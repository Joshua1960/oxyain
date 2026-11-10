---
name: android-app-design
description: Design and review native Android app UI following Google's Material Design 3 (Material You). Use when the user asks to design, mock up, critique, or spec an Android screen, flow, or component, or to build Jetpack Compose / Material Components UI. Not for iOS (use ios-app-design) or web (use web-app-design).
---

# Android App Design (Material Design 3)

M3 is Google's open-source, code-integrated design system built around customization and expression ("Material You"). It defines color, typography, shape, elevation, and motion as **design tokens**, with a large component library available in Compose and Material Components.

## Workflow
1. **Brief**: user goal, primary task, form factors (phone, foldable, tablet, Wear), brand constraints. If Figma MCP is connected, read the file and reuse its Material 3 kit / variables.
2. **Theme first**: define the token set (color roles, type scale, shape, motion) before screens.
3. **Structure**: pick adaptive navigation, then screens, then components.
4. **Audit** with the checklist below. Flag deviations from M3 and justify them.
5. **Handoff**: token table + screen specs (layout, roles, states, a11y). Offer Jetpack Compose (`MaterialTheme`) code if asked.

## Foundations (tokens)
### Color
- Generate a scheme from a **seed/source color** (Material Theme Builder). Use **dynamic color** (Android 12+ wallpaper-derived) with a branded fallback scheme.
- Use **color roles**, never raw hex in components: primary / on-primary / primary-container / on-primary-container; same for secondary, tertiary, error; surface, surface-container (lowest..highest), on-surface, on-surface-variant, outline, outline-variant, inverse-*.
- Accent hierarchy: primary for key actions, secondary for supporting, tertiary for contrast accents. Design Light and Dark. Contrast: 4.5:1 text, 3:1 UI.

### Typography
- Roboto (or brand font) via the M3 type scale: Display L/M/S (57/45/36), Headline L/M/S (32/28/24), Title L/M/S (22/16/14), Body L/M/S (16/14/12), Label L/M/S (14/12/11). Use `sp`, support font scaling to 200%.

### Shape
- Corner scale: none 0, extra-small 4, small 8, medium 12, large 16, extra-large 28, full (pill). Components map to shape tokens (buttons: full, cards: medium, dialogs: extra-large, FAB: large).

### Elevation
- Prefer **tonal elevation** (surface tint/surface-container) over heavy shadows; levels 0-5 (0, 1, 3, 6, 8, 12 dp).

### Motion
- Emphasized and standard easing; durations ~50-600ms by distance/importance. Use shared-axis, container transform, fade-through transitions. Support predictive back animations. Respect "Remove animations".

## Layout and adaptivity
- 4dp baseline grid; 8dp spacing steps; **48x48dp minimum touch targets**.
- **Window size classes**: Compact (<600dp), Medium (600-839dp), Expanded (>=840dp). Margins 16dp compact, 24dp medium+.
- Use canonical layouts: List-detail, Supporting pane, Feed. Design for foldables, tablets, and large screens, not stretched phone UI.
- **Edge-to-edge** with proper window insets (status, navigation bar, gesture area, cutouts).

## Navigation
- **Compact**: Navigation bar (3-5 destinations) at bottom. **Medium**: Navigation rail. **Expanded**: Navigation drawer (permanent) or rail.
- Top app bar (center-aligned / small / medium / large) with scroll behavior; Navigation = back arrow or menu icon.
- System back (gesture/predictive) must work predictably; do not add custom back overrides without cause. Avoid iOS-style bottom tab text-only bars or swipe-back chevrons as a primary pattern.

## Components (use M3)
Buttons (filled, tonal, elevated, outlined, text), FAB / Extended FAB / Large FAB (one primary action), Icon buttons, Segmented buttons, Chips (assist, filter, input, suggestion), Cards (elevated, filled, outlined), Lists, Text fields (filled, outlined), Search bar/view, Dialogs, Bottom sheets (modal/standard), Side sheets, Menus, Snackbar (transient feedback), Badges, Progress indicators, Sliders, Switches, Checkboxes, Date/time pickers, Tabs, Carousel.

## Interaction and feedback
- Ripple/state layers: hover 8%, focus 10%, pressed 10%, dragged 16% overlays on state colors.
- Snackbars for non-critical feedback (with undo); dialogs only for decisions. Swipe-to-dismiss with undo.
- Haptics via system constants; notifications use channels with clear importance; widgets (Glance), App shortcuts, themed (monochrome) app icon.

## States to design
Enabled, hovered, focused, pressed, dragged, disabled, selected, loading, empty, error, offline, permission-denied, first-run.

## Platform conventions
- Runtime permissions requested in context with rationale; handle "don't ask again".
- Support Credential Manager / passkeys, system share sheet, intent handling, back stack behavior, per-app language.
- Localization: text expansion, RTL mirroring via start/end.

## Accessibility
TalkBack contentDescription and focus order, 48dp targets, font scaling, color contrast, don't rely on color alone, Switch Access, reduced motion, semantic grouping.

## Pre-handoff checklist
- [ ] Token-based theme (color roles, type, shape); dynamic color + fallback
- [ ] Light + Dark verified; contrast passes
- [ ] Correct nav component per window size class
- [ ] Edge-to-edge insets; 48dp targets
- [ ] One primary action (FAB or filled button) per screen
- [ ] State layers and all states designed
- [ ] Tablet/foldable adaptive layouts defined
- [ ] TalkBack labels and order specified

Source: Material Design 3 (m3.material.io). Verify current specs there; M3 Expressive updates may change values.

