# Technical Architecture

## Stack

- Expo
- React Native
- TypeScript
- Expo Router
- Expo SQLite
- Zustand
- Expo Blur
- Expo Linear Gradient
- Expo Haptics

## Architecture Principles

### Local First

SQLite is the source of truth for persistent expense data.

Zustand is the application state layer, not the permanent database.

### Separation of Concerns

UI components should not contain complex financial calculations.

Use:

- database layer for persistence
- repositories for data access
- store for application state
- utility/services for calculations
- components for presentation

## Suggested Structure

```text
app/
  _layout.tsx
  index.tsx
  add-expense.tsx
  expenses.tsx
  analytics.tsx
  budget.tsx
  settings.tsx

components/
  glass/
  dashboard/
  expenses/
  analytics/
  navigation/

database/
  database.ts
  migrations.ts
  repositories/

store/
  expenseStore.ts

constants/
  categories.ts
  theme.ts

utils/
  calculations.ts
  dates.ts
  currency.ts

docs/

.agents/
  skills/
```

## Data Flow

```text
User Interaction
      ↓
Screen / Component
      ↓
Zustand Store / Service
      ↓
Repository
      ↓
SQLite
      ↓
Updated State
      ↓
UI
```

## Database Rule

Do not duplicate derived financial totals as permanent database fields unless there is a strong reason.

Totals such as:

- weekly spending
- monthly spending
- category totals
- remaining budget

should generally be calculated from source data.

## Navigation

Use Expo Router.

Recommended primary navigation:

- Home
- Expenses
- Analytics
- Budget

Settings can be accessible from the Home header or another secondary location.

## Performance

Avoid unnecessary re-renders.

For large expense histories:

- use FlatList
- use memoized row components where useful
- query only required data
- avoid recalculating expensive analytics on every render

## Offline Requirement

Core operations must not depend on:

- API requests
- authentication
- remote databases
- network availability
