import type { z } from "zod";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function parse<T extends z.ZodTypeAny>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value ?? {});
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new HttpError(400, `Ungueltige Eingabe bei "${issue.path.join(".") || "body"}": ${issue.message}`);
  }
  return result.data;
}

/** Erzeugt eine AdGuard-$client-Angabe; Namen mit Sonderzeichen werden gequotet. */
export function clientModifier(client: string): string {
  if (/^[0-9a-f.:/]+$/i.test(client)) return client;
  return `'${client.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}
