# GCS Support Tool styling standard (v2.10)

## Purpose and source of truth

Version 2.10 uses one shared visual language across the application. The polished `/about` page is the visual reference: quiet teal accents, layered neutral surfaces, restrained borders and shadows, clear type hierarchy, and generous but practical spacing.

The implementation sources of truth are:

- `public/stylesheets/design-system.css` for tokens, the application shell, shared components, responsive behavior, and legacy normalization;
- `public/javascripts/theme.js` for selecting, applying, and persisting the color mode; and
- `views/layout.pug` for stylesheet order and the shared navigation, notices, schedule, main-content, and footer structure.

Dark mode is the default and primary design target. Light mode is a fully supported alternative, not a page-specific variation. Every new or updated page must remain readable and functional in both modes.

## Design principles

- Use semantic `--gcs-*` tokens. Do not encode a theme with literal dark or light colors in page CSS.
- Keep the interface calm and information-first. Accent color should guide attention, not cover every surface.
- Create hierarchy through typography, spacing, borders, and surface elevation before adding decoration.
- Reuse the shared shell and components. Page styles should describe only what is unique to that page.
- Preserve meaning in every mode. Success, warning, danger, and informational states must not become generic accent colors.
- Design at small and large widths, for keyboard use, and with reduced motion enabled.

## Shared tokens

Tokens are declared in `design-system.css`. `:root` and `html[data-color-mode='dark']` contain the dark/default values. `html[data-color-mode='light']` overrides the theme-dependent values.

Do not copy these values into page styles. Consume the token by name, for example `background: var(--gcs-surface)` and `border-color: var(--gcs-border)`. The values below document the v2.10 contract.

### Canvas and surfaces

| Token | Dark/default | Light |
| --- | --- | --- |
| `--gcs-bg` | `#10171d` | `#f3f7f8` |
| `--gcs-bg-deep` | `#0b1116` | `#e8eff1` |
| `--gcs-bg-subtle` | `#131d24` | `#edf3f4` |
| `--gcs-surface` | `#182128` | `#ffffff` |
| `--gcs-surface-elevated` | `#1e2a32` | `#ffffff` |
| `--gcs-surface-muted` | `#202e37` | `#edf3f4` |
| `--gcs-surface-hover` | `#263640` | `#e5eef0` |
| `--gcs-overlay` | `rgba(4, 10, 14, 0.76)` | `rgba(18, 39, 47, 0.52)` |
| `--gcs-input` | `#141d23` | `#ffffff` |
| `--gcs-input-disabled` | `#1c272e` | `#edf2f3` |
| `--gcs-nav` | `rgba(16, 25, 32, 0.96)` | `rgba(255, 255, 255, 0.96)` |
| `--gcs-nav-hover` | `rgba(88, 194, 192, 0.1)` | `rgba(37, 111, 118, 0.08)` |
| `--gcs-stripe` | `rgba(255, 255, 255, 0.025)` | `rgba(32, 70, 81, 0.035)` |

Use `--gcs-bg` for the page canvas, `--gcs-surface` for normal containers, `--gcs-surface-elevated` for overlays and prominent cards, and `--gcs-surface-muted` for inset or secondary regions. Reserve `--gcs-overlay` for backdrops.

### Text, borders, and interaction

| Token | Dark/default | Light |
| --- | --- | --- |
| `--gcs-heading` | `#f2f7f5` | `#152c34` |
| `--gcs-text` | `#d7e2e4` | `#324b53` |
| `--gcs-muted` | `#9fb0b8` | `#526970` |
| `--gcs-subtle` | `#768a94` | `#5b7178` |
| `--gcs-border` | `#30414c` | `#d8e2e5` |
| `--gcs-border-strong` | `#607985` | `#789097` |
| `--gcs-accent` | `#58c2c0` | `#256f76` |
| `--gcs-accent-strong` | `#7bd7d3` | `#176e75` |
| `--gcs-accent-contrast` | `#071b1c` | `#ffffff` |
| `--gcs-accent-soft` | `#183b3e` | `#e4f4f3` |
| `--gcs-link` | `#72d4d0` | `#196f76` |
| `--gcs-link-hover` | `#a6ebe7` | `#0e5258` |
| `--gcs-focus` | `#58c2c0` | `#256f76` |

Use `--gcs-heading` for headings and high-emphasis labels, `--gcs-text` for normal copy, `--gcs-muted` for supporting copy, and `--gcs-subtle` only for low-emphasis metadata that remains nonessential. Use `--gcs-accent-contrast` for content placed directly on an accent-colored background.

