"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Loader2, X } from "lucide-react";
import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export function Card({ children, className, title, icon, action }: { children: ReactNode; className?: string; title?: string; icon?: ReactNode; action?: ReactNode }) {
  return (
    <section className={cx("rounded-2xl border border-line bg-panel/80 p-4 backdrop-blur-md sm:p-5", className)}>
      {(title || action) && (
        <header className="mb-4 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-fg">
            {icon && <span className="text-accent">{icon}</span>}
            {title}
          </h2>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

type ButtonVariant = "primary" | "ghost" | "danger" | "outline";

export function Button({
  variant = "outline",
  loading,
  icon,
  children,
  className,
  size = "md",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; loading?: boolean; icon?: ReactNode; size?: "sm" | "md" }) {
  const styles: Record<ButtonVariant, string> = {
    primary: "bg-accent text-bg hover:brightness-110 border-transparent font-semibold",
    outline: "border-line bg-bg/40 text-fg hover:border-accent/60 hover:text-accent",
    ghost: "border-transparent text-dim hover:text-fg hover:bg-fg/5",
    danger: "border-danger/40 text-danger hover:bg-danger/10",
  };
  return (
    <button
      type="button"
      {...rest}
      disabled={rest.disabled || loading}
      className={cx(
        "inline-flex select-none items-center justify-center gap-2 rounded-xl border transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-8 px-2.5 text-xs" : "h-10 px-3.5 text-sm",
        styles[variant],
        className,
      )}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

export function Toggle({ checked, onChange, label, description, disabled }: { checked: boolean; onChange(value: boolean): void; label?: ReactNode; description?: ReactNode; disabled?: boolean }) {
  return (
    <label className={cx("flex cursor-pointer items-start justify-between gap-4", disabled && "cursor-not-allowed opacity-60")}>
      {(label || description) && (
        <span className="min-w-0">
          {label && <span className="block text-sm text-fg">{label}</span>}
          {description && <span className="mt-0.5 block text-xs leading-relaxed text-dim">{description}</span>}
        </span>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx("relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition", checked ? "border-accent bg-accent/80" : "border-line bg-bg")}
      >
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 500, damping: 32 }}
          className={cx("absolute top-0.5 h-[18px] w-[18px] rounded-full", checked ? "right-0.5 bg-bg" : "left-0.5 bg-dim")}
        />
      </button>
    </label>
  );
}

export function Checkbox({ checked, onChange, label, description }: { checked: boolean; onChange(value: boolean): void; label: ReactNode; description?: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[rgb(var(--accent))]" />
      <span>
        <span className="block font-mono text-sm text-fg">{label}</span>
        {description && <span className="mt-0.5 block text-xs leading-relaxed text-dim">{description}</span>}
      </span>
    </label>
  );
}

const fieldClass = "w-full rounded-xl border border-line bg-bg/60 px-3 py-2 text-sm text-fg placeholder:text-dim/70 outline-none transition focus:border-accent/70 focus:ring-2 focus:ring-accent/20";

export function Input({ label, hint, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: ReactNode }) {
  return (
    <label className={cx("block", className)}>
      {label && <span className="mb-1.5 block text-xs font-medium text-dim">{label}</span>}
      <input {...rest} className={cx(fieldClass, rest.type === "url" || rest.inputMode === "url" ? "font-mono" : "")} />
      {hint && <span className="mt-1 block text-xs text-dim">{hint}</span>}
    </label>
  );
}

export function TextArea({ label, hint, className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; hint?: ReactNode }) {
  return (
    <label className={cx("block", className)}>
      {label && <span className="mb-1.5 block text-xs font-medium text-dim">{label}</span>}
      <textarea {...rest} className={cx(fieldClass, "resize-y")} />
      {hint && <span className="mt-1 block text-xs text-dim">{hint}</span>}
    </label>
  );
}

export function Select({ label, children, className, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <label className={cx("block", className)}>
      {label && <span className="mb-1.5 block text-xs font-medium text-dim">{label}</span>}
      <select {...rest} className={cx(fieldClass, "appearance-none")}>
        {children}
      </select>
    </label>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "ok" | "warn" | "danger" | "accent" }) {
  const tones = {
    neutral: "border-line text-dim",
    ok: "border-ok/40 text-ok",
    warn: "border-warn/40 text-warn",
    danger: "border-danger/40 text-danger",
    accent: "border-accent/40 text-accent",
  };
  return <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider", tones[tone])}>{children}</span>;
}

export function StatusDot({ ok, pulse }: { ok: boolean | null; pulse?: boolean }) {
  const color = ok === null ? "bg-dim" : ok ? "bg-ok" : "bg-danger";
  return (
    <span className="relative inline-flex h-2.5 w-2.5">
      {pulse && ok && <span className={cx("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", color)} />}
      <span className={cx("relative inline-flex h-2.5 w-2.5 rounded-full", color)} />
    </span>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-dim">
      <Loader2 className="h-4 w-4 animate-spin text-accent" />
      {label ?? "Lade…"}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
      <span>{message}</span>
      {onRetry && (
        <Button size="sm" variant="danger" onClick={onRetry}>
          Erneut versuchen
        </Button>
      )}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-dim">{children}</div>;
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose(): void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
            className="relative max-h-[88vh] w-full overflow-y-auto rounded-t-3xl border border-line bg-panel p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-glow sm:max-w-xl sm:rounded-3xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold">{title}</h3>
              <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-dim hover:bg-fg/5 hover:text-fg" aria-label="Schliessen">
                <X className="h-5 w-5" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange(value: NoInfer<T>): void; items: { id: NoInfer<T>; label: string; icon?: ReactNode }[] }) {
  return (
    <div className="no-scrollbar -mx-1 mb-4 flex gap-1 overflow-x-auto px-1">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={cx(
            "relative flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm transition",
            value === item.id ? "text-bg" : "text-dim hover:text-fg",
          )}
        >
          {value === item.id && <motion.span layoutId="tabs-pill" className="absolute inset-0 rounded-xl bg-accent" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
          <span className="relative flex items-center gap-1.5">
            {item.icon}
            {item.label}
          </span>
        </button>
      ))}
    </div>
  );
}

export function PageTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-dim">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function CopyField({ value, label, onCopied }: { value: string; label?: string; onCopied?: () => void }) {
  return (
    <div>
      {label && <span className="mb-1.5 block text-xs font-medium text-dim">{label}</span>}
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(value).then(() => onCopied?.());
        }}
        className="w-full break-all rounded-xl border border-line bg-bg/60 px-3 py-2 text-left font-mono text-xs text-accent transition hover:border-accent/60"
        title="Kopieren"
      >
        {value}
      </button>
    </div>
  );
}
