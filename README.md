# Financial Planning

A client-side financial-planning tool for projecting household cash flow, funding
goals, and modeling retirement drawdown. Everything runs in the browser — there is
no backend and no data leaves the page.

## Features

- **Cash-flow projection** — models income (including partner salary), expenses,
  salary-raise breakpoints, job-loss events, and children arriving over time.
- **Goals** — add funded goals (emergency fund, retirement, property purchase, and
  general savings) with per-category asset-allocation rules, and see each goal's
  trajectory on the chart.
- **Retirement planning** — a dedicated page that splits savings into Roth and
  Traditional buckets, estimates federal income tax at withdrawal (single or
  married-filing-jointly brackets), and projects balances to age 100 with an
  inspect-age slider and year-by-year breakdown.
- **Interactive controls** — sliders and toggles for every assumption, with
  currency shown compactly (thousands, and millions above $1M).
- **Save / load plans** — plans persist locally so you can revisit and compare them.

## Tech stack

- React 19 + TypeScript
- Vite (built to a single self-contained HTML file via `vite-plugin-singlefile`)
- Jest + Testing Library for tests

## Getting started

```bash
npm install
npm run dev        # start the dev server
```

Then open the URL Vite prints (default http://localhost:5173).

## Scripts

| Command             | Description                                      |
| ------------------- | ------------------------------------------------ |
| `npm run dev`       | Start the Vite dev server                        |
| `npm run build`     | Type-check and build a single-file production app |
| `npm run preview`   | Preview the production build                      |
| `npm run lint`      | Run ESLint                                        |
| `npm run typecheck` | Type-check without emitting                      |
| `npm test`          | Run the Jest unit tests                          |

## Project structure

```
src/
  App.tsx            App shell, tabs (Home / Retirement), and layout
  components/
    controls/        Assumption sliders, toggles, breakpoint editors
    goals/           Goal cards and the goals panel
    results/         Cash-flow chart, metric cards, breakdown table, verdict
    retirement/      Retirement page, chart, tax filing toggle, breakdown
  lib/               Modeling and formatting logic
    model.ts         Core cash-flow projection engine
    retirement.ts    Retirement drawdown projection
    tax.ts           Federal income-tax estimation
    goals.ts         Goal categories and allocation rules
    plans.ts         Plan serialization / save-load
    ...              format, children, salaryRaises, chartSeries, baseData
  hooks/             Draft-state management
  data/              Default assumptions

tests/               Jest unit tests mirroring src/
```

## Requirements

Node >= 24.13.0 (see `engines` in `package.json`).
