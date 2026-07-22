# Financial Planning App — Spec

## 1. Problem & goals

[`financial-planning`](https://github.com/ajpye-gh/financial-planning) is a single-purpose household cashflow calculator hard-coded to one family's exact scenario: a specific salary ladder, a specific move-up-home timeline, a lake house purchase. The sliders, section groupings, and even the tooltip copy are all specific to that one household.

This app, `financial-planning-app`, is a **generic version** for any user's situation:

1. A short questionnaire up front determines which *base* sections apply (own vs. rent, spouse income, kids) — everything else is opt-in.
2. Every savings/spending/purchase objective — what `financial-planning` hard-coded as "lake house," "move-up home," "529," "travel," "other goals" — becomes an instance of a small set of **typed goals** that the user adds, edits, and removes freely. There is no hard-coded "lake house" anywhere in this app; it's an example a user could create.
3. "Free cash" is not tied to any one goal. Every goal's contribution subtracts from the same shared free-cash number, so a user can push any goal's slider up until free cash hits zero and see the tradeoff directly.
4. A chart toggle lets the user view the accumulation curve for any individual goal (e.g. "college fund growth"), not just one hard-coded line.

## 2. Non-goals

- No backend/server, no accounts, no multi-device sync. Stays a static, local, single-user app, like `financial-planning`.
- No tax-law-accurate modeling (marginal brackets, filing status, state tax) — inputs stay approximate/blended, matching `financial-planning`'s existing "net keep rate" simplification.
- No changes to `financial-planning` itself; this is a separate repo.
- The goal-type system (§4.3) is deliberately small at launch (three types) but designed to add more later (e.g. a rental-property or business-investment goal type) without changing the core architecture — inventing every possible goal type up front is explicitly out of scope.

## 3. User flow overview

1. **Questionnaire** (first run only, ~3 questions): own vs. rent, spouse/partner income, kids. Answers gate which *base* fields are shown — this is the only thing the questionnaire controls. See §4.2.
2. **Base sections** render based on those answers: Household position (income, expenses, housing — plus home value/mortgage if the user owns), Salary path, Household composition (spouse/kids fields, only if applicable), Assumptions (inflation, investment return).
3. **Goals list** — starts empty. The user adds goals from a small typed catalog (§4.3): a recurring accumulation/consumption goal, a big one-time purchase, or a debt payoff. Each goal gets its own slider(s) and, for accumulation/debt goals, its own accumulating/declining balance.
4. **Results**: verdict banner, metric cards, a chart with a **goal toggle** (§6.4) to inspect any one goal's curve, and a year-by-year breakdown table — same visual language as `financial-planning`, generalized to a dynamic goal list instead of fixed rows.
5. **Load/Save**: same file-based plan I/O as `financial-planning`, extended to the new schema, plus localStorage autosave so progress survives a closed tab.

Re-running the questionnaire is available from a settings affordance at any time (answering differently just changes which base fields are visible; it never touches the goals list).

## 4. Data model

### 4.1 Base inputs (always-relevant, non-goal fields)

These are the fields that apply to essentially every household, independent of any goal — analogous to `financial-planning`'s "Today's position," "Your salary path," and the non-conditional parts of "Household":

| Field | Notes |
|---|---|
| Net income /mo, Expenses /mo | as today |
| Housing payment, of which P&I | "housing payment" covers rent *or* mortgage payment — framing adjusts based on `ownsHome` |
| Home value, Mortgage balance | shown only if `ownsHome` (needed so a later "move to a bigger home" goal can compute sale equity) |
| Cash today, Brokerage today | as today — this is the shared "unallocated savings" pool every goal draws from/tops up. No dedicated reserve/emergency-fund target here anymore — that's just an `accumulate`-mode goal now (see the "Emergency fund top-up" catalog entry in §4.3) |
| Salary milestones (yr 0/1/4/6/10), growth after yr 10, net keep rate | as today |
| Wife/partner net /mo, income-stops year | shown only if `hasPartnerIncome` |
| Number of children, cost per child | always shown; children are added individually with an arrival year (0 = already part of the household today), organized the same way as salary raise breakpoints — not a single count slider |
| Inflation, investment return | as today, split into their own "Assumptions" section instead of buried in "Household" |
| Inspect year | global control for the breakdown table, as today |

### 4.2 Questionnaire

```ts
interface Question {
  id: string;
  prompt: string;
  type: 'boolean' | 'choice';
  options?: { label: string; value: string }[]; // for 'choice'
  showIf?: (answers: Answers) => boolean;
}

type Answers = Record<string, boolean | string>;

const QUESTIONS: Question[] = [
  {
    id: 'housing',
    prompt: 'Do you own or rent your home?',
    type: 'choice',
    options: [{ label: 'Own', value: 'own' }, { label: 'Rent', value: 'rent' }],
  },
  { id: 'hasPartnerIncome', prompt: 'Do you have a spouse or partner who earns income?', type: 'boolean' },
  { id: 'hasKids', prompt: 'Do you have kids, or plan to?', type: 'boolean' },
];
```

That's the entire questionnaire. Everything that was a fixed conditional *section* in `financial-planning` ("Move-up home," "Lake house," "Competing savings goals") is not gated by a question at all in this app — it's available any time via "add a goal," because a goal list that starts empty is already opt-in by construction.

### 4.3 Goal types — the core abstraction

A `Goal` is a discriminated union. Three types at launch, chosen to cover the distinct *shapes* of financial objective the user identified:

> "saving for a secondary home that has a definite purchase date that incurs new expenses, is different than saving monthly for travel or saving monthly for [college]"

```ts
type Goal = RecurringGoal | BigPurchaseGoal | DebtPayoffGoal;

/** Monthly amount that either accumulates (grows at the investment return) or is pure consumption. */
interface RecurringGoal {
  kind: 'recurring';
  id: string;
  name: string;                 // "Travel", "College (529)", "Emergency top-up", user-defined
  mode: 'accumulate' | 'consume';
  monthlyAmount: number;        // the slider value
  monthlyAmountRange: { min: number; max: number; step: number };
  targetAmount?: number;        // only meaningful when mode === 'accumulate'; renders a target line (§6.4)
}

/** A one-time purchase at a definite future year, optionally financed and/or funded by selling an existing asset,
 *  that changes ongoing recurring costs from that year forward. Covers both `financial-planning`'s "lake house"
 *  (no financing, no asset sale, purely additive new cost) and its "move-up home" (financed, sells the current
 *  home, REPLACES the existing housing payment) as two configurations of the same type. */
interface BigPurchaseGoal {
  kind: 'bigPurchase';
  id: string;
  name: string;                 // "Lake house", "Move to a bigger home", "New car", user-defined
  purchaseYear: number;
  priceToday: number;           // grows to `priceToday * (1 + appreciationPct/100) ** purchaseYear`
  appreciationPct: number;
  oneTimeExtras?: number;       // e.g. "toys budget" for a lake house, closing costs

  /** Omit for an all-cash purchase. */
  financing?: {
    downPayment: number;        // additional cash pushed in beyond any asset-sale proceeds
    ratePct: number;
    termMonths: number;
  };

  /** Omit if nothing is being sold to help fund this purchase. */
  existingAsset?: {
    valueToday: number;
    appreciationPct: number;
    loanBalanceToday: number;
    annualPaydown: number;
    sellingCostsPct: number;
  };

  /** Recurring cost from purchaseYear onward, as % of purchase value per year (tax/insurance/maintenance),
   *  applied monthly. */
  postPurchaseRecurringPctOfValue: number;

  /** If true (e.g. "move to a bigger home"), the new payment REPLACES the base "Housing payment" field from
   *  purchaseYear onward instead of adding a second, separate recurring cost (e.g. "lake house"). */
  replacesBaseHousing: boolean;
}

/** A balance that shrinks over time instead of growing. */
interface DebtPayoffGoal {
  kind: 'debtPayoff';
  id: string;
  name: string;                 // "Student loans", "Car loan", "Credit card", user-defined
  balanceToday: number;
  annualRatePct: number;
  minimumMonthlyPayment: number;
  extraMonthlyPayment: number;  // the slider — additional to the minimum, accelerates payoff
}
```

How today's `financial-planning` concepts map onto this:

| `financial-planning` concept | Generic equivalent |
|---|---|
| Travel /mo | `RecurringGoal`, `mode: 'consume'` |
| 529 /mo | `RecurringGoal`, `mode: 'accumulate'` |
| Other goals /mo | `RecurringGoal`, either mode, user's choice |
| Lake house (price, buy year, appreciation, carrying cost, toys budget) | `BigPurchaseGoal`, no `financing`, no `existingAsset`, `replacesBaseHousing: false` |
| Move-up home (new price, move year, rate, appreciation, selling costs, paydown, tax+insurance, extra down) | `BigPurchaseGoal`, with `financing` and `existingAsset` set, `replacesBaseHousing: true` |
| *(new — not in `financial-planning`)* | `DebtPayoffGoal`, e.g. for student loans, a car loan, credit cards |

A small starter catalog (Travel, College savings, Emergency fund, Second home, Move to a bigger home, Car loan, Custom…) seeds the "add a goal" picker with one of the three `kind`s pre-filled and sensible default ranges, but nothing about a specific goal name or purpose is hard-coded in the model — the catalog is just UI sugar over the same three types.

### 4.4 Plan file schema

```ts
interface PlanFile {
  version: 1;
  answers: Answers;
  baseInputs: Record<BaseFieldId, SliderRange>; // the §4.1 fields, same {min,max,step,default} shape as today's PlanData
  goals: Goal[];
}
```

Validation reuses the exact pattern from `financial-planning`'s `parsePlanData` (`src/lib/planData.ts`): check every expected base field, range sanity (`min <= default <= max`, `step > 0`), extended to validate `answers` and to discriminate/validate each `goals[]` entry by its `kind`.

## 5. Calculation engine

Per year (1..N, N configurable, defaulting to 18 as today):

1. Compute income (salary interpolation + partner income, as today).
2. Compute base living costs (non-housing expenses, kids cost, inflated). Kids cost = `costPerKidMo` × the count of children whose arrival year has been reached (0 = today), inflated — not a single "kids added" slider phased in on a fixed cadence.
3. Compute housing cost:
   - If no `BigPurchaseGoal` with `replacesBaseHousing: true` has reached its `purchaseYear` yet, use the base housing payment (P&I fixed, T&I inflating), as today's "current home" branch.
   - Once such a goal's `purchaseYear` arrives, switch to its financed payment (computed once at purchase, then inflated), exactly like today's move-up-home mechanic — just driven by the goal's fields instead of dedicated sliders.
4. For every other `BigPurchaseGoal` (not replacing base housing) that has reached its `purchaseYear`: add its `postPurchaseRecurringPctOfValue`-derived monthly cost to total expenses (purely additive), exactly like today's lake-house carrying cost.
5. For every `RecurringGoal`: subtract `monthlyAmount` from free cash. If `mode: 'accumulate'`, also grow that goal's own balance: `balance_y = balance_{y-1} * (1 + investmentReturn/100) + monthlyAmount * 12` (identical to today's `edu529` bucket). If `mode: 'consume'`, no balance is tracked, matching today's travel field.
6. For every `DebtPayoffGoal`: subtract `minimumMonthlyPayment + extraMonthlyPayment` from free cash, and shrink its balance: `balance_y = max(balance_{y-1} * (1 + annualRatePct/1200)**12 - (minimum+extra)*12, 0)`. Once a balance hits 0, its payment stops counting against free cash from the next year on (a paid-off loan frees up cash) — a new, realistic dynamic `financial-planning` didn't have.
7. **Free cash** = income − living costs − housing cost − Σ(all `BigPurchaseGoal` post-purchase recurring costs) − Σ(all `RecurringGoal` monthly amounts) − Σ(all `DebtPayoffGoal` payments). This is the "truly free" number from the user's request — every goal type subtracts from it on equal footing.
8. **Unallocated savings** (today's "Lake fund (liquid)", renamed): the shared brokerage/cash pool. Grows from whatever free cash is left after all goal contributions — invested straight into brokerage (no base reserve-target top-up mechanic; want a cash reserve, add an "Emergency fund top-up" goal instead). Cash today only moves as a last-resort draw-down if brokerage goes negative. At each `BigPurchaseGoal`'s `purchaseYear`, this pool is drawn down by the purchase's total cost (price + `oneTimeExtras`, plus `financing.downPayment` if financed, minus any `existingAsset` net sale proceeds if selling) — a shortfall here is what drives the "not funded" verdict, exactly as today's lake-house shortfall check.

The chart's timeline starts at a **Y0 baseline** (today's actual numbers — no inflation or growth applied yet) before the Y1..Y18 projection, so the line visibly anchors at your current position rather than jumping straight to a year already one year out.