### State colors

| Token | Dark/default | Light | Intended meaning |
| --- | --- | --- | --- |
| `--gcs-success` | `#62d4a9` | `#16785d` | Completed, valid, available |
| `--gcs-success-soft` | `#183a31` | `#e1f5ed` | Success surface |
| `--gcs-warning` | `#f2c46d` | `#895b0e` | Caution, approaching limit |
| `--gcs-warning-soft` | `#44371f` | `#fff3d8` | Warning surface |
| `--gcs-danger` | `#ff9b9b` | `#b8404a` | Error, destructive action, failed state |
| `--gcs-danger-soft` | `#46272c` | `#fce8e9` | Danger surface |
| `--gcs-info` | `#79bfff` | `#236fa6` | Informational or neutral status |
| `--gcs-info-soft` | `#20364a` | `#e5f2fb` | Information surface |
| `--gcs-violet` | `#b7a4ff` | `#7256c9` | Secondary metadata and code-like content |
| `--gcs-violet-soft` | `#2d2743` | `#f0ecfc` | Violet secondary surface |

Pair each foreground token with its matching `-soft` surface where appropriate. The teal accent is the application brand and interaction color; it is not a substitute for a semantic state. Always include text, an icon, or another non-color cue when state matters.

### Elevation, shape, and layout

| Token | Dark/default | Light |
| --- | --- | --- |
| `--gcs-shadow-sm` | `0 0.35rem 1rem rgba(0, 0, 0, 0.16)` | `0 0.35rem 1rem rgba(31, 64, 72, 0.07)` |
| `--gcs-shadow` | `0 1.15rem 2.8rem rgba(0, 0, 0, 0.25)` | `0 1.15rem 2.8rem rgba(31, 64, 72, 0.09)` |
| `--gcs-shadow-lg` | `0 1.5rem 4rem rgba(0, 0, 0, 0.34)` | `0 1.5rem 4rem rgba(31, 64, 72, 0.14)` |
| `--gcs-radius-sm` | `0.5rem` | Inherited from `:root` |
| `--gcs-radius` | `0.85rem` | Inherited from `:root` |
| `--gcs-radius-lg` | `1.2rem` | Inherited from `:root` |
| `--gcs-content-width` | `108rem` | Inherited from `:root` |
| `--gcs-transition` | `150ms ease` | Inherited from `:root` |

Use small shadows for ordinary cards and controls, the normal shadow for floating panels, and the large shadow only for overlays such as dropdowns and modals. Borders should continue to define a surface when shadows are absent or reduced.

## Stylesheet and cascade order

`views/layout.pug` loads assets in this order:

1. `theme.js` runs in the document head so the saved mode can be applied before the page is painted.
2. Bootstrap 4.3.1 provides the base component model.
3. `style.css` provides original global styles.
4. `my_style.css` provides existing application styles.
5. A page's `block styles` loads page-specific or vendor CSS.
6. `#myCss` loads the legacy `Style_dark.css` or `Style_normal.css` compatibility sheet.
7. The selected mode is reapplied without changing persistence.
8. `design-system.css` loads last as the shared v2.10 normalization layer.

The final position of `design-system.css` is intentional. Do not reorder these files casually. New page styles should use shared tokens and be scoped beneath one page root, such as `.case-page`, to avoid leaking into the shell. If a page-specific rule must refine a shared component, use that page root to make the intent and specificity clear; do not solve cascade conflicts with broad selectors or repeated `!important` declarations.

The two legacy `Style_*.css` files remain part of the migration path. New styling must not add another theme switch or depend on those files for new component colors.

## Shared application shell

All standard pages extend `views/layout.pug`. The layout owns:

- `.app-shell`, the full-height application frame;
- the sticky `.app-header` and `.app-navbar`, including navigation, language, user, and theme controls;
- `.app-notice-region` for status, news, and warning notices;
- `.app-schedule-strip` for the seven-day work schedule;
- `main#main-content.app-main`, including the keyboard skip-link target; and
- `.app-footer`.

Because the layout already supplies the document's `main` landmark, page templates must not add another `<main>` element. Use a `section` or `div` as the page root and give major sections meaningful headings.

A normal page follows this structure:

```pug
extends layout

block styles
  link(rel='stylesheet', href='/stylesheets/example.css')

block content
  section.example-page(aria-labelledby='example-title')
    header.app-page-header
      .example-page-heading
        p.app-page-kicker Section name
        h1#example-title Page title
        p Short, useful page description.
      .app-page-actions
        a.btn.btn-primary(href='/example/new') New item

    .app-panel
      //- Page content

block scripts
  script(src='/javascripts/example.js')
```

