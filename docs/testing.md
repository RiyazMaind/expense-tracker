# Testing Strategy

## Testing Layers

### Unit Tests

Test:

- date calculations
- weekly calculations
- monthly calculations
- category totals
- budget calculations
- currency formatting

### Integration Tests

Test:

- SQLite insert
- update
- delete
- queries
- persistence

### E2E

Test complete user journeys:

- add expense
- edit expense
- delete expense
- view history
- view analytics
- set budget
- restart app
- verify persistence
- operate offline

## Tooling

### Playwright

Use Playwright for Expo Web or web-specific surfaces.

Do not treat it as the primary native Android/iOS automation solution.

### Native E2E

Use Maestro or Detox for native device/simulator workflows when needed.

## Visual QA

Every major screen should be visually reviewed on actual rendered output.

Review:

- spacing
- typography
- safe areas
- touch targets
- scrolling
- keyboard
- glass effects
- contrast
- empty states
- edge cases

## Critical Acceptance Tests

### Add Expense

Given the user enters ₹250 Food,
when they save,
then the expense exists in SQLite,
appears in history,
and updates dashboard totals.

### Persistence

Given an expense exists,
when the app is restarted,
then the expense remains available.

### Offline

Given the network is disabled,
when the user adds and views expenses,
then all core functionality continues to work.

### Budget

Given a ₹20,000 monthly budget and ₹12,000 spending,
then remaining budget is ₹8,000 and progress is 60%.

## Regression Rule

Any bug fixed in calculations or persistence should receive a regression test.
