"use client";

import { Check, Clock, X } from "lucide-react";
import { useEffect } from "react";
import { api } from "@/lib/api";
import { relative, formatDateTime } from "@/lib/format";
import { useApp, useResource } from "@/lib/store";
import type { AccessRequest } from "@/lib/types";
import { Badge, Button, Empty, ErrorBox, Spinner } from "./ui";

const DURATIONS = [
  { minutes: 15, label: "15 Min" },
  { minutes: 60, label: "1 Std" },
  { minutes: 240, label: "4 Std" },
];

export function AccessRequests({ status = "pending", compact = false, onChange }: { status?: "pending" | "all"; compact?: boolean; onChange?(): void }) {
  const { run } = useApp();
  const { data, error, loading, reload } = useResource<{ requests: AccessRequest[] }>(`/api/access-requests?status=${status}`);

  useEffect(() => {
    const timer = setInterval(reload, 15_000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const rows = data?.requests ?? [];
  if (rows.length === 0) return <Empty>{status === "pending" ? "Keine offenen Freigabe-Anfragen." : "Noch keine Anfragen."}</Empty>;

  const act = async (id: string, action: "approve" | "deny", minutes?: number) => {
    const ok = await run(
      () => api(`/api/access-requests/${id}/${action}`, { body: action === "approve" ? { minutes, scope: "client" } : {} }),
      action === "approve" ? `Freigegeben fuer ${minutes} Minuten` : "Anfrage abgelehnt",
    );
    if (ok) {
      reload();
      onChange?.();
    }
  };

  return (
    <ul className="space-y-2">
      {rows.slice(0, compact ? 5 : 200).map((row) => (
        <li key={row.id} className="rounded-xl border border-line bg-bg/40 p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="break-all font-mono text-sm text-accent">{row.domain}</p>
              <p className="mt-0.5 text-xs text-dim">
                {row.clientName ?? row.clientIp} · {relative(row.createdAt)}
              </p>
              {row.message && <p className="mt-1.5 text-sm text-fg">&bdquo;{row.message}&ldquo;</p>}
            </div>
            <Badge tone={row.status === "pending" ? "warn" : row.status === "approved" ? "ok" : "neutral"}>
              {row.status === "pending" ? "offen" : row.status === "approved" ? "frei" : row.status === "denied" ? "abgelehnt" : "abgelaufen"}
            </Badge>
          </div>
          {row.status === "approved" && row.expiresAt && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-dim"><Clock className="h-3.5 w-3.5" /> frei bis {formatDateTime(row.expiresAt)}</p>
          )}
          {(row.status === "pending" || row.status === "approved") && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {DURATIONS.map((d) => (
                <Button key={d.minutes} size="sm" variant={row.status === "pending" ? "primary" : "outline"} icon={<Check className="h-3.5 w-3.5" />} onClick={() => act(row.id, "approve", d.minutes)}>
                  {d.label}
                </Button>
              ))}
              <Button size="sm" variant="danger" icon={<X className="h-3.5 w-3.5" />} onClick={() => act(row.id, "deny")}>
                {row.status === "approved" ? "Widerrufen" : "Ablehnen"}
              </Button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
