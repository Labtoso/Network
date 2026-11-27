"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

export function QrCode({ value, size = 200 }: { value: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, { margin: 1, width: size * 2, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } })
      .then((url) => !cancelled && setSrc(url))
      .catch(() => setSrc(null));
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (!src) return <div className="animate-pulse rounded-xl bg-fg/10" style={{ width: size, height: size }} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={`QR-Code: ${value}`} width={size} height={size} className="rounded-xl border-4 border-white bg-white" />;
}
