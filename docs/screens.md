# Screen Specification

## 1. Home

Purpose: give an immediate financial overview.

Content:

- Greeting/header
- Current month total
- Today's total
- Weekly total
- Budget progress
- Recent expenses
- Add Expense action

Primary question answered:

> How much am I spending?

## 2. Add Expense

Purpose: record an expense quickly.

Fields:

- Amount
- Category
- Note
- Date

Actions:

- Save
- Cancel/back

UX requirement:

The amount input should receive focus quickly and the save action should be obvious.

## 3. Expenses

Purpose: browse all transactions.

Features:

- Date grouping
- Expense rows
- Category indicator
- Amount
- Search/filter
- Edit
- Delete

Use FlatList for scalability.

## 4. Analytics

Purpose: understand spending patterns.

Sections:

- Current period total
- Daily spending chart
- Category breakdown
- Average daily spending
- Highest spending day
- Previous-month comparison

Weekly and monthly views should be easy to switch.

## 5. Budget

Purpose: control monthly spending.

Show:

- Monthly budget
- Spent
- Remaining
- Progress
- Optional category budgets later

The budget screen should clearly communicate when spending exceeds the limit.

## 6. Settings

Purpose: configure the personal app.

Initial options:

- Currency
- Appearance
- Monthly budget
- Export data
- Import/restore
- About

## Empty States

The first-use experience should be intentional.

Example:

```text
No expenses yet

Start tracking your spending by
adding your first expense.

[ Add Expense ]
```

Do not show an empty chart with no explanation.
