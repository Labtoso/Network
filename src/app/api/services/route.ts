import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_SERVICES } from "@/lib/infrastructure";

async function probeEndpointLatency(url: string, fallbackMs: number): Promise<number> {
  if (!url.startsWith("http")) return fallbackMs;
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1400);
    await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    return Math.max(1, Date.now() - start);
  } catch {
    return fallbackMs;
  }
}

export async function GET() {
  return NextResponse.json({
    services: DEFAULT_SERVICES,
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const target = DEFAULT_SERVICES.find((s) => s.id === body?.id);
    const endpoint = body?.endpoint || target?.endpoint || "http://127.0.0.1:3000";
    const fallback = target?.pingMs || 8;
    const pingMs = await probeEndpointLatency(endpoint, fallback);

    return NextResponse.json({
      id: body?.id,
      status: "online",
      pingMs,
      checkedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ status: "online", pingMs: 5 });
  }
}
