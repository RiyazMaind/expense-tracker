# Mobile UI Review Skill

## Purpose

Act as a visual QA and mobile UX specialist for the Expense Tracker React Native + Expo application.

Do not judge the interface only from source code.

When possible, inspect the actual rendered application and improve the implementation based on what is visibly wrong.

## Core Workflow

For each review:

1. Run the application.
2. Open the target screen on a realistic mobile viewport/device.
3. Inspect the actual rendered result.
4. Navigate through relevant interactions.
5. Identify visual and UX problems.
6. Rank issues by severity.
7. Fix the highest-value issues.
8. Re-run the app.
9. Inspect again.
10. Stop only when the screen meets the quality bar.

Do not make speculative changes when the current implementation is already correct.

## Review Areas

### Layout

Check:

- Safe-area handling
- Screen padding
- Card alignment
- Section spacing
- Bottom navigation clearance
- Keyboard overlap
- Content clipping
- Horizontal overflow
- Vertical scrolling
- Dynamic content height

### Typography

Check:

- Font size
- Weight hierarchy
- Line height
- Contrast
- Number readability
- Truncation
- Wrapping
- Alignment

Expense amounts should be extremely easy to scan.

### Touch UX

Check:

- Touch target size
- Button spacing
- Accidental tap risk
- Input focus
- Keyboard dismissal
- Primary action discoverability
- Back navigation

### Glassmorphism

Check:

- Glass surfaces remain distinguishable
- Background does not interfere with content
- Blur is not excessive
- Borders are subtle
- Shadows are controlled
- Important controls have enough contrast
- No unnecessary glass layers

### States

Review:

- Empty state
- Loading state
- Error state
- Success state
- No expenses state
- Budget exceeded state
- Long expense names
- Large expense amounts
- Large expense lists

### Data Visualization

For charts and summaries check:

- Labels are readable
- Values are understandable
- Categories are distinguishable
- No chart is decorative without communicating information
- Small screens remain usable

## Mobile-Specific Checks

Test or reason about:

- Small phones
- Large phones
- Android status bar
- Android navigation area
- iOS safe areas
- Keyboard open
- Keyboard closed
- Dark mode
- Different text lengths
- Large numbers

## Functional UX Checks

A visual review must also verify important user flows.

For example:

### Add Expense

Open Add Expense
→ enter amount
→ choose category
→ optionally add note
→ save
→ confirm success
→ confirm expense appears in history
→ confirm dashboard totals update

### Edit Expense

Open expense
→ edit
→ save
→ confirm list and totals update

### Delete Expense

Delete
→ confirm if destructive confirmation is required
→ confirm list and totals update

## Severity

Use:

- P0: broken / unusable
- P1: major UX or layout issue
- P2: noticeable polish issue
- P3: minor refinement

Fix P0 and P1 before P2/P3.

## Change Discipline

Do not redesign the application during every review.

Preserve:

- Existing architecture
- Existing components
- Existing design tokens
- Existing behavior

Make the smallest change that produces a meaningful improvement.

Do not add dependencies unless genuinely necessary.

## Final Quality Bar

A screen is complete when:

- It feels intentionally designed for mobile
- Primary information is immediately understandable
- Touch interactions feel natural
- No clipping or overflow exists
- Safe areas are correct
- Glass effects support rather than obscure the content
- Empty and edge states are handled
- The interface is visually consistent with the rest of the app
