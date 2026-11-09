import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeAreaTopScrim } from "./shims";
import { api, DATA_POLL_MS, type ApiResponse } from "./api";

type State = ApiResponse<typeof api, "getState">;
type Snapshot = NonNullable<State["snapshot"]>;
type Timeframe = NonNullable<Snapshot["timeframes"]>[number];
type Zone = NonNullable<Snapshot["zones"]>[number];
type KeyLevels = NonNullable<Snapshot["keyLevels"]>;
type FibLevels = NonNullable<Snapshot["fibLevels"]>;
type VerdictWord = "BUY" | "SELL" | "WAIT";

function money(n: number, decimals = 2): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function trendStyle(v: number): { label: string; cls: string } {
  if (v > 0) return { label: "UP", cls: "text-[var(--bull)]" };
  if (v < 0) return { label: "DOWN", cls: "text-[var(--bear)]" };
  return { label: "MIXED", cls: "text-[var(--dim)]" };
}

// Small trend mark: direction icon + word, colored by direction. Used in
// the trend tiles.
function TrendMark({ v, iconClass = "h-4 w-4" }: { v: number; iconClass?: string }) {
  const t = trendStyle(v);
  return (
    <span className={`inline-flex items-center gap-1.5 font-bold ${t.cls}`}>
      {v > 0 ? (
        <IconTrendUp className={iconClass} />
      ) : v < 0 ? (
        <IconTrendDown className={iconClass} />
      ) : (
        <IconMixed className={iconClass} />
      )}
      {t.label}
    </span>
  );
}

function verdictColor(word: VerdictWord): string {
  if (word === "BUY") return "var(--bull)";
  if (word === "SELL") return "var(--bear)";
  return "var(--wait)";
}

// Safety net for AI-written text (AI note / news mood): strip any stray
// markdown asterisks so stored text always renders clean.
function cleanText(s: string): string {
  return s.replace(/\*/g, "");
}

// ---------------------------------------------------------------------------
// Custom hand-drawn inline SVG icons (replacing all emoji/glyph chrome).
// One consistent style: 24x24 viewBox, stroke currentColor, no fill, round
// caps/joins. Size comes from the className at the call site.
// ---------------------------------------------------------------------------

type IconProps = { className?: string };

function IconRobot({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M12 8V4.5" />
      <circle cx="12" cy="3" r="1.1" />
      <rect x="4.5" y="8" width="15" height="11" rx="2.5" />
      <circle cx="9" cy="13" r="0.4" fill="currentColor" />
      <circle cx="15" cy="13" r="0.4" fill="currentColor" />
      <path d="M9.5 16.2h5" />
      <path d="M4.5 12.5H3M21 12.5h-1.5" />
    </svg>
  );
}

function IconNews({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M4 6.5A1.5 1.5 0 0 1 5.5 5H17v13.5H5.5A1.5 1.5 0 0 1 4 17Z" />
      <path d="M17 8.5h1.5A1.5 1.5 0 0 1 20 10v7a1.5 1.5 0 0 1-1.5 1.5H17" />
      <path d="M7 9h6.5M7 12h6.5M7 15h4" />
    </svg>
  );
}

function IconCandles({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M6.5 3.5v3M6.5 15.5v3" />
      <rect x="4" y="6.5" width="5" height="9" rx="1" />
      <path d="M17.5 5.5v3M17.5 17.5v3" />
      <rect x="15" y="8.5" width="5" height="9" rx="1" />
    </svg>
  );
}

function IconSliders({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M3.5 6.5h9M17.5 6.5h3" />
      <circle cx="15" cy="6.5" r="2.3" />
      <path d="M3.5 12h3M11.5 12h9" />
      <circle cx="9" cy="12" r="2.3" />
      <path d="M3.5 17.5h11M19.5 17.5h1" />
      <circle cx="17" cy="17.5" r="2.3" />
    </svg>
  );
}

function IconHistory({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M3.5 12a8.5 8.5 0 1 1 2.5 6" />
      <path d="M3.5 12H7M3.5 12l2-2.2" />
      <path d="M12 8v4.2l2.8 1.8" />
    </svg>
  );
}

function IconRefresh({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M20 12a8 8 0 1 1-2.3-5.7" />
      <path d="M20.2 3.4v3.9h-3.9" />
    </svg>
  );
}

function IconTrendUp({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M3.5 17.5 9 12l3.2 3.2L19.5 8" />
      <path d="M14.8 8h4.7v4.7" />
    </svg>
  );
}

function IconTrendDown({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M3.5 6.5 9 12l3.2-3.2L19.5 16" />
      <path d="M14.8 16h4.7v-4.7" />
    </svg>
  );
}

function IconMixed({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M12 4.8 19.2 12 12 19.2 4.8 12Z" />
      <path d="M9 12h6" />
    </svg>
  );
}

function IconX({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function IconScales({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M12 4.5v13" />
      <path d="M8.5 20.5h7M12 17.5v3" />
      <path d="M5.5 7 12 5.2 18.5 7" />
      <path d="M5.5 7 3.2 12.5M5.5 7l2.3 5.5" />
      <path d="M2.8 12.5a2.7 2.7 0 0 0 5.4 0" />
      <path d="M18.5 7l-2.3 5.5M18.5 7l2.3 5.5" />
      <path d="M15.8 12.5a2.7 2.7 0 0 0 5.4 0" />
    </svg>
  );
}

function IconListChecks({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="m3.5 7 1.8 1.8L8.8 5.2" />
      <path d="M11.5 7h9" />
      <path d="m3.5 15.5 1.8 1.8 3.5-3.6" />
      <path d="M11.5 15.5h9" />
    </svg>
  );
}

function IconMaximize({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M9 4H5.5A1.5 1.5 0 0 0 4 5.5V9" />
      <path d="M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9" />
      <path d="M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15" />
      <path d="M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15" />
    </svg>
  );
}

function IconTarget({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4.3" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" />
    </svg>
  );
}

// ---------------------------------------------------------------------------

function SectionTitle({
  children,
  icon,
}: {
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div>
      <h2 className="font-display flex items-center gap-2.5 text-xl font-semibold text-[var(--text)]">
        {icon ? (
          <span className="shrink-0 text-[var(--accent-strong)]">{icon}</span>
        ) : null}
        <span>{children}</span>
      </h2>
      <div className="mt-1.5 h-0.5 w-10 bg-[var(--accent)]" aria-hidden="true" />
    </div>
  );
}

function ScoreBar({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / total) * 100));
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="num text-lg font-semibold" style={{ color }}>
          {value}
          <span className="text-sm text-[var(--dim)]"> / {total}</span>
        </span>
      </div>
      <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phase 2 helpers: ADX strength, breakout flag, market sessions.
// ---------------------------------------------------------------------------

// ADX trend-strength label: <20 Sust, 20–40 Darmiyani, >40 Mazboot.
function adxLabel(adx: number): string {
  if (adx < 20) return "Sust";
  if (adx <= 40) return "Darmiyani";
  return "Mazboot";
}

// Small ADX strength meter: thin bar on a 0–50 scale (capped) plus the
// "ADX {n} · {label}" text. Renders nothing when adx is null. The
// `large` variant (explorer detail) shows the number prominently.
function AdxMeter({
  adx,
  large = false,
}: {
  adx: number | null | undefined;
  large?: boolean;
}) {
  if (adx == null) return null;
  const pct = Math.max(0, Math.min(100, (adx / 50) * 100));
  const n = Math.round(adx);
  return (
    <div className={large ? "max-w-xs" : ""}>
      <div className="flex items-baseline gap-1.5">
        <span
          className={`text-[var(--dim)] ${large ? "text-sm font-medium" : "text-[11px]"}`}
        >
          ADX
        </span>
        <span
          className={`num font-bold text-[var(--accent-strong)] ${
            large ? "text-xl" : "text-xs"
          }`}
        >
          {n}
        </span>
        <span
          className={`text-[var(--dim)] ${large ? "text-sm" : "text-[11px]"}`}
        >
          · {adxLabel(adx)}
        </span>
      </div>
      <div
        className={`mt-1 overflow-hidden rounded-full bg-[var(--surface-2)] ${
          large ? "h-2" : "h-1.5"
        }`}
        role="img"
        aria-label={`Trend strength ADX ${n}, ${adxLabel(adx)}`}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: "var(--accent-strong)" }}
        />
      </div>
    </div>
  );
}

// Breakout flag chip for a timeframe: trending-up icon in green for an
// upside breakout, trending-down in brick for a downside one. Nothing
// when there is no breakout.
function BreakoutChip({
  breakout,
}: {
  breakout: "up" | "down" | null | undefined;
}) {
  if (breakout !== "up" && breakout !== "down") return null;
  const up = breakout === "up";
  const color = up ? "var(--bull)" : "var(--bear)";
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold tracking-wide"
      style={{
        color,
        backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 45%, transparent)`,
      }}
    >
      {up ? (
        <IconTrendUp className="h-3.5 w-3.5" />
      ) : (
        <IconTrendDown className="h-3.5 w-3.5" />
      )}
      Breakout
    </span>
  );
}

// Gold trading sessions in UTC hours (start inclusive, end exclusive;
// Sydney wraps past midnight).
const SESSIONS = [
  { name: "Sydney", start: 21, end: 6 },
  { name: "Tokyo", start: 0, end: 9 },
  { name: "London", start: 8, end: 17 },
  { name: "New York", start: 13, end: 22 },
] as const;

function sessionActive(hourUtc: number, s: { start: number; end: number }): boolean {
  return s.start < s.end
    ? hourUtc >= s.start && hourUtc < s.end
    : hourUtc >= s.start || hourUtc < s.end;
}

// Session chips row for the hero: which gold sessions are open right now
// (from the browser's current UTC time, refreshed on the ~5s price tick
// via the nowMs prop). London + New York together get the overlap note.
function SessionsRow({ nowMs }: { nowMs: number }) {
  const hourUtc = new Date(nowMs).getUTCHours();
  const states = SESSIONS.map((s) => ({
    name: s.name,
    active: sessionActive(hourUtc, s),
  }));
  const overlap =
    states.find((s) => s.name === "London")?.active &&
    states.find((s) => s.name === "New York")?.active;
  const activeCount = states.filter((s) => s.active).length;
  return (
    <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
      {states.map((s) => (
        <span
          key={s.name}
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            s.active
              ? "border border-[var(--accent-strong)] bg-[var(--accent)] text-[var(--text)]"
              : "border border-[var(--border)] bg-[var(--surface)] text-[var(--dim)]"
          }`}
        >
          {s.name}
          {s.active ? " · open" : ""}
        </span>
      ))}
      {overlap ? (
        <span className="text-xs font-semibold text-[var(--accent-strong)]">
          London + New York overlap — gold ke liye sab se tez waqt
        </span>
      ) : activeCount >= 2 ? (
        <span className="text-xs font-semibold text-[var(--dim)]">
          {activeCount} sessions ek sath open hain — overlap chal raha hai
        </span>
      ) : null}
    </div>
  );
}

