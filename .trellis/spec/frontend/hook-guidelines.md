# Hook Guidelines

> How hooks are used in this project.

---

## Overview

Hooks are the boundary between **data access** (react/vue-query wrappers) and
**business UI** (page / column definitions / form drawers). They exist to
keep the query layer thin and the UI layer declarative — when a hook is well
shaped, the page should not need to know about fallback, query keys, or
parsing internals.

---

## Custom Hook Patterns

### `useXxxQuery` — thin query wrapper

Wraps `useQuery` / `useVueQuery` for a single resource. Responsible only for:

- Merging query parameters (e.g. injecting `platform` from env).
- Building a stable `queryKey` from the merged params.
- Forwarding react/vue-query `options` to the caller.

**Must NOT** do:

- Build lookup maps / valueEnums / fallback chains.
- Apply platform-aware row selection.
- Hold any constant that callers might want to override (use a parameter).

Example: `useListDictData(query, options?)` — passes through the query.

### `useXxxLookups` — domain helpers for display

Built **on top of** `useXxxQuery`. Returns small helper functions and pre-built
valueEnums so the page never needs to write `?? '兜底文案'` or maintain its own
maps. See **Data Query / Display Hook Fallback Principle** below.

---

## Data Fetching

- React: `@tanstack/react-query` (`useQuery` / `useMutation`).
- Vue: `@tanstack/vue-query` (`useQuery` / `useMutation`).
- Query layer is intentionally dumb; presentation concerns belong in a
  dedicated `useXxxLookups` hook layered above it.

---

## Naming Conventions

- `useXxxQuery` (preferred) / `useXxx` / `useListXxx` — query wrappers.
- `useXxxLookups` / `useXxxDisplay` — presentation helpers.
- `fetchXxx` / `useFetchXxx` — non-reactive fetch utilities.

---

## Common Mistakes

### ❌ Spreading fallback constants across pages

The single most common anti-pattern: each page re-implements fallback label
strings, color maps, and platform-preferred selection logic. When the dict
seed data or design system changes, every page must be updated in lockstep.

### ❌ Mixing query concerns with display concerns

A `useXxxQuery` hook that also builds valueEnums, formats dates, or applies
fallback chains is doing too much. Split display logic into a separate
`useXxxLookups` hook.

### ❌ Hand-rolling `Map.set` overwrite as a "platform selector"

Relying on `Map.set` returning the latest value to pick the "current platform"
row is fragile — it depends on the upstream API returning rows in a specific
order. Use an explicit priority selector (`find(platform === current) ??
find(tagType) ?? first`) and document it.

---

## Data Query / Display Hook Fallback Principle

> When a hook returns **display-facing data** (labels, tag types, valueEnums),
> it **must** carry its own fallback. The application layer **must not** hold
> fallback constants or write `?? '兜底文案'` / `n === 1 ? 'X' : 'Y'` ternaries.

### Why

- Every page that consumes the same dict re-implements the same fallback
  chain. Drift is inevitable: one page fixes a typo, the other doesn't.
- Visual regressions hide in plain sight: missing the fallback makes a column
  silently render `undefined` until the dict loads.
- Changing the contract (e.g. adding a third state) requires editing N files
  instead of 1.

### Contract

A `useXxxLookups` hook exposes:

- **Label helpers** that always return a non-empty string:
  `lookupSwitchLabel(n)` → `dict.label ?? '启用' / '禁用'`.
- **Tag-type helpers** that return the dict's tagType or a framework-neutral
  fallback: `lookupSwitchTagType(n)` → `dict.tagType ?? 'success' / 'default'`.
- **Pre-built valueEnums** ready for `ProTable.valueEnum` / `vxe-grid
  column.valueEnum`: `switchValueEnum`, `platformValueEnum`.
- **Optional fallback labels** as a parameter: e.g. `platformLabels?: Record<string, string>`
  — used when the dict is empty so the dropdown still shows friendly text.
- A **platform-preferred row selector** inside the hook (do not push this
  to the caller).

### Correct usage

```ts
// Page consumes the hook — no fallback constants in scope:
const dictLookups = useDictLookups({
  typeCodes: ['sys_switch_status', 'sys_platform'],
  includeGeneral: true,
  platformLabels: SEARCH_PLATFORM_OPTIONS.reduce(...),
});

// Status column: hook gives label + tagType, page just renders.
<Tag color={dictLookups.lookupSwitchTagType(r.isEnabled) !== 'default'
  ? dictLookups.lookupSwitchTagType(r.isEnabled) : undefined}>
  {dictLookups.lookupSwitchLabel(r.isEnabled)}
</Tag>
```

```vue
<!-- Vue: same shape, framework-specific whitelist filter applied at template -->
<NTag :type="lookupSwitchTagTypeN(row.isEnabled as 0 | 1)" size="small">
  {{ dictLookups.lookupSwitchLabel(row.isEnabled as 0 | 1) }}
</NTag>
```

### Anti-patterns to avoid

```ts
// ❌ Page owns fallback constants
const SWITCH_FALLBACK = { 1: '启用', 0: '禁用' };
const tagType = hit?.tagType;
return <Tag color={tagType !== 'default' ? tagType : undefined}>{label}</Tag>;

// ❌ Inline ternaries in render
const label = isEnabled === 1 ? '启用' : '禁用';

// ❌ Page-level valueEnum construction with manual fallback
const statusValueEnum = {
  1: { text: hit?.label ?? '启用' },
  0: { text: hit?.label ?? '禁用' },
};
```

### When you need a new fallback

1. Open the hook file (`useXxxLookups`).
2. Add the fallback constant near other fallbacks for the same domain.
3. Update the helper(s) to use it.
4. Run `trellis-check` — pages that consume the hook pick up the change for
   free.

If the new fallback requires framework-specific filtering (e.g. Naive UI NTag
type whitelist), wrap the hook helper in a thin page-level adapter rather
than reintroducing whitelist logic inside the hook (keeps the hook
framework-neutral).