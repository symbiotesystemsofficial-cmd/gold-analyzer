# Gold Analyzer — Website (Vercel)

XAU/USD (gold) multi-timeframe analyzer ki **asal static website** — wohi
cream-theme, Hinglish interface jo pehle Muse artifact me thi (final
verdict hero, TradingView chart, timeframe Explorer apne TV-style chart ke
sath, day range, change tiles, signal card, score, 54 checks, key levels,
zones, Fibonacci, patterns, score history, AI note, news mood, verdict
history). Ye version read-only hai: koi server, koi login, koi trade
button nahi — sirf analysis + demo.

## Deploy kese hota hai

1. Is poore folder ko aik GitHub repo me push karo (repo root = ye folder).
2. Vercel me **Add New → Project → Import** us repo ko karo.
3. Vercel khud detect kar lega: Framework **Vite**, Build `npm run build`,
   Output `dist` (`vercel.json` me bhi yehi likha hai — zero config).
4. Us ke baad **har push par Vercel auto-build + auto-deploy** kar dega.

`dist/` folder me tayyar built output pehle se mojood hai; Vercel deploy
par usay fresh build se replace kar dega. Local chala kar dekhna ho to:

```bash
npm install
npm run build     # dist/ banta hai
npm run preview   # build local serve hoti hai
```

## Data kese flow hota hai

Site ke paas apna koi backend nahi — do public sources se data ata hai:

| Kya | Kahan se | Cadence |
|---|---|---|
| Poora analyzer snapshot (verdict, signal, timeframes, levels, AI note…) | `data.json` — `https://symbiotesystemsofficial-cmd.github.io/tv-gold-chart/data.json` | Page har **30s** poll karti hai |
| Live spot price (hero) | `https://api.gold-api.com/price/XAU` seedha browser se | Har **5s** |

* `data.json` bot publish karta hai: `~/workspace/trading-analyzer/publish_data.py`
  har scan ke baad (cron ke zariye, `GOLD_ANALYZER_PUBLISH=1` par) naya
  snapshot tv-gold-chart repo me push karta hai — sirf tab jab scan
  badla ho, aur kam az kam ~5 minute ke fasle se. GitHub Pages usay
  serve karta hai (`Access-Control-Allow-Origin: *` verified hai).
* gold-api bhi browser ko CORS allow karta hai
  (`Access-Control-Allow-Origin: *`, 2026-11-09 verified). Agar kabhi
  ye band ho jaye to site khud bakhud data.json wali spot price par
  gir jati hai — page kabhi khali nahi hoti.
* Data source badalna ho to `src/api.ts` ke sab se upar
  **`DATA_JSON_URL`** constant badlo aur dobara build/deploy karo.

## TradingView chart

Chart section me **official TradingView Advanced Chart widget** seedha
embed hai — symbol **OANDA:XAUUSD** (FXCM wala symbol free widget me
nahi chalta, is liye OANDA), 5-minute default, light theme,
Asia/Karachi timezone, dono toolbars on, attribution visible. Asal
website (top-level page) par widget bilkul normal render hota hai —
Muse artifact ke band frame wala block yahan lagu nahi hota.

## Files

```
index.html        page shell
vercel.json       Vercel build/output config
vite.config.ts    Vite + React + Tailwind v4
src/
  api.ts          DATA_JSON_URL config + data fetching + snapshot types
  App.tsx         poora UI (artifact client se liya gaya, adapted)
  main.tsx        React entry (plain QueryClient)
  shims.tsx       SafeAreaTopScrim ka local version
  theme.css       cream theme (Tailwind v4)
dist/             built static output (Vercel serve karta hai)
```