function VerdictHero({
  snapshot,
  livePrice,
  nowMs,
}: {
  snapshot: Snapshot | null;
  livePrice: number | null;
  nowMs: number;
}) {
  const fv = snapshot?.finalVerdict ?? null;
  const word: VerdictWord = fv?.word ?? "WAIT";
  const line =
    fv?.line ??
    "Multi-timeframe verdict ka intezaar hai — agli scan jald ayegi.";
  const price = livePrice ?? snapshot?.spotPrice ?? null;
  // Alignment (#12): share of the timeframes whose verdict equals the
  // final verdict word (WAIT counts the WAITs).
  const tfs = snapshot?.timeframes ?? [];
  const alignedCount = tfs.filter((t) => t.verdict === word).length;
  const alignPct =
    tfs.length > 0 ? Math.round((alignedCount / tfs.length) * 100) : 0;
  // Setup grade (#13): from the latest final score (score history first,
  // verdict history as fallback) and the timeframe alignment only.
  const sh = snapshot?.scoreHistory ?? [];
  const vh = snapshot?.verdictHistory ?? [];
  const finalScore =
    sh.length > 0
      ? (sh[sh.length - 1]?.finalScore ?? null)
      : vh.length > 0
        ? (vh[vh.length - 1]?.score ?? null)
        : null;
  // Grade rule (#13): score + alignment ONLY. A = |final score| ≥ 8 AND
  // alignment ≥ 7/9 timeframes; B = |final score| ≥ 6 AND alignment ≥ 5/9;
  // C = baqi (BUY/SELL par); WAIT par grade "—" rehta hai.
  let grade: "A" | "B" | "C" | "—" = "—";
  if (word !== "WAIT") {
    const absScore = Math.abs(finalScore ?? 0);
    if (absScore >= 8 && alignedCount >= 7) {
      grade = "A";
    } else if (absScore >= 6 && alignedCount >= 5) {
      grade = "B";
    } else {
      grade = "C";
    }
  }
  const gradeColor =
    grade === "A"
      ? "var(--bull)"
      : grade === "B"
        ? "var(--wait)"
        : grade === "C"
          ? "var(--bear)"
          : "var(--dim)";
  return (
    <section aria-label="Final verdict" className="mt-10 text-center">
      <p className="flex items-center justify-center gap-2 text-xs font-semibold tracking-[0.24em] text-[var(--dim)] uppercase">
        <IconCandles className="h-4 w-4 text-[var(--accent-strong)]" />
        Final Verdict — saare timeframes mila kar
      </p>
      <p
        className="font-display mt-3 text-7xl font-bold tracking-wide sm:text-8xl"
        style={{ color: verdictColor(word) }}
      >
        {word}
      </p>
      <p className="mx-auto mt-3 max-w-xl text-base leading-[1.55]">
        {line}
      </p>
      {/* Setup grade chip, next to the verdict. */}
      <div className="mt-4 flex flex-col items-center gap-1.5">
        <span
          className="rounded-full px-3.5 py-1 text-sm font-bold tracking-wide"
          style={{
            color: gradeColor,
            backgroundColor: `color-mix(in srgb, ${gradeColor} 14%, transparent)`,
            border: `1px solid color-mix(in srgb, ${gradeColor} 45%, transparent)`,
          }}
        >
          {grade === "—" ? "Grade —" : `Grade ${grade}`}
        </span>
        <span className="text-[11px] text-[var(--dim)]">
          {word === "WAIT" ? "WAIT par koi setup nahi" : null}
          {word === "WAIT" ? " · " : ""}
          Grade = score + timeframes ka ittefaq
        </span>
      </div>
      {/* Alignment meter: how many timeframes stand with the verdict. */}
      {tfs.length > 0 ? (
        <div className="mx-auto mt-5 max-w-md">
          <div
            className="h-2 overflow-hidden rounded-full bg-[var(--surface-2)]"
            role="img"
            aria-label={`Alignment ${alignPct} percent — ${alignedCount} of ${tfs.length} timeframes is verdict ke sath hain`}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${alignPct}%`,
                backgroundColor: verdictColor(word),
              }}
            />
          </div>
          <p className="num mt-2 text-sm text-[var(--dim)]">
            {alignedCount} / {tfs.length} timeframes final verdict ke sath
            ({alignPct}%)
          </p>
          <p className="mt-1 text-[11px] leading-[1.55] text-[var(--dim)]">
            Wo timeframes ginay jate hain jinka apna verdict final verdict
            jesa hai — WAIT par WAIT wale timeframes ginay jate hain.
          </p>
        </div>
      ) : null}
      {price != null ? (
        <p className="num mt-4 text-lg text-[var(--dim)]">
          Spot price{" "}
          <span className="text-2xl font-bold text-[var(--accent-strong)]">
            ${money(price)}
          </span>{" "}
          <span className="font-sans ml-1 inline-flex items-center gap-1 align-middle text-[11px] font-bold tracking-widest text-[var(--bull)]">
            <span
              className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--bull)]"
              aria-hidden="true"
            />
            LIVE
          </span>
        </p>
      ) : null}
      <SessionsRow nowMs={nowMs} />
      {snapshot?.changePcts ? (
        <div className="mx-auto mt-6 grid max-w-md grid-cols-3 gap-2.5">
          {(
            [
              ["Aaj", snapshot.changePcts.day],
              ["Hafta", snapshot.changePcts.week],
              ["Mahina", snapshot.changePcts.month],
            ] as const
          ).map(([label, v]) =>
            v == null ? null : (
              <div
                key={label}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2 py-2.5 text-center"
              >
                <p className="text-[11px] font-medium text-[var(--dim)]">
                  {label}
                </p>
                <p
                  className={`num mt-0.5 flex items-center justify-center gap-1 text-base font-bold ${
                    v >= 0 ? "text-[var(--bull)]" : "text-[var(--bear)]"
                  }`}
                >
                  {v >= 0 ? (
                    <IconTrendUp className="h-4 w-4" />
                  ) : (
                    <IconTrendDown className="h-4 w-4" />
                  )}
                  {v >= 0 ? "+" : "−"}
                  {money(Math.abs(v))}%
                </p>
              </div>
            ),
          )}
        </div>
      ) : null}
      <div
        className="mx-auto mt-9 h-px w-40 bg-[var(--border)]"
        aria-hidden="true"
      />
    </section>
  );
}

// TradingView Live Chart — an addition directly under the Final Verdict
// hero. On this standalone website the OFFICIAL TradingView Advanced
// Chart widget is embedded directly (FX:XAUUSD, light theme, 5-minute
// default interval, Asia/Karachi timezone, full toolbar + drawing
// tools): a real top-level site is exactly the environment the widget is
// built for, so it renders in-page here. (Inside the old Muse artifact
// the same widget was blocked by TradingView's ancestor-frame checks —
// that sandbox is the whole reason this section is an embed again only
// on the real site.) The TradingView attribution line stays visible
// (licence condition).
function TradingViewChartSection() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = "";
    const widgetEl = document.createElement("div");
    widgetEl.className = "tradingview-widget-container__widget";
    widgetEl.style.height = "100%";
    widgetEl.style.width = "100%";
    container.appendChild(widgetEl);
    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: "FX:XAUUSD",
      interval: "5",
      timezone: "Asia/Karachi",
      theme: "light",
      style: "1",
      locale: "en",
      hide_top_toolbar: false,
      hide_side_toolbar: false,
      allow_symbol_change: true,
      support_host: "https://www.tradingview.com",
    });
    container.appendChild(script);
    return () => {
      container.innerHTML = "";
    };
  }, []);

  return (
    <section aria-label="TradingView live chart" className="mt-10">
      <div className="panel p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2.5 px-1">
          <p className="flex items-center gap-2 text-base font-bold">
            <IconCandles className="h-5 w-5 text-[var(--accent-strong)]" />
            TradingView Live Chart
          </p>
          <span className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-0.5 text-xs font-semibold text-[var(--dim)]">
            FXCM · XAU/USD · 5m
          </span>
        </div>
        <div
          ref={containerRef}
          className="tradingview-widget-container mt-4 h-[520px] overflow-hidden rounded-xl border border-[var(--border)] sm:h-[600px] lg:h-[660px]"
          style={{ width: "100%" }}
        />
        <p className="mt-3 px-1 text-sm leading-[1.55] text-[var(--dim)]">
          Ye chart aur is ki price seedha TradingView se arahi hai (FXCM
          feed) — upar wala verdict aur neeche wali analysis hamare apne
          system ki hai.
        </p>
        {/* TradingView attribution — licence condition, stays visible. */}
        <p className="mt-2 text-center text-xs text-[var(--dim)]">
          <a
            href="https://www.tradingview.com/"
            target="_blank"
            rel="noopener nofollow"
            className="font-semibold text-[#2962FF] hover:underline"
          >
            Track all markets on TradingView
          </a>
        </p>
      </div>
    </section>
  );
}

// Day Range Bar: today's low–high track with the live spot price marked
// on it (clamped 0–100%). Uses the live tick price when available, else
// the snapshot spot price. Hidden when keyLevels is null.
function DayRangeBar({
  snapshot,
  livePrice,
}: {
  snapshot: Snapshot;
  livePrice: number | null;
}) {
  const kl = snapshot.keyLevels ?? null;
  if (!kl || kl.dayLow == null || kl.dayHigh == null) return null;
  const low = kl.dayLow;
  const high = kl.dayHigh;
  const price = livePrice ?? snapshot.spotPrice;
  const pct =
    high > low
      ? Math.max(0, Math.min(100, ((price - low) / (high - low)) * 100))
      : 50;
  return (
    <section aria-label="Aaj ki range" className="mt-8">
      <div className="panel px-5 py-4 sm:px-6">
        <div className="flex items-baseline justify-between gap-3 text-xs text-[var(--dim)]">
          <span className="num">Low ${money(low)}</span>
          <span className="text-sm font-semibold text-[var(--text)]">
            Aaj ki range
          </span>
          <span className="num">High ${money(high)}</span>
        </div>
        <div
          className="relative mt-3 h-2 rounded-full bg-[var(--surface-2)]"
          role="img"
          aria-label={`Aaj ki range: low $${money(low)}, high $${money(high)}, abhi price $${money(price)}`}
        >
          <span
            className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--surface)] shadow"
            style={{ left: `${pct}%`, backgroundColor: "var(--accent-strong)" }}
          />
        </div>
        <p className="num mt-2.5 text-center text-sm font-bold text-[var(--accent-strong)]">
          ${money(price)}
        </p>
      </div>
    </section>
  );
}

const TF_ORDER = [
  "1m",
  "5m",
  "15m",
  "30m",
  "1H",
  "4H",
  "Daily",
  "Weekly",
  "Monthly",
] as const;

// One candle: [timestampMs, open, high, low, close, volume] — timestampMs
// is the candle bucket's start (ms epoch); volume is the summed Yahoo
// volume for the bucket.
type Candle = [number, number, number, number, number, number];

// Candle bucket length in ms per timeframe. Monthly is calendar-based
// (the next bucket starts at the next calendar month) and is handled
// separately in nextBucketStart.
const TF_MS: Record<string, number> = {
  "1m": 60_000,
  "5m": 300_000,
  "15m": 900_000,
  "30m": 1_800_000,
  "1H": 3_600_000,
  "4H": 14_400_000,
  Daily: 86_400_000,
  Weekly: 604_800_000,
};

// Start of the bucket that follows the one starting at `ts`.
function nextBucketStart(ts: number, tf: string): number | null {
  if (tf === "Monthly") {
    const d = new Date(ts);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
  }
  const dur = TF_MS[tf];
  return dur != null ? ts + dur : null;
}

// End of the bucket (phase-aligned with the candle starting at `ts`)
// that contains `nowMs` — i.e. the next bucket boundary strictly after
// now. The countdown uses this instead of the raw bucket end so it keeps
// ticking on wall-clock time even when the forming candle's own bucket
// has already passed (throttled timers, a stale snapshot).
function bucketEndAfter(ts: number, tf: string, nowMs: number): number | null {
  let end = nextBucketStart(ts, tf);
  if (end == null) return null;
  if (end > nowMs) return end;
  if (tf === "Monthly") {
    while (end <= nowMs) {
      const next = nextBucketStart(end, tf);
      if (next == null) break;
      end = next;
    }
    return end;
  }
  const dur = TF_MS[tf];
  if (dur == null) return end;
  return end + (Math.floor((nowMs - end) / dur) + 1) * dur;
}

// Formats the remaining time in a candle bucket for the countdown chip:
// mm:ss under an hour, h:mm:ss under a day, then "Nd Nh".
function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const p2 = (n: number) => String(n).padStart(2, "0");
  if (totalSec >= 86_400) {
    return `${Math.floor(totalSec / 86_400)}d ${Math.floor((totalSec % 86_400) / 3600)}h`;
  }
  if (totalSec >= 3600) {
    return `${Math.floor(totalSec / 3600)}:${p2(Math.floor((totalSec % 3600) / 60))}:${p2(totalSec % 60)}`;
  }
  return `${p2(Math.floor(totalSec / 60))}:${p2(totalSec % 60)}`;
}

// Sparse time-axis label for a candle bucket start, in PKT (Asia/Karachi):
// HH:MM for intraday timeframes, a short date for Daily/Weekly/Monthly.
function candleTimeLabel(ts: number, tf: string): string {
  const d = new Date(ts);
  if (tf === "Daily" || tf === "Weekly" || tf === "Monthly") {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Karachi",
      day: "numeric",
      month: "short",
    }).format(d);
  }
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Karachi",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

// Normalizes raw snapshot candle entries into Candle tuples. Current
// entries carry 6 numbers; a stored snapshot may still hold legacy
// 4-element [open, high, low, close] entries until the next push — those
// get volume 0 and a timestamp synthesized from their position (counting
// back from the current bucket by the timeframe duration), so mixed
// snapshots never break rendering.
function normalizeCandles(
  raw: readonly (readonly number[])[],
  tf: string,
): Candle[] {
  const dur = TF_MS[tf] ?? 86_400_000;
  const lastStart = Math.floor(Date.now() / dur) * dur;
  const n = raw.length;
  return raw.map((c, i): Candle => {
    if (c.length >= 6) {
      return [c[0] ?? 0, c[1] ?? 0, c[2] ?? 0, c[3] ?? 0, c[4] ?? 0, c[5] ?? 0];
    }
    return [
      lastStart - (n - 1 - i) * dur,
      c[0] ?? 0,
      c[1] ?? 0,
      c[2] ?? 0,
      c[3] ?? 0,
      0,
    ];
  });
}

// Applies the live spot price to the last (still-forming) candle: its
// close follows the live price, and its high/low expand when the price
// moves past them. Shared by the small card candle layers and the large
// explorer chart so both tick the same way with the ~5s refreshed price.
function effectiveCandles(
  candles: Candle[],
  livePrice: number | null,
): Candle[] {
  const eff: Candle[] = candles.map((c) => [
    c[0],
    c[1],
    c[2],
    c[3],
    c[4],
    c[5],
  ]);
  const lastIdx = eff.length - 1;
  const last = eff[lastIdx];
  if (livePrice != null && last) {
    eff[lastIdx] = [
      last[0],
      last[1],
      Math.max(last[2], livePrice),
      Math.min(last[3], livePrice),
      livePrice,
      last[5],
    ];
  }
  return eff;
}

// ---------------------------------------------------------------------------
// Live candle series: client-side state per timeframe so the forming candle
// visibly grows/falls with every ~5s live tick and a NEW candle starts when
// its period rolls over — TradingView-style — even between snapshot pushes
// (which arrive only every few minutes). The snapshot's last candle is
// treated as the currently-forming one.
// ---------------------------------------------------------------------------

const MAX_CANDLES = 100;

type SeriesState = {
  candles: Candle[];
};

// Adopts a snapshot's candles as the live series for a timeframe:
// normalized (legacy 4-element entries included) and deep-copied — the
// snapshot's arrays are never mutated.
function adoptSeries(
  raw: readonly (readonly number[])[],
  tf: string,
): SeriesState {
  return { candles: normalizeCandles(raw, tf).slice(-MAX_CANDLES) };
}

// Advances one timeframe's live series by one price tick: first rolls
// over into new flat candle(s) when the tick time reaches the forming
// candle's bucket end — its real timestamp plus the timeframe duration
// (Monthly: the start of the next calendar month) — then patches the
// forming (last) candle with the live price: close follows the price,
// high/low expand past it. Catch-up appends are capped at MAX_CANDLES.
// Returns a new state; the input state and the snapshot's arrays are
// never mutated.
function tickSeries(
  state: SeriesState,
  tf: string,
  price: number,
  nowMs: number,
): SeriesState {
  let candles = state.candles;
  const first = candles[candles.length - 1];
  if (first && first[0] > 0) {
    let boundary = nextBucketStart(first[0], tf);
    if (boundary != null && nowMs >= boundary) {
      const appended: Candle[] = [];
      let prevClose = first[4];
      while (
        boundary != null &&
        nowMs >= boundary &&
        appended.length < MAX_CANDLES
      ) {
        appended.push([boundary, prevClose, prevClose, prevClose, prevClose, 0]);
        prevClose = appended[appended.length - 1]?.[4] ?? prevClose;
        boundary = nextBucketStart(boundary, tf);
      }
      if (appended.length > 0) {
        candles = [...candles, ...appended].slice(-MAX_CANDLES);
      }
    }
  }
  const lastIdx = candles.length - 1;
  const last = candles[lastIdx];
  if (last) {
    if (candles === state.candles) {
      candles = [...candles];
    }
    candles[lastIdx] = [
      last[0],
      last[1],
      Math.max(last[2], price),
      Math.min(last[3], price),
      price,
      last[5],
    ];
  }
  return { candles };
}

// Candlestick layer behind a timeframe card's content, fed by the SAME
// shared live series the explorer uses (adopt / evolve / rollover in App).
// Historical candles stay faded (~0.3); the forming (last) candle renders
// at FULL strength with a glowing live tick dot at its close edge, so the
// card visibly reads as real-time and its body grows/shrinks on ticks.
function CandleLayer({
  candles,
  livePrice,
}: {
  candles: Candle[];
  livePrice: number | null;
}) {
  const eff = effectiveCandles(candles, livePrice);
  let min = Infinity;
  let max = -Infinity;
  for (const c of eff) {
    if (c[3] < min) min = c[3];
    if (c[2] > max) max = c[2];
  }
  // The live price joins the axis range so the live price line and its tag
  // never clip outside the chart.
  if (livePrice != null) {
    if (livePrice < min) min = livePrice;
    if (livePrice > max) max = livePrice;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return null;
  }
  const pad = (max - min) * 0.06;
  min -= pad;
  max += pad;
  const slot = 10;
  const width = Math.max(eff.length * slot, slot);
  const y = (p: number) => ((max - p) / (max - min)) * 100;
  const lastIdx = eff.length - 1;
  const renderCandle = (c: Candle, i: number) => {
    const [, o, h, l, cl] = c;
    const up = cl >= o;
    const fill = up ? "var(--bull)" : "var(--bear)";
    const x = i * slot;
    const top = y(Math.max(o, cl));
    const height = Math.max(y(Math.min(o, cl)) - top, 0.8);
    return (
      <g key={i}>
        <line
          x1={x + slot / 2}
          x2={x + slot / 2}
          y1={y(h)}
          y2={y(l)}
          stroke={fill}
          strokeWidth={1}
        />
        <rect x={x + 2} y={top} width={slot - 4} height={height} fill={fill} />
      </g>
    );
  };
  const last = eff[lastIdx];
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox={`0 0 ${width} 100`}
      preserveAspectRatio="none"
    >
      <g opacity={0.3}>{eff.slice(0, lastIdx).map(renderCandle)}</g>
      {last ? (
        <g opacity={1}>
          {renderCandle(last, lastIdx)}
          {/* Live tick marker: a glowing dot at the forming candle's close
              edge, in the live-price color. */}
          <circle
            cx={lastIdx * slot + slot / 2}
            cy={y(last[4])}
            r={3.4}
            fill="var(--accent-strong)"
            opacity={0.35}
          />
          <circle
            cx={lastIdx * slot + slot / 2}
            cy={y(last[4])}
            r={1.7}
            fill="var(--accent-strong)"
          />
        </g>
      ) : null}
    </svg>
  );
}

function TimeframeCard({
  item,
  livePrice,
  series,
}: {
  item: Timeframe;
  livePrice: number | null;
  series?: Candle[];
}) {
  const color = verdictColor(item.verdict);
  const actionable = item.verdict === "BUY" || item.verdict === "SELL";
  const reasons = item.reasons ?? [];
  const candles = series ?? normalizeCandles(item.candles ?? [], item.tf);
  return (
    <article className="panel relative overflow-hidden p-5 sm:p-6">
      {candles.length >= 2 ? (
        <CandleLayer candles={candles} livePrice={livePrice} />
      ) : null}
      <div className="relative">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-bold tracking-wide">{item.tf}</h3>
          <p className="num text-sm text-[var(--dim)]">${money(item.price)}</p>
        </div>
        <p
          className="font-display mt-1.5 text-3xl font-bold tracking-wide"
          style={{ color }}
        >
          {item.verdict}
        </p>
        <p className="num mt-2 text-sm">
          <span className="font-semibold text-[var(--bull)]">
            Bull {item.bull}
          </span>
          <span className="text-[var(--dim)]"> · </span>
          <span className="font-semibold text-[var(--bear)]">
            Bear {item.bear}
          </span>
        </p>
        {item.adx != null || item.breakout ? (
          <div className="mt-3 flex flex-wrap items-start justify-between gap-2">
            <AdxMeter adx={item.adx} />
            <BreakoutChip breakout={item.breakout} />
          </div>
        ) : null}
        {reasons.length > 0 ? (
          <ul className="mt-3 grid gap-1.5">
            {reasons.map((r) => (
              <li key={r} className="text-xs leading-[1.55] text-[var(--dim)]">
                · {r}
              </li>
            ))}
          </ul>
        ) : null}
        {actionable &&
        item.entry != null &&
        item.sl != null &&
        item.tp != null ? (
          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[var(--border)] pt-4 text-center">
            <div>
              <p className="text-[11px] text-[var(--dim)]">Entry</p>
              <p className="num mt-0.5 text-sm font-semibold">
                ${money(item.entry)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-[var(--dim)]">SL</p>
              <p className="num mt-0.5 text-sm font-semibold text-[var(--bear)]">
                ${money(item.sl)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-[var(--dim)]">TP</p>
              <p className="num mt-0.5 text-sm font-semibold text-[var(--bull)]">
                ${money(item.tp)}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Phase 1 chart overlays: EMA/SMA, swing trend lines, pivot lines, zones.
// All computed client-side from the adopted live series — no server data.
// ---------------------------------------------------------------------------

// User-set price target (Explorer controls): the target price plus the
// live price at the moment it was set (decides the reach direction).
type TargetState = { price: number; basePrice: number | null };

// Shared chart display settings between the inline explorer and the
// full-screen overlay.
type ChartConfig = {
  windowSize: number;
  showEma: boolean;
  showSma: boolean;
  showFib: boolean;
  target: TargetState | null;
  targetReached: boolean;
};

// EMA(period) over the closes, aligned to the input: the first close seeds
// the average, so every index has a value.
function emaSeries(closes: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev: number | null = null;
  for (const c of closes) {
    prev = prev == null ? c : c * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

// SMA(period) over the closes, aligned to the input: null until a full
// period of closes exists.
function smaSeries(closes: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < closes.length; i++) {
    sum += closes[i] ?? 0;
    if (i >= period) sum -= closes[i - period] ?? 0;
    out.push(i >= period - 1 ? sum / period : null);
  }
  return out;
}

// A trend line in full-series coordinates: two anchor points (index,
// price); the chart extends it to the right edge.
type TrendLine = { i1: number; p1: number; i2: number; p2: number };

// Swing highs/lows with a ±3 window over the adopted series. ONE
// descending line through the two most recent swing highs whose later
// high is LOWER (resistance trendline), and ONE ascending line through
// the two most recent swing lows whose later low is HIGHER (support
// trendline). No clean pair for a side -> NOTHING for that side; fake
// lines are never forced.
function computeTrendLines(candles: Candle[]): {
  resistance: TrendLine | null;
  support: TrendLine | null;
} {
  const W = 3;
  const swingHighs: { i: number; p: number }[] = [];
  const swingLows: { i: number; p: number }[] = [];
  for (let i = W; i < candles.length - W; i++) {
    const c = candles[i];
    if (!c) continue;
    let isHigh = true;
    let isLow = true;
    for (let j = i - W; j <= i + W; j++) {
      const o = candles[j];
      if (!o || j === i) continue;
      if (o[2] >= c[2]) isHigh = false;
      if (o[3] <= c[3]) isLow = false;
    }
    if (isHigh) swingHighs.push({ i, p: c[2] });
    if (isLow) swingLows.push({ i, p: c[3] });
  }
  let resistance: TrendLine | null = null;
  if (swingHighs.length >= 2) {
    const a = swingHighs[swingHighs.length - 2];
    const b = swingHighs[swingHighs.length - 1];
    if (a && b && b.p < a.p) {
      resistance = { i1: a.i, p1: a.p, i2: b.i, p2: b.p };
    }
  }
  let support: TrendLine | null = null;
  if (swingLows.length >= 2) {
    const a = swingLows[swingLows.length - 2];
    const b = swingLows[swingLows.length - 1];
    if (a && b && b.p > a.p) {
      support = { i1: a.i, p1: a.p, i2: b.i, p2: b.p };
    }
  }
  return { resistance, support };
}

// The five classic pivot lines from keyLevels, strongest first label.
function pivotLinesOf(
  kl: KeyLevels | null,
): { label: string; value: number; pivot?: boolean }[] {
  if (!kl) return [];
  const out: { label: string; value: number; pivot?: boolean }[] = [];
  if (kl.r2 != null) out.push({ label: "R2", value: kl.r2 });
  if (kl.r1 != null) out.push({ label: "R1", value: kl.r1 });
  if (kl.pivot != null) out.push({ label: "Pivot", value: kl.pivot, pivot: true });
  if (kl.s1 != null) out.push({ label: "S1", value: kl.s1 });
  if (kl.s2 != null) out.push({ label: "S2", value: kl.s2 });
  return out;
}

// Large candlestick chart for the timeframe explorer, TradingView style:
// real candle bodies and wicks drawn from the timeframe's live series,
// bullish in the muted green, bearish in the muted brick red, with an
// OHLC legend for the forming candle, a volume histogram along the
// bottom, a light grid, PKT time labels, a right-axis live price chip
// and a per-second candle countdown. Shows the last `windowSize`
// candles; EMA/SMA and trend lines are computed over the FULL adopted
// series and rendered within the displayed window. Zone bands and pivot
// lines are price-based (window-independent). The last candle ticks with
// the ~5s refreshed live price via effectiveCandles.
function BigCandleChart({
  candles,
  livePrice,
  tf,
  zones,
  keyLevels,
  fibLevels,
  config,
  tall = false,
}: {
  candles: Candle[];
  livePrice: number | null;
  tf: string;
  zones: Zone[];
  keyLevels: KeyLevels | null;
  fibLevels: FibLevels | null;
  config: ChartConfig;
  tall?: boolean;
}) {
  // Local 1-second clock for the candle countdown chip only — display
  // state; the server is never polled faster than the ~5s price tick.
  const [nowSec, setNowSec] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowSec(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const eff = effectiveCandles(candles, livePrice);
  const off = Math.max(0, eff.length - config.windowSize);
  const disp = eff.slice(off);
  let min = Infinity;
  let max = -Infinity;
  for (const c of disp) {
    if (c[3] < min) min = c[3];
    if (c[2] > max) max = c[2];
  }
  // The live price joins the axis range so the live price line and its tag
  // never clip outside the chart.
  if (livePrice != null) {
    if (livePrice < min) min = livePrice;
    if (livePrice > max) max = livePrice;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return null;
  }
  // Y-range rule for overlays: start from the displayed candles + live
  // price, then extend the range (at most ~25% of the candle range on
  // each side) to include zone bands / pivot lines / the target that fall
  // inside that extension. Anything still outside is simply clipped.
  const pivots = pivotLinesOf(keyLevels);
  const candleRange = max - min;
  const extMin = min - candleRange * 0.25;
  const extMax = max + candleRange * 0.25;
  for (const z of zones) {
    const half = z.price * 0.00175;
    const top = z.price + half;
    const bot = z.price - half;
    if (top >= extMin && bot <= extMax) {
      if (bot < min) min = bot;
      if (top > max) max = top;
    }
  }
  for (const p of pivots) {
    if (p.value >= extMin && p.value <= extMax) {
      if (p.value < min) min = p.value;
      if (p.value > max) max = p.value;
    }
  }
  if (
    config.target &&
    config.target.price >= extMin &&
    config.target.price <= extMax
  ) {
    if (config.target.price < min) min = config.target.price;
    if (config.target.price > max) max = config.target.price;
  }
  // Fibonacci levels + swing extremes join the range the same way when
  // the Fib overlay is on.
  const fibOn = config.showFib && fibLevels != null;
  if (fibOn && fibLevels) {
    const fibPrices = [
      ...fibLevels.levels.map((l) => l.price),
      fibLevels.swingHigh,
      fibLevels.swingLow,
    ];
    for (const p of fibPrices) {
      if (p >= extMin && p <= extMax) {
        if (p < min) min = p;
        if (p > max) max = p;
      }
    }
  }
  const rawMin = min;
  const rawMax = max;
  const pad = (max - min) * 0.06;
  min -= pad;
  max += pad;
  // TradingView layout: the price plot takes the top ~81% of the chart
  // height; the volume histogram occupies the bottom ~19%.
  const H = 240;
  const volH = Math.round(H * 0.19);
  const priceH = H - volH - 4;
  const slot = 10;
  const width = Math.max(disp.length * slot, slot);
  const y = (p: number) => ((max - p) / (max - min)) * priceH;
  const yPct = (p: number) => (y(p) / H) * 100;
  const inRange = (p: number) => p >= rawMin && p <= rawMax;
  const maxVol = disp.reduce((m, c) => Math.max(m, c[5]), 0);
  // Light grid: horizontal lines at five evenly spaced price levels.
  const gridPrices = [0, 0.25, 0.5, 0.75, 1].map(
    (f) => rawMin + (rawMax - rawMin) * f,
  );
  // Sparse time labels: roughly every 15–20 candles on wide windows,
  // denser on narrow ones so the axis never goes blank.
  const labelStep = disp.length >= 45 ? 15 : disp.length >= 25 ? 10 : 5;
  const labelIdxs = disp
    .map((_, j) => j)
    .filter((j) => j % labelStep === 0);
  // The forming (last displayed) candle drives the OHLC legend, the
  // price chip color and the countdown.
  const forming = disp[disp.length - 1] ?? null;
  const formingUp = forming ? forming[4] >= forming[1] : true;
  const formingEnd = forming ? bucketEndAfter(forming[0], tf, nowSec) : null;
  const countdown =
    formingEnd != null
      ? formatCountdown(Math.max(0, formingEnd - nowSec))
      : null;
  const formingChg = forming ? forming[4] - forming[1] : 0;
  const formingPct =
    forming && forming[1] !== 0 ? (formingChg / forming[1]) * 100 : 0;

  // EMA(20) / SMA(50) over the FULL adopted series closes, rendered only
  // for the displayed window.
  const closes = eff.map((c) => c[4]);
  const ema = config.showEma ? emaSeries(closes, 20) : null;
  const sma = config.showSma ? smaSeries(closes, 50) : null;
  const overlayPoints = (
    series: (number | null)[] | null,
  ): string | null => {
    if (!series) return null;
    const pts: string[] = [];
    for (let j = 0; j < disp.length; j++) {
      const v = series[off + j];
      if (v == null) continue;
      pts.push(`${j * slot + slot / 2},${y(v)}`);
    }
    return pts.length >= 2 ? pts.join(" ") : null;
  };
  const emaPts = overlayPoints(ema);
  const smaPts = overlayPoints(sma);

  // Trend lines over the full adopted series, drawn from their first
  // visible point to the right edge of the chart.
  const trends = computeTrendLines(eff);
  const trendPriceAt = (line: TrendLine, fullIdx: number): number =>
    line.p1 +
    ((line.p2 - line.p1) / (line.i2 - line.i1)) * (fullIdx - line.i1);
  const trendSeg = (
    line: TrendLine | null,
  ): { x1: number; y1: number; x2: number; y2: number } | null => {
    if (!line || line.i2 === line.i1) return null;
    const startFull = Math.max(line.i1, off);
    if (startFull > off + disp.length - 1) return null;
    return {
      x1: (startFull - off) * slot + slot / 2,
      y1: y(trendPriceAt(line, startFull)),
      x2: width,
      // The right edge sits half a slot past the last candle's center.
      y2: y(trendPriceAt(line, off + disp.length - 0.5)),
    };
  };
  const resSeg = trendSeg(trends.resistance);
  const supSeg = trendSeg(trends.support);
  const lastFullIdx = off + disp.length - 1;

  return (
    <div>
      {/* OHLC legend for the forming candle, TradingView style: values
          follow the live tick through effectiveCandles. */}
      {forming ? (
        <p
          className="num mb-1.5 flex flex-wrap gap-x-2.5 text-xs font-medium text-[var(--dim)]"
          aria-label={`${tf} ki banti hui candle: open ${money(forming[1])}, high ${money(forming[2])}, low ${money(forming[3])}, close ${money(forming[4])}`}
        >
          <span>
            O{" "}
            <span className="font-semibold text-[var(--text)]">
              {money(forming[1])}
            </span>
          </span>
          <span>
            H{" "}
            <span className="font-semibold text-[var(--text)]">
              {money(forming[2])}
            </span>
          </span>
          <span>
            L{" "}
            <span className="font-semibold text-[var(--text)]">
              {money(forming[3])}
            </span>
          </span>
          <span>
            C{" "}
            <span className="font-semibold text-[var(--text)]">
              {money(forming[4])}
            </span>
          </span>
          <span
            className="font-semibold"
            style={{ color: formingUp ? "var(--bull)" : "var(--bear)" }}
          >
            {formingChg >= 0 ? "+" : "−"}
            {money(Math.abs(formingChg))} ({formingPct >= 0 ? "+" : "−"}
            {money(Math.abs(formingPct))}%)
          </span>
        </p>
      ) : null}
      <div className="relative">
      <svg
        role="img"
        aria-label={`${tf} candlestick chart — sab se kam price $${money(rawMin)}, sab se zyada $${money(rawMax)}`}
        className={`block w-full ${tall ? "h-[62vh]" : "h-56 sm:h-64"}`}
        viewBox={`0 0 ${width} ${H}`}
        preserveAspectRatio="none"
      >
        {/* S/R zone bands: soft shaded band, price ±0.175% around the
            zone center (support green tint, resistance brick tint). */}
        {zones.map((z) => {
          const half = z.price * 0.00175;
          const top = z.price + half;
          const bot = z.price - half;
          if (top < rawMin || bot > rawMax) return null;
          return (
            <rect
              key={`${z.kind}-${z.price}`}
              x={0}
              y={y(top)}
              width={width}
              height={Math.max(y(bot) - y(top), 1.5)}
              fill={
                z.kind === "support"
                  ? "color-mix(in srgb, var(--bull) 13%, transparent)"
                  : "color-mix(in srgb, var(--bear) 13%, transparent)"
              }
            />
          );
        })}
        {/* Light TradingView-like grid: horizontal lines at evenly
            spaced price levels, verticals aligned with the time
            labels below. */}
        {gridPrices.map((p, i) => (
          <line
            key={`grid-${i}`}
            x1={0}
            x2={width}
            y1={y(p)}
            y2={y(p)}
            stroke="var(--border)"
            strokeWidth={0.7}
            opacity={0.6}
          />
        ))}
        {labelIdxs.map((j) => (
          <line
            key={`vgrid-${j}`}
            x1={j * slot + slot / 2}
            x2={j * slot + slot / 2}
            y1={0}
            y2={H}
            stroke="var(--border)"
            strokeWidth={0.7}
            opacity={0.4}
          />
        ))}
        {/* Volume histogram: one bar per candle along the bottom,
            colored like its candle, scaled to the window's max. */}
        {maxVol > 0
          ? disp.map((c, j) => {
              const bh = (c[5] / maxVol) * volH;
              if (bh <= 0) return null;
              return (
                <rect
                  key={`vol-${j}`}
                  x={j * slot + 1.5}
                  y={H - bh}
                  width={slot - 3}
                  height={bh}
                  fill={c[4] >= c[1] ? "var(--bull)" : "var(--bear)"}
                  opacity={0.38}
                />
              );
            })
          : null}
        {disp.map((c, j) => {
          const [, o, h, l, cl] = c;
          const up = cl >= o;
          const fill = up ? "var(--bull)" : "var(--bear)";
          const x = j * slot;
          const top = y(Math.max(o, cl));
          const height = Math.max(y(Math.min(o, cl)) - top, 1.2);
          const isForming = j === disp.length - 1;
          return (
            <g key={j} opacity={isForming ? 1 : 0.72}>
              <line
                x1={x + slot / 2}
                x2={x + slot / 2}
                y1={y(h)}
                y2={y(l)}
                stroke={fill}
                strokeWidth={1.1}
              />
              <rect
                x={x + 1.5}
                y={top}
                width={slot - 3}
                height={height}
                fill={fill}
              />
            </g>
          );
        })}
        {/* Key level lines: thin DASHED horizontals, Pivot stronger. */}
        {pivots.map((p) =>
          inRange(p.value) ? (
            <line
              key={p.label}
              x1={0}
              x2={width}
              y1={y(p.value)}
              y2={y(p.value)}
              stroke={p.pivot ? "var(--accent-strong)" : "var(--dim)"}
              strokeWidth={p.pivot ? 1.1 : 0.8}
              strokeDasharray="6 4"
              opacity={p.pivot ? 0.85 : 0.55}
            />
          ) : null,
        )}
        {/* Trend lines: thin gold (support) / espresso (resistance). */}
        {resSeg ? (
          <line
            x1={resSeg.x1}
            y1={resSeg.y1}
            x2={resSeg.x2}
            y2={resSeg.y2}
            stroke="var(--text)"
            strokeWidth={1.2}
            opacity={0.75}
          />
        ) : null}
        {supSeg ? (
          <line
            x1={supSeg.x1}
            y1={supSeg.y1}
            x2={supSeg.x2}
            y2={supSeg.y2}
            stroke="var(--accent-strong)"
            strokeWidth={1.2}
            opacity={0.85}
          />
        ) : null}
        {/* EMA / SMA overlays. */}
        {smaPts ? (
          <polyline
            points={smaPts}
            fill="none"
            stroke="#7A8CA3"
            strokeWidth={1.2}
            opacity={0.9}
          />
        ) : null}
        {emaPts ? (
          <polyline
            points={emaPts}
            fill="none"
            stroke="#C9A227"
            strokeWidth={1.2}
            opacity={0.95}
          />
        ) : null}
        {/* Fibonacci retracement lines: DASHED thin olive-gold
            horizontals; swing extremes dotted. */}
        {fibOn && fibLevels
          ? fibLevels.levels.map((l) =>
              inRange(l.price) ? (
                <line
                  key={`fib-${l.pct}`}
                  x1={0}
                  x2={width}
                  y1={y(l.price)}
                  y2={y(l.price)}
                  stroke="#8C7A2D"
                  strokeWidth={0.9}
                  strokeDasharray="5 4"
                  opacity={0.75}
                />
              ) : null,
            )
          : null}
        {fibOn && fibLevels
          ? [
              { label: "Swing High", value: fibLevels.swingHigh },
              { label: "Swing Low", value: fibLevels.swingLow },
            ].map((s) =>
              inRange(s.value) ? (
                <line
                  key={s.label}
                  x1={0}
                  x2={width}
                  y1={y(s.value)}
                  y2={y(s.value)}
                  stroke="#8C7A2D"
                  strokeWidth={0.9}
                  strokeDasharray="2 3"
                  opacity={0.6}
                />
              ) : null,
            )
          : null}
        {/* Price target: distinct SOLID gold line. */}
        {config.target && inRange(config.target.price) ? (
          <line
            x1={0}
            x2={width}
            y1={y(config.target.price)}
            y2={y(config.target.price)}
            stroke="var(--accent)"
            strokeWidth={1.8}
          />
        ) : null}
        {livePrice != null ? (
          <line
            x1={0}
            x2={width}
            y1={y(livePrice)}
            y2={y(livePrice)}
            stroke="var(--accent-strong)"
            strokeWidth={1}
            strokeDasharray="4 4"
            opacity={0.5}
          />
        ) : null}
      </svg>
      {/* Right-axis price labels for the grid levels. */}
      {gridPrices.map((p, i) => (
        <span
          key={`glbl-${i}`}
          className="num absolute right-0 rounded bg-[var(--surface)]/85 px-1 py-0.5 text-[10px] font-medium text-[var(--dim)]"
          style={{ top: `${yPct(p)}%`, transform: "translateY(-50%)" }}
        >
          {money(p, 0)}
        </span>
      ))}
      {/* Zone band labels at the left axis side. */}
      {zones.map((z) => {
        if (!inRange(z.price)) return null;
        const isSup = z.kind === "support";
        return (
          <span
            key={`lbl-${z.kind}-${z.price}`}
            className="num absolute left-0 rounded px-1.5 py-0.5 text-[11px] font-bold"
            style={{
              top: `${yPct(z.price)}%`,
              transform: "translateY(-50%)",
              color: isSup ? "var(--bull)" : "var(--bear)",
              backgroundColor: isSup
                ? "color-mix(in srgb, var(--bull) 16%, var(--surface))"
                : "color-mix(in srgb, var(--bear) 16%, var(--surface))",
            }}
          >
            {isSup ? "S" : "R"} {money(z.price, 0)} ×{z.touches}
          </span>
        );
      })}
      {/* Pivot line labels at the right axis side. */}
      {pivots.map((p) =>
        inRange(p.value) ? (
          <span
            key={`plbl-${p.label}`}
            className="num absolute right-0 rounded bg-[var(--surface)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--dim)]"
            style={{
              top: `${yPct(p.value)}%`,
              transform: "translateY(-50%)",
            }}
          >
            {p.label} {money(p.value, 0)}
          </span>
        ) : null,
      )}
      {/* Trend labels (one per drawn trend line, at the right edge). */}
      {resSeg && trends.resistance ? (
        <span
          className="absolute right-0 rounded bg-[var(--surface)]/85 px-1.5 py-0.5 text-[11px] font-semibold text-[var(--text)]"
          style={{
            top: `${yPct(trendPriceAt(trends.resistance, lastFullIdx))}%`,
            transform: "translateY(-130%)",
          }}
        >
          Trend
        </span>
      ) : null}
      {supSeg && trends.support ? (
        <span
          className="absolute right-0 rounded bg-[var(--surface)]/85 px-1.5 py-0.5 text-[11px] font-semibold text-[var(--accent-strong)]"
          style={{
            top: `${yPct(trendPriceAt(trends.support, lastFullIdx))}%`,
            transform: "translateY(30%)",
          }}
        >
          Trend
        </span>
      ) : null}
      {/* Fibonacci level labels at the right axis side (below any pivot
          label at the same height is acceptable — values rarely meet). */}
      {fibOn && fibLevels
        ? fibLevels.levels.map((l) =>
            inRange(l.price) ? (
              <span
                key={`flbl-${l.pct}`}
                className="num absolute right-0 rounded px-1.5 py-0.5 text-[11px] font-semibold"
                style={{
                  top: `${yPct(l.price)}%`,
                  transform: "translateY(-50%)",
                  color: "#8C7A2D",
                  backgroundColor:
                    "color-mix(in srgb, var(--accent) 16%, var(--surface))",
                }}
              >
                {l.pct}% · {money(l.price)}
              </span>
            ) : null,
          )
        : null}
      {fibOn && fibLevels
        ? [
            { label: "Swing High", value: fibLevels.swingHigh },
            { label: "Swing Low", value: fibLevels.swingLow },
          ].map((s) =>
            inRange(s.value) ? (
              <span
                key={`slbl-${s.label}`}
                className="num absolute left-0 rounded px-1.5 py-0.5 text-[11px] font-semibold"
                style={{
                  top: `${yPct(s.value)}%`,
                  transform: "translateY(-50%)",
                  color: "#8C7A2D",
                  backgroundColor:
                    "color-mix(in srgb, var(--accent) 16%, var(--surface))",
                }}
              >
                {s.label}
              </span>
            ) : null,
          )
        : null}
      {/* Price target tag: solid gold; pulses once the target is reached. */}
      {config.target && inRange(config.target.price) ? (
        <span
          className={`num absolute left-0 rounded px-1.5 py-0.5 text-[11px] font-bold ${
            config.targetReached ? "animate-pulse" : ""
          }`}
          style={{
            top: `${yPct(config.target.price)}%`,
            transform: "translateY(-50%)",
            backgroundColor: "var(--accent)",
            color: "var(--text)",
          }}
        >
          Target {money(config.target.price)}
        </span>
      ) : null}
      {/* Right-axis last-price chip, TradingView style: solid, colored
          by the forming candle's direction; the candle countdown chip
          sits just LEFT of this axis column (never over a pivot label)
          and ticks every second. */}
      {livePrice != null ? (
        <>
          <span
            className="num absolute right-0 rounded px-1.5 py-0.5 text-[11px] font-bold"
            style={{
              top: `${yPct(livePrice)}%`,
              transform: "translateY(-50%)",
              backgroundColor: formingUp ? "var(--bull)" : "var(--bear)",
              color: "var(--surface)",
            }}
          >
            ${money(livePrice)}
          </span>
          {countdown ? (
            <span
              className="num absolute rounded border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--dim)]"
              style={{
                // Shifted LEFT of the right-axis label column: the
                // countdown never sits on top of a pivot (R1/S1) or grid
                // axis label, even when the live price is right at R1 —
                // it rides beside the price chip instead of under it.
                right: "5.5rem",
                top: `${yPct(livePrice)}%`,
                transform: "translateY(-50%)",
              }}
              aria-label={`Is ${tf} candle ke khatam hone me baqi waqt ${countdown}`}
            >
              {countdown}
            </span>
          ) : null}
        </>
      ) : null}
      </div>
      {/* Time axis: sparse PKT labels from the candle timestamps. */}
      <div className="relative mt-1 h-4" aria-hidden="true">
        {labelIdxs.map((j) => {
          const c = disp[j];
          if (!c) return null;
          return (
            <span
              key={`tlabel-${j}`}
              className="num absolute text-[10px] text-[var(--dim)]"
              style={{
                left: `${((j + 0.5) / Math.max(disp.length, 1)) * 100}%`,
                transform: "translateX(-50%)",
              }}
            >
              {candleTimeLabel(c[0], tf)}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// Explorer chart controls: window selector chips (last 20 / 60 / 100
// candles), EMA 20 / SMA 50 legend toggles, and the price-target setter
// (numeric input + "Target lagao"; a clear button while a target is set).
// Shared by the inline explorer; the full-screen overlay reuses the
// window + toggle rows through the same props.
function ExplorerControls({
  config,
  onWindow,
  onToggleEma,
  onToggleSma,
  onToggleFib,
  targetInput,
  onTargetInput,
  onSetTarget,
  onClearTarget,
  includeTarget = true,
}: {
  config: ChartConfig;
  onWindow: (n: number) => void;
  onToggleEma: () => void;
  onToggleSma: () => void;
  onToggleFib: () => void;
  targetInput: string;
  onTargetInput: (v: string) => void;
  onSetTarget: () => void;
  onClearTarget: () => void;
  includeTarget?: boolean;
}) {
  const chipCls = (active: boolean) =>
    `rounded-full px-3 py-1.5 text-xs transition-colors ${
      active
        ? "border border-[var(--accent-strong)] bg-[var(--accent)] font-bold text-[var(--text)]"
        : "border border-[var(--border)] bg-[var(--surface)] font-medium text-[var(--dim)]"
    }`;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
      <div className="flex items-center gap-1.5" role="group" aria-label="Chart window chuno — kitni candles dikhe">
        <span className="text-xs font-medium text-[var(--dim)]">Candles:</span>
        {[20, 60, 100].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`Aakhri ${n} candles dikhao`}
            aria-pressed={config.windowSize === n}
            onClick={() => onWindow(n)}
            className={chipCls(config.windowSize === n)}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5" role="group" aria-label="Chart lines on ya off karo">
        <button
          type="button"
          aria-label="EMA 20 line on ya off karo"
          aria-pressed={config.showEma}
          onClick={onToggleEma}
          className={chipCls(config.showEma)}
        >
          <span
            className="mr-1.5 inline-block h-0.5 w-3.5 align-middle"
            style={{ backgroundColor: "#C9A227" }}
            aria-hidden="true"
          />
          EMA 20
        </button>
        <button
          type="button"
          aria-label="SMA 50 line on ya off karo"
          aria-pressed={config.showSma}
          onClick={onToggleSma}
          className={chipCls(config.showSma)}
        >
          <span
            className="mr-1.5 inline-block h-0.5 w-3.5 align-middle"
            style={{ backgroundColor: "#7A8CA3" }}
            aria-hidden="true"
          />
          SMA 50
        </button>
        <button
          type="button"
          aria-label="Fibonacci levels chart par on ya off karo"
          aria-pressed={config.showFib}
          onClick={onToggleFib}
          className={chipCls(config.showFib)}
        >
          <span
            className="mr-1.5 inline-block h-0.5 w-3.5 align-middle"
            style={{ backgroundColor: "#8C7A2D" }}
            aria-hidden="true"
          />
          Fib
        </button>
      </div>
      {includeTarget ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <label
            htmlFor="gold-target-input"
            className="flex items-center gap-1.5 text-xs font-medium text-[var(--dim)]"
          >
            <IconTarget className="h-4 w-4 text-[var(--accent-strong)]" />
            Target price
          </label>
          <input
            id="gold-target-input"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={targetInput}
            onChange={(e) => onTargetInput(e.target.value)}
            placeholder="4200.00"
            className="num w-28 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text)]"
          />
          <button
            type="button"
            aria-label="Price target lagao"
            onClick={onSetTarget}
            className="rounded-full border border-[var(--accent-strong)] bg-[var(--accent)] px-3 py-1.5 text-xs font-bold text-[var(--text)]"
          >
            Target lagao
          </button>
          {config.target ? (
            <button
              type="button"
              aria-label="Price target hatao"
              onClick={onClearTarget}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--bear)]"
            >
              <IconX className="h-3.5 w-3.5" />
              Target hatao ({money(config.target.price)})
            </button>
          ) : null}
          {config.target && config.targetReached ? (
            <span className="animate-pulse text-xs font-bold text-[var(--accent-strong)]">
              Target tak price pohanch gayi
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// Explorer view for one selected timeframe: the large candlestick chart
// (with zone bands, pivot lines, trend lines, EMA/SMA, target line) plus
// that timeframe's full details — verdict chip, bull/bear check counts,
// the complete reasons list, and entry / SL / TP when present.
function TimeframeExplorer({
  item,
  livePrice,
  series,
  zones,
  keyLevels,
  fibLevels,
  config,
  controls,
  onExpand,
}: {
  item: Timeframe;
  livePrice: number | null;
  series?: Candle[];
  zones: Zone[];
  keyLevels: KeyLevels | null;
  fibLevels: FibLevels | null;
  config: ChartConfig;
  controls: ReactNode;
  onExpand: () => void;
}) {
  const color = verdictColor(item.verdict);
  const reasons = item.reasons ?? [];
  const candles = series ?? normalizeCandles(item.candles ?? [], item.tf);
  const hasLevels = item.entry != null || item.sl != null || item.tp != null;
  return (
    <article className="panel p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-base font-bold tracking-wide">{item.tf} chart</h3>
          <span
            className="rounded-full px-3 py-1 text-sm font-bold tracking-wide"
            style={{
              color,
              backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`,
              border: `1px solid color-mix(in srgb, ${color} 45%, transparent)`,
            }}
          >
            {item.verdict}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <p className="num text-base text-[var(--dim)]">
            ${money(item.price)}
          </p>
          <button
            type="button"
            aria-label="Chart full-screen me kholo"
            onClick={onExpand}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-strong)]"
          >
            <IconMaximize className="h-4 w-4" />
            Bara chart
          </button>
        </div>
      </div>
      <p className="num mt-3 text-sm">
        <span className="font-semibold text-[var(--bull)]">
          Bull {item.bull} checks
        </span>
        <span className="text-[var(--dim)]"> · </span>
        <span className="font-semibold text-[var(--bear)]">
          Bear {item.bear} checks
        </span>
      </p>
      {item.adx != null || item.breakout ? (
        <div className="mt-4 flex flex-wrap items-start gap-4">
          <AdxMeter adx={item.adx} large />
          <BreakoutChip breakout={item.breakout} />
        </div>
      ) : null}
      <div className="mt-4">{controls}</div>
      {candles.length >= 2 ? (
        <div className="mt-4">
          <BigCandleChart
            candles={candles}
            livePrice={livePrice}
            tf={item.tf}
            zones={zones}
            keyLevels={keyLevels}
            fibLevels={fibLevels}
            config={config}
          />
        </div>
      ) : (
        <p className="mt-5 text-sm leading-[1.55] text-[var(--dim)]">
          Is timeframe ka candle data abhi nahi aya — agli scan (1 minute) me
          chart ajayega.
        </p>
      )}
      {reasons.length > 0 ? (
        <div className="mt-5">
          <p className="text-sm font-semibold">Poori wajah — saare reasons</p>
          <ul className="mt-2.5 grid gap-1.5">
            {reasons.map((r) => (
              <li key={r} className="text-sm leading-[1.55] text-[var(--dim)]">
                · {r}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {hasLevels ? (
        <div className="mt-5 grid grid-cols-3 gap-2 border-t border-[var(--border)] pt-4 text-center">
          <div>
            <p className="text-[11px] text-[var(--dim)]">Entry</p>
            <p className="num mt-0.5 text-base font-semibold">
              {item.entry != null ? `$${money(item.entry)}` : "—"}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-[var(--dim)]">Stop-loss</p>
            <p className="num mt-0.5 text-base font-semibold text-[var(--bear)]">
              {item.sl != null ? `$${money(item.sl)}` : "—"}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-[var(--dim)]">Take-profit</p>
            <p className="num mt-0.5 text-base font-semibold text-[var(--bull)]">
              {item.tp != null ? `$${money(item.tp)}` : "—"}
            </p>
          </div>
        </div>
      ) : null}
    </article>
  );
}

// Step 3 — AI Note: the Dahl AI layer's short Hinglish note on the final
// verdict, shown directly under the hero. When no note has been written
// yet, only the placeholder line shows. The note text arrives as separate
// lines (line breaks); each line renders as its own paragraph so the note
// reads structured instead of one dense block. A small colored chip next
// to the heading carries the verdict word the note was written for.
function AiNoteSection({ snapshot }: { snapshot: Snapshot | null }) {
  const note = snapshot?.aiNote ?? null;
  const lines = note
    ? cleanText(note.text)
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
    : [];
  const chipWord: VerdictWord =
    note?.forWord === "BUY" || note?.forWord === "SELL"
      ? note.forWord
      : "WAIT";
  const chipColor = verdictColor(chipWord);
  return (
    <section aria-label="AI note" className="mt-10">
      <div
        className="panel p-5 sm:p-6"
        style={{ borderLeft: "3px solid var(--accent)" }}
      >
        <div className="flex flex-wrap items-center gap-2.5">
          <p className="flex items-center gap-2 text-base font-bold">
            <IconRobot className="h-5 w-5 text-[var(--accent-strong)]" />
            AI Note
          </p>
          {note ? (
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-bold tracking-wide"
              style={{
                color: chipColor,
                backgroundColor: `color-mix(in srgb, ${chipColor} 14%, transparent)`,
                border: `1px solid color-mix(in srgb, ${chipColor} 45%, transparent)`,
              }}
            >
              {note.forWord}
            </span>
          ) : null}
        </div>
        {note ? (
          <>
            <div className="mt-3.5 space-y-2.5">
              {lines.map((line, i) => (
                <p key={i} className="text-base leading-[1.65]">
                  {line}
                </p>
              ))}
            </div>
            <p className="mt-4 border-t border-[var(--border)] pt-3 text-xs text-[var(--dim)]">
              {note.model} · {note.at}
            </p>
          </>
        ) : (
          <p className="mt-2.5 text-sm leading-[1.55] text-[var(--dim)]">
            AI note verdict badalne par ayega
          </p>
        )}
      </div>
    </section>
  );
}

// Step 3 — News ka Asar: the mood of the latest gold news from the Dahl AI
// layer. Renders nothing at all until a news mood has been stored.
function NewsMoodSection({ snapshot }: { snapshot: Snapshot | null }) {
  const mood = snapshot?.newsMood ?? null;
  if (!mood) return null;
  const badgeCls =
    mood.label === "Bullish"
      ? "border-[var(--bull)]/50 text-[var(--bull)]"
      : mood.label === "Bearish"
        ? "border-[var(--bear)]/50 text-[var(--bear)]"
        : "border-[var(--wait)]/60 text-[var(--wait)]";
  const scoreColor =
    mood.label === "Bullish"
      ? "var(--bull)"
      : mood.label === "Bearish"
        ? "var(--bear)"
        : "var(--wait)";
  // Marker position on the -100..+100 bar, as a percentage (0% = -100,
  // 50% = 0, 100% = +100).
  const markerPct = (Math.max(-100, Math.min(100, mood.score)) + 100) / 2;
  return (
    <section aria-label="News ka asar" className="mt-14">
      <SectionTitle icon={<IconNews />}>News ka Asar</SectionTitle>
      <div className="panel mt-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`rounded-full border bg-[var(--surface-2)] px-3.5 py-1.5 text-sm font-bold ${badgeCls}`}
          >
            {mood.label}
          </span>
          <span className="num text-lg font-bold" style={{ color: scoreColor }}>
            {mood.score >= 0 ? "+" : ""}
            {mood.score}
          </span>
        </div>
        <div
          className="relative mt-4 h-1.5 rounded-full bg-[var(--surface-2)]"
          role="img"
          aria-label={`News score ${mood.score >= 0 ? "+" : ""}${mood.score}, -100 se +100 ke scale par`}
        >
          <span
            className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-[var(--dim)]"
            style={{ left: "50%" }}
          />
          <span
            className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--surface)] shadow"
            style={{ left: `${markerPct}%`, backgroundColor: scoreColor }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-[var(--dim)]">
          <span className="num">-100</span>
          <span className="num">0</span>
          <span className="num">+100</span>
        </div>
        <p className="mt-3.5 text-base leading-[1.55]">{cleanText(mood.line)}</p>
        <p className="mt-3.5 border-l-2 border-[var(--accent)] pl-3.5 text-sm leading-[1.55] text-[var(--dim)] italic">
          “{cleanText(mood.headline)}”
        </p>
        <p className="mt-3.5 text-xs text-[var(--dim)]">
          {mood.at} · {mood.model}
        </p>
      </div>
    </section>
  );
}

function TimeframesPanel({
  snapshot,
  livePrice,
  liveSeriesMap,
  onRefresh,
  refreshing,
}: {
  snapshot: Snapshot;
  livePrice: number | null;
  liveSeriesMap: Record<string, SeriesState>;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const tfs = snapshot.timeframes ?? [];
  const ordered = [...tfs].sort((a, b) => {
    const ia = TF_ORDER.indexOf(a.tf as (typeof TF_ORDER)[number]);
    const ib = TF_ORDER.indexOf(b.tf as (typeof TF_ORDER)[number]);
    return (ia === -1 ? TF_ORDER.length : ia) - (ib === -1 ? TF_ORDER.length : ib);
  });
  // Chart explorer selection: "ALL" shows the 9-card grid (default); a
  // timeframe label shows that timeframe's large chart + full details.
  // Purely client-side — all data is already in the snapshot.
  const [selected, setSelected] = useState<string>("ALL");
  const selectedItem =
    selected === "ALL"
      ? null
      : (ordered.find((i) => i.tf === selected) ?? null);
  // The selected timeframe's live series (adopted + tick-evolved); falls
  // back to the snapshot's candles, normalized, before adoption lands.
  const selectedCandles: Candle[] = selectedItem
    ? (liveSeriesMap[selectedItem.tf]?.candles ??
      normalizeCandles(selectedItem.candles ?? [], selectedItem.tf))
    : [];
  const chipCls = (active: boolean) =>
    `rounded-full px-3.5 py-1.5 text-sm transition-colors ${
      active
        ? "border border-[var(--accent-strong)] bg-[var(--accent)] font-bold text-[var(--text)]"
        : "border border-[var(--border)] bg-[var(--surface)] font-medium text-[var(--dim)]"
    }`;

  // Phase 1 chart state — shared by the inline explorer and the
  // full-screen overlay so selections survive opening/closing it.
  const [windowSize, setWindowSize] = useState<number>(60);
  const [showEma, setShowEma] = useState<boolean>(true);
  const [showSma, setShowSma] = useState<boolean>(false);
  const [showFib, setShowFib] = useState<boolean>(false);
  const [fullscreen, setFullscreen] = useState<boolean>(false);
  // Price target: persisted in localStorage ("goldTargetPrice" + the live
  // price at set time in "goldTargetBasePrice"). Client-side only.
  const [target, setTarget] = useState<TargetState | null>(() => {
    try {
      const raw = window.localStorage.getItem("goldTargetPrice");
      if (!raw) return null;
      const price = Number(raw);
      if (!Number.isFinite(price) || price <= 0) return null;
      const baseRaw = window.localStorage.getItem("goldTargetBasePrice");
      const base = baseRaw ? Number(baseRaw) : NaN;
      return { price, basePrice: Number.isFinite(base) ? base : null };
    } catch {
      return null;
    }
  });
  const [targetInput, setTargetInput] = useState<string>("");
  const [targetReached, setTargetReached] = useState<boolean>(false);
  // Reach check on every live tick: the live price reaches/crosses the
  // target in the direction it was set (above the then-price -> live >=
  // target; below -> live <= target), or comes within 0.1% of it. The
  // reached state latches (tag pulses) until the user clears the target.
  useEffect(() => {
    if (!target || livePrice == null || targetReached) return;
    const near = Math.abs(livePrice - target.price) / target.price <= 0.001;
    const crossed =
      target.basePrice == null
        ? false
        : target.price >= target.basePrice
          ? livePrice >= target.price
          : livePrice <= target.price;
    if (near || crossed) setTargetReached(true);
  }, [livePrice, target, targetReached]);
  const setTargetFromInput = () => {
    const price = Number(targetInput);
    if (!Number.isFinite(price) || price <= 0) return;
    const next: TargetState = { price, basePrice: livePrice };
    try {
      window.localStorage.setItem("goldTargetPrice", String(price));
      if (livePrice != null) {
        window.localStorage.setItem("goldTargetBasePrice", String(livePrice));
      } else {
        window.localStorage.removeItem("goldTargetBasePrice");
      }
    } catch {
      // Storage unavailable — the target still applies for this session.
    }
    setTarget(next);
    setTargetReached(false);
    setTargetInput("");
  };
  const clearTarget = () => {
    try {
      window.localStorage.removeItem("goldTargetPrice");
      window.localStorage.removeItem("goldTargetBasePrice");
    } catch {
      // Nothing to clear.
    }
    setTarget(null);
    setTargetReached(false);
  };
  const chartConfig: ChartConfig = {
    windowSize,
    showEma,
    showSma,
    showFib,
    target,
    targetReached,
  };
  const zones = snapshot.zones ?? [];
  const explorerControls = (
    <ExplorerControls
      config={chartConfig}
      onWindow={setWindowSize}
      onToggleEma={() => setShowEma((v) => !v)}
      onToggleSma={() => setShowSma((v) => !v)}
      onToggleFib={() => setShowFib((v) => !v)}
      targetInput={targetInput}
      onTargetInput={setTargetInput}
      onSetTarget={setTargetFromInput}
      onClearTarget={clearTarget}
    />
  );
  return (
    <section aria-label="Saare timeframes" className="mt-14">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionTitle icon={<IconCandles />}>
          Saare Timeframes — Har Chart Ka Jawab
        </SectionTitle>
        <button
          type="button"
          aria-label="Live price abhi refresh karo"
          onClick={onRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--accent-strong)] px-4 py-2 text-sm font-semibold text-[var(--accent-strong)] transition-opacity disabled:opacity-50"
        >
          <IconRefresh className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          {refreshing ? "Refresh ho raha hai…" : "Refresh"}
        </button>
      </div>
      {ordered.length === 0 ? (
        <p className="panel mt-4 p-5 text-sm leading-[1.55] text-[var(--dim)]">
          Timeframe data abhi nahi aya — agli scan (1 minute) me ajayega.
        </p>
      ) : (
        <>
          <div
            className="mt-5 flex flex-wrap gap-2"
            role="group"
            aria-label="Timeframe chuno"
          >
            <button
              type="button"
              aria-label="Saare timeframes aik sath dekho"
              aria-pressed={selected === "ALL"}
              onClick={() => setSelected("ALL")}
              className={chipCls(selected === "ALL")}
            >
              Saare
            </button>
            {TF_ORDER.map((tf) => (
              <button
                key={tf}
                type="button"
                aria-label={`${tf} timeframe ka chart dekho`}
                aria-pressed={selected === tf}
                onClick={() => setSelected(tf)}
                className={chipCls(selected === tf)}
              >
                {tf}
              </button>
            ))}
          </div>
          {selectedItem ? (
            <div className="mt-5">
              <TimeframeExplorer
                item={selectedItem}
                livePrice={livePrice}
                series={liveSeriesMap[selectedItem.tf]?.candles}
                zones={zones}
                keyLevels={snapshot.keyLevels ?? null}
                fibLevels={snapshot.fibLevels ?? null}
                config={chartConfig}
                controls={explorerControls}
                onExpand={() => setFullscreen(true)}
              />
            </div>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
              {ordered.map((item) => (
                <TimeframeCard
                  key={item.tf}
                  item={item}
                  livePrice={livePrice}
                  series={liveSeriesMap[item.tf]?.candles}
                />
              ))}
            </div>
          )}
        </>
      )}
      {/* Full-screen chart overlay: same live chart rendering (candles,
          live price line + tag, zone bands, pivot lines, trend lines,
          target line), with switchable TF chips, window chips and
          EMA/SMA toggles. Closing returns to the normal view with all
          selections preserved. */}
      {fullscreen && selectedItem ? (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-[var(--bg)]"
          role="dialog"
          aria-modal="true"
          aria-label={`${selectedItem.tf} chart full-screen`}
        >
          <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-lg font-bold tracking-wide">
                  {selectedItem.tf} chart
                </h3>
                <span
                  className="rounded-full px-3 py-1 text-sm font-bold tracking-wide"
                  style={{
                    color: verdictColor(selectedItem.verdict),
                    backgroundColor: `color-mix(in srgb, ${verdictColor(selectedItem.verdict)} 14%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${verdictColor(selectedItem.verdict)} 45%, transparent)`,
                  }}
                >
                  {selectedItem.verdict}
                </span>
                <p className="num text-base text-[var(--dim)]">
                  ${money(selectedItem.price)}
                </p>
              </div>
              <button
                type="button"
                aria-label="Full-screen chart band karo"
                onClick={() => setFullscreen(false)}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-sm font-semibold text-[var(--bear)]"
              >
                <IconX />
                Band karo
              </button>
            </div>
            <div
              className="mt-4 flex flex-wrap gap-2"
              role="group"
              aria-label="Full-screen me timeframe badlo"
            >
              {TF_ORDER.map((tf) => (
                <button
                  key={tf}
                  type="button"
                  aria-label={`Full-screen me ${tf} timeframe ka chart dekho`}
                  aria-pressed={selected === tf}
                  onClick={() => setSelected(tf)}
                  className={chipCls(selected === tf)}
                >
                  {tf}
                </button>
              ))}
            </div>
            <div className="mt-4">
              <ExplorerControls
                config={chartConfig}
                onWindow={setWindowSize}
                onToggleEma={() => setShowEma((v) => !v)}
                onToggleSma={() => setShowSma((v) => !v)}
                onToggleFib={() => setShowFib((v) => !v)}
                targetInput={targetInput}
                onTargetInput={setTargetInput}
                onSetTarget={setTargetFromInput}
                onClearTarget={clearTarget}
                includeTarget={false}
              />
            </div>
            <p className="num mt-4 text-sm">
              <span className="font-semibold text-[var(--bull)]">
                Bull {selectedItem.bull} checks
              </span>
              <span className="text-[var(--dim)]"> · </span>
              <span className="font-semibold text-[var(--bear)]">
                Bear {selectedItem.bear} checks
              </span>
            </p>
            <div className="panel mt-4 p-4 sm:p-5">
              {selectedCandles.length >= 2 ? (
                <BigCandleChart
                  candles={selectedCandles}
                  livePrice={livePrice}
                  tf={selectedItem.tf}
                  zones={zones}
                  keyLevels={snapshot.keyLevels ?? null}
                  fibLevels={snapshot.fibLevels ?? null}
                  config={chartConfig}
                  tall
                />
              ) : (
                <p className="text-sm leading-[1.55] text-[var(--dim)]">
                  Is timeframe ka candle data abhi nahi aya — agli scan (1
                  minute) me chart ajayega.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ChecksList({ snapshot }: { snapshot: Snapshot }) {
  const bull = snapshot.checks.filter((c) => c.side === "bull");
  const bear = snapshot.checks.filter((c) => c.side === "bear");
  return (
    <section aria-label="Analysis checks" className="mt-14">
      <SectionTitle icon={<IconListChecks />}>54 Checks ka result</SectionTitle>
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div className="panel p-5 sm:p-6">
          <p className="text-sm font-semibold text-[var(--bull)]">
            Bullish pass — {bull.length}
          </p>
          <ul className="mt-2.5 flex flex-wrap gap-1.5">
            {bull.map((c) => (
              <li
                key={c.name}
                className="rounded-full border border-[var(--bull)]/40 bg-[var(--surface-2)] px-2.5 py-1 text-xs"
              >
                {c.name}
              </li>
            ))}
          </ul>
        </div>
        <div className="panel p-5 sm:p-6">
          <p className="text-sm font-semibold text-[var(--bear)]">
            Bearish pass — {bear.length}
          </p>
          <ul className="mt-2.5 flex flex-wrap gap-1.5">
            {bear.map((c) => (
              <li
                key={c.name}
                className="rounded-full border border-[var(--bear)]/40 bg-[var(--surface-2)] px-2.5 py-1 text-xs"
              >
                {c.name}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-[var(--dim)]">
            Baaki {snapshot.neutralCount} checks neutral rahe — na bullish, na
            bearish.
          </p>
        </div>
      </div>
    </section>
  );
}

function KeyLevelsSection({
  snapshot,
  livePrice,
}: {
  snapshot: Snapshot;
  livePrice: number | null;
}) {
  const kl = snapshot.keyLevels ?? null;
  const price = livePrice ?? snapshot.spotPrice;
  type LadderRow = {
    label: string;
    value: number;
    cls: string;
    live?: boolean;
  };
  const ladder: LadderRow[] = [];
  if (kl) {
    if (kl.r2 != null)
      ladder.push({ label: "Resistance 2 (R2)", value: kl.r2, cls: "text-[var(--bear)]" });
    if (kl.r1 != null)
      ladder.push({ label: "Resistance 1 (R1)", value: kl.r1, cls: "text-[var(--bear)]" });
    if (kl.pivot != null)
      ladder.push({ label: "Pivot", value: kl.pivot, cls: "text-[var(--accent-strong)]" });
    if (kl.s1 != null)
      ladder.push({ label: "Support 1 (S1)", value: kl.s1, cls: "text-[var(--bull)]" });
    if (kl.s2 != null)
      ladder.push({ label: "Support 2 (S2)", value: kl.s2, cls: "text-[var(--bull)]" });
  }
  const hasLevels = ladder.length > 0;
  if (hasLevels && price != null) {
    ladder.push({
      label: "Live price",
      value: price,
      cls: "text-[var(--accent-strong)]",
      live: true,
    });
  }
  ladder.sort((a, b) => b.value - a.value);
  return (
    <section aria-label="Key levels" className="mt-14">
      <SectionTitle icon={<IconSliders />}>
        Key Levels — Support / Resistance
      </SectionTitle>
      {!hasLevels ? (
        <p className="panel mt-4 p-5 text-sm leading-[1.55] text-[var(--dim)]">
          Key levels abhi nahi aye — agli scan (1 minute) me ajayenge.
        </p>
      ) : (
        <div className="panel mt-5 p-5 sm:p-6">
          <ul className="grid gap-1">
            {ladder.map((row) => (
              <li
                key={row.label}
                className={`flex items-baseline justify-between gap-3 px-3 py-2.5 ${
                  row.live ? "rounded-lg bg-[var(--surface-2)]" : ""
                }`}
              >
                <span
                  className={`flex items-center gap-2 text-sm ${row.live ? "font-bold" : "font-semibold"} ${row.cls}`}
                >
                  {row.live ? (
                    <span
                      className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent-strong)]"
                      aria-hidden="true"
                    />
                  ) : null}
                  {row.label}
                </span>
                <span
                  className={`num text-sm ${row.live ? "font-bold text-[var(--accent-strong)]" : "font-semibold"}`}
                >
                  ${money(row.value)}
                </span>
              </li>
            ))}
          </ul>
          {kl &&
          (kl.prevHigh != null ||
            kl.prevLow != null ||
            kl.prevClose != null ||
            kl.dayHigh != null ||
            kl.dayLow != null) ? (
            <p className="num mt-3 border-t border-[var(--border)] pt-3 text-xs leading-[1.55] text-[var(--dim)]">
              Pichla din — High{" "}
              {kl.prevHigh != null ? `$${money(kl.prevHigh)}` : "—"} · Low{" "}
              {kl.prevLow != null ? `$${money(kl.prevLow)}` : "—"} · Close{" "}
              {kl.prevClose != null ? `$${money(kl.prevClose)}` : "—"}
              {"  |  "}Aaj — High{" "}
              {kl.dayHigh != null ? `$${money(kl.dayHigh)}` : "—"} · Low{" "}
              {kl.dayLow != null ? `$${money(kl.dayLow)}` : "—"}
            </p>
          ) : null}
          <p className="mt-2 text-xs leading-[1.55] text-[var(--dim)]">
            Levels pichle din ki candles se bane classic pivot points hain —
            price resistance ke paas rukti hai, support par sahara leti hai.
            TP/SL inhi levels ke hisab se samajhna asaan hota hai.
          </p>
        </div>
      )}
    </section>
  );
}

// Support / Resistance Zones list: the engine's real detected zones
// (price levels where price repeatedly stopped), one row per zone — kind
// chip, price, touches, and a strength meter. Hidden entirely when the
// zones field is empty or missing.
function ZonesListSection({ snapshot }: { snapshot: Snapshot }) {
  const zones = snapshot.zones ?? [];
  if (zones.length === 0) return null;
  const ordered = [...zones].sort((a, b) => b.price - a.price);
  return (
    <section aria-label="Support resistance zones" className="mt-14">
      <SectionTitle icon={<IconSliders />}>
        Support / Resistance Zones
      </SectionTitle>
      <div className="panel mt-5 p-5 sm:p-6">
        <ul className="grid gap-1">
          {ordered.map((z) => {
            const isSup = z.kind === "support";
            const color = isSup ? "var(--bull)" : "var(--bear)";
            // Strength meter: values <= 1 read as a fraction, larger
            // values as a 0–100 score; both clamp to the bar.
            const pct = Math.max(
              0,
              Math.min(100, z.strength <= 1 ? z.strength * 100 : z.strength),
            );
            return (
              <li
                key={`${z.kind}-${z.price}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5"
              >
                <span
                  className="rounded-full px-2.5 py-0.5 text-xs font-bold tracking-wide"
                  style={{
                    color,
                    backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${color} 45%, transparent)`,
                  }}
                >
                  {isSup ? "Support" : "Resistance"}
                </span>
                <span className="num text-sm font-bold">
                  ${money(z.price)}
                </span>
                <span className="num text-xs text-[var(--dim)]">
                  ×{z.touches} touches
                </span>
                <span className="ml-auto flex items-center gap-2">
                  <span className="text-[11px] text-[var(--dim)]">Taqat</span>
                  <span
                    className="h-2 w-20 overflow-hidden rounded-full bg-[var(--surface-2)]"
                    role="img"
                    aria-label={`Zone ki taqat ${Math.round(pct)} percent`}
                  >
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs leading-[1.55] text-[var(--dim)]">
          Ye zones asal price history se bane hain — jahan price baar baar
          ruki ya wapas mudhi, wahi ilaqa mazboot support ya resistance
          banta hai.
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Phase 2 sections: Volatility, Correlation, Divergences, Chart Patterns,
// Score History, Fibonacci list. All read optional snapshot fields and
// degrade gracefully on snapshots that predate Phase 2.
// ---------------------------------------------------------------------------

// Volatility (#8): the engine's ATR snapshot — a big label badge (Sust =
// muted grey-green, Normal = warm amber, Tez = muted brick) plus the
// daily and 1H ATR percentages. Hidden when volatility is null.
function VolatilitySection({ snapshot }: { snapshot: Snapshot }) {
  const vol = snapshot.volatility ?? null;
  if (!vol) return null;
  const color =
    vol.label === "Sust"
      ? "color-mix(in srgb, var(--bull) 55%, var(--dim))"
      : vol.label === "Tez"
        ? "var(--bear)"
        : "var(--wait)";
  return (
    <section aria-label="Volatility" className="mt-14">
      <SectionTitle icon={<IconSliders />}>Volatility</SectionTitle>
      <div className="panel mt-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-4">
          <span
            className="rounded-full px-4 py-2 text-base font-bold tracking-wide"
            style={{
              color,
              backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`,
              border: `1px solid color-mix(in srgb, ${color} 45%, transparent)`,
            }}
          >
            {vol.label}
          </span>
          <div className="grid flex-1 grid-cols-2 gap-2 text-center">
            <div className="rounded-lg bg-[var(--surface-2)] px-2 py-2.5">
              <p className="num text-base font-bold">
                Daily ATR {money(vol.dailyAtrPct)}%
              </p>
              <p className="mt-0.5 text-xs text-[var(--dim)]">
                Roz ki harkat
              </p>
            </div>
            <div className="rounded-lg bg-[var(--surface-2)] px-2 py-2.5">
              <p className="num text-base font-bold">
                1H ATR {money(vol.h1AtrPct)}%
              </p>
              <p className="mt-0.5 text-xs text-[var(--dim)]">
                Har ghante ki harkat
              </p>
            </div>
          </div>
        </div>
        <div
          className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--surface-2)]"
          role="img"
          aria-label={`Volatility meter — Daily ATR ${money(vol.dailyAtrPct)} percent, label ${vol.label}`}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.max(2, Math.min(100, (vol.dailyAtrPct / 3) * 100))}%`,
              backgroundColor: color,
            }}
          />
        </div>
        <p className="mt-3 text-xs leading-[1.55] text-[var(--dim)]">
          Label Daily ATR% par: 0.9 se kam Sust, 1.8 se zyada Tez — meter
          0 se 3% ke scale par hai
        </p>
      </div>
    </section>
  );
}

// One-line Hinglish reading of a correlation value. A strongly negative
// DXY reading names the dollar/gold relationship explicitly.
function correlationReading(v: number, isDxy = false): string {
  if (isDxy && v <= -0.5)
    return "Mazboot ulta rishta — dollar ulta chalta hai, gold ke liye madadgar rujhan";
  if (v <= -0.5) return "Mazboot ulta rishta";
  if (v <= -0.2) return "Halka ulta rishta";
  if (v < 0.2) return "Koi saaf rishta nahi";
  if (v < 0.5) return "Halka seedha rishta";
  return "Mazboot seedha rishta";
}

function corrText(v: number): string {
  return `${v < 0 ? "−" : "+"}${money(Math.abs(v))}`;
}

// Correlation (#7): gold's relationship with DXY, US 10Y and Silver —
// a center-zero bar from -1 to +1 per row, the value, and its reading.
// A row whose value is null is hidden; when all three are null (or the
// whole field is absent) the section hides entirely.
function CorrelationSection({ snapshot }: { snapshot: Snapshot }) {
  const corr = snapshot.correlations ?? null;
  if (!corr) return null;
  const allRows: { label: string; value: number | null; isDxy?: boolean }[] =
    [
      { label: "DXY (Dollar Index)", value: corr.dxy, isDxy: true },
      { label: "US 10Y (Bond Yield)", value: corr.us10y },
      { label: "Silver", value: corr.silver },
    ];
  const rows = allRows.filter(
    (r): r is { label: string; value: number; isDxy?: boolean } =>
      r.value != null,
  );
  if (rows.length === 0) return null;
  return (
    <section aria-label="Correlation" className="mt-14">
      <SectionTitle icon={<IconScales />}>
        Correlation — Gold ka Rishta
      </SectionTitle>
      <div className="panel mt-5 grid gap-5 p-5 sm:p-6">
        {rows.map((row) => {
          const clamped = Math.max(-1, Math.min(1, row.value));
          return (
            <div key={row.label}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold">{row.label}</span>
                <span className="num text-base font-bold text-[var(--accent-strong)]">
                  {corrText(clamped)}
                </span>
              </div>
              <div
                className="relative mt-2 h-2 rounded-full bg-[var(--surface-2)]"
                role="img"
                aria-label={`${row.label} correlation ${corrText(clamped)}`}
              >
                <span
                  className="absolute top-1/2 h-3.5 w-px -translate-y-1/2 bg-[var(--dim)]"
                  style={{ left: "50%" }}
                />
                {clamped !== 0 ? (
                  <span
                    className="absolute top-0 h-full rounded-full"
                    style={{
                      left: clamped < 0 ? `${50 + clamped * 50}%` : "50%",
                      width: `${Math.abs(clamped) * 50}%`,
                      backgroundColor: "var(--accent-strong)",
                      opacity: 0.75,
                    }}
                  />
                ) : null}
              </div>
              <div className="mt-1 flex justify-between text-[11px] text-[var(--dim)]">
                <span className="num">−1</span>
                <span className="num">0</span>
                <span className="num">+1</span>
              </div>
              <p className="mt-1.5 text-xs leading-[1.55] text-[var(--dim)]">
                {correlationReading(clamped, row.isDxy)}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// Divergences (#10): only the timeframes whose divergence flag is set,
// in timeframe order. When none are set, the honest empty line shows.
function DivergencesSection({ snapshot }: { snapshot: Snapshot }) {
  const tfs = snapshot.timeframes ?? [];
  const ordered = [...tfs].sort((a, b) => {
    const ia = TF_ORDER.indexOf(a.tf as (typeof TF_ORDER)[number]);
    const ib = TF_ORDER.indexOf(b.tf as (typeof TF_ORDER)[number]);
    return (ia === -1 ? TF_ORDER.length : ia) - (ib === -1 ? TF_ORDER.length : ib);
  });
  const divs = ordered.filter((t) => t.divergence != null);
  return (
    <section aria-label="Divergences" className="mt-14">
      <SectionTitle icon={<IconCandles />}>Divergences</SectionTitle>
      {divs.length === 0 ? (
        <p className="panel mt-4 p-5 text-sm leading-[1.55] text-[var(--dim)]">
          Abhi koi divergence active nahi hai.
        </p>
      ) : (
        <ul className="panel mt-5 grid gap-1 p-3 sm:p-4">
          {divs.map((t) => {
            const bullish = t.divergence === "bullish";
            const color = bullish ? "var(--bull)" : "var(--bear)";
            return (
              <li
                key={t.tf}
                className="flex flex-wrap items-center gap-2.5 rounded-lg px-3 py-2.5 odd:bg-[var(--surface-2)]"
              >
                <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-0.5 text-xs font-bold">
                  {t.tf}
                </span>
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold tracking-wide"
                  style={{
                    color,
                    backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${color} 45%, transparent)`,
                  }}
                >
                  {bullish ? (
                    <IconTrendUp className="h-3.5 w-3.5" />
                  ) : (
                    <IconTrendDown className="h-3.5 w-3.5" />
                  )}
                  {bullish ? "Bullish Divergence" : "Bearish Divergence"}
                </span>
                <span className="text-xs text-[var(--dim)]">
                  Price aur momentum alag simt — palatne ka ishara ho sakta
                  hai
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// Chart Patterns (#15): the engine's detected patterns across all
// timeframes, sorted by timeframe order. Empty state line when none.
function PatternsSection({ snapshot }: { snapshot: Snapshot }) {
  const patterns = snapshot.patterns ?? [];
  const ordered = [...patterns].sort((a, b) => {
    const ia = TF_ORDER.indexOf(a.tf as (typeof TF_ORDER)[number]);
    const ib = TF_ORDER.indexOf(b.tf as (typeof TF_ORDER)[number]);
    return (ia === -1 ? TF_ORDER.length : ia) - (ib === -1 ? TF_ORDER.length : ib);
  });
  return (
    <section aria-label="Chart patterns" className="mt-14">
      <SectionTitle icon={<IconCandles />}>Chart Patterns</SectionTitle>
      {ordered.length === 0 ? (
        <p className="panel mt-4 p-5 text-sm leading-[1.55] text-[var(--dim)]">
          Abhi kisi timeframe par pattern nahi bana.
        </p>
      ) : (
        <ul className="panel mt-5 grid gap-1 p-3 sm:p-4">
          {ordered.map((p, i) => {
            const color = p.side === "bull" ? "var(--bull)" : "var(--bear)";
            return (
              <li
                key={`${p.tf}-${p.name}-${i}`}
                className="flex flex-wrap items-center gap-2.5 rounded-lg px-3 py-2.5 odd:bg-[var(--surface-2)]"
              >
                <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-0.5 text-xs font-bold">
                  {p.tf}
                </span>
                <span className="text-sm font-semibold">{p.name}</span>
                <span
                  className="rounded-full px-2.5 py-0.5 text-xs font-bold tracking-wide"
                  style={{
                    color,
                    backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${color} 45%, transparent)`,
                  }}
                >
                  {p.side === "bull" ? "Bull" : "Bear"}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// Score History (#14): hand-drawn SVG line chart of the bull/bear check
// scores over successive scans; the "Final Score" chip switches to a
// single symmetric line of the weighted final score with a zero axis.
// With fewer than 2 entries the honest "abhi ban rahi hai" line shows.
function ScoreHistorySection({ snapshot }: { snapshot: Snapshot }) {
  const hist = snapshot.scoreHistory ?? [];
  const [showFinal, setShowFinal] = useState<boolean>(false);
  const timePart = (t: string): string => {
    const idx = t.indexOf(", ");
    return idx >= 0 ? t.slice(idx + 2) : t;
  };
  const W = 600;
  const H = 170;
  const PAD = 8;
  let chart: ReactNode = null;
  if (hist.length >= 2) {
    const x = (i: number) =>
      PAD + (i / (hist.length - 1)) * (W - PAD * 2);
    if (showFinal) {
      const maxAbs = Math.max(
        5,
        ...hist.map((h) => Math.abs(h.finalScore)),
      );
      const y = (v: number) =>
        H / 2 - (v / maxAbs) * (H / 2 - PAD);
      const pts = hist
        .map((h, i) => `${x(i)},${y(h.finalScore)}`)
        .join(" ");
      chart = (
        <svg
          role="img"
          aria-label={`Final score history graph — kam az kam ${-maxAbs}, zyada se zyada +${maxAbs}`}
          className="block h-44 w-full"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
        >
          <line
            x1={PAD}
            x2={W - PAD}
            y1={H / 2}
            y2={H / 2}
            stroke="var(--dim)"
            strokeWidth={0.8}
            strokeDasharray="4 3"
            opacity={0.7}
          />
          <polyline
            points={pts}
            fill="none"
            stroke="var(--accent-strong)"
            strokeWidth={1.8}
          />
        </svg>
      );
    } else {
      const maxY = Math.max(
        10,
        ...hist.map((h) => Math.max(h.bull, h.bear)),
      );
      const y = (v: number) => H - PAD - (v / maxY) * (H - PAD * 2);
      const bullPts = hist.map((h, i) => `${x(i)},${y(h.bull)}`).join(" ");
      const bearPts = hist.map((h, i) => `${x(i)},${y(h.bear)}`).join(" ");
      chart = (
        <svg
          role="img"
          aria-label={`Score history graph — bull aur bear scores, scale 0 se ${maxY}`}
          className="block h-44 w-full"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
        >
          <polyline
            points={bullPts}
            fill="none"
            stroke="var(--bull)"
            strokeWidth={1.8}
            opacity={0.85}
          />
          <polyline
            points={bearPts}
            fill="none"
            stroke="var(--bear)"
            strokeWidth={1.8}
            opacity={0.85}
          />
        </svg>
      );
    }
  }
  const first = hist[0];
  const last = hist[hist.length - 1];
  return (
    <section aria-label="Score history" className="mt-14">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionTitle icon={<IconHistory />}>Score History</SectionTitle>
        {hist.length >= 2 ? (
          <button
            type="button"
            aria-label="Final score wala graph dikhao ya band karo"
            aria-pressed={showFinal}
            onClick={() => setShowFinal((v) => !v)}
            className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
              showFinal
                ? "border border-[var(--accent-strong)] bg-[var(--accent)] font-bold text-[var(--text)]"
                : "border border-[var(--border)] bg-[var(--surface)] font-medium text-[var(--dim)]"
            }`}
          >
            Final Score
          </button>
        ) : null}
      </div>
      {hist.length < 2 ? (
        <p className="panel mt-4 p-5 text-sm leading-[1.55] text-[var(--dim)]">
          Score history abhi banti ja rahi hai — kuch scans ke baad graph
          ayega.
        </p>
      ) : (
        <div className="panel mt-5 p-5 sm:p-6">
          {showFinal ? (
            <p className="flex items-center gap-2 text-xs font-semibold text-[var(--dim)]">
              <span
                className="inline-block h-0.5 w-4"
                style={{ backgroundColor: "var(--accent-strong)" }}
                aria-hidden="true"
              />
              Final score (weighted) — zero line darmiyan me hai
            </p>
          ) : (
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-[var(--dim)]">
              <span className="flex items-center gap-2">
                <span
                  className="inline-block h-0.5 w-4"
                  style={{ backgroundColor: "var(--bull)" }}
                  aria-hidden="true"
                />
                Bull score
              </span>
              <span className="flex items-center gap-2">
                <span
                  className="inline-block h-0.5 w-4"
                  style={{ backgroundColor: "var(--bear)" }}
                  aria-hidden="true"
                />
                Bear score
              </span>
            </p>
          )}
          <div className="mt-3">{chart}</div>
          {first && last ? (
            <div className="num mt-2 flex justify-between text-[11px] text-[var(--dim)]">
              <span>{timePart(first.time)}</span>
              <span>{timePart(last.time)}</span>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

// Fibonacci Levels list (#2b): swing high/low, the leg direction, and
// the five retracement levels with pct + price. Hidden entirely when
// fibLevels is null.
function FibLevelsSection({ snapshot }: { snapshot: Snapshot }) {
  const fib = snapshot.fibLevels ?? null;
  if (!fib) return null;
  const levels = [...fib.levels].sort((a, b) => a.pct - b.pct);
  return (
    <section aria-label="Fibonacci levels" className="mt-14">
      <SectionTitle icon={<IconSliders />}>Fibonacci Levels</SectionTitle>
      <div className="panel mt-5 p-5 sm:p-6">
        <div className="grid gap-1">
          <div className="flex items-baseline justify-between gap-3 px-3 py-2">
            <span className="text-sm font-semibold">Swing High</span>
            <span className="num text-sm font-semibold">
              ${money(fib.swingHigh)}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-3 px-3 py-2">
            <span className="text-sm font-semibold">Swing Low</span>
            <span className="num text-sm font-semibold">
              ${money(fib.swingLow)}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-3 px-3 py-2">
            <span className="text-sm font-semibold">Leg</span>
            <span className="text-sm font-semibold text-[var(--accent-strong)]">
              {fib.direction === "up" ? "Low se High" : "High se Low"}
            </span>
          </div>
        </div>
        <ul className="mt-2 grid gap-1 border-t border-[var(--border)] pt-3">
          {levels.map((l) => (
            <li
              key={l.pct}
              className="flex items-baseline justify-between gap-3 px-3 py-2"
            >
              <span
                className="num text-sm font-semibold"
                style={{ color: "#8C7A2D" }}
              >
                {l.pct}%
              </span>
              <span className="num text-sm font-semibold">
                ${money(l.price)}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs leading-[1.55] text-[var(--dim)]">
          Fibonacci retracement — price aksar inhi hisso par rukti ya
          palatti hai; chart par dekhne ke liye kisi timeframe ke chart me
          Fib on karo.
        </p>
      </div>
    </section>
  );
}

function VerdictHistorySection({ snapshot }: { snapshot: Snapshot }) {
  const hist = snapshot.verdictHistory ?? [];
  const ordered = [...hist].reverse();
  return (
    <section aria-label="Verdict history" className="mt-14">
      <SectionTitle icon={<IconHistory />}>
        Verdict History — pichle faislay
      </SectionTitle>
      {ordered.length === 0 ? (
        <p className="panel mt-4 p-5 text-sm leading-[1.55] text-[var(--dim)]">
          Abhi verdict history nahi hai — har nayi scan ke final verdict ke
          sath yahan record banta jayega.
        </p>
      ) : (
        <ol className="panel mt-5 grid gap-0 p-3 sm:p-4">
          {ordered.map((h, i) => (
            <li
              key={`${h.time}-${i}`}
              className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-lg px-3 py-3 odd:bg-[var(--surface-2)]"
            >
              <span className="text-xs text-[var(--dim)]">{h.time}</span>
              <span className="flex items-baseline gap-3">
                <span className="num text-xs text-[var(--dim)]">
                  ${money(h.price)}
                </span>
                {h.score != null ? (
                  <span className="num text-xs text-[var(--dim)]">
                    score {h.score >= 0 ? "+" : ""}
                    {h.score}
                  </span>
                ) : null}
                <span
                  className="font-display text-base font-bold tracking-wide"
                  style={{ color: verdictColor(h.word) }}
                >
                  {h.word}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function App() {
  const queryClient = useQueryClient();
  const [refreshNote, setRefreshNote] = useState<string | null>(null);

  const state = useQuery({
    queryKey: ["gold-state"],
    queryFn: () => api.getState({}),
    // Static site: no server push — re-poll the published data.json on a
    // fixed cadence so a fresh scan appears without a manual reload.
    refetchInterval: DATA_POLL_MS,
  });

  // TradingView-style live price: tick the spot price every ~5 seconds via
  // refreshPrice and update only this local value — the snapshot query is
  // untouched; the timeframe cards' last candle follows this same value.
  // A failed tick is silent: the last shown price simply stays.
  const [liveTick, setLiveTick] = useState<{
    price: number;
    updatedAt: string | null;
  } | null>(null);

  // Live candle series per timeframe: adopted fresh from each new snapshot
  // and evolved on every successful price tick (period rollover + the
  // forming candle patched with the live price) so the charts keep moving
  // like TradingView between snapshot pushes.
  const [liveSeriesMap, setLiveSeriesMap] = useState<
    Record<string, SeriesState>
  >({});
  const adoptedScanRef = useRef<string | null>(null);

  const evolveSeries = (price: number) => {
    const now = Date.now();
    setLiveSeriesMap((prev) => {
      const next: Record<string, SeriesState> = {};
      for (const [tf, st] of Object.entries(prev)) {
        next[tf] = tickSeries(st, tf, price, now);
      }
      return next;
    });
  };

  const tick = useMutation({
    mutationFn: () => api.refreshPrice({}),
    onSuccess: (r) => {
      if (r.ok && r.price != null) {
        setLiveTick({ price: r.price, updatedAt: r.updatedAt });
        evolveSeries(r.price);
      }
    },
    onError: () => {},
  });
  const tickMutate = tick.mutate;
  // Wall-clock tick for the hero's session chips: refreshed on the same
  // ~5s cadence as the price tick.
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => {
      tickMutate();
      setNowMs(Date.now());
    }, 5000);
    return () => clearInterval(id);
  }, [tickMutate]);

  const refresh = useMutation({
    mutationFn: () => api.refreshPrice({}),
    onSuccess: (r) => {
      if (r.ok) {
        if (r.price != null) {
          setLiveTick({ price: r.price, updatedAt: r.updatedAt });
          evolveSeries(r.price);
        }
        setRefreshNote(null);
        void queryClient.invalidateQueries({ queryKey: ["gold-state"] });
      } else {
        setRefreshNote(
          "Live price abhi refresh nahi ho saki — neeche wali price hi latest available hai.",
        );
      }
    },
    onError: () =>
      setRefreshNote(
        "Live price abhi refresh nahi ho saki — neeche wali price hi latest available hai.",
      ),
  });

  const data = state.data;
  const snap = data?.snapshot ?? null;

  // Re-adopt the live series whenever a NEW snapshot is pushed (its
  // scanAtLabel changes): fresh candles from the snapshot, anchored at now,
  // so rollover periods count from the moment the snapshot arrived.
  useEffect(() => {
    if (!snap) return;
    if (adoptedScanRef.current === snap.scanAtLabel) return;
    adoptedScanRef.current = snap.scanAtLabel;
    const map: Record<string, SeriesState> = {};
    for (const item of snap.timeframes ?? []) {
      map[item.tf] = adoptSeries(item.candles ?? [], item.tf);
    }
    setLiveSeriesMap(map);
  }, [snap]);

  const livePrice = liveTick?.price ?? data?.livePrice ?? null;
  const liveUpdatedAt = liveTick?.updatedAt ?? data?.liveUpdatedAt ?? null;
  const updatedLabel = liveUpdatedAt
    ? new Date(liveUpdatedAt).toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  const hasSignal = snap != null && snap.signal !== "NONE";
  const signalColor =
    snap?.signal === "LONG"
      ? "var(--bull)"
      : snap?.signal === "SHORT"
        ? "var(--bear)"
        : "var(--accent-strong)";

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <SafeAreaTopScrim backgroundColor="var(--bg)" />
      <main className="mx-auto w-full max-w-3xl px-5 pt-7 pb-14 sm:px-6">
        {/* Top strip */}
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-bold tracking-[0.22em] text-[var(--accent-strong)]">
            GOLD · XAU/USD
          </p>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-medium text-[var(--dim)]">
              Analyzer V2
            </span>
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-medium text-[var(--dim)]">
              1-minute candle
            </span>
            <span className="rounded-full bg-[var(--accent)] px-2.5 py-1 text-xs font-bold text-[var(--text)]">
              DEMO
            </span>
          </div>
        </div>

        <VerdictHero snapshot={snap} livePrice={livePrice} nowMs={nowMs} />

        <TradingViewChartSection />

        {snap ? <DayRangeBar snapshot={snap} livePrice={livePrice} /> : null}

        <AiNoteSection snapshot={snap} />

        <NewsMoodSection snapshot={snap} />

        {/* Live price */}
        <section aria-label="Live gold price" className="mt-6">
          <p className="flex items-center gap-2 text-sm text-[var(--dim)]">
            Live spot price
            <span className="inline-flex items-center gap-1 text-[11px] font-bold tracking-widest text-[var(--bull)]">
              <span
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--bull)]"
                aria-hidden="true"
              />
              LIVE
            </span>
          </p>
          <div className="mt-1 flex flex-wrap items-end gap-x-4 gap-y-2">
            <p className="num text-5xl font-bold tracking-tight text-[var(--accent-strong)]">
              {livePrice != null ? `$${money(livePrice)}` : "—"}
            </p>
            <button
              type="button"
              aria-label="Live price refresh karo"
              onClick={() => refresh.mutate()}
              disabled={refresh.isPending}
              className="mb-1.5 inline-flex items-center gap-2 rounded-full border border-[var(--accent-strong)] px-4 py-2 text-sm font-semibold text-[var(--accent-strong)] transition-opacity disabled:opacity-50"
            >
              <IconRefresh className={refresh.isPending ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              {refresh.isPending ? "Refresh ho raha hai…" : "Refresh"}
            </button>
          </div>
          {updatedLabel ? (
            <p className="mt-1.5 text-xs text-[var(--dim)]">
              Last updated: {updatedLabel}
            </p>
          ) : null}
          {refreshNote ? (
            <p className="mt-2 text-xs text-[var(--bear)]">{refreshNote}</p>
          ) : null}
        </section>

        {state.isPending ? (
          <p className="mt-10 text-center text-sm text-[var(--dim)]">
            Analyzer ka data load ho raha hai…
          </p>
        ) : state.isError ? (
          <p className="mt-10 text-center text-sm text-[var(--bear)]">
            Data load nahi ho saka. Thori dair baad dobara kholo.
          </p>
        ) : snap == null ? (
          <p className="mt-10 text-center text-sm text-[var(--dim)]">
            Abhi koi scan saved nahi hai. Pehli scan ate hi signal, score aur
            checks yahan dikhenge.
          </p>
        ) : (
          <>
            <TimeframesPanel
              snapshot={snap}
              livePrice={livePrice}
              liveSeriesMap={liveSeriesMap}
              onRefresh={() => refresh.mutate()}
              refreshing={refresh.isPending}
            />

            {/* Signal card */}
            <section aria-label="Current signal" className="mt-14">
              <SectionTitle icon={<IconTarget />}>Abhi ka signal</SectionTitle>
              <div
                className="panel mt-5 p-6 sm:p-7"
                style={{ borderColor: signalColor }}
              >
                <p
                  className="font-display text-3xl font-bold tracking-wide"
                  style={{ color: signalColor }}
                >
                  {hasSignal ? snap.signal : "NO TRADE"}
                </p>
                <p className="mt-2 text-sm leading-[1.55]">{snap.signalReason}</p>
                {hasSignal &&
                snap.entry != null &&
                snap.stopLoss != null &&
                snap.takeProfit != null ? (
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-[var(--surface-2)] px-2 py-3">
                      <p className="text-xs text-[var(--dim)]">Entry</p>
                      <p className="num mt-0.5 text-base font-semibold">
                        ${money(snap.entry)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-[var(--surface-2)] px-2 py-3">
                      <p className="text-xs text-[var(--dim)]">Stop-loss</p>
                      <p className="num mt-0.5 text-base font-semibold text-[var(--bear)]">
                        ${money(snap.stopLoss)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-[var(--surface-2)] px-2 py-3">
                      <p className="text-xs text-[var(--dim)]">Take-profit</p>
                      <p className="num mt-0.5 text-base font-semibold text-[var(--bull)]">
                        ${money(snap.takeProfit)}
                      </p>
                    </div>
                  </div>
                ) : null}
                <p className="mt-3 text-xs text-[var(--dim)]">
                  Scan: {snap.scanAtLabel} · 1-minute candle · Scan ke waqt
                  spot ${money(snap.spotPrice)}
                </p>
                <p className="mt-3 border-t border-[var(--border)] pt-3 text-xs leading-[1.55] text-[var(--dim)]">
                  Market upar ho to <span className="font-semibold text-[var(--bull)]">LONG (khareed)</span> se,
                  neeche ho to <span className="font-semibold text-[var(--bear)]">SHORT (sell)</span> se —
                  V2 dono simt trade karta hai, sirf tab jab weekly + daily
                  trend aur score usi simt hon.
                </p>
              </div>
            </section>

            {/* Score + trends */}
            <section aria-label="Score aur trends" className="mt-14">
              <SectionTitle icon={<IconScales />}>Score — Bull vs Bear</SectionTitle>
              <div className="panel mt-5 p-5 sm:p-6">
                <div className="grid gap-4">
                  <ScoreBar
                    label="Bullish score"
                    value={snap.scoreBull}
                    total={snap.totalChecks}
                    color="var(--bull)"
                  />
                  <ScoreBar
                    label="Bearish score"
                    value={snap.scoreBear}
                    total={snap.totalChecks}
                    color="var(--bear)"
                  />
                </div>
                <p className="mt-3 text-xs leading-[1.55] text-[var(--dim)]">
                  V2 rule: signal tabhi banta hai jab score kam az kam 26 ho,
                  lead 12+ ho, jeetne wali side non-neutral checks ki 70%+ ho —
                  aur Weekly aur Daily trend dono signal ki simt me hon.
                </p>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  {(
                    [
                      ["Weekly trend", snap.trends.weekly],
                      ["Daily trend", snap.trends.daily],
                      ["4H trend", snap.trends.fourHour],
                    ] as const
                  ).map(([label, v]) => {
                    return (
                      <div
                        key={label}
                        className="rounded-lg bg-[var(--surface-2)] px-2 py-2.5"
                      >
                        <p className="num flex items-center justify-center text-base">
                          <TrendMark v={v} />
                        </p>
                        <p className="mt-0.5 text-xs text-[var(--dim)]">{label}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            <VolatilitySection snapshot={snap} />

            <ChecksList snapshot={snap} />

            <CorrelationSection snapshot={snap} />

            <DivergencesSection snapshot={snap} />

            <PatternsSection snapshot={snap} />

            <ScoreHistorySection snapshot={snap} />

            <KeyLevelsSection snapshot={snap} livePrice={livePrice} />

            <ZonesListSection snapshot={snap} />

            <FibLevelsSection snapshot={snap} />

            <VerdictHistorySection snapshot={snap} />
          </>
        )}

        {/* Disclaimer footer */}
        <footer className="mt-12 border-t border-[var(--border)] pt-4">
          <p className="text-xs leading-[1.55] text-[var(--dim)]">
            Ye sirf analysis + demo hai — asal paisa nahi lagta.
            Zero-loss ki koi guarantee nahi hoti; V2 is liye sakht hai taake
            ghalat trades se bacha ja sake. Ye financial advice nahi hai.
          </p>
        </footer>
      </main>
    </div>
  );
}
