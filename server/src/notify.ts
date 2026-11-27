import { getGeneral } from "./settings.js";

/**
 * Optionale Push-Benachrichtigung bei neuen Freigabe-Anfragen.
 * Kompatibel mit ntfy.sh / eigenem ntfy-Server (POST mit Text-Body und Title-Header)
 * und jedem Webhook, der einen POST mit Text annimmt.
 */
export async function notifyAdmin(title: string, message: string, clickUrl?: string): Promise<void> {
  const { notifyUrl } = await getGeneral();
  if (!notifyUrl) return;
  try {
    await fetch(notifyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        Title: title.replace(/[^\x20-\x7E]/g, "?"),
        Tags: "shield",
        ...(clickUrl ? { Click: clickUrl } : {}),
      },
      body: message,
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    /* Benachrichtigung ist optional; Fehler blockieren die Anfrage nicht. */
  }
}
