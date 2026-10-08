# Product Specification

## Product Name

Working name: **Expense Tracker**

A polished private expense tracker for personal daily spending.

## Problem

Recording small expenses is often inconvenient. A useful tracker should let the user record an expense in seconds and immediately understand current spending.

## Target User

A single personal user who wants to:

- Record daily expenses
- See recent spending
- Track weekly spending
- Track monthly spending
- Understand category distribution
- Set a simple monthly budget
- Keep all financial data locally on the phone

## Core User Loop

Open app
→ tap Add Expense
→ enter amount
→ choose category
→ optionally add note
→ save
→ immediately see updated totals

## MVP Features

### Expense Management

- Add expense
- Edit expense
- Delete expense
- Expense date
- Amount
- Category
- Optional note
- Expense history
- Category filtering

### Dashboard

Show:

- Today's spending
- Current week's spending
- Current month's spending
- Monthly budget progress
- Remaining budget
- Recent expenses

### Analytics

Show:

- Daily spending
- Weekly spending
- Monthly spending
- Category breakdown
- Daily average
- Highest spending day
- Highest spending category
- Previous-month comparison

### Budget

- Set monthly budget
- Display amount spent
- Display amount remaining
- Display budget percentage
- Indicate when budget is exceeded

### Data

- Local SQLite persistence
- Offline operation
- Export/backup planned
- Import/restore planned

## Categories

Initial categories:

- Food
- Transport
- Shopping
- Bills
- Entertainment
- Health
- Education
- Groceries
- Other

The category list should remain easy to modify.

From the Add Expense category picker the user can create their own categories:
a name plus an icon chosen from a searchable picker. Created categories behave
like the builtins everywhere — the picker, the history list and the dashboard
breakdown — and are stored per device in the `categories` table
(docs/data-model.md).

## Currency

Initial currency: INR (₹).

The architecture should avoid hard-coding currency formatting throughout the UI.

## UX Principle

Adding an expense should require as few actions as practical.

The dashboard should answer three questions immediately:

1. How much did I spend today?
2. How much have I spent this week?
3. How much have I spent this month?

## Privacy

No expense data should leave the device in the MVP.

The app must remain useful with network access disabled.
