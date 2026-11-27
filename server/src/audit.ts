import { prisma } from "./db.js";

export async function audit(actor: string, action: string, detail: unknown): Promise<void> {
  const text = typeof detail === "string" ? detail : JSON.stringify(detail);
  await prisma.auditLog.create({ data: { actor, action, detail: text.slice(0, 4000) } });
}