Load page-only CSS and JavaScript through `block styles` and `block scripts`. Do not add a library globally merely because one page needs it.

## Shared components

### Page structure

- `.app-page-header` is the standard title and action row. It stacks automatically on small screens.
- `.app-page-kicker` is a short uppercase context label, not a replacement for the page heading.
- `.app-page-actions` groups primary and secondary actions.
- `.app-toolbar` groups filters, search, or compact controls.
- `.app-panel` is the default content surface.
- `.app-empty-state` provides a centered, bordered empty or first-use state.

Every page needs one clear `h1`. Subsequent headings should follow a logical hierarchy rather than being selected for size alone.

### Cards and panels

Use `.card` for a discrete record or Bootstrap-compatible content group and `.app-panel` for a page section. Shared styles already provide tokenized borders, surfaces, radii, and shadows. Keep card headers concise and put supporting metadata in muted text. `.card-done` and `.card-new` retain their semantic success and danger treatments.

Avoid nested elevated surfaces unless the nesting communicates real hierarchy. Prefer a muted inset region inside a card over another fully shadowed card.

### Forms

- Use the existing `.form-control`, `.form-select`, `.custom-select`, and input-group classes; the design system normalizes them in both themes.
- Give every control a visible label. Placeholder text is an example or hint, not a label.
- Use the correct native input type and preserve native keyboard behavior.
- Associate help and error text with `aria-describedby`; set `aria-invalid='true'` when validation fails.
- Keep readonly and disabled controls visually distinct without making their values unreadable.
- Use normal document flow or responsive grid/flex layouts. Avoid fixed pixel widths for primary form fields.
- Place the main submit action consistently and visually separate destructive actions with danger styling and confirmation where appropriate.

### Tables

Use `.table` with `.table-responsive` when columns may exceed the available width. Headers must use `<th>` with an appropriate `scope`; provide a caption or nearby heading that identifies the data. The shared layer intentionally normalizes legacy `.table-dark` markup in both themes, but new templates should use the neutral `.table` name unless dark appearance itself has meaning.

Use stripes and row hover only when they improve scanning. Do not encode status solely as a row background. On narrow screens, preserve data accuracy through horizontal scrolling or a deliberate stacked presentation rather than hiding important columns without an alternative.

### Buttons, notices, and status

Use the existing Bootstrap button variants, which are tokenized by the shared layer:

- primary/info for the main or informational action;
- secondary for a lower-priority action;
- success for a completing or approving action;
- warning for a cautionary action; and
- danger for destructive or irreversible actions.

Use `.app-notice` in the shell notice region and `.alert` inside page content. Choose their semantic modifier instead of styling a message with a literal color. Use `.badge` for compact metadata, not as the only explanation of an important state. Dynamic messages should use an appropriate `role` or `aria-live` region without repeatedly interrupting assistive technology.

## Color-mode behavior

The current mode is represented by `html[data-color-mode='dark']` or `html[data-color-mode='light']`. If no valid saved value exists, dark is selected. `theme.js` stores the semantic mode in `localStorage` under `gcs-color-mode` and maintains the older `settings.colormode` value during migration. Storage failures are non-fatal; the visible mode still changes for the current page.

Use the public `window.GCSTheme` API for all new code:

```js
GCSTheme.getPreferredMode();             // 'dark' or 'light'
GCSTheme.apply('dark');                  // Apply and persist
GCSTheme.apply('light', { persist: false }); // Apply for this page load only
GCSTheme.toggle();                       // Toggle, persist, and return the new mode
```

Do not manipulate `#myCss`, `data-color-mode`, or theme storage directly. `UpdateColorMode()` and `ToggleColorMode()` in `GCSTool.js` are compatibility wrappers for existing controls; new controls should call `GCSTheme`.

Applying a mode also updates the browser theme color, legacy selector, accessible toggle label/state, and supported Toast UI editor instances.

### Charts and dynamically painted UI

CSS-painted HTML and SVG should reference tokens and will update automatically. The shared D3 surface uses `.gcs-line-chart` and `.gcs-line-chart-series`; prefer those classes over literal `fill` and `stroke` attributes.

Canvas charts and SVG code that resolves colors into attributes must repaint after a live toggle. Listen for `gcs:themechange`; the selected mode is available as `event.detail.mode`:

