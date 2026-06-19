# Follow-up: `typecheck:cosmetic` is broken and not enforced in CI

**Status:** ✅ RESOLVED — both errors fixed + enforced in CI
**Owner:** Daniel Diaz
**Raised during:** pre-flight checks for the PR #1996 nav-link fix, 2026-06-15

## Resolution

- **Fix A** (`+types` for shadowed product route): `generate-vertical-tsconfig.mjs`
  now excludes *all* `.test.` siblings of a shadowed route (not just
  `<route>.test.tsx`), catching the compound `_app.product.$productId.loader.test.ts`
  that imported the canonical route back into the program. Tightened so a sibling
  that is its own route module (e.g. `_app.account.orders.test.tsx`) is not
  wrongly excluded.
- **Fix B** (`t('hero.body')` — vertical-added key invisible to `t()` types):
  `src/locales/deep-merge.ts` `deepMerge` now returns a `DeepMerge<Base, Over>`
  type that includes override-only keys (with literal leaves widened to their
  base primitive), so vertical-added translation keys are visible to the
  type-safe `t()` augmentation, not just present at runtime.
- **Enforcement**: the **Template Cosmetic Vertical** CI job
  (`.github/workflows/template-mirror.yml`) now runs
  `pnpm --filter @salesforce/template typecheck:cosmetic`.

`pnpm typecheck:all` exits 0 (fashion + cosmetic). Docs updated:
authoring-rules §5, ci-diagnostics (source-vs-mirror typecheck), sync-from-main
(scan for new canonical tests of shadowed routes).

---

_Original report below._

**Raised during:** pre-flight checks for the PR #1996 nav-link fix, 2026-06-15

## Problem

`pnpm --filter @salesforce/template typecheck:cosmetic` fails with **2 errors**, both
pre-existing on `option-a-real-rewrite` (the PR base) — NOT introduced by PR #1996:

```
src/routes/_app.product.$productId.tsx(19,28): error TS2307:
    Cannot find module './+types/_app.product.$productId'

src/verticals/cosmetic/routes/_app.about-us.tsx(412,24): error TS2345:
    Argument of type '["hero.body"]' is not assignable to parameter ... (t() key)
```

**CI does not catch these.** The "Template Cosmetic Vertical" job
(`.github/workflows/template-mirror.yml`) runs `test` + `build` + `bundlesize` only —
**no `tsc`**. `build` (react-router/vite) transpiles via esbuild without type-checking, so
broken cosmetic types ship invisibly. (`typecheck:fashion` IS run and is clean.)

## Root causes (two distinct)

### A. `_app.product.$productId.tsx` — missing `+types` for the shadowed route

`react-router typegen` under `VERTICAL=cosmetic` only generates `+types/` for the cosmetic
overlay's product route, so the **canonical** `src/routes/_app.product.$productId.tsx`
(pulled into the cosmetic tsconfig transitively) can't resolve its `./+types/...` import.
The flattened mirror doesn't hit this (override physically replaces canonical → one route).
Long-standing; tracked separately before this session.

### B. `t('hero.body')` — cosmetic key absent from the canonical type augmentation

The `aboutUs` route calls `t('hero.body')`. The `t()` types come from
`resources['en-GB']` (`src/middlewares/i18next.server.ts:38`), i.e. the **canonical**
`en-GB` translations — where `aboutUs.hero` is `{}` (empty). The cosmetic vertical adds
`hero.body` only at **runtime** via its `locales/en-*/overrides.ts` deepMerge; the type
augmentation never sees it, so `t('hero.body')` is type-invalid even though the string
resolves correctly at runtime. (Came in via option-a commit W-22844119 "About Us hero
body".)

This is the general "cosmetic-added keys aren't in the canonical `t()` type" gap — any key
a vertical adds via overrides but isn't in canonical en-GB will type-error.

## Proposed fixes

1. **Enforce cosmetic typecheck in CI** — add `pnpm typecheck:cosmetic` (or
   `typecheck:all`) to the "Template Cosmetic Vertical" job so these can't ship invisibly
   again. Do this *after* fixing A and B (else it red-flags immediately).
2. **Fix A** — make `react-router typegen` emit `+types` for canonical routes the cosmetic
   overlay shadows, or adjust `tsconfig.cosmetic.json` generation so the canonical product
   route's `+types` resolves. (See the earlier cosmetic-typecheck note / GUS item.)
3. **Fix B** — give the `t()` augmentation a type source that includes vertical-added keys.
   Options: type `resources` against the cosmetic-merged locale when `VERTICAL=cosmetic`,
   or add the cosmetic-introduced `aboutUs.hero.*` keys to canonical en-GB as
   typed-but-overridden defaults. (The cleaner long-term answer is per-vertical resource
   typing.)

## Scope

- Pre-existing on the PR base; **not** caused by PR #1996 (verified: both lines live on
  `option-a-real-rewrite`, unchanged by this PR).
- CI-invisible today, so no merge block — but a real latent quality gap.

## Acceptance

- [ ] `pnpm typecheck:cosmetic` exits 0.
- [ ] CI runs cosmetic typecheck (so regressions are caught).
- [ ] `fashion` typecheck still clean.
