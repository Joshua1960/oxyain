---
name: ios
description: Design and review native iOS/iPadOS app UI following Apple's Human Interface Guidelines (HIG). Use when the user asks to design, mock up, critique, or spec an iPhone/iPad screen, flow, or component, or to build SwiftUI/UIKit UI that should feel native. Not for Android (use android-app-design) or web (use web-app-design).
---

# iOS App Design (Apple HIG)

Apple's HIG is a platform guideline, not a code-based token system: it stresses native consistency, clarity, deference to content, and depth. Design so the app feels like it belongs on iOS.

## Workflow
1. **Brief**: confirm the user goal, primary task, device targets (iPhone sizes, iPad, Dynamic Island), and whether a Figma file / brand system exists. If Figma MCP is connected, read the file first and reuse its components and variables.
2. **Structure**: choose navigation, then screens, then components (below).
3. **Design**: specify layout, type, color, states, and motion using the rules below.
4. **Audit**: run the checklist at the end before handing off. Flag every deviation from HIG and justify it.
5. **Handoff**: output screen specs (layout, spacing, type styles, semantic colors, SF Symbols, states, accessibility labels). Offer SwiftUI code if asked.

## Core principles
- **Clarity**: legible text, precise icons, purposeful negative space.
- **Deference**: UI supports content; avoid heavy chrome and decoration.
- **Depth**: use layering, translucency (materials), and motion to convey hierarchy.
- Use system components and behaviors before custom ones. Custom controls need a strong reason.

## Navigation and structure
- **Tab bar** for 3-5 top-level peers (5 max on iPhone; "More" beyond). Always visible; never use for actions.
- **Navigation stack** (back chevron + large title) for hierarchical drill-down. Support the edge-swipe back gesture; never break it.
- **Sheets/modals** for self-contained tasks; provide a clear Cancel/Done. Prefer detents (medium/large) over full-screen takeovers.
- **iPad**: use sidebar / split view (NavigationSplitView) rather than a stretched phone layout; support multitasking and rotation.
- Menus, context menus, and swipe actions for secondary actions; keep destructive actions confirmed via action sheet or red role.

## Layout
- Respect **safe areas** and layout margins (16pt default horizontal on iPhone). Never place controls under the home indicator or Dynamic Island.
- **Touch targets >= 44x44 pt**.
- Use an 8-pt-ish spacing rhythm (4/8/12/16/20/24). Align to system margins; use readable content width on iPad.
- Design for all iPhone sizes and both orientations where sensible; use adaptive layout (size classes), not fixed frames.

## Typography
- Font: **San Francisco** (SF Pro; SF Pro Rounded/New York optional). Use **Dynamic Type text styles** rather than fixed sizes.
- Default styles (at default size): Large Title 34, Title 1 28, Title 2 22, Title 3 20, Headline 17 semibold, Body 17, Callout 16, Subhead 15, Footnote 13, Caption 1 12, Caption 2 11.
- Minimum practical size ~11pt; body 17pt. Layouts must survive the largest accessibility sizes (wrap, stack vertically, never truncate essential text).

## Color
- Use **semantic system colors** (label, secondaryLabel, systemBackground, secondarySystemBackground, separator, tint/accent) so Light, Dark, and Increased Contrast work automatically.
- One accent/tint color for interactive elements; do not rely on color alone to convey meaning.
- Contrast: 4.5:1 for body text, 3:1 for large text and UI glyphs. Design Dark Mode from the start (elevated surfaces get lighter, not shadows).

## Iconography and imagery
- Use **SF Symbols** (match weight to adjacent text, use hierarchical/palette rendering, provide accessibility labels). App icon follows the current icon grid/layering rules; no text-heavy icons.
- Images: provide @2x/@3x or vector assets; avoid text baked into images.

## Components (prefer native)
Navigation bar, Tab bar, Toolbar, List/Inset grouped list, Form, Button (filled/tinted/gray/plain; prominent for one primary action per view), Toggle, Picker, Segmented control, Search (searchable), Alert, Action sheet, Sheet, Menu, Context menu, Progress/Activity indicator, Widgets, Live Activities, Dynamic Island, Share sheet.

## Interaction, motion, feedback
- Gestures: standard only (tap, swipe, long-press, pinch); always give a visible alternative to custom gestures.
- Motion: purposeful, interruptible, springy; respect **Reduce Motion**.
- Haptics: use system haptic feedback sparingly to confirm; never as the only feedback.
- Loading: show skeleton/placeholder or progress; support pull-to-refresh on lists.

## States to always design
Default, pressed, disabled, loading, empty, error (with recovery action), offline, success, first-run/onboarding, permission-denied.

## Platform conventions
- Request permissions in context, with a pre-prompt explaining why; handle denial gracefully.
- Sign in with Apple when offering third-party sign-in; support Face ID/Touch ID, Passkeys.
- Onboarding minimal; let users in fast. Avoid custom back buttons, hamburger menus, and Android-style FABs/snackbars.
- Localization: allow text expansion (~30%), support RTL (mirror layouts, not media/numbers).

## Accessibility (non-negotiable)
VoiceOver labels/traits/order, Dynamic Type, Bold Text, Increase Contrast, Reduce Motion/Transparency, Voice Control, targets >= 44pt, no color-only meaning.

## Pre-handoff checklist
- [ ] Native navigation pattern, back-swipe intact
- [ ] Safe areas and 44pt targets respected
- [ ] Dynamic Type text styles; tested at largest sizes
- [ ] Semantic colors; Light + Dark verified; contrast passes
- [ ] SF Symbols with labels; one primary action per screen
- [ ] All states designed (empty/error/loading/offline)
- [ ] iPad / orientation behavior defined
- [ ] VoiceOver order and labels specified

Source: Apple Human Interface Guidelines (developer.apple.com/design/human-interface-guidelines). Verify current values there; guidelines evolve with each iOS release.

