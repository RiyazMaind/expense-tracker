/**
 * Teach Node's test runner about the `@/` path alias.
 *
 * Metro resolves `@/*` from `tsconfig.json`, but `node --test` reads no
 * tsconfig at all — it would fail on the first
 * `import { addDays } from '@/utils/dates'` with `ERR_MODULE_NOT_FOUND`.
 *
 * `module.registerHooks` runs in-thread, so unlike the older async `register()`
 * loader this needs no second process and no source map plumbing. It also
 * deliberately does not transpile: Node strips types natively, so the tests run
 * the same code that ships rather than a compiled approximation of it.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SOURCE_ROOT = fileURLToPath(new URL('../src', import.meta.url));

/** Mirrors Metro's resolution order for extensionless TypeScript imports. */
const CANDIDATES = ['.ts', '.tsx', '/index.ts', '/index.tsx'];

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith('@/')) {
      return nextResolve(specifier, context);
    }

    const base = join(SOURCE_ROOT, specifier.slice(2));

    for (const candidate of CANDIDATES) {
      const resolved = `${base}${candidate}`;
      if (existsSync(resolved)) {
        return nextResolve(pathToFileURL(resolved).href, context);
      }
    }

    return nextResolve(specifier, context);
  },
});