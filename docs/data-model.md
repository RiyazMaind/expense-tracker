# Data Model

## Expenses

SQLite table:

```text
expenses
---------
id
amount
category
note
date
created_at
updated_at
```

### Field Definitions

`id`
- Integer primary key

`amount`
- Numeric monetary amount
- Must be positive for a normal expense

`category`
- Category identifier

`note`
- Optional text

`date`
- Expense date
- Stored in a consistent format

`created_at`
- Creation timestamp

`updated_at`
- Last modification timestamp

## Budgets

```text
budgets
-------
id
month
amount
created_at
updated_at
```

`month` should represent a specific calendar month.

Example:

```text
2026-10
```

## Derived Metrics

### Today

Sum expenses where expense date equals today's local calendar date.

### Week

Use a clearly defined local week boundary.

The MVP should use Monday as the first day of the week unless product requirements change.

### Month

Sum expenses within the current calendar month.

### Daily Average

```text
total spending / number of elapsed days
```

The exact definition should be consistent across the app.

### Remaining Budget

```text
monthly budget - monthly spending
```

Can be negative when the budget is exceeded.

### Budget Percentage

```text
monthly spending / monthly budget * 100
```

Cap the visual progress indicator at 100%, while still displaying the actual percentage if over budget.

## Currency

Store monetary values safely and consistently.

Do not use floating-point arithmetic carelessly for financial calculations.

Prefer integer minor units if appropriate for the implementation, e.g. paise:

```text
₹250.50 → 25050
```

The UI converts stored values to INR display format.
