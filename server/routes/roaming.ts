import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ag, newClient } from "../src/adguard.js";
import { audit } from "../src/audit.js";
import { requireAdmin } from "../src/auth.js";
import { findCaddyCertificate } from "../src/certs.js";
import { prisma } from "../src/db.js";
import { invalidateDevice, isValidClientId } from "../src/dns.js";
import { dohUrl, dotHostname } from "../src/mobileconfig.js";
import { getRoaming, roamingSchema, setRoaming } from "../src/settings.js";
import { createProfileLink } from "./public.js";
import { HttpError, parse } from "./util.js";

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${base || "geraet"}-${randomBytes(3).toString("hex")}`;
}

function present(device: Awaited<ReturnType<typeof prisma.roamingDevice.findFirstOrThrow>>) {
  return {
    ...device,
    dohUrl: dohUrl(device.clientId),
    dotHost: dotHostname(device.clientId),
    stale: device.enabled && (!device.lastSeenAt || device.lastSeenAt.getTime() < Date.now() - 24 * 3600_000),
  };
}

export async function roamingRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireAdmin);
  const actor = (request: { session?: { email: string } }) => request.session?.email ?? "unknown";

  app.get("/api/roaming", async () => {
    const [settings, devices] = await Promise.all([getRoaming(), prisma.roamingDevice.findMany({ orderBy: { createdAt: "asc" } })]);
    return { settings, devices: devices.map(present), signingAvailable: findCaddyCertificate() !== null };
  });

  app.put("/api/roaming/settings", async (request) => {
    const body = parse(roamingSchema, request.body);
    await setRoaming(body);
    await audit(actor(request), "roaming.settings", body);
    return body;
  });

  app.post("/api/roaming/devices", async (request) => {
    const body = parse(
      z.object({
        name: z.string().min(1).max(64),
        platform: z.enum(["ios", "macos", "android", "windows", "other"]),
        clientId: z.string().max(63).optional(),
        adguardClient: z.string().max(128).nullable().optional(),
      }),
      request.body,
    );
    const clientId = (body.clientId?.trim().toLowerCase() || slugify(body.name)).slice(0, 63);
    if (!isValidClientId(clientId)) throw new HttpError(400, "Die ClientID darf nur a-z, 0-9 und - enthalten (max. 63 Zeichen).");
    if (await prisma.roamingDevice.findUnique({ where: { clientId } })) throw new HttpError(409, "Diese ClientID ist schon vergeben.");

    const list = await ag.clients();
    let linked: string;
    if (body.adguardClient) {
      const existing = (list.clients ?? []).find((entry) => entry.name === body.adguardClient);
      if (!existing) throw new HttpError(404, `AdGuard-Client "${body.adguardClient}" nicht gefunden.`);
      if (!existing.ids.includes(clientId)) await ag.updateClient(existing.name, { ...existing, ids: [...existing.ids, clientId] });
      linked = existing.name;
    } else {
      const taken = new Set((list.clients ?? []).map((entry) => entry.name));
      linked = taken.has(body.name) ? `${body.name} (Roaming)` : body.name;
      await ag.addClient(newClient(linked, [clientId]));
    }

    const device = await prisma.roamingDevice.create({
      data: { name: body.name, platform: body.platform, clientId, adguardClient: linked },
    });
    invalidateDevice(clientId);
    await audit(actor(request), "roaming.device.add", { name: body.name, clientId, adguardClient: linked });
    return present(device);
  });

  app.patch("/api/roaming/devices/:id", async (request) => {
    const { id } = request.params as { id: string };
    const body = parse(z.object({ name: z.string().min(1).max(64).optional(), enabled: z.boolean().optional() }), request.body);
    const device = await prisma.roamingDevice.update({ where: { id }, data: body });
    invalidateDevice(device.clientId);
    await audit(actor(request), "roaming.device.update", { id, ...body });
    return present(device);
  });

  app.post("/api/roaming/devices/:id/delete", async (request) => {
    const { id } = request.params as { id: string };
    const device = await prisma.roamingDevice.findUnique({ where: { id } });
    if (!device) throw new HttpError(404, "Geraet nicht gefunden.");
    try {
      const list = await ag.clients();
      const client = (list.clients ?? []).find((entry) => entry.ids.includes(device.clientId));
      if (client) {
        const ids = client.ids.filter((entry) => entry !== device.clientId);
        if (ids.length === 0) await ag.deleteClient(client.name);
        else await ag.updateClient(client.name, { ...client, ids });
      }
    } catch (error) {
      request.log.warn({ err: error }, "ClientID konnte in AdGuard nicht entfernt werden");
    }
    await prisma.roamingDevice.delete({ where: { id } });
    invalidateDevice(device.clientId);
    await audit(actor(request), "roaming.device.delete", { name: device.name, clientId: device.clientId });
    return { ok: true };
  });

  app.post("/api/roaming/devices/:id/profile-link", async (request) => {
    const { id } = request.params as { id: string };
    const device = await prisma.roamingDevice.findUnique({ where: { id } });
    if (!device) throw new HttpError(404, "Geraet nicht gefunden.");
    return { ...(await createProfileLink(device.id)), signed: findCaddyCertificate() !== null };
  });
}
