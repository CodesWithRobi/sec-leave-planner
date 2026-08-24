# SEC Leave Planner

A static web app that helps Saveetha Engineering College students plan leaves by computing per-subject and overall attendance impact.

## What it does

- **Dashboard** — shows current attendance for all subjects and activities, color-coded by zone (green ≥80%, amber 75-80% condonation risk, red <75% detained)
- **What-If** — pick a date range and see how leave affects every subject and overall. Shows remaining budget (how many more classes you can miss). Toggle to exclude activities from the pool.
- **Trip Planner** — scans ahead to find the longest vacation windows, ranked by calendar days. Input RP leaves to see how exchanging them for full-present days changes the picture. Expand any window for per-subject breakdown.
- **Import/Export** — bookmarklet copies your attendance JSON from learner.saveetha.in to clipboard. Paste it in and you're set.

## How to use

1. Open [learner.saveetha.in/attendance](https://learner.saveetha.in/academics/calculate-my-attendance/) and log in
2. Open browser console (F12 → Console)
3. Paste the bookmarklet code (copy it from the Settings tab) and press Enter
4. JSON is copied to your clipboard
5. Come back here, paste (Ctrl+V) into the box, and hit Import

## Rules it enforces

- Per-subject AND overall must stay ≥80%
- At course end, only medical OD can add percentage
- Activities (ECA-, SDCP) don't count per-subject but DO count in overall pool
- RP leaves cover the busiest school days first

## Built with

- React + TypeScript + Tailwind CSS
- Vite
- Pure TypeScript engine (no dependencies for calculations)

## Getting started

```bash
npm install
npm run dev
```

## Running tests

```bash
npx vitest run
```
