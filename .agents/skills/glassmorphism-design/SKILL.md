# Glassmorphism Design Skill

## Purpose

Define and enforce a polished, production-quality glassmorphism visual system for the Expense Tracker mobile app.

This is a React Native + Expo mobile application. Design decisions must prioritize native mobile usability first and glassmorphism second.

## Core Visual Direction

Create a premium dark glassmorphism interface that feels calm, modern, lightweight, and finance-focused.

The visual hierarchy should be:

1. Atmospheric background
2. Ambient light / gradient elements
3. Glass containers
4. High-contrast interactive controls
5. Typography and data
6. Subtle feedback and motion

Do not turn every element into glass.

## Glass Surface Rules

Use translucent surfaces with subtle borders and controlled blur.

Preferred characteristics:

- Low-opacity white or neutral surfaces
- Very subtle 1px borders
- Moderate blur where platform support allows it
- Soft shadows
- Rounded corners with consistent radii
- Enough contrast for text and controls
- Avoid excessive transparency

Example conceptual tokens:

- Glass 1: rgba(255,255,255,0.04)
- Glass 2: rgba(255,255,255,0.06)
- Glass 3: rgba(255,255,255,0.09)
- Border: rgba(255,255,255,0.10)
- Strong border: rgba(255,255,255,0.15)

These are starting points, not mandatory literal values.

## Background

Prefer a deep neutral background with restrained ambient gradients.

Use a small number of large, blurred light sources rather than many decorative blobs.

The background must never reduce readability of:

- Amounts
- Expense names
- Category labels
- Charts
- Buttons
- Navigation

## Color

Use neutral surfaces and a restrained accent palette.

Suggested accents:

- Purple
- Blue
- Emerald
- Soft cyan

Use semantic colors carefully:

- Green: positive / remaining budget
- Red: overspending / destructive action
- Amber: warning
- Accent: primary action

Avoid rainbow gradients and excessive neon.

## Typography

Financial numbers are important information.

Prioritize:

- Large readable amounts
- Strong hierarchy
- Clear category labels
- Comfortable line height
- Tabular or consistent numeral presentation where appropriate

Never sacrifice readability for visual style.

## Spacing

Use a consistent spacing scale.

Prefer generous spacing around:

- Main spending amount
- Section headings
- Cards
- Primary actions
- Bottom navigation

Avoid tightly packed cards.

## Components

Glass treatment is appropriate for:

- Dashboard cards
- Expense list containers
- Bottom navigation
- Modal surfaces
- Filters
- Analytics panels

Use more solid/high-contrast surfaces for:

- Primary CTA buttons
- Destructive actions
- Important numeric controls
- Keyboard-like number entry
- Selected states when needed

## Motion

Motion should be subtle and purposeful.

Use animation for:

- Card entrance
- Tab transitions
- Progress changes
- Expense creation feedback
- Modal presentation

Avoid constant floating or pulsing animations.

Respect reduced-motion preferences where supported.

## Mobile Rules

Always prioritize:

- Safe areas
- Touch targets
- One-handed use
- Keyboard behavior
- Scroll behavior
- Readability at common phone sizes
- Android back behavior
- Landscape edge cases where relevant

Interactive controls should have comfortable touch areas.

## Anti-Patterns

Do not:

- Put blur on everything
- Use glass purely for decoration
- Create low-contrast text
- Use excessive gradients
- Use tiny typography
- Create desktop layouts squeezed into phones
- Add unnecessary visual effects
- Introduce new dependencies just for decorative effects
- Replace working components merely for stylistic experimentation

## Implementation Rule

Before creating a new visual component, check existing project tokens and components.

Reuse the established design system.

If a design decision conflicts with usability, accessibility, or performance, choose usability, accessibility, and performance.

## Quality Gate

Before considering a screen complete, verify:

- Visual hierarchy is obvious
- Primary action is obvious
- Amounts are easy to scan
- Glass surfaces have enough contrast
- No element feels unnecessarily decorative
- Spacing is consistent
- Touch targets are comfortable
- Screen works on small and large phones
- The interface still looks good without blur support
