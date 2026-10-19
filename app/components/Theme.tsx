import type { ReactNode } from "react";
import { useNavigate } from "@remix-run/react";

// Presentational building blocks for the SmartSavings admin theme.
// Styles live in app/styles/theme.css (loaded globally from app/routes/app.tsx).

// ─── Icons ────────────────────────────────────────────────────────────────────

export type ThemeIconName =
  | "back" | "save" | "check" | "chevron" | "plus"
  | "cart" | "layers" | "eye" | "code" | "info" | "percent" | "box"
  | "calendar" | "mail" | "chart" | "palette" | "ruler" | "text" | "sliders"
  | "gift" | "shield" | "truck" | "tag" | "users" | "link" | "monitor"
  | "edit" | "clock";

export function ThemeIcon({ name, size = 24 }: { name: ThemeIconName; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };
  switch (name) {
    case "back": return <svg {...common}><path d="m12 19-7-7 7-7M5 12h16" /></svg>;
    case "save": return <svg {...common}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" /><path d="M17 21v-8H7v8M7 3v6h8V3" /></svg>;
    case "check": return <svg {...common}><path d="m5 12 4 4L19 6" /></svg>;
    case "chevron": return <svg {...common}><path d="m6 9 6 6 6-6" /></svg>;
    case "plus": return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
    case "cart": return <svg {...common}><circle cx="9" cy="20" r="1" /><circle cx="19" cy="20" r="1" /><path d="M2 3h2l2.5 12h13l2-9H5" /></svg>;
    case "layers": return <svg {...common}><path d="m12 2 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 17l9 5 9-5" /></svg>;
    case "eye": return <svg {...common}><path d="M2 12s3.7-6 10-6 10 6 10 6-3.7 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>;
    case "code": return <svg {...common}><path d="m8 5-7 7 7 7M16 5l7 7-7 7M14 3l-4 18" /></svg>;
    case "info": return <svg {...common}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>;
    case "percent": return <svg {...common}><path d="M19 5 5 19" /><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" /></svg>;
    case "box": return <svg {...common}><path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" /><path d="m3 8 9 5 9-5M12 13v8" /></svg>;
    case "calendar": return <svg {...common}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>;
    case "mail": return <svg {...common}><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 6L2 7" /></svg>;
    case "chart": return <svg {...common}><path d="M3 3v18h18" /><path d="M7 15v2M12 10v7M17 6v11" /></svg>;
    case "palette": return <svg {...common}><circle cx="13.5" cy="6.5" r="1" /><circle cx="17.5" cy="10.5" r="1" /><circle cx="8.5" cy="7.5" r="1" /><circle cx="6.5" cy="12.5" r="1" /><path d="M12 2a10 10 0 0 0 0 20c1 0 1.7-.8 1.7-1.7 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.9.8-1.7 1.7-1.7h2a5.6 5.6 0 0 0 5.4-5.6C22 6 17.5 2 12 2Z" /></svg>;
    case "ruler": return <svg {...common}><path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.4 2.4 0 0 1 0-3.4l2.6-2.6a2.4 2.4 0 0 1 3.4 0Z" /><path d="m14.5 12.5 2-2M11.5 9.5l2-2M8.5 6.5l2-2M17.5 15.5l2-2" /></svg>;
    case "text": return <svg {...common}><path d="M4 7V4h16v3M9 20h6M12 4v16" /></svg>;
    case "sliders": return <svg {...common}><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" /></svg>;
    case "gift": return <svg {...common}><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" /><path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5" /></svg>;
    case "shield": return <svg {...common}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></svg>;
    case "truck": return <svg {...common}><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2M15 18H9" /><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14" /><circle cx="17" cy="18" r="2" /><circle cx="7" cy="18" r="2" /></svg>;
    case "tag": return <svg {...common}><path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4Z" /><circle cx="7.5" cy="7.5" r="1.5" /></svg>;
    case "users": return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
    case "link": return <svg {...common}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>;
    case "monitor": return <svg {...common}><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></svg>;
    case "edit": return <svg {...common}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>;
    case "clock": return <svg {...common}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>;
  }
}

