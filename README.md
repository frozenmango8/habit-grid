# habit-grid

[![CI](https://github.com/frozenmango8/habit-grid/actions/workflows/ci.yml/badge.svg)](https://github.com/frozenmango8/habit-grid/actions/workflows/ci.yml)

A habit tracker. Each habit is a year-long grid, in the style of a contribution graph.

Live site: https://frozenmango8.github.io/habit-grid/

## Use

Habits stay in this browser. Export writes a JSON backup, and Import replaces what is stored here with that file.

Add a habit with a color and either a daily goal or a weekly one, such as 3 times a week. Check it off from Today, or click a day in the grid. Click a finished day to clear it. When the daily goal is above one, each click steps the count and the square darkens as it fills.

Each habit shows the current streak, the longest streak, and how much of the last 30 days and of the year on screen is done. Weekly habits count streaks in weeks. Today, or the current week, does not break a streak until it is over.

Week starts on Sunday or Monday. The theme can follow the system, or stay light or dark. Archive hides a habit without deleting its log. Up and Down change the order.

## Develop

Requires Node 22.

```sh
npm install
npm run dev
npm test
npm run lint
npm run build
```

GitHub Actions runs lint, typecheck, test, and build on pull requests and on pushes to `main`. A push to `main` also publishes the site.
