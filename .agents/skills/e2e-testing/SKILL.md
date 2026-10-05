# E2E Testing Skill

## Purpose

Define reliable end-to-end testing for the offline-first Expense Tracker mobile application.

The application must remain useful without an internet connection.

Testing should focus on real user workflows rather than implementation details.

## Testing Strategy

Use the appropriate tool for the runtime:

- Playwright for web / Expo Web flows
- Maestro or Detox for native Android/iOS flows
- Unit tests for calculation and business logic

Do not treat Playwright as a native mobile automation framework.

## Core User Journeys

### Add Expense

1. Launch app.
2. Open Add Expense.
3. Enter amount.
4. Select category.
5. Enter optional note.
6. Save.
7. Verify expense appears in history.
8. Verify dashboard totals update.

### Edit Expense

1. Open an existing expense.
2. Change amount/category/note.
3. Save.
4. Verify updated expense.
5. Verify totals update.

### Delete Expense

1. Open an existing expense.
2. Delete it.
3. Confirm destructive action if confirmation exists.
4. Verify expense disappears.
5. Verify totals update.

### Weekly Tracking

Create expenses on different dates where the test environment allows it.

Verify:

- Weekly total
- Daily breakdown
- Average daily spending
- Correct inclusion/exclusion of dates

### Monthly Tracking

Verify:

- Current month total
- Previous month comparison
- Category totals
- Monthly average

### Budget

1. Set monthly budget.
2. Add expenses.
3. Verify spent amount.
4. Verify remaining amount.
5. Verify progress.
6. Verify overspending state.

### Persistence

This is critical.

1. Add an expense.
2. Close/reload/restart the app.
3. Reopen expense history.
4. Verify the expense still exists.

## Offline Testing

The application must not require network access for:

- Adding expenses
- Editing expenses
- Deleting expenses
- Viewing expenses
- Viewing analytics
- Viewing budgets

Where possible, run the application with network disabled and repeat the core workflows.

## Data Integrity

Verify that:

- Amounts are stored correctly
- Dates are correct
- Categories remain correct
- Deleted records do not appear in totals
- Edited records are reflected in analytics
- Reloading does not duplicate records

## Edge Cases

Test:

- ₹0 input if the UI permits it
- Very large amount
- Decimal amount
- Long note
- Empty note
- No expenses
- One expense
- Many expenses
- Same-day multiple expenses
- Month boundary
- Week boundary
- Budget exactly reached
- Budget exceeded

## Testing Principles

Prefer stable selectors.

Use accessibility labels, test IDs, or semantic roles rather than brittle CSS/XPath selectors.

Avoid tests that depend on animation timing.

Wait for meaningful UI state changes.

Do not add arbitrary long sleeps.

## Test Isolation

Each test should have predictable data.

Use a clean database or deterministic fixture strategy where practical.

Do not make tests depend on the order in which previous tests happened to run.

## Failure Reporting

When a test fails, report:

- Test name
- Screen
- Action that failed
- Expected result
- Actual result
- Likely cause
- Minimal recommended fix

## Quality Gate

Before declaring the app ready:

- Core CRUD flow passes
- Dashboard totals are correct
- Weekly calculations are correct
- Monthly calculations are correct
- Budget calculations are correct
- Data persists across restart
- Offline core flow works
- Important edge cases are covered
- Tests are deterministic
