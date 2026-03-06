# IRONLOG v6.0

A complete fitness tracking PWA — workouts, nutrition, body metrics, progress photos, AI coaching, social community, admin panel, and cloud sync. Single-file React app, zero build step, works offline.

**Live:** [ironlog.space](https://ironlog.space)

---

## Stats

| Metric | Value |
|---|---|
| Frontend | 12,239 lines · single HTML file |
| Components | 67 React components |
| Routes | 67 unique views |
| State actions | 29 reducer mutations |
| Exercise DB | 200 exercises · 11 categories · all with YouTube links |
| Food DB | 200+ foods with full macros |
| Fast food hacks | 57 meals < 600 cal · 30+ brands |
| Training programs | 6 with full exercise details |
| API endpoints | 9 serverless functions |
| Database | 18+ tables · Supabase Storage |
| Auth | Session tokens · SHA-256 hashed PIN · admin verification |
| Service Worker | v6.0 · offline fallback · background sync · push hardening |
| PWA score | Improved · 192px + 512px icons · screenshots · manifest id |

---

## Navigation

**7 tabs for admins, 6 for users:** Home · Log · Track · Plan · Social · Settings · Admin (admin only)

---

## Home Tab

- Time-based greeting with display name
- Today's split type (Push/Pull/Legs/Rest)
- Streak flame with all-time record tracking
- 30-day training heatmap — green = trained, red = missed scheduled day
- Weekly goal progress ring — configurable workouts/week target
- Next workout countdown — hours left or next day preview
- Compact macros bar — calories + protein always visible
- Readiness score with 7-day sparkline trend
- Quick actions (Workout, Nutrition, Weigh-in)
- Today's plan card with exercise chips
- Accountability partner nudge
- Today's nutrition summary with water + sleep
- Today's workout with auto-generated shareable card
- Strength chart (Big 3 trends)
- Sync status indicator

---

## Log Tab (3 Sub-Tabs)

### Workout Logger
- 200 exercises across 11 categories: Chest, Back, Legs, Shoulders, Arms, Core, Cardio, Olympic, Full Body, Mobility, Machines
- Every exercise has a YouTube tutorial link
- Last session preview before adding exercise
- Smart weight auto-fill using overload suggestion
- Warm-up set generator (Bar → 50% → 70% → 85%)
- Auto-start rest timer when reps filled (toggleable)
- Superset mode with A/B labels
- Notes per exercise (form cues, tempo)
- Drop set / failure markers per set
- Repeat last workout (one tap, shows exercise names)
- Templates from training programs
- Progressive overload suggestions
- PR auto-detection with celebration
- Crash recovery — unsaved workout automatically restored after unexpected close
- Plate calculator, live timer, 1-5 star rating
- Pre-save validation, edit/delete with undo

### Nutrition Logger
- 200+ food database with full macros
- Branded bars, fast food items, drinks
- Barcode scanner (camera-based)
- 4 meal slots with meal timing (time picker per meal)
- Recent foods quick-add chips
- Meal favorites — save combos, one-tap reload
- Auto-calculate totals from food items
- Macro pie chart (P/C/F donut)
- Water tracking counter (+/- buttons, X/8 glasses)
- Calorie deficit/surplus indicator vs TDEE
- Copy yesterday's nutrition
- Edit past entries — tap history to edit in place

### Body Metrics
- Weight, body fat %, chest, waist, arms, thighs
- Trend arrows and goal weight line on chart
- 7-day rolling average weight vs prior week
- Progress since Day 1 comparison card
- Photo prompt after saving (if 7+ days since last photo)
- Copy yesterday, dual-axis weight/BF% chart

---

## Track Tab (14 Sub-Pages)

- Workouts — history with share cards, drop/fail badges, notes
- PRs — all exercises, E1RM, % of PR, category filter
- Exercise Chart — any exercise weight/E1RM over time
- Duration Trends — avg/longest/shortest, bar chart with reference line
- Volume — sets per muscle group with recommended ranges
- Analytics — strength score, exercise progression
- Heat Map — muscle balance visualization
- Strength — per-lift standards (Beginner → Elite)
- Photos — gallery, vault (PIN-protected), video, fullscreen viewer
- Compare — before/after slider
- Weekly Report — shareable summary card
- Readiness Trend — 14-day chart

---

## Plan Tab (14 Sub-Pages)

- AI Coach — daily workout generator with progressive overload
- AI Chat — conversational Claude coach (bring your own API key, stored locally)
- Programs — PPL, 5/3/1, PHUL, Full Body, Bro Split, nSuns
- Schedule — weekly split config with overrides
- Phases — cut/bulk/maintain tracker
- Meal Plan — auto-generated daily meals
- Fast Food Hacks — 30+ chains with macro breakdowns
- Supplements — daily checklist
- Goals — weight, strength, custom targets
- 1RM Calculator
- Injury Manager — AI Coach adapts around injuries
- Substitutions — exercise alternatives
- Form Check — video recording
- Data Guard — suspicious data detection

---

## Social Tab

- Feed with reactions (🔥💪👏💎😤), count badges, scale animation
- Friends — add by code/username/email (names shown, never emails)
- DMs — 500 char limit (server-enforced), read receipts (✓ sent, ✓✓ read), quick replies
- Streak Battle — side-by-side streak comparison on friend profiles
- Groups — create/join by code, leaderboards, chat, weekly recap
- Challenges — tiered badges (Streak, Big 3, Macro Master)
- Compare — side-by-side stats with any friend
- Profile — QR code, friend code, username, privacy controls
- Badges — 9 earnable achievements
- Accountability partner toggle with nudges

---

## Settings

- Theme (dark/light), Units (lbs/kg)
- Goals — cal, protein, carbs, fat, TDEE, goal weight, workouts/week
- Schedule, Exercise Library (add custom with YouTube links)
- Profile editing, Backup & Restore (cloud sync + PIN)
- Storage indicator (X / 5 MB with progress bar)
- Export all data as JSON, demo data, clear all
- Privacy controls (4 toggles), Accessibility (3 options — persisted across data resets)
- Reminders (push notifications), Legal & Privacy

---

## Admin Panel (Server-Verified)

Own nav tab, invisible to non-admins. Every API call verified against database.

- Dashboard — 9 stat cards + 14-day trend chart
- User Management — sortable table, 6 filters, search
- User Lookup — full drill-down with all data + photos (including vault) with fullscreen prev/next viewer
- User Actions — delete account (cascades all data), ban/unban (revokes all sessions)
- Content Moderation — view DMs (user dropdowns) and group chats
- Platform Health — stale users, sync issues, active sessions

---

## Infrastructure

### PWA & Offline
- SW v5.1: network-first HTML, cache-first CDN (7-day max-age), SWR for assets
- Offline fallback page, offline badge in-app
- Periodic background sync (4hr where supported)
- Push re-subscribe on subscription change + health check
- iOS install guide modal, landscape lock
- 192×192 and 512×512 PNG icons for full OS/store compliance
- Mobile (1080×1920) and desktop (1280×800) screenshots for install UI
- `manifest.json`: `id`, `lang`, `dir`, `display_override`, `launch_handler`, `share_target`, `file_handlers`, `iarc_rating_id`
- `launch_handler` — re-launching focuses existing instance instead of opening a new tab
- `share_target` — app appears in OS share sheet; accepts images and text
- `file_handlers` — accepts `.json` and `.csv` imports directly

### Cloud Sync
- Auto-sync on every change (debounced 3s)
- IndexedDB offline queue with retry; permanent 4xx errors (400/403/404/409/422) discarded rather than retried forever
- Photo upload to Supabase Storage (individual endpoint)
- Sync timestamp on Home

### Security
- Server-issued session tokens (30-day expiry)
- 6-digit PIN: **SHA-256 hashed at rest** (salt = first 16 chars of email); transparent migration from plaintext on next login
- PIN auth consistent across all endpoints (`session.mjs`, `users/index.mjs`, `pull.js`)
- Admin: database flag + backend verification + env var super-admin
- CORS restricted to `ironlog.space` on all endpoints (was wildcard `*` on `/api/users`)
- Env var guards on every handler before `createClient()`
- DM send requires verified friendship server-side
- `mark_read` by ID scoped to authenticated user
- `log_event` enforces an allowlist of 12 valid event types
- `photoId` sanitized to `[a-zA-Z0-9_-]` before use in storage path
- Stack traces excluded from error responses
- Admin `user_detail` returns a safe column projection (excludes PIN hash, raw IP, lockout state)

### UX Polish
- Crash recovery — WorkoutTab checks IndexedDB on mount; prompts resume if unsaved workout < 4 hours old
- Accessibility preferences survive full data reset (`CLEAR_ALL`)
- `ShareCard.share()` properly awaitable (was fire-and-forget despite `async` declaration)
- Custom confirm dialogs (zero browser popups)
- Undo with visual countdown bar (6 seconds)
- Skeleton loading with shimmer animation
- Haptic feedback, guided 9-step walkthrough
- Feature help on every page
- Share cards with native share sheet + clipboard
- OG meta tags for link previews
- Lazy image loading

---

## Architecture

```
Frontend (GitHub Pages)
├── index.html              — 12,239-line single-file React PWA
├── sw.js                   — Service Worker v5.1 (194 lines)
├── offline.html            — Offline fallback page
├── 404.html                — SPA redirect
├── manifest.json           — PWA manifest (id, lang, dir, display_override,
│                             launch_handler, share_target, file_handlers, screenshots)
├── icon.svg                — Source icon
├── icon-192.png            — PWA install icon (192×192)
├── icon-512.png            — PWA install icon (512×512)
├── screenshot-mobile.png   — Install UI screenshot (1080×1920)
├── screenshot-desktop.png  — Install UI screenshot (1280×800)
├── tests/                  — Unit tests
└── e2e/                    — Playwright E2E tests

Backend (Vercel — 9 files)
├── api/auth/session.mjs    — Session create/validate/revoke · PIN hashing
├── api/auth/validate.mjs   — Session middleware
├── api/sync/push.js        — Data push (workouts, nutrition, body, photos…)
├── api/sync/pull.js        — Data pull with PIN/session auth
├── api/users/index.mjs     — User create/update
├── api/push/index.mjs      — Web push subscription management
├── api/photos/upload.mjs   — Progress photo upload to Supabase Storage
├── api/social/index.mjs    — Friends, feed, groups, DMs, notifications
└── api/admin/index.mjs     — Admin dashboard, user management, moderation

Database (Supabase — 18+ tables + Storage)
```

---

## Deploy

### Frontend
Push to GitHub Pages.

### Backend
Push to Vercel. Set environment variables:

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service role key |
| `VAPID_PUBLIC_KEY` | Web push public key |
| `VAPID_PRIVATE_KEY` | Web push private key |
| `VAPID_EMAIL` | Contact email for push |
| `ADMIN_EMAIL` | Super-admin email address |
| `LATEST_APP_VERSION` | Current version string (e.g. `5.2`) |
| `UPDATE_NOTES` | Optional update message shown to outdated clients |

### Database
Run SQL migration files in order, create `progress-photos` storage bucket (public).

---

## Version History

| Version | Changes |
|---|---|
| v1.0 | Core workout/nutrition/body tracking |
| v2.0 | Cloud sync, PWA, barcode scanner |
| v3.0 | AI Coach, heat map, goals, phases, injuries |
| v4.0 | Auth, validation, fast food, push notifications, accessibility |
| v4.1 | Photo vault, video, meal plans, programs, supplements, AI chat, social community, account PIN, onboarding |
| v4.2 | Security overhaul, 6-tab nav, API consolidation, admin panel, DM chat, 10 UX enhancements |
| v4.3 | 200 exercises, 8 enhancement phases, share cards, custom dialogs, skeleton loading |
| v5.0 | Major bug audit: 10 fixes across social/sync/admin/frontend (DMRead, group filters, rate limiting, object URL leaks, CORS hardening) |
| v5.1 | Full audit pass: CORS wildcard fix, unauthenticated update removed, PIN hashing (SHA-256), admin delete_user/ban_user implemented, reaction allowlist, group name validation, DM length enforcement, photoId sanitization, crash recovery, SyncQueue 4xx discard, a11y persistence, ShareCard promise fix, version bumps |
| v5.2 | Second audit pass: PIN auth fixed in pull.js (hash mismatch), DM friendship enforcement on send, notification mark_read ownership check, admin user_detail safe column projection, stack trace removed from errors, LATEST_APP_VERSION fallback corrected, event_type allowlist on log_event · PWA: 192px + 512px PNG icons, app screenshots, manifest id/lang/dir/display_override/launch_handler/share_target/file_handlers |
| v5.3 | PWA manifest completion: `protocol_handlers` (web+ironlog:), `scope_extensions`, `edge_side_panel` (400px), `tabbed` in display_override, `widgets` (Today's Summary Adaptive Card) · Version bumps to 5.3 |
| v6.0 | Sync integrity reconciliation (`/api/sync/reconcile.js`): client-server record count comparison across workouts/nutrition/body/photos domains with per-domain delta reporting · System Health panel in Settings: last sync, offline queue depth, SW version, push subscription status, storage quota, reconciliation results with domain breakdown · `ReconcileAPI` auto-runs every 4 hours after successful push sync · `SW_VERSION` constant in frontend |
| v5.4 | Fix: Save buttons inaccessible on all Log/form sheets — Sheet, GlobalConfirm, UndoToast, SuccessToast, MessageBanner all portalled via ReactDOM.createPortal to document.body, bypassing iOS Safari position:fixed-inside-overflow-scroll bug; Sheet rebuilt as flex column so footer save button is always visible without hacky paddingBottom offsets | `protocol_handlers` (web+ironlog:), `scope_extensions`, `edge_side_panel` (400px), `tabbed` in display_override, `widgets` (Today's Summary Adaptive Card) · Version bumps to 5.3 |

---

## License

IRONLOG is a personal project by Byheir Wise. All rights reserved.