This is a direct generalization of `financial-planning`'s `src/lib/model.ts` (`housingCostsForYear`/`lakeCarryForYear` become goal-driven; `edu529`'s accumulation becomes the general `RecurringGoal` case; `DebtPayoffGoal` is new).

## 6. UI/UX

### 6.1 Questionnaire wizard

A minimal multi-step flow (3 questions, §4.2) shown on first run. Simple enough not to need a dedicated routing library — a small `useState<number>` step index over the `QUESTIONS` array is sufficient, consistent with `financial-planning`'s existing preference for minimal dependencies.

### 6.2 Base sections

Reuse `financial-planning`'s `ControlGroup`/`SliderField`/`Tooltip` components and `.control-group`/`.slider-field` CSS classes unchanged. Section visibility is a pure function of `Answers`, evaluated once and passed down — the components themselves don't know about the questionnaire.

### 6.3 Goals list & goal editor

- A "Goals" section renders one card per active goal (reusing the `.control-group` card styling), each showing its type-appropriate slider(s) (`RecurringGoal`: one amount slider; `DebtPayoffGoal`: one extra-payment slider; `BigPurchaseGoal`: purchase year + price sliders, plus a collapsible "financing" and "selling my current home" sub-form when those are enabled) and a remove button.
- An "Add a goal" control opens the starter catalog (§4.3) or a "Custom" option per `kind`.
- Each goal's card shows a compact running total (e.g. current accumulated balance for `accumulate`/`debtPayoff`, or "funded"/"short by $X" for a `bigPurchase` goal whose year hasn't arrived) — reusing the `.metric-card` pattern.

