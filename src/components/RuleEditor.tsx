"use client";

import { useMemo, useRef } from "react";

function escape(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Prueft eine AdGuard-Regelzeile grob auf typische Fehler. Gibt eine Meldung oder null zurueck. */
export function lintRule(line: string): string | null {
  const rule = line.trim();
  if (!rule || rule.startsWith("!") || rule.startsWith("#")) return null;
  if (/^\/.*\/$/.test(rule)) {
    try {
      new RegExp(rule.slice(1, -1));
      return null;
    } catch {
      return "Ungueltiger regulaerer Ausdruck";
    }
  }
  if (/\s/.test(rule) && !/^(\d{1,3}\.){3}\d{1,3}\s+\S+$/.test(rule) && !/^[0-9a-f:]+\s+\S+$/i.test(rule) && !rule.includes("$")) return "Leerzeichen in Regel";
  if (rule.startsWith("||") && !/[\^$|*]/.test(rule.slice(2)) && rule.length > 2) return "Tipp: Regel mit ^ abschliessen, z. B. ||domain.de^";
  if ((rule.match(/\$/g) ?? []).length > 1 && !rule.startsWith("/")) return "Mehr als ein $ (Modifier mit Komma trennen)";
  return null;
}

function highlight(line: string): string {
  const trimmed = line.trim();
  if (trimmed.startsWith("!") || trimmed.startsWith("#")) return `<span class="tok-comment">${escape(line)}</span>`;
  if (/^\/.*\/$/.test(trimmed)) return `<span class="tok-regex">${escape(line)}</span>`;
  let rest = line;
  let html = "";
  if (rest.startsWith("@@")) {
    html += `<span class="tok-allow">@@</span>`;
    rest = rest.slice(2);
  }
  const dollar = rest.indexOf("$");
  const body = dollar >= 0 ? rest.slice(0, dollar) : rest;
  const modifiers = dollar >= 0 ? rest.slice(dollar) : "";
  html += escape(body)
    .replace(/^(\|\|?)/, '<span class="tok-anchor">$1</span>')
    .replace(/(\^|\|)$/, '<span class="tok-anchor">$1</span>')
    .replace(/^(\d{1,3}(?:\.\d{1,3}){3})(\s+)/, '<span class="tok-host">$1</span>$2');
  if (modifiers) html += `<span class="tok-mod">${escape(modifiers)}</span>`;
  const lint = lintRule(line);
  return lint ? `<span class="tok-error" title="${escape(lint)}">${html}</span>` : html;
}

/** Leichter Code-Editor mit Zeilennummern und Syntax-Highlighting fuer AdGuard-Filtersyntax bzw. HTML. */
export function CodeEditor({ value, onChange, language = "adguard", minHeight = 360 }: { value: string; onChange(value: string): void; language?: "adguard" | "html"; minHeight?: number }) {
  const pre = useRef<HTMLPreElement>(null);
  const gutter = useRef<HTMLDivElement>(null);
  const lines = value.split("\n");

  const html = useMemo(() => {
    if (language === "html") {
      return escape(value)
        .replace(/(&lt;\/?)([a-zA-Z0-9-]+)/g, '$1<span class="tok-tag">$2</span>')
        .replace(/([a-zA-Z-:]+)=(&quot;|")(.*?)(\2)/g, '<span class="tok-attr">$1</span>=<span class="tok-str">"$3"</span>')
        .replace(/(\{(?:domain|client_name|time_remaining)\})/g, '<span class="tok-mod">$1</span>');
    }
    return lines.map(highlight).join("\n");
  }, [value, lines, language]);

  const sync = (target: HTMLTextAreaElement) => {
    if (pre.current) {
      pre.current.scrollTop = target.scrollTop;
      pre.current.scrollLeft = target.scrollLeft;
    }
    if (gutter.current) gutter.current.scrollTop = target.scrollTop;
  };

  return (
    <div className="code-editor relative flex overflow-hidden rounded-xl border border-line bg-bg/80" style={{ height: minHeight }}>
      <div ref={gutter} aria-hidden="true" className="w-11 shrink-0 select-none overflow-hidden border-r border-line/60 bg-bg/60 py-3 pr-2 text-right font-mono text-[11px] leading-[1.6] text-dim/70" style={{ fontSize: 13 }}>
        {lines.map((_, i) => (
          <div key={i}>{i + 1}</div>
        ))}
      </div>
      <div className="relative flex-1">
        <pre ref={pre} aria-hidden="true" className="pointer-events-none absolute inset-0 m-0 overflow-hidden p-3 text-fg" dangerouslySetInnerHTML={{ __html: `${html}\n` }} />
        <textarea
          value={value}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          onChange={(e) => onChange(e.target.value)}
          onScroll={(e) => sync(e.currentTarget)}
          onKeyDown={(e) => {
            if (e.key === "Tab") {
              e.preventDefault();
              const el = e.currentTarget;
              const start = el.selectionStart;
              const next = `${value.slice(0, start)}  ${value.slice(el.selectionEnd)}`;
              onChange(next);
              requestAnimationFrame(() => el.setSelectionRange(start + 2, start + 2));
            }
          }}
          className="absolute inset-0 h-full w-full resize-none overflow-auto bg-transparent p-3 text-transparent caret-[rgb(var(--accent))] outline-none selection:bg-accent/30"
        />
      </div>
    </div>
  );
}