// ─── Page header ──────────────────────────────────────────────────────────────

export interface HeaderAction {
  content: string;
  onAction: () => void;
  loading?: boolean;
  disabled?: boolean;
  destructive?: boolean;
  icon?: ThemeIconName;
}

function HeaderButton({ action, variant }: { action: HeaderAction; variant: "primary" | "outline" | "danger" }) {
  const busy = Boolean(action.loading);
  return (
    <button
      type="button"
      className={`ss-btn ss-btn--${variant}`}
      onClick={action.onAction}
      disabled={action.disabled || busy}
      aria-busy={busy || undefined}
    >
      {busy ? (
        <span className="ss-btn__spinner" aria-hidden="true" />
      ) : (
        action.icon && <ThemeIcon name={action.icon} size={18} />
      )}
      {action.content}
    </button>
  );
}

export function PageHeader({
  title,
  subtitle,
  backTo,
  backLabel = "Back",
  badge,
  primaryAction,
  secondaryActions = [],
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  backTo?: string;
  backLabel?: string;
  badge?: ReactNode;
  primaryAction?: HeaderAction;
  secondaryActions?: HeaderAction[];
}) {
  const navigate = useNavigate();
  const hasActions = Boolean(primaryAction) || secondaryActions.length > 0;

  return (
    <header className="ss-header">
      <div className="ss-header__lead">
        {backTo && (
          <button
            type="button"
            className="ss-header__back"
            onClick={() => navigate(backTo)}
            aria-label={backLabel}
            title={backLabel}
          >
            <ThemeIcon name="back" size={22} />
          </button>
        )}
        <div className="ss-header__text">
          <div className="ss-header__title-row">
            <h1 className="ss-header__title">{title}</h1>
            {badge}
          </div>
          {subtitle && <p className="ss-header__subtitle">{subtitle}</p>}
        </div>
      </div>
      {hasActions && (
        <div className="ss-header__actions">
          {secondaryActions.map((action) => (
            <HeaderButton
              key={action.content}
              action={action}
              variant={action.destructive ? "danger" : "outline"}
            />
          ))}
          {primaryAction && <HeaderButton action={primaryAction} variant="primary" />}
        </div>
      )}
    </header>
  );
}

// ─── Section card ─────────────────────────────────────────────────────────────

export type SectionTone = "blue" | "mint" | "amber" | "violet" | "rose" | "sky";

export function SectionCard({
  title,
  subtitle,
  icon,
  tone = "blue",
  actions,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon: ThemeIconName;
  tone?: SectionTone;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className={`ss-section ss-section--${tone}${children ? "" : " ss-section--compact"}`}>
      <div className="ss-section__head">
        <span className="ss-section__icon" aria-hidden="true">
          <ThemeIcon name={icon} size={26} />
        </span>
        <div className="ss-section__heading">
          <h2 className="ss-section__title">{title}</h2>
          {subtitle && <p className="ss-section__subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="ss-section__actions">{actions}</div>}
      </div>
      {children && <div className="ss-section__body">{children}</div>}
    </section>
  );
}

// ─── Pills ────────────────────────────────────────────────────────────────────

export type PillTone = "green" | "blue" | "amber" | "violet" | "red" | "gray";

export function Pill({ tone = "gray", dot = false, children }: { tone?: PillTone; dot?: boolean; children: ReactNode }) {
  return (
    <span className={`ss-pill ss-pill--${tone}`}>
      {dot && <span className="ss-pill__dot" aria-hidden="true" />}
      {children}
    </span>
  );
}

const STATUS_TONES: Record<string, PillTone> = {
  active: "green",
  scheduled: "blue",
  paused: "amber",
  draft: "violet",
  expired: "gray",
};

export function StatusPill({ status }: { status: string }) {
  const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : "Unknown";
  return (
    <Pill tone={STATUS_TONES[status] ?? "gray"} dot>
      {label}
    </Pill>
  );
}
