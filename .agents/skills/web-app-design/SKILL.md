---
name: web-app-design
description: Design and review responsive web application UI built on a design system (tokens, components, patterns). Use when the user asks to design, mock up, critique, spec, or build a web app screen, dashboard, form flow, or component library, or to audit a UI for design-system drift. For native mobile use ios-app-design or android-app-design.
---

# Web App Design

A design system = reusable components + design tokens (color, spacing, type) + patterns + documentation. Good web UI comes from picking a system, expressing it as tokens, and composing screens only from its parts.

## Workflow
1. **Brief**: users, key tasks, devices, browsers, brand, existing design system or Figma file. If Figma MCP is available, read the file and reuse its components and variables instead of inventing new ones.
2. **Choose the system**: use the team's own; otherwise pick a fit (Material 3 for Google-flavored / Android-adjacent web, Apple HIG feel for iOS-adjacent PWAs, or Polaris, Carbon, Atlassian, Base for admin/enterprise/commerce). Do not mix systems on one surface.
3. **Tokens**: define color roles, type scale, spacing, radius, elevation, motion as named tokens (CSS variables / Figma variables). No raw values in components.
4. **Information architecture**: sitemap, primary navigation, page templates.
5. **Design**: mobile-first, then enlarge. Spec every state.
6. **Audit and handoff**: run checklist; deliver tokens, component usage, states, a11y notes, and code (HTML/CSS/React) if requested.

## Tokens
- **Color**: semantic roles (bg, surface, text, text-muted, primary, on-primary, border, success/warning/danger/info). Light + dark themes via `prefers-color-scheme` and a manual toggle.
- **Spacing**: 4/8 scale (4, 8, 12, 16, 24, 32, 48, 64).
- **Type**: modular scale, body 16px min, line-height 1.4-1.6, line length 45-75ch, system or one brand font + fallback stack.
- **Radius / elevation / motion**: 3-5 steps each; motion 100-300ms, ease-out, honor `prefers-reduced-motion`.

## Responsive layout
- Mobile-first breakpoints, e.g. 0 / 600 / 840 / 1200 / 1600 (mirrors Material window classes). Fluid grid: 4 columns compact, 8 medium, 12 expanded; gutters 16-24px.
- Navigation by width: bottom bar or hamburger (compact), rail/collapsible sidebar (medium), persistent sidebar + top bar (expanded).
- Content reflow, not shrinking: tables become cards or scroll with sticky first column; side panels become sheets.
- Touch targets >= 44px (WCAG 2.2 min 24px; aim for 44-48). Support keyboard, mouse, touch.

## Patterns
Dashboards (summary cards, charts, filters), data tables (sort, filter, bulk actions, pagination/virtualization), forms (inline validation, labels above fields, clear errors, autosave or explicit save), search and filters, wizards/steppers, settings, empty states, onboarding, notifications/toasts, modals (use sparingly, trap focus), command palette for power users.

## States
Default, hover, focus-visible, active, disabled, loading (skeleton), empty, error with recovery, success, offline, permission-denied, long-content and i18n overflow.

## Performance and craft
Optimize images (responsive srcset, modern formats), avoid layout shift (reserve space), keep LCP/INP/CLS healthy, minimize custom-font weights, and design for slow networks.

## Cross-platform consistency
Web apps that ship alongside native apps should share tokens and language but follow each platform's idioms: do not force iOS tab bars on Android or Material FABs onto iOS. Use the PWA/web version as the neutral expression of the brand.

## Accessibility (WCAG 2.2 AA)
Contrast 4.5:1 text / 3:1 UI; visible focus; full keyboard operation and logical order; semantic HTML and ARIA only when needed; labels for inputs; error messages tied to fields; alt text; no color-only meaning; zoom to 200%/reflow at 320px; reduced motion.

## Design-system audit mode
When asked to audit: list components or styles that deviate from the published system (hard-coded colors, off-scale spacing, detached components, duplicate variants); count and group them; propose mapping each to the nearest token/component; then apply fixes in a second pass (audit first, apply second).

## Pre-handoff checklist
- [ ] Only system tokens and components used
- [ ] Mobile, tablet, desktop layouts defined
- [ ] Light + dark themes verified
- [ ] All states designed incl. empty/error/loading
- [ ] Keyboard, focus, and contrast pass WCAG 2.2 AA
- [ ] Copy, i18n expansion, and RTL considered
- [ ] Performance budget noted

Sources: Figma resource library (design system examples, Claude skills for design); Material Design 3; Apple HIG.