### 6.4 Chart toggle

`CashflowChart` (`src/components/results/CashflowChart.tsx` in `financial-planning`) already plots two series on independent axes: a primary accumulating series (left axis) and free cash (right axis, dashed). Generalize the primary series selection:

```ts
type ChartSeriesId = 'unallocated' | `goal:${string}`;
```

A tab/segmented-control row above the chart lists "Unallocated savings" plus one entry per goal that has something meaningful to plot:

- **`RecurringGoal` (`mode: 'accumulate'`)** and **`DebtPayoffGoal`**: their own dedicated balance curve (growing or shrinking), with a target/zero reference line — closest to today's 529 behavior.
- **`BigPurchaseGoal`**: there's no separate dedicated balance (it draws from the shared pool, like lake house today) — selecting it shows the **"Unallocated savings" curve** with a purchase-year marker/annotation and that goal's funded/short-by metric called out, rather than a distinct line.
- **`RecurringGoal` (`mode: 'consume'`)**: no balance to chart at all (pure spend, like travel today) — excluded from the toggle, its effect is only visible in the free-cash line and the breakdown table.

Free cash (right axis) stays constant across every toggle selection since it's the shared budget-health indicator.

### 6.5 Persistence

- **File load/save**: reuse `PlanFileControls`'s file-input-read + Blob-download mechanics (`src/components/controls/PlanFileControls.tsx`) unchanged — only the shape being read/written grows to the `PlanFile` schema (§4.4).
- **localStorage autosave**: a `useAutosave(state)` hook debounces writes of `{answers, baseInputs, goals}` to `localStorage['financial-planning-app:draft']`. On load, hydrate from it if present, before falling back to a committed generic `Defaults.json` (same role as today's `Defaults.json`, but now just seeding `baseInputs` with an empty `goals: []`). An explicit "start over" action clears it and re-shows the questionnaire. Pure browser API, no new dependency.

## 7. Reused patterns from `financial-planning`

Carry over near-verbatim as the starting point (all under `financial-planning`'s `src/`):

- **Toolchain**: `package.json`, `eslint.config.js`, `tsconfig*.json`, `jest.config.cjs`, `.prettierrc.json`, `vite.config.ts` — React 19, strict TS, ESLint+sonarjs, Prettier, Jest+Testing Library. Copy these into the new repo's scaffold rather than re-deriving them.
- `src/lib/format.ts` — `formatCurrency`, `formatCurrencyCompact`, `formatSliderValue`. Fully generic already.
- `src/components/Tooltip.tsx` — CSS-only hover/focus tooltip. Fully generic.
- `src/index.css` — the `:root` token system (`--surface-1/2`, `--danger/success/warning` + `-bg` pairs, `--accent`, `--radius`, `--shadow`) and component classes (`.control-group`, `.slider-field`, `.metric-card`, `.verdict-banner`, `.breakdown-table`, range-input styling, the `aspect-ratio`-locked chart SVG pattern). New components (questionnaire wizard, goal editor, chart toggle) should extend this file following the same conventions.
- `PlanFileControls` (`src/components/controls/PlanFileControls.tsx`) — validated file load + Blob-download save pattern, reused for the extended schema.

What needs real redesign (not reused as-is): `sliderGroups.ts` → becomes the questionnaire + base-field schema (§4.1, §4.2); `model.ts` → the goal-driven engine (§5); `planData.ts` → the extended `PlanFile` schema (§4.4); `App.tsx` → questionnaire flow + goal editor + chart toggle; `CashflowChart.tsx` → parameterized primary series + purchase-year annotations.

## 8. Phased implementation roadmap

0. **Scaffold** — copy toolchain config from `financial-planning` (§7), generic branding/title, empty `App`.
1. **Questionnaire flow** — `QUESTIONS` schema (§4.2), wizard UI, `Answers` state + localStorage autosave.
2. **Base sections** — the §4.1 fields, gated by `Answers`, reusing `SliderField`/`ControlGroup`/`Tooltip`/`format.ts`.
3. **Goal engine, `RecurringGoal` first** — the simplest type (accumulate/consume), since it's a near-direct port of today's `edu529`/travel logic. Get add/remove/edit UI and the calculation loop (§5 steps 5, 7, 8) working end-to-end before adding the other two types.
4. **`DebtPayoffGoal`** — smaller addition on top of step 3's plumbing (declining balance instead of growing).
5. **`BigPurchaseGoal`** — the most complex type (financing, asset sale, `replacesBaseHousing`); port `financial-planning`'s `housingCostsForYear`/`lakeCarryForYear` logic (`src/lib/model.ts`) as the reference implementation.
6. **Chart toggle** (§6.4) — parameterize `CashflowChart`'s primary series, add the selector, purchase-year annotations, target/zero reference lines.
7. **Persistence** — extend `PlanFileControls` to the `PlanFile` schema (§4.4); wire up `useAutosave` (§6.5).
8. **Polish** — breakdown table adapted to the dynamic goal list, verdict banner logic across goal types, tests throughout, fully generic copy (no household-specific tooltip narrative anywhere).
