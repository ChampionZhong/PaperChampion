# PaperChampion Design System — Editorial Lab

> Tokens, components, motion, and copy rules for everyone working on the
> frontend. Source of truth lives in `src/index.css` (`@theme {}` block) and
> `src/lib/tokens.ts` (TypeScript surface).

## Philosophy

**Premium without decoration.** The palette is warm off-white + deep
indigo + per-module accents. Color is *information*, not ornament — it
identifies a module, surfaces state, or marks a focus ring. If a color
is purely decorative, remove it.

Three rules govern every screen:

1. **Hairline borders over shadows.** Cards default to `1 px` solid
   `border-border`. Shadows are reserved for hover-lift, modals, and
   floating popovers.
2. **Two text families, no more.** `IBM Plex Sans` for UI. `IBM Plex
   Serif` (via `.font-display`) for hero headlines, paper titles, and
   magazine spreads. `IBM Plex Mono` for arxiv IDs, durations, and tabular
   numerals only.
3. **Color budget = 3.** Each screen displays at most three visible
   accents: brand indigo + the active module accent + at most one
   semantic state color (success / warning / error).

## Tokens

### Colors

```
Brand           --color-primary           #4F46E5  (indigo-600)
Brand hover     --color-primary-hover     #4338CA  (indigo-700)
Brand soft bg   --color-primary-light     #EEF0FE
Brand strong    --color-primary-strong    #3730A3  (indigo-800)

Surface         --color-page              #F8F6F1  (warm off-white)
Card / modal    --color-surface           #FFFFFF
Sidebar bg      --color-sidebar           #F4F1EA
Border          --color-border            #E5DFD3
Border strong   --color-border-strong     #CFC7B7  (hover state, rare)

Ink             --color-ink               #1A1816  (body text)
Ink secondary   --color-ink-secondary     #5C534A  (secondary copy)
Ink tertiary    --color-ink-tertiary      #A09587  (placeholder, captions)

Semantic state  --color-success / warning / error / info
                each with a -light soft variant
```

### Module accents

Used only as a 4–8 px `<Dot module="…">` + active-tab underline + page
header mark. Never as a card background tint.

| Module     | Light    | Dark     | Used by                  |
|------------|----------|----------|--------------------------|
| agent      | `#4F46E5`| `#818CF8`| `/` (chat landing)       |
| collect    | `#0D9488`| `#2DD4BF`| `/collect` (arXiv intake)|
| papers     | `#7C3AED`| `#A78BFA`| `/papers`, `/papers/:id` |
| brief      | `#0284C7`| `#38BDF8`| `/brief` (daily brief)   |
| graph      | `#D97706`| `#FBBF24`| `/graph` (citation)      |
| wiki       | `#059669`| `#34D399`| `/wiki` (knowledge base) |
| writing    | `#E11D48`| `#FB7185`| `/writing` (editor)      |
| dashboard  | `#475569`| `#94A3B8`| `/dashboard` (overview)  |

`moduleForPath()` in `lib/tokens.ts` resolves a pathname to its module.

### Typography scale

```
--text-display    36/40 px  Plex Serif    Hero, landing, magazine
--text-h1         28/32 px  Plex Serif    Page titles
--text-h2         22/28 px  Plex Sans     Section titles
--text-h3         17/24 px  Plex Sans     Card titles
--text-body       14/22 px  Plex Sans     Body copy
--text-sm         13/20 px  Plex Sans     Secondary copy
--text-xs         12/16 px  Plex Sans     Captions, metadata
--text-mono       13/20 px  Plex Mono     IDs, tabular numbers
```

Apply `font-display` class for serif moments. Default is sans.

### Spacing / radius / motion

- Spacing: 4 px grid (`gap-1` = 4, `gap-3` = 12, `p-5` = 20, etc.).
- Radius: `sm` 6 / `md` 10 / `lg` 14 / `xl` 20 / `2xl` 28 / `pill` 9999.
- Ease: `--ease-standard` for most transitions; `--ease-emphasized` for
  modal entrances.
- Duration: `--duration-fast` 150 ms for hover, `--duration-normal` 220
  ms for layout shifts, `--duration-slow` 360 ms for emphasis.

### Elevation

Use sparingly. `shadow-xs` for button rest, `shadow-sm` for hover-lift
cards, `shadow-md` for popovers, `shadow-lg` for modals only.

## Components

`src/components/ui/` is the only place to import UI primitives.