```js
function readChartColors() {
  const styles = getComputedStyle(document.documentElement);
  return {
    line: styles.getPropertyValue('--gcs-accent-strong').trim(),
    text: styles.getPropertyValue('--gcs-muted').trim(),
    grid: styles.getPropertyValue('--gcs-border-strong').trim(),
  };
}

function renderChart() {
  const colors = readChartColors();
  // Clear/update the existing chart and render with the current values.
}

renderChart();
window.addEventListener('gcs:themechange', renderChart);
```

Read computed tokens during each render, not once when the script is parsed. Debounce expensive resize work, but repaint promptly on a theme event.

## Accessibility requirements

- Preserve the layout's skip link and single main-content landmark.
- Ensure all functionality is reachable and operable with a keyboard. Never remove the shared `:focus-visible` indication without providing an equally clear replacement.
- Use native controls and semantic elements before adding ARIA. Every icon-only action needs an accessible name.
- Maintain readable text contrast in both modes. Treat `--gcs-subtle` as nonessential supporting text and verify any custom token combination.
- Do not rely on color alone. Add text, an icon, shape, or position to communicate state.
- Give images useful alternative text when they convey information and empty alternative text when they are decorative.
- Use descriptive link and button text. Links opening a new tab should be intentional and use `rel='noopener noreferrer'`.
- Keep touch and pointer targets at least as usable as the shared controls; do not shrink them for dense layouts.
- Respect `prefers-reduced-motion`. The shared layer suppresses animations and transitions for users who request it; page CSS and scripts must do the same.
- Avoid unexpected focus changes, flashing content, and rapidly repeating live-region announcements.

## Responsive requirements

The shell changes at `1199.98px` and `767.98px`. At the larger breakpoint, navigation collapses into a card-like panel and its action area wraps. At the smaller breakpoint, the shell uses compact controls, page headers and the footer stack, schedules become vertical, tables tighten, and content regions use a `1.5rem` total viewport gutter.

Page implementations must:

- start from a flexible layout using grid, flexbox, percentages, `minmax()`, and `clamp()` where helpful;
- avoid fixed content widths and fixed heights for regions containing translated or user-provided text;
- keep the viewport free of horizontal scrolling except inside deliberate containers such as `.table-responsive`;
- let action groups wrap and retain a clear primary action;
- make charts responsive and rerender them after their container changes size;
- test long labels, empty states, validation messages, and translated content at narrow widths; and
- add page-specific breakpoints only when content requires them, using the shared breakpoints where possible.

## Page migration checklist

When bringing a legacy page into the v2.10 system:

1. Extend `layout.pug`; remove duplicate document, navigation, footer, and `<main>` markup.
2. Add one scoped page root and a clear `h1`, normally using `.app-page-header`.
3. Move page-only styles into `block styles` or a page stylesheet. Move page-only scripts and libraries into `block scripts`.
4. Replace hard-coded foregrounds, backgrounds, borders, shadows, and status colors with the nearest semantic `--gcs-*` token.
5. Remove dark-only assumptions, including white text used as a universal default, black panel backgrounds, and literal dark chart paint.
6. Reuse `.app-panel`, `.card`, form controls, tables, buttons, alerts, badges, and empty-state styles before creating a new component.
7. Scope any remaining custom selectors beneath the page root. Avoid tag-wide rules, inline presentation styles, and `!important` unless overriding an unavoidable third-party rule.
8. Make charts and other dynamically painted UI token-driven; subscribe to `gcs:themechange` when a redraw is necessary.
9. Verify dark mode first, then light mode. Test hover, focus, active, disabled, readonly, loading, empty, success, warning, and error states.
10. Test keyboard navigation, reduced motion, long text, and widths above and below `1199.98px` and `767.98px`.
11. Compile the Pug template, run relevant syntax checks, and smoke-test the page's existing interactions before considering the migration complete.

## Runtime and dependency constraint

The application targets Node.js `16.20.2`. Styling work should use the existing Pug, Bootstrap 4.3.1, CSS, and vanilla JavaScript stack and should not introduce a new npm package. If a dependency is genuinely necessary for a later feature, its Node 16 compatibility must be verified before it is proposed or installed, and an existing dependency or small local implementation should be preferred.

Do not assume Bootstrap 5 markup, utilities, or JavaScript behavior. `design-system.css` provides a small set of compatibility utilities such as `.form-select`, `.text-end`, `.fw-semibold`, `.gap-2`, and `.gap-3`; add to that set only when the shared need is established.
