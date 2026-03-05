# IRONLOG v4.2

A complete fitness tracking PWA — workouts, nutrition, body metrics, progress media, AI coaching, social community, and cloud sync. React app with Vite build system, works offline.

**Live:** [ironlog.space](https://ironlog.space)

---

## Stats

| Metric | Value |
|---|---|
| Frontend | 9,021 lines · modular React (Vite) |
| Components | 59 React components |
| State actions | 31 reducer mutations |
| Exercise DB | 85 exercises · 12 categories |
| Food DB | 500+ foods with full macros |
| Fast food hacks | 57 meals < 600 cal · 30 brands |
| Training programs | 6 with full exercise details |
| API endpoints | 8 serverless functions |
| Database | 18 tables · 3 views · 4 functions |
| Auth | Server-issued session tokens · PIN · rate limiting |

---

## Navigation

Six tabs: **Home · Log · Track · Plan · Social · Settings**

**Home** — Greeting with sync status, readiness score, streak, weekly activity dots, today's schedule, quick actions, daily check-in, recent PRs.

**Log** — Workout logger (exercise picker, sets/reps/weight/RPE, rest timer, PR detection, plate calculator), Nutrition logger (500+ foods, barcode scanner, meal-based tracking, copy yesterday), Body metrics (weight, body fat, measurements).

**Track** (10 items — your data, looking backward)
- History: Workouts, Nutrition, Body, Photos & Videos
- Analytics: Readiness trends, Analytics charts, Muscle heat map, Strength score
- Reports: Weekly summary, Photo comparison slider

**Plan** (13 items — forward-looking tools)
- Training: AI Coach (daily program), Programs (6 pre-built), Schedule, Phase tracker
- Nutrition: Meal plan generator, Fast food hacks, Supplement tracker
- Tools: Goals, 1RM calculator, Injury manager, Substitution finder, Form check, Data guard

**Social** (9 items — community)
- Activity: Feed (today card, highlights, friend activity, reactions), Profile (shareable card, privacy controls), Notifications
- Connections: Friends (add/accept/block), Groups (create/join by code), You vs Your Best
- Compete: Challenges (tiered Bronze→Diamond), Badges (9 earnable), Group leaderboard

**Settings** — Profile editor (email locked), cloud sync controls, data health check, force sync, export/import JSON, push notifications, private photo vault, install guide.

---

## Key Features

### Workout Tracking
- Exercise picker with schedule-aware suggestions (Push day → shows chest/shoulder/tricep exercises first)
- Sets, reps, weight, RPE with rest timer between sets
- PR auto-detection with celebration animation
- Plate calculator with per-side breakdown
- Edit/delete with undo and confirmation
- Pre-save validation (flags impossible weights, duplicate entries)
- Workout templates

### Nutrition
- 500+ food database with full macros
- Barcode scanner (camera-based)
- Persistent daily summary bar showing calorie/protein progress toward goals
- Meal-type organization (Breakfast, Lunch, Dinner, Snacks)
- Copy yesterday's meals in one tap
- 57 fast food hacks from 30 restaurant brands
- Auto-generated meal plans with meal-type-aware food selection
- Supplement daily checklist (syncs to cloud)

### Body & Progress
- Weight and body fat with trend arrows (↗ ↘ → stable)
- Photo and video capture with fullscreen viewer
- Before/after comparison slider with time span indicator ("12 weeks apart")
- Private vault with PIN protection
- Photos sync to Supabase Storage

### AI Coach
- Rule-based daily workout generator with progressive overload
- AI Chat powered by Claude (5 free messages/day + bring your own key)
- Context includes: recent workouts, body weight, goals, current training phase, today's schedule, streak, active injuries
- Chat history persists across navigation (last 20 messages)

### Training Programs
- 6 pre-built programs: PPL, 5/3/1 Wendler, PHUL, Full Body 3x, Bro Split, nSuns
- Full exercise list per day visible before committing
- One-tap apply to weekly schedule

### Social & Community
- Activity feed with friend updates and emoji reactions (💪🔥👏💎⭐)
- Friend system with send/accept/block
- Groups with join-by-code and leaderboards
- Tiered challenges: Streak (7→14→21→30), Big 3 (600→800→1000→1200), Macro Master (3→5→7)
- Weekly rotating challenges
- 9 earnable badges
- Shareable profile links (ironlog.space/u/username)
- Privacy controls (4 toggles, private by default)
- Accountability nudges after 2 days inactive
- Notification badge on Social nav tab

### Cloud & Sync
- Auto-syncs on every data change (debounced 3 seconds)
- Syncs: workouts, nutrition, body, photos, checkins, milestones, goals, schedule, exercises, units, phases, injuries, privacy settings, supplements, vault PIN
- Offline queue with retry, compaction, 24h TTL
- Sync timestamp on Home: "Synced 2m ago"
- Data health check with force sync
- Export/import JSON backups

### Security
- Server-issued session tokens (crypto.randomUUID, 30-day expiry)
- 6-digit account PIN with server-side validation
- PIN rate limiting: 5 attempts → 15 minute lockout
- Email locked in profile editor (cannot be changed)
- PIN never sent to client — validated server-side only
- Session auth on all data endpoints (push, pull, social, photos, profile update)
- Legacy fallback for existing users during migration

### Auto-Update System
- Service worker with explicit version string
- Network-first for HTML (always gets latest code)
- Auto-checks for update on every app open + every 5 minutes
- New version auto-activates via skipWaiting → page reloads
- Server-side version check returns update banner + walkthrough

---

## Architecture

```
Frontend (GitHub Pages — Vite + React)
├── src/
│   ├── main.jsx                — App entry point
│   ├── App.jsx                 — Root component, routing, reducer
│   ├── theme.js                — Design tokens (V object)
│   ├── utils.js                — Shared utilities
│   ├── icons.jsx               — Icon library
│   └── components/
│       ├── shared/             — Reusable UI components
│       ├── home/               — HomeTab
│       ├── log/                — WorkoutTab, NutritionTab, BodyTab
│       ├── track/              — History, Analytics, Reports
│       ├── plan/               — AI Coach, Programs, Tools
│       ├── social/             — Feed, Friends, Groups, Challenges
│       └── settings/           — Settings panel
├── public/
│   ├── sw.js                   — Service worker v4.2 (network-first HTML)
│   ├── 404.html                — SPA redirect for /u/username routes
│   ├── manifest.json           — PWA manifest with shortcuts
│   ├── CNAME                   — Custom domain (ironlog.space)
│   └── icon.svg
├── vite.config.js              — Vite build config (base: /Ironlog/)
└── package.json

Backend (Vercel — 8 files, 7 functions)
├── api/auth/
│   ├── session.mjs             — Create/validate/revoke sessions
│   └── validate.mjs            — Shared session validator (import only)
├── api/sync/
│   ├── push.js                 — Push data to cloud (session + legacy auth)
│   └── pull.js                 — Pull data (session or PIN auth)
├── api/users/
│   └── index.mjs               — Create + update (combined)
├── api/push/
│   └── index.mjs               — Subscribe + send (combined)
├── api/photos/
│   └── upload.mjs              — Supabase Storage upload (session auth)
└── api/social/
    └── index.mjs               — Friends, feed, groups, notifications,
                                   challenges, profile, username (combined)

Database (Supabase — 18 tables)
├── users                       — Profile, PIN, badges, privacy, username
├── workouts                    — Exercise data with sets/reps/weight
├── nutrition                   — Meals with full macros
├── body_measurements           — Weight, body fat, dimensions
├── progress_photos             — Photo/video with private flag
├── checkins                    — Daily soreness/energy/motivation/sleep
├── milestones                  — Goals with deadlines
├── user_settings               — Schedule, units, vault PIN, phases,
│                                  injuries, privacy, supplements
├── sync_log                    — Audit trail
├── push_subscriptions          — Web Push endpoints
├── sessions                    — Server-issued auth tokens
├── friendships                 — Friend connections with status
├── activity_events             — Feed items
├── groups                      — Group definitions
├── group_members               — Group membership
├── challenge_snapshots         — Daily leaderboard values
├── reactions                   — Event reactions
└── notifications               — In-app notifications
```

---

## Deploy

### Frontend
```bash
npm run deploy   # Builds with Vite and pushes to GitHub Pages
```

Includes `CNAME` in `public/` for custom domain. Include `404.html` for `/u/username` routes.

### Backend
1. Push to Vercel-connected repo
2. Delete old separate files if upgrading (old `api/social/friends.mjs`, `api/users/create.js`, etc.)
3. Environment variables:
   - `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
   - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL`
   - `ADMIN_PUSH_KEY`
   - `LATEST_APP_VERSION=4.2`
   - `UPDATE_NOTES` (optional)

### Database
Run SQL files in order:
1. `setup-all-tables.sql` — Core 9 tables
2. `setup-push-table.sql` — Push subscriptions
3. `setup-photos-storage.sql` — Photo columns + account PIN
4. `setup-social.sql` — Social tables, views, functions
5. `setup-security.sql` — Sessions table, PIN rate limiting, settings columns

Create storage bucket `progress-photos` (public) in Supabase Dashboard.

### Fresh Start
Run `clear-all-tables.sql` to truncate all 18 tables. Preserves schema.

---

## Shipping Updates

1. Increment `APP_VERSION` in `src/App.jsx`
2. Increment `SW_VERSION` in `public/sw.js` (must match)
3. Set `LATEST_APP_VERSION` env var in Vercel
4. Run `npm run deploy` for frontend, push backend to Vercel
5. Users auto-update on next app open (network-first SW)

---

## Local Development

```bash
npm install       # Install dependencies
npm run dev       # Start dev server at localhost:5173
npm run build     # Production build to dist/
npm run preview   # Preview production build locally
npm run deploy    # Build + push to GitHub Pages
```

---

## Version History

| Version | Changes |
|---|---|
| v1.0 | Core workout/nutrition/body tracking |
| v2.0 | Cloud sync, PWA, barcode scanner |
| v3.0 | AI Coach, heat map, goals, phases, injuries |
| v3.5 | Bug fixes, 9-table sync, QR scanner fix |
| v4.0 | Auth, validation, edit entries, fast food hacks, push notifications, accessibility, test harness |
| v4.1 | Photo vault, video support, meal plans, 6 training programs, supplements, photo compare, AI chat, social community (friends, groups, challenges, leaderboards, badges), account PIN, interactive onboarding, app version sync |
| v4.2 | **Security overhaul** (server-issued sessions, PIN rate limiting, email locked, all endpoints authenticated), **6-tab nav** (Track/Plan split), API consolidation (13→8 endpoints), auto-update SW, schedule-aware exercise suggestions, daily macro bar, trend arrows, photo time spans, program exercise details, AI phase context, streak memoization, error retry states, full data sync (phases, injuries, privacy, supplements), notification badge, **Vite migration** (ES modules, component-based file structure, npm build pipeline) |

---

## License

IRONLOG is a personal project by Byheir Wise. All rights reserved.
