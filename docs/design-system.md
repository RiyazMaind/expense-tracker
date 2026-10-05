# Design System

## Visual Direction

Dark premium glassmorphism.

The interface should feel:

- calm
- modern
- premium
- focused
- lightweight
- financial rather than flashy

## Visual Hierarchy

```text
Atmospheric background
        ↓
Ambient lighting
        ↓
Glass surfaces
        ↓
Primary controls
        ↓
Typography
        ↓
Micro-interactions
```

## Background

Use a deep neutral background.

Suggested starting direction:

```text
#080B12
```

Use restrained blurred gradient lights.

Avoid decorative noise that competes with financial information.

## Glass

Conceptual tokens:

```text
glass-subtle: rgba(255,255,255,0.04)
glass-default: rgba(255,255,255,0.06)
glass-strong: rgba(255,255,255,0.09)

border-subtle: rgba(255,255,255,0.08)
border-default: rgba(255,255,255,0.10)
border-strong: rgba(255,255,255,0.15)
```

These are starting values. The rendered result is the final authority.

## Accent Colors

Possible accents:

- Purple
- Blue
- Emerald
- Cyan

Semantic colors:

- Positive: green/emerald
- Warning: amber
- Destructive: red
- Primary: project accent

Use color sparingly.

## Typography

Large amounts are the most important numbers on the screen.

Prioritize:

- clear amount hierarchy
- readable labels
- strong section headings
- comfortable line height
- high contrast

## Cards

Cards should communicate meaningful grouping.

Do not create cards simply to fill space.

## Buttons

Primary actions should be more visually solid than background glass.

The Add Expense action must be immediately recognizable.

## Navigation

Use a floating or elevated glass bottom navigation if it remains comfortable on the target devices.

## Motion

Use subtle motion for:

- transitions
- adding expense
- updating totals
- progress changes
- modal presentation

Avoid decorative continuous animation.

## Mobile Accessibility

Maintain:

- adequate touch targets
- readable contrast
- clear selected states
- predictable focus behavior
- usable keyboard interactions

## Design Rule

Glassmorphism is a visual language, not a requirement that every component be transparent.
