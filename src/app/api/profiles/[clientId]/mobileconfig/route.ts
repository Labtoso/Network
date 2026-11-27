import { NextRequest, NextResponse } from "next/server";
import { getNetworkState } from "@/lib/db";
import { generateAppleMobileConfig } from "@/lib/roaming-profiles";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await context.params;
  const url = new URL(request.url);
  const protocol = url.searchParams.get("proto") === "dot" ? "dot" : "doh";

  const state = getNetworkState();
  const device =
    state.devices.find((d) => d.id === clientId) || state.devices[0];

  const xml = generateAppleMobileConfig(device, state.policy, protocol);

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/x-apple-aspen-config; charset=utf-8",
      "Content-Disposition": `attachment; filename="labtoso-roaming-${device.id}-${protocol}.mobileconfig"`,
      "Cache-Control": "no-store",
    },
  });
}
