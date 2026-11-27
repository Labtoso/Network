import { ag, type AdGuardClient, type Schedule } from "./adguard.js";
import type { BlockPageConfig } from "./settings.js";

export const BLOCK_THEMES: Record<BlockPageConfig["theme"], { bg: string; panel: string; fg: string; dim: string; accent: string; accent2: string; glyphs: string }> = {
  matrix: { bg: "#050505", panel: "#0a0f0a", fg: "#d1fae5", dim: "#4d7c5a", accent: "#00ff41", accent2: "#00b32d", glyphs: "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789" },
  "cyber-terminal": { bg: "#0a0700", panel: "#110c02", fg: "#ffe2a8", dim: "#8a6a2a", accent: "#ffb000", accent2: "#cc8400", glyphs: "0123456789ABCDEF<>/\\|[]{}#$%&*+=" },
  "midnight-obsidian": { bg: "#050608", panel: "#0b0e13", fg: "#e2e8f0", dim: "#475569", accent: "#38bdf8", accent2: "#0ea5e9", glyphs: "0123456789abcdef.:-+*" },
  "neon-tokyo": { bg: "#05030f", panel: "#0d0920", fg: "#f5e9ff", dim: "#6b5b95", accent: "#22d3ee", accent2: "#f0abfc", glyphs: "ネオン東京夜光電脳都市0123456789#@%" },
  bioluminescence: { bg: "#020a07", panel: "#06140f", fg: "#d1fae5", dim: "#2f6b55", accent: "#10b981", accent2: "#34d399", glyphs: "·•∘○◦°⁘⁙⋅∙" },
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatDuration(ms: number | null): string {
  if (ms === null) return "unbestimmt";
  const totalMinutes = Math.max(0, Math.ceil(ms / 60_000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days} T`);
  if (hours) parts.push(`${hours} Std`);
  parts.push(`${minutes} Min`);
  return parts.join(" ");
}

export interface BlockVars {
  domain: string;
  clientName: string;
  remainingMs: number | null;
}

function substitute(text: string, vars: BlockVars): string {
  return escapeHtml(text)
    .replace(/\{domain\}/g, `<span data-var="domain">${escapeHtml(vars.domain)}</span>`)
    .replace(/\{client_name\}/g, `<span data-var="client">${escapeHtml(vars.clientName)}</span>`)
    .replace(/\{time_remaining\}/g, `<span data-countdown>${escapeHtml(formatDuration(vars.remainingMs))}</span>`);
}

function runtimeScript(vars: BlockVars, preview: boolean): string {
  const data = JSON.stringify({ domain: vars.domain, remainingMs: vars.remainingMs, preview }).replace(/</g, "\\u003c");
  return `<script>
(function(){
  var D=${data};
  var end=D.remainingMs===null?null:Date.now()+D.remainingMs;
  function fmt(ms){if(ms===null)return"unbestimmt";var t=Math.max(0,Math.ceil(ms/1000)),d=Math.floor(t/86400),h=Math.floor(t%86400/3600),m=Math.floor(t%3600/60),s=t%60;function p(n){return(n<10?"0":"")+n}return(d?d+" T ":"")+p(h)+":"+p(m)+":"+p(s)}
  function tick(){var els=document.querySelectorAll("[data-countdown]");for(var i=0;i<els.length;i++)els[i].textContent=fmt(end===null?null:end-Date.now());}
  tick();setInterval(tick,1000);
  function status(text){var el=document.querySelector("[data-request-status]");if(el)el.textContent=text;}
  function poll(id){setTimeout(function(){fetch("/api/public/access-request/"+encodeURIComponent(id)).then(function(r){return r.json()}).then(function(r){
    if(r.status==="approved"){status("Freigegeben bis "+new Date(r.expiresAt).toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"})+". Seite wird neu geladen…");setTimeout(function(){location.href="http://"+D.domain+"/"},4000);}
    else if(r.status==="denied"){status("Die Anfrage wurde abgelehnt.");}
    else poll(id);
  }).catch(function(){poll(id)})},4000);}
  window.NETWORK={requestAccess:function(message){
    if(D.preview){status("Vorschau: Anfrage wuerde jetzt an den Admin gesendet.");return;}
    status("Anfrage wird gesendet…");
    fetch("/api/public/access-request",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({domain:D.domain,message:message||""})})
      .then(function(r){return r.json().then(function(b){if(!r.ok)throw new Error(b.error||"Fehler");return b})})
      .then(function(b){status("Anfrage gesendet. Warte auf Freigabe…");poll(b.id)})
      .catch(function(e){status(e.message)});
  }};
  document.addEventListener("click",function(e){var t=e.target.closest&&e.target.closest("[data-request-access]");if(!t)return;e.preventDefault();var input=document.querySelector("[data-request-message]");window.NETWORK.requestAccess(input?input.value:"");});
})();
</script>`;
}

function canvasScript(theme: (typeof BLOCK_THEMES)[keyof typeof BLOCK_THEMES]): string {
  return `<canvas id="bg" aria-hidden="true"></canvas><script>
(function(){var c=document.getElementById("bg"),x=c.getContext("2d"),g=${JSON.stringify(theme.glyphs)},f=16,cols=[],w,h;
function rs(){w=c.width=innerWidth;h=c.height=innerHeight;cols=[];for(var i=0;i<Math.ceil(w/f);i++)cols.push(Math.random()*h/f)}
rs();addEventListener("resize",rs);
function draw(){x.fillStyle="rgba(0,0,0,0.08)";x.fillRect(0,0,w,h);x.font=f+"px monospace";
for(var i=0;i<cols.length;i++){var ch=g[Math.floor(Math.random()*g.length)];x.fillStyle=Math.random()>0.975?"${theme.fg}":"${theme.accent}";x.globalAlpha=0.55;x.fillText(ch,i*f,cols[i]*f);x.globalAlpha=1;if(cols[i]*f>h&&Math.random()>0.975)cols[i]=0;cols[i]+=0.6}
requestAnimationFrame(draw)}
if(!matchMedia("(prefers-reduced-motion: reduce)").matches)draw();})();
</script>`;
}

export function renderBlockPage(cfg: BlockPageConfig, vars: BlockVars, options: { preview: boolean }): string {
  const theme = BLOCK_THEMES[cfg.theme] ?? BLOCK_THEMES.matrix;

  if (cfg.expertMode && cfg.customHtml.trim()) {
    // Im Experten-Modus ist HTML erlaubt: nur die Variablen werden escaped eingesetzt.
    let html = cfg.customHtml
      .replace(/\{domain\}/g, escapeHtml(vars.domain))
      .replace(/\{client_name\}/g, escapeHtml(vars.clientName))
      .replace(/\{time_remaining\}/g, `<span data-countdown>${escapeHtml(formatDuration(vars.remainingMs))}</span>`);
    const head = `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script src="https://cdn.tailwindcss.com/3.4.17"></script>`;
    const runtime = runtimeScript(vars, options.preview);
    if (/<head[^>]*>/i.test(html)) html = html.replace(/<head[^>]*>/i, (m) => `${m}${head}`);
    else html = `<!doctype html><html lang="de"><head>${head}</head><body>${html}</body></html>`;
    return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${runtime}</body>`) : `${html}${runtime}`;
  }

  const levelColor = cfg.alertLevel === "critical" ? "#ef4444" : cfg.alertLevel === "info" ? theme.accent : "#f59e0b";
  const rows: string[] = [];
  if (cfg.showDomain) rows.push(`<div class="row"><span>Domain</span><code>${escapeHtml(vars.domain)}</code></div>`);
  if (cfg.showClient) rows.push(`<div class="row"><span>Gerät</span><code>${escapeHtml(vars.clientName)}</code></div>`);
  if (cfg.showCountdown) rows.push(`<div class="row"><span>Sperre endet in</span><code data-countdown>${escapeHtml(formatDuration(vars.remainingMs))}</code></div>`);

  const request = cfg.showRequestButton
    ? `<div class="req"><p class="hint">${substitute(cfg.requestHint, vars)}</p>
       <textarea data-request-message maxlength="300" rows="2" placeholder="Warum brauchst du die Seite? (optional)"></textarea>
       <button data-request-access>Zugang anfordern</button><p class="status" data-request-status></p></div>`
    : "";

  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${escapeHtml(cfg.title)}</title>
<style>
*{box-sizing:border-box}html,body{margin:0;height:100%;background:${theme.bg};color:${theme.fg};font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
#bg{position:fixed;inset:0;width:100%;height:100%;opacity:.35}
main{position:relative;min-height:100%;display:flex;align-items:center;justify-content:center;padding:24px 16px}
.card{width:100%;max-width:460px;background:${theme.panel}e6;border:1px solid ${theme.accent}33;border-radius:16px;padding:28px;backdrop-filter:blur(12px);box-shadow:0 0 60px ${theme.accent}14}
.badge{display:inline-flex;align-items:center;gap:8px;font:600 11px/1 ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase;color:${levelColor};border:1px solid ${levelColor}55;border-radius:999px;padding:6px 10px}
.dot{width:7px;height:7px;border-radius:50%;background:${levelColor};box-shadow:0 0 10px ${levelColor};animation:p 1.6s infinite}@keyframes p{50%{opacity:.3}}
h1{font-size:28px;line-height:1.15;margin:18px 0 10px;letter-spacing:-.02em}
.alert{color:${theme.fg}cc;line-height:1.55;margin:0 0 20px}
.row{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-top:1px solid ${theme.accent}1f;font-size:14px}
.row span{color:${theme.dim}}.row code{font-family:ui-monospace,"JetBrains Mono",monospace;color:${theme.accent};word-break:break-all;text-align:right}
.req{margin-top:20px;padding-top:18px;border-top:1px solid ${theme.accent}1f}.hint{font-size:13px;color:${theme.dim};margin:0 0 10px;line-height:1.5}
textarea{width:100%;background:#00000066;border:1px solid ${theme.accent}33;border-radius:10px;color:${theme.fg};padding:10px;font:inherit;font-size:14px;resize:none}
button{margin-top:10px;width:100%;border:0;border-radius:10px;padding:13px;font:600 15px/1 inherit;background:${theme.accent};color:${theme.bg};cursor:pointer}
button:active{transform:scale(.99)}.status{font-size:13px;color:${theme.accent};min-height:18px;margin:10px 0 0}
footer{margin-top:22px;font-size:11px;color:${theme.dim};text-align:center}
</style></head>
<body>${canvasScript(theme)}
<main><div class="card">
<span class="badge"><span class="dot"></span>${cfg.alertLevel === "critical" ? "Kritisch" : cfg.alertLevel === "info" ? "Hinweis" : "Gesperrt"}</span>
<h1>${substitute(cfg.title, vars)}</h1>
<p class="alert">${substitute(cfg.alert, vars)}</p>
${rows.join("")}
${request}
<footer>${substitute(cfg.footer, vars)}</footer>
</div></main>
${runtimeScript(vars, options.preview)}
</body></html>`;
}

/* ---------- Zuordnung anfragender Geraete und Restzeit aus dem AdGuard-Zeitplan ---------- */

let clientCache: { at: number; clients: AdGuardClient[]; auto: { ip: string; name: string }[]; global?: Schedule } | null = null;

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function idMatchesIp(id: string, ip: string): boolean {
  if (id === ip) return true;
  const [net, bitsText] = id.split("/");
  const bits = Number(bitsText);
  const a = ipv4ToInt(net);
  const b = ipv4ToInt(ip);
  if (a === null || b === null || !Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (a & mask) === (b & mask);
}

export async function identifyClient(ip: string): Promise<{ name: string; client: AdGuardClient | null; schedule?: Schedule }> {
  try {
    if (!clientCache || clientCache.at < Date.now() - 60_000) {
      const [list, services] = await Promise.all([ag.clients(), ag.servicesGet()]);
      clientCache = { at: Date.now(), clients: list.clients ?? [], auto: list.auto_clients ?? [], global: services.schedule };
    }
    const client = clientCache.clients.find((entry) => entry.ids.some((id) => idMatchesIp(id, ip))) ?? null;
    if (client) {
      return { name: client.name, client, schedule: client.use_global_blocked_services ? clientCache.global : client.blocked_services_schedule };
    }
    const auto = clientCache.auto.find((entry) => entry.ip === ip);
    return { name: auto?.name || ip, client: null, schedule: clientCache.global };
  } catch {
    return { name: ip, client: null };
  }
}

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

function zonedNow(timeZone: string): { day: number; msOfDay: number } {
  const zone = !timeZone || timeZone === "Local" ? undefined : timeZone;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  const msOfDay = ((Number(get("hour")) * 60 + Number(get("minute"))) * 60 + Number(get("second"))) * 1000;
  return { day: day < 0 ? 0 : day, msOfDay };
}

/**
 * AdGuard-Zeitplaene beschreiben Pausen der Dienst-Sperre. Die Restzeit ist daher die Zeit
 * bis zum Beginn des naechsten Pausenfensters. Ohne Zeitplan: null (unbestimmt).
 */
export function remainingFromSchedule(schedule?: Schedule): number | null {
  if (!schedule) return null;
  const spans = DAYS.map((day) => schedule[day]);
  if (!spans.some(Boolean)) return null;
  const now = zonedNow(schedule.time_zone ?? "Local");
  for (let offset = 0; offset < 8; offset += 1) {
    const span = spans[(now.day + offset) % 7];
    if (!span) continue;
    const startFromNow = offset * 86_400_000 + span.start - now.msOfDay;
    if (offset === 0 && span.start <= now.msOfDay && now.msOfDay < span.end) return 0;
    if (startFromNow > 0) return startFromNow;
  }
  return null;
}
