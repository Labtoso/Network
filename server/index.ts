import cors from "@fastify/cors";
import Fastify from "fastify";
import { ZodError } from "zod";
import { AdGuardError } from "./src/adguard.js";
import { loadBlockCache } from "./src/blockcache.js";
import { assertProductionConfig, config } from "./src/config.js";
import { prisma } from "./src/db.js";
import { startDotServer } from "./src/dot.js";
import { startScheduler } from "./src/scheduler.js";
import { adguardRoutes } from "./routes/adguard.js";
import { authRoutes } from "./routes/auth.js";
import { dnsQueryRoutes } from "./routes/dns-query.js";
import { publicRoutes } from "./routes/public.js";
import { roamingRoutes } from "./routes/roaming.js";
import { settingsRoutes } from "./routes/settings.js";
import { studioRoutes } from "./routes/studio.js";
import { HttpError } from "./routes/util.js";

const app = Fastify({
  trustProxy: config.trustProxy ? ["127.0.0.1", "::1"] : false,
  bodyLimit: 2 * 1024 * 1024,
  routerOptions: { maxParamLength: 2048 },
  logger: { level: process.env.LOG_LEVEL ?? "info" },
});

const allowedOrigins = new Set([...config.corsOrigins, config.publicUrl]);

await app.register(cors, {
  origin: (origin, callback) => {
    // Ohne Origin: gleiche Herkunft, curl, DoH-Clients. Sonst nur die freigegebenen Frontends.
    if (!origin || allowedOrigins.has(origin.replace(/\/+$/, ""))) return callback(null, true);
    callback(null, false);
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Authorization", "Content-Type"],
  maxAge: 600,
});

app.addHook("onSend", async (_request, reply, payload) => {
  reply.header("X-Content-Type-Options", "nosniff");
  reply.header("Referrer-Policy", "no-referrer");
  return payload;
});

app.setErrorHandler((error, request, reply) => {
  if (error instanceof HttpError || error instanceof AdGuardError) {
    return reply.code(error.status).send({ error: error.message });
  }
  if (error instanceof ZodError) {
    return reply.code(400).send({ error: error.issues[0]?.message ?? "Ungueltige Eingabe." });
  }
  const status = (error as { statusCode?: number }).statusCode;
  if (status && status >= 400 && status < 500) {
    return reply.code(status).send({ error: (error as Error).message });
  }
  if ((error as { code?: string }).code === "P2025") {
    return reply.code(404).send({ error: "Eintrag nicht gefunden." });
  }
  request.log.error({ err: error }, "Unbehandelter Fehler");
  return reply.code(500).send({ error: "Interner Serverfehler." });
});

await app.register(publicRoutes);
await app.register(dnsQueryRoutes);
await app.register(authRoutes);
await app.register(adguardRoutes);
await app.register(roamingRoutes);
await app.register(studioRoutes);
await app.register(settingsRoutes);

for (const problem of assertProductionConfig()) app.log.warn(problem);

await loadBlockCache();
startScheduler({ info: (msg) => app.log.info(msg), warn: (msg) => app.log.warn(msg) });
startDotServer((msg) => app.log.info(msg));

const shutdown = async (signal: string) => {
  app.log.info(`${signal} empfangen, beende...`);
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

await app.listen({ host: config.host, port: config.port });
