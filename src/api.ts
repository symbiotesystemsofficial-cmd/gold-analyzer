// ============================================================================
// DATA CONFIG — static-site data pipeline (no artifact server actions here).
//
// The analyzer snapshot is published as ONE JSON file by the bot's publish
// step (publish_data.py in ~/workspace/trading-analyzer). To point this site
// at a different snapshot host, change DATA_JSON_URL below and rebuild.
// ============================================================================
export const DATA_JSON_URL =
  "https://symbiotesystemsofficial-cmd.github.io/tv-gold-chart/data.json";

// How often the snapshot JSON is re-polled (ms). The bot scans every ~1
// minute and publishes at most every ~5 minutes, so 30s polling keeps the
// page fresh without hammering the host.
export const DATA_POLL_MS = 30_000;

// Live spot price endpoint — the same one the bot itself uses
// (gold_bot.py). Verified 2026-11-09: it answers with
// `Access-Control-Allow-Origin: *`, so the browser can poll it directly.
// If that ever breaks, refreshPrice() below returns ok:false and the UI
// gracefully falls back to the snapshot's spot price.
export const GOLD_API_URL = "https://api.gold-api.com/price/XAU";

// ----------------------------------------------------------------------------
// Snapshot types — these mirror the analyzer snapshot exactly (the same
// shape build_snapshot.py produces and the artifact's getstate returned).
// ----------------------------------------------------------------------------

export interface CheckItem {
  name: string;
  side: "bull" | "bear";
}

export interface TfPattern {
  name: string;
  side: "bull" | "bear";
}

export interface Timeframe {
  tf: string;
  verdict: "BUY" | "SELL" | "WAIT";
  bull: number;
  bear: number;
  price: number;
  entry?: number | null;
  sl?: number | null;
  tp?: number | null;
  reasons?: string[];
  adx?: number | null;
  breakout?: "up" | "down" | null;
  divergence?: "bullish" | "bearish" | null;
  patterns?: TfPattern[];
  // [timestampMs, open, high, low, close, volume] rows (legacy 4-element
  // [open, high, low, close] rows are normalized by the client on ingest).
  candles?: number[][];
}

export interface FinalVerdict {
  word: "BUY" | "SELL" | "WAIT";
  line: string;
}

export interface KeyLevels {
  r2?: number;
  r1?: number;
  pivot?: number;
  s1?: number;
  s2?: number;
  prevHigh?: number;
  prevLow?: number;
  prevClose?: number;
  dayHigh?: number;
  dayLow?: number;
}

export interface VerdictHistoryEntry {
  time: string;
  word: "BUY" | "SELL" | "WAIT";
  price: number;
  score?: number;
}

export interface AiNote {
  text: string;
  model: string;
  at: string;
  forWord: string;
}

export interface NewsMood {
  label: "Bullish" | "Bearish" | "Neutral";
  score: number;
  line: string;
  headline: string;
  at: string;
  model: string;
}

export interface Zone {
  kind: "support" | "resistance";
  price: number;
  touches: number;
  strength: number;
}

export interface ChangePcts {
  day: number | null;
  week: number | null;
  month: number | null;
}

export interface FibLevels {
  swingHigh: number;
  swingLow: number;
  direction: "up" | "down";
  levels: { pct: number; price: number }[];
}

export interface Correlations {
  dxy: number | null;
  us10y: number | null;
  silver: number | null;
}

export interface Volatility {
  dailyAtrPct: number;
  h1AtrPct: number;
  label: "Sust" | "Normal" | "Tez";
}

export interface PatternItem {
  tf: string;
  name: string;
  side: "bull" | "bear";
}

export interface ScoreHistoryEntry {
  time: string;
  bull: number;
  bear: number;
  finalScore: number;
}

export interface BacktestTrade {
  date: string;
  side: string;
  entry: number;
  exit: number;
  exitKind: "TP" | "SL";
  pnl: number;
}

export interface Backtest {
  startBalance: number;
  endBalance: number;
  pnl: number;
  pnlPct: number;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  positionPct: number;
  periodLabel: string;
  caveats: string;
  rows: BacktestTrade[];
}

export interface PaperTrade {
  dir: string;
  entry: number;
  exit: number;
  why: string;
  pnl: number;
}

export interface PaperOpen {
  dir: string;
  entry: number;
  sl?: number;
  tp?: number;
  stopLoss?: number;
  takeProfit?: number;
  size?: number;
  source?: string;
  [key: string]: unknown;
}

export interface Paper {
  balance: number;
  totalTrades: number;
  status: string;
  open?: PaperOpen | null;
  trades?: PaperTrade[];
  totalPnl?: number;
}

export interface Snapshot {
  version: string;
  scanAtLabel: string;
  spotPrice: number;
  futuresPrice: number;
  scoreBull: number;
  scoreBear: number;
  totalChecks: number;
  neutralCount: number;
  signal: "LONG" | "SHORT" | "NONE";
  signalReason: string;
  entry: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  trends: { weekly: number; daily: number; fourHour: number };
  checks: CheckItem[];
  backtest: Backtest;
  paper: Paper;
  timeframes?: Timeframe[];
  finalVerdict?: FinalVerdict | null;
  keyLevels?: KeyLevels | null;
  verdictHistory?: VerdictHistoryEntry[];
  aiNote?: AiNote | null;
  newsMood?: NewsMood | null;
  zones?: Zone[];
  changePcts?: ChangePcts | null;
  fibLevels?: FibLevels | null;
  correlations?: Correlations | null;
  volatility?: Volatility | null;
  patterns?: PatternItem[];
  scoreHistory?: ScoreHistoryEntry[];
}

export interface StateResponse {
  snapshot: Snapshot | null;
  livePrice: number | null;
  liveUpdatedAt: string | null;
}

export interface RefreshPriceResponse {
  ok: boolean;
  price: number | null;
  updatedAt: string | null;
}

// ----------------------------------------------------------------------------
// The api surface the UI consumes — same method names/shapes the artifact's
// RPC client exposed (getState / refreshPrice), backed by plain fetches.
// The manual `command` action does NOT exist here: this site is read-only.
// ----------------------------------------------------------------------------

async function getState(_args: Record<string, never>): Promise<StateResponse> {
  const res = await fetch(DATA_JSON_URL, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`data.json fetch failed: HTTP ${res.status}`);
  }
  const snapshot = (await res.json()) as Snapshot;
  return {
    snapshot,
    // Between live ticks, the freshest price we have is the snapshot's own
    // spot price (the artifact server used to store the last refresh here).
    livePrice: snapshot?.spotPrice ?? null,
    liveUpdatedAt: null,
  };
}

async function refreshPrice(
  _args: Record<string, never>,
): Promise<RefreshPriceResponse> {
  try {
    const res = await fetch(GOLD_API_URL, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return { ok: false, price: null, updatedAt: null };
    const data = (await res.json()) as {
      price?: unknown;
      updatedAt?: unknown;
    };
    const price = typeof data.price === "number" ? data.price : null;
    const updatedAt = typeof data.updatedAt === "string" ? data.updatedAt : null;
    if (price == null) return { ok: false, price: null, updatedAt: null };
    return { ok: true, price, updatedAt };
  } catch {
    return { ok: false, price: null, updatedAt: null };
  }
}

export const api = { getState, refreshPrice };

// Type helper kept for parity with the artifact client: resolves an api
// method name to its resolved return type.
export type ApiResponse<
  T,
  K extends keyof T,
> = T[K] extends (args: never) => Promise<infer R> ? R : never;
