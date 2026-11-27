import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ag } from "../src/adguard.js";
import { audit } from "../src/audit.js";
import { requireAdmin } from "../src/auth.js";
import { renderBlockPage } from "../src/blockpage.js";
import { prisma } from "../src/db.js";
import { blockPageSchema, getBlockPage, getGeneral, setBlockPage } from "../src/settings.js";
import { HttpError, clientModifier, parse } from "./util.js";

export async function studioRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireAdmin);
  const actor = (request: { session?: { email: string } }) => request.session?.email ?? "unknown";

  app.get("/api/blockpage", async () => getBlockPage());

  app.put("/api/blockpage", async (request) => {
    const body = parse(blockPageSchema, request.body);
    if (body.mode === "redirect" && !/^https?:\/\//i.test(body.redirectUrl)) {
      throw new HttpError(400, "Fuer den Redirect-Modus wird eine http(s)-URL benoetigt.");
    }
    await setBlockPage(body);
    await audit(actor(request), "blockpage.save", { mode: body.mode, expert: body.expertMode });
    return body;
  });

  app.post("/api/blockpage/preview", async (request) => {
    const body = parse(
      z.object({ config: blockPageSchema, domain: z.string().max(253).default("tiktok.com"), clientName: z.string().max(128).default("iPhone von Max"), remainingMinutes: z.number().int().min(0).max(100_000).nullable().default(95) }),
      request.body,
    );
    return {
      html: renderBlockPage(
        body.config,
        { domain: body.domain, clientName: body.clientName, remainingMs: body.remainingMinutes === null ? null : body.remainingMinutes * 60_000 },
        { preview: true },
      ),
    };
  });

  /* ---------- Freigabe-Anfragen ---------- */
  app.get("/api/access-requests", async (request) => {
    const { status } = parse(z.object({ status: z.enum(["pending", "approved", "denied", "expired", "all"]).default("all") }), request.query);
    const rows = await prisma.accessRequest.findMany({
      where: status === "all" ? {} : { status },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return { requests: rows };
  });

  app.post("/api/access-requests/:id/approve", async (request) => {
    const { id } = request.params as { id: string };
    const general = await getGeneral();
    const body = parse(
      z.object({ minutes: z.number().int().min(5).max(10_080).default(general.accessDefaultMinutes), scope: z.enum(["client", "all"]).default("client") }),
      request.body,
    );
    const row = await prisma.accessRequest.findUnique({ where: { id } });
    if (!row) throw new HttpError(404, "Anfrage nicht gefunden.");
    if (row.status !== "pending" && row.status !== "approved") throw new HttpError(409, "Diese Anfrage ist schon abgeschlossen.");

    const target = body.scope === "client" ? row.clientName ?? row.clientIp : null;
    const ruleText = target ? `@@||${row.domain}^$client=${clientModifier(target)},important` : `@@||${row.domain}^$important`;
    const filtering = await ag.filtering();
    const rules = filtering.user_rules ?? [];
    if (!rules.includes(ruleText)) await ag.setUserRules([...rules, ruleText]);

    const updated = await prisma.accessRequest.update({
      where: { id },
      data: { status: "approved", decidedAt: new Date(), expiresAt: new Date(Date.now() + body.minutes * 60_000), ruleText },
    });
    await audit(actor(request), "access.approve", { domain: row.domain, client: target, minutes: body.minutes });
    return updated;
  });

  app.post("/api/access-requests/:id/deny", async (request) => {
    const { id } = request.params as { id: string };
    const row = await prisma.accessRequest.findUnique({ where: { id } });
    if (!row) throw new HttpError(404, "Anfrage nicht gefunden.");
    if (row.status === "approved" && row.ruleText) {
      const filtering = await ag.filtering();
      await ag.setUserRules((filtering.user_rules ?? []).filter((rule) => rule !== row.ruleText));
    }
    const updated = await prisma.accessRequest.update({ where: { id }, data: { status: "denied", decidedAt: new Date(), expiresAt: null } });
    await audit(actor(request), "access.deny", { domain: row.domain, client: row.clientName ?? row.clientIp });
    return updated;
  });
}
