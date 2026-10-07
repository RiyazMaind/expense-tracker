# Screen Specification

## 1. Home

Purpose: give an immediate financial overview.

Content:

- Greeting/header
- Current month total (the hero figure)
- Today's total
- Weekly total
- Daily average
- Highest spending day
- Daily spending trend
- Category breakdown
- Budget progress
- Month switcher: browses one month at a time, back through every past month
  that has expenses; the hero, tiles, trend, categories and budget all re-scope
  to the month shown. Past months read against their own last day, so their
  trend covers the whole month and their budget card states the outcome
  ("Month ended ₹X under budget") instead of the forecast.
- Recent expenses
- Add Expense action

The dashboard also carries what used to be a separate Analytics screen
(section 4), so the figures and the charts that describe them are read together
rather than on two screens.

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

Merged into Home (section 1); there is no separate analytics screen.

The dashboard shows the whole set: current period total, daily spending chart,
category breakdown, daily average and highest spending day. Keeping them on the
screen the user already opens means the totals and the trend they explain can
never disagree about which days a week contains.

The dashboard browses one month at a time — past months via the switcher under
the header. Side-by-side month comparison is not implemented.

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
