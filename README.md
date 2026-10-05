# Expense Tracker

An offline-first personal expense tracker for Android and iOS, built with Expo
and React Native. All data is stored locally in SQLite; the app requires no
account, backend, or network connection.

## Requirements

- Node.js and npm
- [Expo Go](https://expo.dev/go) or a development build

## Getting started

```bash
npm install
npx expo start
```

Then press `a` for Android, `i` for an iOS simulator, or scan the QR code with
Expo Go.

## Commands

| Command | Purpose |
| --- | --- |
| `npx expo start` | Start the Metro dev server |
| `npx expo start --android` / `--ios` / `--web` | Start on a specific platform |
| `npm run lint` | Run ESLint (`eslint-config-expo`) |
| `npx tsc --noEmit` | Type-check the project |
| `npx expo-doctor` | Diagnose dependency and config issues |

Web is a development and preview target only. Android and iOS are the primary
platforms.

## Project layout

```text
src/app/          Expo Router routes (every file here is a screen)
docs/             Product and technical documentation
assets/fonts/     Bundled fonts, embedded at build time via expo-font
```

Documentation lives in [`docs/`](./docs): start with
[`docs/README.md`](./docs/README.md).

## Current status

Phase 1 — project foundation. The design system, glass surfaces, and
navigation shell are not built yet.