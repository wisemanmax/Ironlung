# IRONLOG v8.1

A complete fitness tracking PWA — workouts, nutrition, body metrics, progress photos, AI coaching, social community, admin panel, and cloud sync. Single-file React app, zero build step, works offline.

**Live:** [ironlog.space](https://ironlog.space)

---

## Stats

| Metric | Value |
|---|---|
| Frontend | 13,775 lines · single HTML file |
| Components | 87 React components |
| Routes | 67 unique views |
| State actions | 29 reducer mutations |
| Exercise DB | 200 exercises · 11 categories · all with YouTube links |
| Food DB | 200+ foods with full macros |
| Fast food hacks | 57 meals < 600 cal · 30+ brands |
| Training programs | 6 with full exercise details |
| API endpoints | 9 serverless functions (Vercel Hobby: 12 max) |
| Database | 18+ tables · Supabase |
| Auth | Session tokens · SHA-256 hashed PIN · email verification · PIN reset · admin verification |
| Email | Resend · verified domain · 3,000 emails/month free |
| Service Worker | v8.0 · offline fallback · background sync · push hardening |
| PWA score | Improved · 192px + 512px icons · screenshots · manifest id |

---

## Navigation

**7 tabs for admins, 6 for users:** Home · Log · Track · Plan · Social · Settings · Admin (admin only)

---

## Home Tab

- Time-based greeting with display name
- **Today's Focus card** — unified split type + exercise chips + Start Workout CTA
- Streak flame with all-time record tracking
- 30-day training heatmap — green = trained, red = missed scheduled day
- Weekly goal progress ring — configurable workouts/week target
- Readiness score gauge with factor pills and Check In button
- Quick actions (Workout, Nutrition, Weigh-in) — flattened single-layer buttons
- Today's nutrition summary — Protein / Carbs / Fat with progress bar
- Accountability partner nudge
- Today's workout with auto-generated shareable card
- Strength chart (Big 3 trends)
- Sync status via `<SyncStatus>` component

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
- Drop / Fail set flags — tappable bordered buttons with 28px touch targets
- Repeat last workout — ellipsis truncation on long exercise names
- Templates from training programs
- Progressive overload suggestions
- PR auto-detection with celebration and share card
- Crash recovery — unsaved workout restored after unexpected close; "Later" option to defer
- Plate calculator, live timer, 1-5 star rating
- Pre-save validation, edit/delete with undo

### Nutrition Logger
- 200+ food database with full macros
- Barcode scanner (camera-based)
- 4 meal slots with meal timing — 32px touch-target time picker
- Recent foods quick-add chips
- Meal favorites — save combos, one-tap reload
- Auto-calculate totals from food items
- Macro pie chart (P/C/F donut)
- Water tracking — useState counter with progress bar
- Calorie deficit/surplus indicator vs TDEE
- Copy yesterday's nutrition
- Edit past entries

### Body Metrics
- Weight, body fat %, chest, waist, arms, thighs
- Trend arrows and goal weight line on chart
- 7-day rolling average weight vs prior week
- Progress since Day 1 comparison card
- Unit-aware measurement bars (42 in / 100 cm max)
- Photo prompt after saving (if 7+ days since last photo)
- Copy yesterday, dual-axis weight/BF% chart

---

## Track Tab (14 Sub-Pages)

- Workouts — history with share cards, drop/fail badges, notes
- PRs — all exercises, E1RM, % of PR, category filter
- Exercise Chart — any exercise weight/E1RM over time
- Duration Trends — avg/longest/shortest, bar chart
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
- Form Check — video recording with interactive cue checklist
- Data Guard — suspicious data detection with delete on all warning types

---

## Analytics Tab

- Exercise progression — top-12 most-logged exercises, horizontal scroll chip row
- Volume by muscle group — pie chart with pill-style legend
- Weekly frequency bar chart

---

## Calendar Tab

- Month view with workout type colour coding
- "Today" button inlined into month nav header
- Day detail sheet — completed exercises, last session of type, suggested exercises, override assignment

---

## Social Tab

- Feed with reactions (🔥💪👏💎😤), count badges, scale animation
- Friends — add by code/username/email
- **iMessage-style DMs** — corner radii, date separators, friend avatar on last bubble, image bubbles, emoji reactions, quick reply chips, push notification prompt
- DM inbox — sorted by last message time, unread badges, skeleton loading, search, pending requests banner
- **Smart unread counting** — 15s global poller, watermark-based deduplication, merge (not replace) for crash/image safety
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
- **Basic / Advanced mode toggle** — persisted to localStorage; Advanced reveals Privacy & Sync and System Health sections
- Goals — cal, protein, carbs, fat, TDEE, goal weight, workouts/week
- Schedule, Exercise Library (YouTube URL optional)
- Profile editing, Backup & Restore (cloud sync + PIN)
- Storage indicator (X / 5 MB with progress bar)
- Export all data as JSON, demo data, clear all
- Privacy controls (4 toggles), Accessibility (3 options — persisted across data resets)
- Reminders (push notifications) with full Web Push subscription on enable
- Legal & Privacy — "Do Not Sell My Personal Information" link
- System Health panel (advanced) — sync status, offline queue, SW version, push status, storage quota, data integrity check

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

### Auth & Email
- Server-issued session tokens (30-day expiry, device-scoped)
- 6-digit PIN: SHA-256 hashed at rest (salt = first 16 chars of email)
- **Email verification** on signup — 6-digit code via Resend, 15-min expiry, 5-attempt limit, 60s resend cooldown
- **Forgot PIN / PIN reset** — send code → verify code → set new PIN (short-lived reset token, revokes all sessions on success)
- Email sent from `no-reply@ironlog.space` via Resend (3,000/month free)
- DNS: SPF + DKIM + DMARC records on Namecheap, MX on Namecheap, all verified

### PWA & Offline
- SW v7.5: network-first HTML, cache-first CDN (7-day max-age), SWR for assets
- Offline fallback page, offline badge in-app
- Periodic background sync (4hr where supported)
- Push re-subscribe on subscription change + health check
- iOS install guide modal, landscape lock
- 192×192 and 512×512 PNG icons
- Mobile (1080×1920) and desktop (1280×800) screenshots for install UI
- `manifest.json`: `id`, `lang`, `dir`, `display_override`, `launch_handler`, `share_target`, `file_handlers`

### Cloud Sync
- Auto-sync on every change (debounced 3s)
- IndexedDB offline queue with retry; permanent 4xx errors discarded rather than retried forever
- Photo/video upload to **Cloudflare R2** (free egress, globally cached, immutable headers)
- Private vault photos served via signed URLs (1hr expiry, scoped to owner)
- Sync timestamp on Home

### Polling Optimization
- Global app poller: 15s when visible / 60s when backgrounded
- DM conversation poller: 8s when visible / 90s when backgrounded
- Messages inbox tick: 30s always
- ~50-60% Vercel invocation reduction when app is backgrounded

### Push Notifications
- VAPID-based Web Push via `web-push` npm package
- `/api/push` endpoint: `subscribe`, `send` (admin), `notify_dm` (user, 60s rate limit)
- SW `notificationclick` opens `/?open-dm=EMAIL` for DM deep-links
- Push subscription registered on notification permission grant (tour, settings, or DM prompt)

### Security
- Server-issued session tokens (30-day expiry)
- 6-digit PIN: SHA-256 hashed at rest (salt = first 16 chars of email)
- Admin: database flag + backend verification + env var super-admin
- CORS restricted to `ironlog.space` and `*.ironlog.space` on all endpoints (subdomain-ready)
- DM send requires verified friendship server-side
- `mark_read` by ID scoped to authenticated user
- `log_event` enforces an allowlist of 12 valid event types
- `photoId` sanitized to `[a-zA-Z0-9_-]` before use in storage path
- Stack traces excluded from error responses
- Admin `user_detail` returns safe column projection (excludes PIN hash)
- PIN reset revokes all active sessions on success
- Email codes: timing-safe compare, SHA-256 hashed, never stored plaintext

### UX Polish
- **Undo countdown bar** — real-time 100ms interval drain over 6 seconds
- Crash recovery — WorkoutTab checks IndexedDB on mount; prompts resume if unsaved workout < 4 hours old
- Accessibility preferences survive full data reset (`CLEAR_ALL`)
- Custom confirm dialogs (zero browser popups)
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
├── index.html              — 13,775-line single-file React PWA
├── sw.js                   — Service Worker v8.0
├── offline.html            — Offline fallback page
├── 404.html                — SPA redirect
├── manifest.json           — PWA manifest
├── icon.svg                — Source icon
├── icon-192.png            — PWA install icon (192×192)
├── icon-512.png            — PWA install icon (512×512)
├── screenshot-mobile.png   — Install UI screenshot (1080×1920)
├── screenshot-desktop.png  — Install UI screenshot (1280×800)
├── tests/                  — Unit tests
└── e2e/                    — Playwright E2E tests

Backend (Vercel Hobby — 9/12 functions used)
├── api/auth/session.mjs    — All auth: create/validate/revoke/revoke_all +
│                             email verify (send_verify_code, confirm_verify_code) +
│                             PIN reset (send_reset_code, verify_reset_code, set_new_pin)
├── api/auth/validate.mjs   — Session middleware (shared module, not a function)
├── api/sync/push.js        — Data push (workouts, nutrition, body, photos…)
├── api/sync/pull.js        — Data pull with PIN/session auth
├── api/sync/reconcile.js   — Client-server record count reconciliation
├── api/users/index.mjs     — User create/update
├── api/push/index.mjs      — Web push subscription + DM notify (60s rate limit)
├── api/photos/upload.mjs   — Photo/video upload to Cloudflare R2 + signed URL generation
├── api/social/index.mjs    — Friends, feed, groups, DMs, notifications
└── api/admin/index.mjs     — Admin dashboard, user management, moderation

Database (Supabase — 18+ tables)
├── users                   — profile, PIN hash, email_verified, verify/reset code fields
├── sessions                — device-scoped tokens with expiry
├── workouts / sets
├── nutrition / foods
├── body_metrics
├── progress_photos         — R2 storage_path, media_type, file_extension
├── social (friends, feed, groups, DMs, notifications)
└── push_subscriptions
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
| `LATEST_APP_VERSION` | Current version string (e.g. `8.1`) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID for R2 |
| `R2_ACCESS_KEY_ID` | R2 S3-compatible access key |
| `R2_SECRET_ACCESS_KEY` | R2 S3-compatible secret key |
| `R2_BUCKET_NAME` | R2 bucket name (e.g. `ironlog-photos`) |
| `R2_PUBLIC_URL` | R2 public bucket URL (e.g. `https://pub-xxx.r2.dev`) |
| `RESEND_API_KEY` | Resend API key for transactional email |
| `UPDATE_NOTES` | Optional update message shown to outdated clients |

### Database
Run SQL migrations in order:
1. Base schema
2. `add_email_verification.sql` — adds `email_verified`, verify/reset code columns to `users`

### Email (Resend)
1. Add domain at resend.com/domains
2. Add DNS records in Namecheap Advanced DNS: DKIM (TXT), SPF (TXT), DMARC (TXT), MX
3. Verify domain in Resend
4. Emails send from `no-reply@ironlog.space`

---

## Ecosystem Roadmap

```
ironlog.space              ← main app (hub) ✅ live
nutrition.ironlog.space    ← NutritionLog (fork of nutrition tab)
gymmatcher.ironlog.space   ← Gym Matcher (hold until user base)
therapy.ironlog.space      ← TherapyLog (future)
finance.ironlog.space      ← FinanceLog (future)
```

**SSO plan:** Cookie scoped to `.ironlog.space` set on login. All subdomains read it automatically. CORS already allows `*.ironlog.space`.

**Build order:**
1. ~~Email verification + PIN reset~~ ✅ Done
2. SSO cookie on login
3. NutritionLog subdomain
4. Gym Matcher (when user base exists)

---

## Capacity (Free Tiers)

| Resource | Limit | Notes |
|---|---|---|
| Vercel invocations | 100K/mo | ~25-40 DAU after polling fixes |
| Vercel functions | 12 max | Using 9 |
| Supabase Auth MAUs | 50K | Not a concern |
| Supabase DB storage | 500MB | ~5KB/user |
| Supabase bandwidth | 5GB | Fine (media on R2) |
| R2 storage | 10GB free | ~10,000 photos |
| R2 egress | Free forever | Unlimited |
| Resend emails | 3,000/mo | Fine for current scale |

**Upgrade trigger:** Vercel Pro ($20/mo) at ~30 DAU → 250-400 DAU ceiling.

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
| v5.0 | Major bug audit: 10 fixes across social/sync/admin/frontend |
| v5.1 | Full audit pass: PIN hashing (SHA-256), admin delete/ban, reaction allowlist, group validation, DM enforcement, photoId sanitization, crash recovery, SyncQueue 4xx discard, a11y persistence, ShareCard promise fix |
| v5.2 | Second audit pass: PIN auth fixed in pull.js, DM friendship enforcement, notification ownership check, admin safe projection, stack traces removed, PWA: 192px + 512px icons, screenshots, full manifest fields |
| v5.3 | PWA manifest completion: `protocol_handlers`, `scope_extensions`, `edge_side_panel`, `tabbed` display_override, `widgets` |
| v5.4 | Fix: Save buttons inaccessible on all Log/form sheets — all overlays portalled via ReactDOM.createPortal |
| v6.0 | Sync integrity reconciliation (`/api/sync/reconcile.js`): client-server record count comparison · System Health panel in Settings · `ReconcileAPI` auto-runs every 4 hours |
| v7.0 | **Home tab overhaul (10 changes)** · **Full app audit (27 fixes):** D/F flag buttons, water counter refactor, calendar cell labels, form check interactive checkboxes, history star ratings, measurement bars unit-aware, analytics pie legend, exercise selector top-12, calendar "Today" inline, DataGuard delete, social stats labels, feed quick-action buttons, repeat-last ellipsis, crash recovery "Later", meal time touch target, Progress Day 1 labels, YouTube field optional, Settings pills solid-fill, Settings Row icon flattened, Social feed mount-once |
| v8.0 | **iMessage-style Messages tab** · **Smart unread system** · **Cloudflare R2 media storage** (photos + videos, free egress) · **Video support** (mp4/mov up to 50MB) · **Polling optimization** (50-60% invocation reduction when backgrounded) · **Settings Advanced/Basic toggle** · **Push notifications end-to-end** · Bug fix pass (5 fixes) |
| v8.1 | **Email verification on signup** — 6-digit code via Resend, resend cooldown, skip option · **Forgot PIN / PIN reset flow** — send code → verify → set new PIN, revokes all sessions · **API consolidation** — verify-email + reset-pin merged into session.mjs, signed-url merged into upload.mjs, backup files deleted · Down to 9 serverless functions (was 13, Hobby limit is 12) · **Resend domain setup** — SPF/DKIM/DMARC/MX records on Namecheap, verified on ironlog.space |

---

## License

IRONLOG is a personal project by Byheir Wise. All rights reserved.
