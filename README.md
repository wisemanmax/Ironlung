# IRONLOG v4.0

**Complete workout, nutrition, and body tracking PWA — offline-first, privacy-focused, free forever.**

## Features

### Core Tracking
- **Workout Logger** — exercises, sets, reps, weight, RPE, duration, rating, notes
- **Nutrition Logger** — 500+ food database, barcode scanner (OpenFoodFacts), meal breakdown, custom foods
- **Body Metrics** — weight, body fat %, chest, waist, arms, thighs with trend charts
- **Progress Photos** — compressed to ~100KB, cloud synced

### Intelligence
- **Adaptive Coach** — daily program based on schedule, progressive overload suggestions
- **Readiness System** — daily check-ins (soreness, energy, motivation, sleep) → composite score
- **Goal Engine** — milestones with deadline tracking and completion
- **Data Integrity Guard** — outlier detection, duplicate detection, suspicious value flags
- **Phase Tracking** — tag cut/bulk/maintain/strength/deload blocks, compare outcomes
- **Injury Awareness** — flag pain by joint, auto-maps affected exercises
- **Exercise Substitution** — find alternatives by movement pattern and muscle group

### Social & Reports
- **Workout Proof Cards** — shareable branded image cards
- **Weekly Summary** — auto-generated report card with share capability
- **Strength Score** — composite score based on compound lifts

### PWA Features
- **Offline-First** — full functionality without internet, IndexedDB sync queue
- **Cloud Sync** — signed auth tokens, per-type sync toggles, background sync retry
- **Push Notifications** — workout/check-in/hydration reminders with action buttons
- **Quiet Hours** — notifications suppressed 10pm–7am
- **Install Funnel** — smart install banner after 3+ visits, platform detection
- **App Shortcuts** — long-press home icon for quick actions

### Data Safety
- **Pre-save Validation** — warns on suspicious values before writing
- **Delete Confirmations** — modal confirmation on all destructive actions
- **Undo System** — 5-second undo toast after any delete
- **Edit Existing Entries** — tap any history card to modify
- **Signed Sync** — auth token on every cloud request
- **Privacy Controls** — per-type sync toggles, cloud deletion request
- **Error Boundary** — crash recovery with emergency data export

## Architecture

```
Frontend (GitHub Pages)
├── index.html          — Single-file React SPA (~6,000 lines)
├── sw.js               — Service worker: cache, push, background sync, queue
├── manifest.json       — PWA manifest with shortcuts
└── icon.svg            — App icon

Backend (Vercel Serverless)
├── api/sync/push.js    — Upserts all data types to Supabase
├── api/sync/pull.js    — Fetches all data for restore
├── api/users/create.js — User registration
└── api/users/update.js — Profile updates

Database (Supabase/Postgres)
├── users               — Profile + consent
├── workouts            — Exercises as JSONB
├── nutrition           — Macros + meals as JSONB
├── body_measurements   — Weight, bf%, circumferences
├── progress_photos     — Compressed base64
├── checkins            — Daily readiness scores
├── milestones          — Goals with completion tracking
├── user_settings       — Goals, schedule, exercises, units
└── sync_log            — Push/pull audit trail
```

### Sync Flow
1. Client saves locally (localStorage)
2. 3-second debounce → push to `/api/sync/push`
3. On failure → IndexedDB queue with retry (5 attempts, 24hr TTL, queue compaction)
4. Background Sync API fires on reconnect
5. Pull on restore → merges with deduplication

## Deployment

### Frontend
1. Push `index.html`, `sw.js`, `manifest.json`, `icon.svg` to GitHub Pages repo
2. Hard refresh to clear old service worker

### Backend
1. Set Vercel environment variables: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
2. Push `api/` folder + `package.json` + `vercel.json` to Vercel-connected repo
3. Run `setup-all-tables.sql` in Supabase SQL Editor

## Known Limitations
- iOS PWA notifications are limited (Apple restricts background triggers)
- BarcodeDetector API not available in Safari — falls back to manual entry with camera open
- Photos > 800px are downscaled to JPEG 70% quality for sync compatibility
- Single-file architecture — works but slows iteration at scale

## Version History
- **v4.0** — Auth tokens, delete confirmations, undo, pre-save validation, edit entries, exercise search, accessibility, error boundary, nutrition copy, quiet hours, SW queue hardening, install analytics
- **v3.5** — 8 features: Readiness, Goals, Coach, Cloud Sync, Social Cards, Offline PWA, Form Check, Data Guard + Phases + Injuries + Substitutions + Privacy + Accessibility + Reminders
- **v3.0** — Cloud sync, barcode scanner, push notifications, progress photos
- **v2.0** — Analytics, calendar, templates, plate calculator
- **v1.0** — Core workout/nutrition/body tracking

---

**Created by Byheir Wise** · [ironlog.space](https://ironlog.space) · [byheir.com](https://byheir.com)
