# SignalDesk AI

> AI-powered Reddit lead discovery and conversation intelligence platform.

Turn Reddit into a live stream of high-intent customer conversations. Paste your website URL and SignalDesk AI will scan Reddit for people actively looking for what you sell — scored by buyer intent, with AI-generated replies.

---

## What It Does

1. **Website Intelligence Engine** — Crawl your site and extract product signals using Claude AI
2. **Intent Detection System** — Score every Reddit post (0-100) by buying intent, pain signals, urgency, and competitor mentions
3. **Reddit Lead Discovery** — Search Reddit across multiple dimensions: keywords, pain phrases, competitor mentions, buying intent
4. **Lead Feed Dashboard** — Live feed of ranked leads with intent breakdown and match reasons
5. **AI Reply Generator** — Generate authentic, Reddit-safe replies with spam risk scoring
6. **Lead Tracking** — Track status: New → Saved → Opened → Replied → Contacted

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React, Tailwind CSS |
| State | Zustand (with persistence) |
| AI | Anthropic Claude (claude-opus-4-6) |
| Database | Supabase (PostgreSQL + RLS) |
| Lead Discovery | Reddit Public JSON API |
| Deployment | Vercel |

---

## Getting Started

### 1. Clone & Install

```bash
git clone <repo-url>
cd signaldeskai
npm install
```

### 2. Configure Environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```env
# Required: Anthropic Claude API
ANTHROPIC_API_KEY=sk-ant-your-key-here

# Optional: Supabase (for auth + persistence)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Onboarding Flow

1. Enter your website URL
2. AI crawls your site and extracts business intelligence
3. Review your extracted profile (keywords, pain points, competitors)
4. See the generated Reddit search queries
5. Launch — leads populate immediately

---

## Database Setup (Supabase)

Run the migration in your Supabase SQL editor:

```
supabase/migrations/001_initial_schema.sql
```

This creates:
- `profiles` — user accounts
- `projects` — lead discovery projects
- `website_profiles` — AI-extracted business data
- `leads` — discovered Reddit/Twitter posts
- `lead_scores` — intent scoring breakdown
- `lead_actions` — user interaction tracking
- `reply_suggestions` — AI-generated replies
- `alerts` — notification preferences

---

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/analyze` | POST | Crawl website + extract business profile using Claude |
| `/api/leads` | POST | Fetch Reddit posts + score by intent |
| `/api/reply` | POST | Generate Reddit-safe reply + DM using Claude |

---

## Intent Scoring Algorithm

Every post receives four scores (0-100):

| Score | What It Measures |
|-------|-----------------|
| **Intent Score** | Composite buyer intent (40% buying + 25% pain + 15% urgency + 20% relevance) |
| **Pain Score** | Detected frustration/problem signals |
| **Urgency Score** | Time-sensitive language |
| **Relevance Score** | Keyword + competitor match depth |

**Buying Signals**: "looking for", "any recommendations", "best software for", "alternatives to"...

**Pain Signals**: "frustrated with", "hate using", "problem with", "doesn't work"...

**Urgency Signals**: "ASAP", "this week", "urgent", "launching"...

---

## Reply Safety System

Every AI-generated reply is scored:

- **Spam Risk**: LOW / MEDIUM / HIGH
- **Natural Tone Score**: 0-100
- **Promotion Level**: NONE / SUBTLE / MODERATE / HIGH
- **Confidence Score**: 0-100

Replies follow the structure: Empathy → Insight → Soft mention

---

## Project Structure

```
src/
├── app/
│   ├── (dashboard)/          # Protected dashboard routes
│   │   ├── leads/            # Lead Feed page
│   │   ├── saved/            # Saved Leads page
│   │   ├── settings/         # Settings page
│   │   └── notifications/    # Notifications page
│   ├── api/
│   │   ├── analyze/          # Website analysis API
│   │   ├── leads/            # Lead discovery API
│   │   └── reply/            # Reply generation API
│   └── onboarding/           # Onboarding flow
├── components/
│   ├── dashboard/            # Lead card, intent scores, filters
│   ├── layout/               # Sidebar, TopBar
│   └── ui/                   # Button, Input, Card, Badge, Progress
├── lib/
│   ├── ai.ts                 # Claude integration
│   ├── reddit.ts             # Reddit API client
│   ├── intent-scorer.ts      # Intent detection engine
│   ├── supabase.ts           # Database client
│   └── utils.ts              # Helpers
├── store/
│   └── useAppStore.ts        # Zustand global state
└── types/
    └── index.ts              # TypeScript types
```

---

## Deployment

### Vercel (Recommended)

```bash
vercel --prod
```

Set environment variables in Vercel dashboard.

### Environment Variables Required

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Claude API key |
| `NEXT_PUBLIC_SUPABASE_URL` | No | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Supabase service key |

---

## Product Principles

- **Quality over quantity** — 20 high-intent leads beats 200 noise
- **Human-like engagement** — Every reply sounds like a peer, not a bot
- **Non-spam behavior** — Platform is designed for genuine conversation
- **Intent detection first** — Keywords are secondary to buyer signals

---

## Roadmap

- [ ] X (Twitter) lead discovery
- [ ] Supabase auth integration
- [ ] Scheduled lead refresh (cron)
- [ ] Slack/email alerts
- [ ] LinkedIn lead discovery
- [ ] HackerNews integration
- [ ] Lead export (CSV)
- [ ] Team collaboration

---

## License

MIT
