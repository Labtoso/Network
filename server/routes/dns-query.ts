import type { FastifyInstance, FastifyReply } from "fastify";
import { resolveDns } from "../src/dns.js";

const MAX_DNS_MESSAGE = 65_535;

/**
 * DNS-over-HTTPS nach RFC 8484 unter /dns-query/{client_id}.
 * Caddy terminiert TLS und leitet hierher; das Backend reicht an AdGuard weiter.
 */
export async function dnsQueryRoutes(app: FastifyInstance): Promise<void> {
  app.addContentTypeParser("application/dns-message", { parseAs: "buffer", bodyLimit: MAX_DNS_MESSAGE }, (_req, body, done) => {
    done(null, body);
  });

  const answer = async (reply: FastifyReply, clientId: string, wire: Buffer) => {
    const result = await resolveDns(clientId.toLowerCase(), wire, "doh");
    reply.header("Content-Type", "application/dns-message");
    reply.header("Cache-Control", "no-store");
    if (result.offline) reply.header("X-Network-Offline", "1");
    return reply.code(200).send(result.body);
  };

  app.get("/dns-query/:clientId", async (request, reply) => {
    const { clientId } = request.params as { clientId: string };
    const { dns } = request.query as { dns?: string };
    if (!dns) return reply.code(400).type("text/plain").send("Parameter ?dns= fehlt (RFC 8484).");
    const wire = Buffer.from(dns, "base64url");
    if (wire.length < 12 || wire.length > MAX_DNS_MESSAGE) return reply.code(400).send("Ungueltige DNS-Nachricht.");
    return answer(reply, clientId, wire);
  });

  app.post("/dns-query/:clientId", async (request, reply) => {
    const { clientId } = request.params as { clientId: string };
    const body = request.body;
    if (!Buffer.isBuffer(body) || body.length < 12) {
      return reply.code(415).type("text/plain").send("Content-Type application/dns-message erwartet.");
    }
    return answer(reply, clientId, body);
  });

  app.all("/dns-query", async (_request, reply) =>
    reply
      .code(400)
      .type("text/plain")
      .send("Jedes Geraet nutzt eine eigene Adresse: /dns-query/<client-id>. Lege das Geraet im Panel unter Geraete > Roaming an."),
  );
}
