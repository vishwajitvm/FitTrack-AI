# FitTrack AI — UI design system ("Aurora Glass")

Goal: a modern fitness app that feels alive — frosted glass over a soft aurora, real depth (3D tilt, a glowing
orb, buttons that press in) and smooth motion — while staying readable, fast and calm. Every page must work in
light and dark themes and at phone width.

## Principles

1. **Glass over aurora.** The app sits on a fixed, still aurora (`.aurora` in AppShell). Surfaces are frosted glass:
   `Card`/`StatCard` use `.glass` (translucent `bg-card` + blur + light top edge). Overlays (modals, menus, popovers,
   SweetAlert) use `.glass-strong`. `bg-card`, `bg-slate-50/100` and `border-line` are see-through by design.
   Keep the aurora still — animating behind blurred glass forces every card to re-blur each frame.
2. **Brand = violet; hero gradient = violet → fuchsia → rose** (`bg-hero`, `text-hero`, `bg-grad`). Primary buttons,
   active tabs, the active nav item and selected chips use `btn-3d` (gradient + 3D press). One `bg-hero` hero per page.
3. **One colour per metric** (`components/ui/accent.ts` → `ACCENT`): `kcal` orange (food eaten), `protein` fuchsia,
   `burn` rose (calories burned / exercise), `balance` emerald (deficit), `weight` sky, `sleep` indigo
   (sleep/recovery/mood), `water` cyan (water/steps). Same accent for the same metric everywhere.
4. **Depth and motion with restraint.** `useTilt()` (fx.tsx) tilts stat cards and hero tiles toward the pointer with a
   glare (mouse only); `EnergyOrb` for a single headline score; `.blob` drifting colour inside a hero only;
   `fade-up` entrances (stagger with `animationDelay`), `AnimatedNumber`, `MetricRing`, `.float`, `.shimmer`.
   Everything stops under `prefers-reduced-motion`. Don't put `fade-up` on an element that also tilts (the
   animation's fill keeps `transform: none`). `btn-3d` sets `transform` on hover — use `bg-grad` on elements that are
   positioned with translate classes.
5. **Clear hierarchy.** Page title 34px bold with a gradient dot (PageHeader). Card titles 15px semibold with a gradient
   or accent icon tile (CardHeader `icon`, `accent`). Labels 13px medium `text-slate-500`, sentence case. Big numbers
   `text-[30px] font-bold tracking-tight num`.
6. **Layout.** Floating glass sidebar (desktop) and floating glass dock (phone). Dashboard is a 12-column bento grid.
   Cards `rounded-3xl p-5`, gaps `gap-5`, controls `rounded-xl h-10`, touch targets ≥ 44px.
7. **Status = pill + word + dot** — never colour alone; never fill a whole card with red/amber/green.

## Tokens (globals.css, Tailwind)

| Use | Class |
|---|---|
| Page / card / border | `bg-slate-50` · `bg-card` · `border-line` |
| Text | `text-slate-900` (primary) · `text-slate-600` (body) · `text-slate-500` (secondary) · `text-slate-400` (hints) |
| Brand | `bg-navy text-white` (solid) · `bg-brand-50 text-brand-600` (tint) · `text-brand-600` (links) · `ring-brand-500` |
| Status | `bg-good-bg text-good-fg`, `bg-warn-bg text-warn-fg`, `bg-crit-bg text-crit-fg`, `bg-info-bg text-info-fg` (+ `-border`) |
| Metric accents | `ACCENT[a].text / .tint / .solid / .border` or `text-acc-protein`, `bg-acc-kcal/10` … |
| Hero / brand gradient | `bg-hero text-white` · `text-hero` · `bg-grad` · `btn-3d` |
| Glass | `glass` (cards, bars, sidebar) · `glass-strong` (overlays) |

Never hard-code hex colours or Tailwind palette colours like `bg-emerald-600`, `text-indigo-500`, `bg-red-50`
in components — use the tokens above so dark mode works. (Recharts colours come from `useChartTheme()`.)

## Building blocks (use these, don't re-invent)

- `ui/card.tsx` — `Card` (`interactive` for clickable), `CardHeader` (title, description, `icon`, `action`, `info`),
  `CardBody`, `CardFooter`.
- Collapsing: every `Card` with a `CardHeader` child gets a chevron (title area toggles too), remembered per page in
  localStorage. Custom-header cards pass `collapsible="id"` and use `CollapseButton` + `CollapseBody` from
  `ui/collapse.tsx`; groups of cards use `common/collapsible-section.tsx`. `PageHeader` shows Collapse all / Expand all.
  `collapsible={false}` opts out.
- `common/stat-card.tsx` — `StatCard` (label, value, unit, sub, icon, `accent`, `spark`, `tone` + `status`).
- `ui/fx.tsx` — `ACCENT`, `AnimatedNumber`, `MetricRing`, `Sparkline`, `IconBubble`, `MiniBar`, `useTilt`, `EnergyOrb`.
- `layout/brand-mark.tsx` — the logo (same art as `app/icon.svg`, the favicon).
- `ui/button.tsx` (`primary` = brand, `outline`, `secondary`, `ghost`, `danger`, `success`; sizes `sm|md|lg|icon`),
  `ui/badge.tsx`, `ui/input.tsx` (`Input`, `Select`, `Textarea`), `ui/field.tsx` (`Field` label+hint),
  `ui/misc.tsx` (`Tabs`, `Segmented`, `Switch`, `Progress`, `Skeleton`), `ui/table.tsx`, `ui/modal.tsx`,
  `ui/info-tip.tsx` ("?" glossary tips), `common/page-header.tsx`, `common/states.tsx` (`EmptyState`,
  `ErrorState`, skeletons), `common/alert-list.tsx`, `common/pagination.tsx`.

## Page anatomy

```
PageHeader (title, Simple-mode intro, actions on the right)
[optional] one hero/summary block — the single most important thing on the page
Stat row — 2 cols on phone, 4 on desktop (StatCard with accent + spark where history exists)
Main content — Cards with CardHeader (icon bubble + title + short description), lists/tables inside
Secondary details — collapsed (ShowDetails) or lower on the page
```

- Lists of items (meals, exercises, reports, providers): rows inside a Card, `divide-y divide-line`, each row
  `flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/80`, leading `IconBubble`, trailing actions (ghost/icon
  buttons) — not a stack of separately bordered boxes.
- Tables on desktop, cards under `md` (`hidden md:block` / `md:hidden`).
- Forms: `Field` per control, grid `sm:grid-cols-2 gap-4`, primary action bottom-right of the card (CardFooter).
- Empty states: `EmptyState` with an icon, one sentence and the one action that fixes it.
- Charts: inside a Card, 220–280px tall, gridlines faint, tooltip from `useChartTheme()`, series colours = metric accents.

## Don'ts

- No whole-card red/amber/green backgrounds for status; no rainbow of bordered boxes.
- No new npm dependencies; no inline hex colours; no `uppercase tracking-wide` on every label.
- Don't change behaviour, data flow or API calls when restyling. Keep Simple/Detailed mode (`usePrefs()`),
  glossary InfoTips, SweetAlert2 confirmations and sonner toasts as they are.