```ts
import {
  Avatar, Badge, Button, Card, CardHeader,
  Divider, Dot, Empty, IconButton, Input,
  Kbd, Modal, Spinner, Tabs, Textarea, Tooltip,
} from "@/components/ui";
```

App-shell components live one level up:

```ts
import { PageHeader } from "@/components/PageHeader";
import { UserMenu } from "@/components/UserMenu";
import Sidebar from "@/components/Sidebar";
```

### Button variants

| Variant       | Use                                |
|---------------|------------------------------------|
| `primary`     | Confirm action, CTA                |
| `secondary`   | Neutral action, surface-on-page    |
| `ghost`       | Toolbar / menu / icon-only         |
| `outline`     | Opt-in cards, sparing              |
| `destructive` | Deletion / sign-out confirms only  |

Sizes: `sm` (h-8) / `md` (h-9) / `lg` (h-11). Always pass `iconLeft`
or `iconRight` for adornments — never `icon` (legacy alias, removed).

### Tabs

Two variants:

- `pill` (default) — segmented control, sits on tinted background.
- `underline` — flat row with bottom-line on active. Use for
  primary in-page navigation (Settings, PaperDetail, GraphExplorer).

### Dot

`<Dot module="papers" size={6} />` for module dots in nav and headers.
Tailwind-safe by an explicit `module → bg-mod-*` lookup table — dynamic
template literals would not be detected by the compiler.

## Page-level patterns

### Page header

Non-Agent routes use a hairline page header with a module dot:

```tsx
<div className="flex items-center gap-2.5 border-b border-border pb-5">
  <Dot module="papers" size={6} />
  <h1 className="font-display text-[22px] font-semibold tracking-tight text-ink">
    论文库
  </h1>
</div>
```

Or use the `<PageHeader>` component for sticky page chrome.

### Empty state

`<Empty title="…" description="…" action={<Button />} />`. Title is
required — no Chinese fallback. Description is optional and should be a
single sentence; do not stack tips.

### Loading

Prefer skeletons (`<StatCardSkeleton />`, `<PaperListSkeleton />`) over
spinners. Use `<Spinner mode="inline" size="sm" />` for inline cases.

### Confirm dialogs

Use `ConfirmDialog` with `variant="danger"` for deletions. Body text
should answer the question "what happens if I confirm?" — not restate
the title.

## Copy budget

Aggressive (~50 % cut against pre-Editorial copy). Rules:

| Pattern                            | Action                                  |
|------------------------------------|------------------------------------------|
| Section labels (`实验室`, `对话历史`) | Drop — icons + position convey grouping  |
| Tooltips on universal icons (⚙, +) | Drop                                     |
| Status text + color + icon         | Pick one — default icon + hover tooltip  |
| Multi-sentence empty states        | One sentence + one CTA                   |
| Toast + success badge co-present   | Keep one verb form                       |
| Version string always visible      | Tuck inside user menu                    |
| `已添加` + `添加成功` toast pair      | Use one form only                        |

## App shell

`Layout` wraps every route with:

```
<SidebarProvider>
  <ConversationProvider>
    <AgentSessionProvider>
      <GlobalTaskProvider>
        <Sidebar />
        <main>{children}</main>
      </GlobalTaskProvider>
    </AgentSessionProvider>
  </ConversationProvider>
</SidebarProvider>
```

Sidebar collapses 260 px ↔ 64 px via `useSidebar().toggleCollapsed()`
(persisted to `localStorage`) or `⌘B` / `Ctrl+B`. Skip the shortcut
when the active element is an input or textarea.

## Dark mode

Every token has a dark override in `html.dark { … }`. Module accents
brighten one shade for the deeper background. There is no separate dark
component — just toggle the `dark` class on `<html>`.

`useTheme()` exposes `{ dark, toggle, setDark }` and persists to
`localStorage["theme"]`.

## When you add a new page

1. Add the route in `App.tsx` (lazy-load it).
2. If the route has a module identity, register it in
   `lib/tokens.ts` (`routeToModule`).
3. Start with `<PageHeader title="…" />` (or the inline pattern above).
4. Use existing primitives from `@/components/ui`.
5. Never introduce a new color value — extend `@theme {}` instead.

## Deprecated / pending

- `.brief-content` inline styles for backend-rendered HTML still ship
  with the daily brief route. Refactor next.
- `SettingsDialog` (1.5 k lines) still uses ad-hoc internal forms; the
  tab bar has been upgraded but the panels have not.
- `GlobalTaskBar` exists but is not mounted; the running-task indicator
  lives in Sidebar instead.
