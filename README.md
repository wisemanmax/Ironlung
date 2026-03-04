# IRONLOG — Intelligent Fitness Tracker PWA

A complete workout, nutrition, and body metrics tracking app built as a Progressive Web App. Designed for iPhone — install directly to your home screen. No App Store needed.

**Created by Byheir Wise** — [Byheir.com](https://byheir.com)
**For updates visit** — [Ironlog.space](https://ironlog.space)

---

## Features

### Workout Logging
- 90+ exercise library with YouTube form videos for every movement
- Auto-fill weights from your last workout — no retyping
- "Repeat Last Workout" button for quick gym sessions
- Live workout timer that auto-tracks session duration
- Rest timer with 60/90/120/180s presets and vibration alerts
- Workout templates: PPL, Upper/Lower, Full Body, Bro Split, and custom
- 5-star workout rating system
- Notes on every session
- PR auto-detection with celebration screen

### Progressive Overload Engine
- Analyzes your last 3 sessions per exercise
- 4 recommendation types: Increase weight, Repeat, Add rep, Deload
- Shows estimated 1RM and training zones (80% / 70%)
- Explains *why* it's recommending each action
- Deload detection when you're failing for multiple sessions

### Muscle Heat Map
- Interactive front + back body diagram (SVG)
- 13 muscle groups: Chest, Back, Front/Side/Rear Delts, Traps, Biceps, Triceps, Quads, Hamstrings, Glutes, Calves, Core
- 77 exercise-to-muscle mappings (primary + secondary)
- 10-day decay system — muscles fade from trained to untrained over time
- Color-coded: Grey → Yellow → Green → Red
- Imbalance alerts: detects quad/hamstring, chest/back, bicep/tricep, and front/rear delt imbalances
- Tap any muscle for detail score

### Strength Score System
- Composite score from Bench, Squat, and Deadlift
- Body-weight-normalized ratios (Bench 30%, Squat 35%, Deadlift 35%)
- Rank scale: Novice → Beginner → Intermediate → Advanced → Elite
- Animated ring chart visualization
- Earned badges: Bench 1.5x BW, Squat 2x BW, Dead 2.5x BW, 1000lb Club
- Monthly score trend chart

### Nutrition Tracking
- 500+ food database with instant search
- Barcode scanner — scan any product, auto-lookup via Open Food Facts API (3M+ products)
- Manual barcode entry fallback
- Meal-by-meal logging: Breakfast, Lunch, Dinner, Snacks
- Auto-calculate totals from food items
- Calorie, protein, carbs, fat tracking with goals
- Water intake (glasses/day)
- Sleep tracking (hours)
- Macro trend charts

### Body Metrics
- Weight, body fat, waist, chest, arms, thighs tracking
- Trend charts for all measurements
- Progress photos with camera capture and date overlay

### Analytics Dashboard
- Volume trends over time
- Workout frequency and distribution
- Muscle group distribution pie chart
- Progression charts for Big 3 lifts
- Configurable date ranges: 7d, 14d, 30d, 90d

### Calendar & Scheduling
- Weekly workout plan with day types
- Predefined splits: PPL, Bro, Upper/Lower, Full Body
- Override individual days
- Visual calendar view

### Smart Features
- Motivational messages when starting a workout
- Auto-duration tracking (live timer → auto-fills minutes on save)
- Previous best displayed for every exercise
- Plate calculator (plates per side for any weight)
- 1RM calculator with percentage chart
- Units toggle: lbs / kg (used throughout the entire app)

### Data Management
- Export full backup as JSON (versioned with metadata)
- Import with smart merge — existing data is never duplicated or lost
- Load demo data to explore the app
- Clear all data with confirmation

### Design
- Dark theme with glassmorphism
- iPhone-optimized: 44px touch targets, safe area insets, momentum scroll
- Bottom tab navigation always visible
- IRONLOG logo → tap to go home from anywhere
- Accordion settings to minimize scrolling
- Scroll-to-top on every page navigation

---

## Install on iPhone

1. Open `https://wisemanmax.github.io/ironlog/` in **Safari**
2. Tap the **Share** button (square with arrow)
3. Scroll down and tap **"Add to Home Screen"**
4. Name it **IRONLOG** and tap **Add**
5. Launch from your home screen — runs fullscreen like a native app

## Deploy to GitHub Pages

```bash
git init
git add .
git commit -m "IRONLOG v3"
git branch -M main
git remote add origin https://github.com/wisemanmax/ironlog.git
git push -u origin main
```

Then in GitHub → Settings → Pages → Source: **main** branch, root folder.

Live at: `https://wisemanmax.github.io/ironlog/`

## Tech Stack

- React 18 (CDN — no build tools needed)
- Recharts (charts and visualizations)
- Babel standalone (JSX compilation in browser)
- Service Worker v4 (offline caching)
- localStorage (persistent data across sessions)
- Open Food Facts API (barcode nutrition lookup)
- BarcodeDetector API (native camera barcode scanning)
- CSS-in-JS (zero external stylesheets)

## File Structure

```
ironlog/
├── index.html      ← Entire app (single file, ~180KB)
├── sw.js           ← Service worker for offline support
├── manifest.json   ← PWA manifest (app name, icons, theme)
├── icon.svg        ← App icon
└── README.md       ← This file
```

## Version History

- **v3.0** — Full rebuild: PWA, 90+ exercises, 500+ foods, charts, templates, rest timer, PR detection
- **v3.1** — Onboarding flow, export/import, progressive overload, units toggle, 1RM calculator, progress photos
- **v3.2** — Barcode scanner, smart merge import, persistent bottom nav, settings accordion
- **v3.3** — Muscle heat map, strength score system, enhanced progressive overload (multi-session analysis, deload detection)
- **v3.4** — Auto-fill from last workout, live workout timer, repeat last workout, motivational messages, global footer, scroll fixes for iOS

---

**Created by Byheir Wise** — [Byheir.com](https://byheir.com) — [Ironlog.space](https://ironlog.space)
