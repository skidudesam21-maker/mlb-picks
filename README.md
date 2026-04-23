# Diamond Edge — MLB Analytical Picks Site

A multi-page MLB betting-picks site. Daily top-3 picks for:

- **NRFI** (no run first inning)
- **Moneyline**
- **Batter hit props** & **pitcher strikeout props**

Plus a **tracking page** that auto-grades every pick against final box scores and tracks record + units.

---

## What you need

Three accounts — **all free, no credit card**:

1. **GitHub** — to host the code: https://github.com/signup
2. **Vercel** — to host the website: https://vercel.com/signup (sign in with GitHub)
3. **The Odds API** — sportsbook odds (500 req/month free): https://the-odds-api.com/
4. **Groq** — AI writeups (free tier): https://console.groq.com/keys

---

## Deployment (zero coding required)

### Step 1 — Get the code onto GitHub

1. Go to https://github.com/new
2. Name the repo `mlb-picks`. Make it private (optional). Click **Create repository**.
3. On the next screen, click **"uploading an existing file"**.
4. Drag every file + folder from this project into the upload box. Wait for it to finish.
5. Scroll down and click **Commit changes**.

### Step 2 — Deploy to Vercel

1. Go to https://vercel.com/new
2. Click **Import** next to your `mlb-picks` repo.
3. On the config screen, scroll to **Environment Variables** and add these (leave `POSTGRES_URL` empty for now — we'll add it in the next step):

   | Name | Value |
   |---|---|
   | `GROQ_API_KEY` | your Groq key |
   | `ODDS_API_KEY` | your Odds API key |
   | `CRON_SECRET` | any long random string (e.g. `xk4h8aBpqZ2mN7rLv3`) |
   | `UNIT_SIZE_USD` | `100` |

4. Click **Deploy**. First deploy will fail because there's no database yet — that's expected.

### Step 3 — Add the database

1. In your Vercel project, click **Storage** in the top tabs.
2. Click **Create Database** → **Postgres** → **Create**.
3. Vercel will automatically add `POSTGRES_URL` and related env vars to your project.
4. Go back to **Deployments**, click the three-dot menu on the latest deployment, and click **Redeploy**. Wait ~2 minutes.

### Step 4 — Generate your first picks

Vercel's cron runs at **10:00 AM ET daily** to generate picks, and **3:00 AM ET** to grade yesterday's results.

To trigger the first run manually:

1. Go to your Vercel project → **Settings** → **Crons**.
2. Next to `/api/cron/generate`, click **Run**. Wait ~1-2 minutes (it's pulling dozens of stats).
3. Visit your site. The NRFI/Moneyline/Props pages should now have today's top 3.

---

## How it works

**Daily flow:**

1. **10 AM ET** — the generate cron runs. It fetches today's MLB schedule (with probable pitchers, weather, lineups), pulls moneyline/NRFI/prop odds from The Odds API, runs all three analytical models, picks the top 3 per category, sends each pick's factors to Groq for a writeup, and saves everything to the database.

2. **3 AM ET** — the grading cron runs. For every ungraded pick from the past, it checks the MLB final box score and marks W/L/Push + unit change.

3. **Pages render live from the database** every time you load them.

**Analytical signals used:**

- *NRFI*: starter ERA/WHIP/K-9/BB-9/HR-9, last-5 recent form, opposing lineup's top-4 OPS vs that pitcher's hand, park run factor, temperature + wind.
- *Moneyline*: starter full-game quality, team OPS + runs/game, team bullpen ERA/WHIP, SP recent form, park factor, home field advantage. Logistic conversion to win prob, then compared to market implied prob — only picks when our edge exceeds the juice.
- *Hits*: season BA, OPS split vs opposing hand, last-15 BA, opposing pitcher ERA + K%, park hit factor, projected PAs by batting order slot.
- *Strikeouts*: season K/9, K%, last-5 avg IP, last-5 avg Ks, opposing team's season K%, park factor. Model picks a safe alt line (usually ~1 K below projection).

**Letter grades** map from confidence: A+ (93+), A (88-92), A- (84-87), B+ (80-83), B (75-79), B- (70-74), C+ (65-69), C (60-64), ..., F (<45).

---

## Customizing the models

All scoring weights live in these files — open them and tweak the numbers:

- `lib/models/nrfi.ts` — NRFI scoring
- `lib/models/moneyline.ts` — ML strength composite
- `lib/models/props.ts` — hit & K models
- `lib/parks.ts` — park factor table

After editing, push to GitHub and Vercel auto-redeploys.

---

## Limitations & honest caveats

- **No model beats the books reliably.** The confidence score is the model's opinion — A+ picks will still lose.
- **Odds come from TheScoreBet when available**, otherwise DraftKings / FanDuel / BetMGM in that order. If no US book in the Odds API offers a line for a game/prop, that pick gets saved with no odds (and won't contribute to tracking units).
- **Player props require odds data to be live** — sometimes these aren't posted until a few hours before first pitch, so the morning cron may miss some. You can manually re-run the cron closer to game time if you want fresher props.
- **Top 3 picks are shown every day regardless of confidence.** If it's a weak slate, the #3 pick might be a C+. The real number shows honestly.
- **The Odds API free tier is 500 requests/month.** The cron uses ~3 requests/day + up to ~15 for props on a full slate. Typical usage stays well under 500.

---

## Manual cron triggers

You can hit the endpoints yourself from your browser bar (need your CRON_SECRET):

```
https://YOUR-SITE.vercel.app/api/cron/generate
```

(You'll get a 401 in the browser — the endpoint requires an `Authorization: Bearer YOUR_CRON_SECRET` header. Easier to just use Vercel's Crons → Run button.)

---

## Gambling disclaimer

This is for entertainment and analytical curiosity. Always gamble responsibly. If you or someone you know has a gambling problem, call **1-800-GAMBLER**.
