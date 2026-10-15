---
name: Ikizen Flow
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#464554'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#777586'
  outline-variant: '#c7c4d7'
  surface-tint: '#5148d7'
  primary: '#2a14b4'
  on-primary: '#ffffff'
  primary-container: '#4338ca'
  on-primary-container: '#c1beff'
  inverse-primary: '#c3c0ff'
  secondary: '#006c4a'
  on-secondary: '#ffffff'
  secondary-container: '#82f5c1'
  on-secondary-container: '#00714e'
  tertiary: '#5c2f00'
  on-tertiary: '#ffffff'
  tertiary-container: '#7d4200'
  on-tertiary-container: '#ffb477'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e3dfff'
  primary-fixed-dim: '#c3c0ff'
  on-primary-fixed: '#100069'
  on-primary-fixed-variant: '#372abf'
  secondary-fixed: '#85f8c4'
  secondary-fixed-dim: '#68dba9'
  on-secondary-fixed: '#002114'
  on-secondary-fixed-variant: '#005137'
  tertiary-fixed: '#ffdcc3'
  tertiary-fixed-dim: '#ffb77d'
  on-tertiary-fixed: '#2f1500'
  on-tertiary-fixed-variant: '#6e3900'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  data-metric:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.02em
  data-tabular:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system embodies high-fidelity restraint, operational precision, and understated authority for service business operations. Designed for founders, operators, and studio managers, the interface communicates reliability, clarity, and structural calm amid dense operational data.

### Aesthetic Foundation
- **Discipline over Decoration**: Elimination of non-functional gradients, saturated backdrops, and faux-physical glass effects.
- **Architectural Surface Structure**: Clear separation between global canvas layers and actionable work surfaces using subtle 1-pixel borders and calibrated background tints.
- **Micro-Deliberation**: Every visual cue conveys semantic state, operational health, or clear navigational pathing.

## Colors

The palette establishes an immediate sense of institutional trust through low-saturation structural neutrals punctuated by focused, deliberate accents.

### Palette Roles
- **Canvas Base**: Slate tint (`#F8FAFC`) forms the root application canvas, with subtle inset wells on `#F1F5F9`.
- **Surfaces**: Pure `#FFFFFF` reserved exclusively for elevated containers, data cards, modals, and data grids.
- **Text & Structure**: Deep Charcoal (`#0F172A`) for primary headlines and critical values; Muted Slate (`#334155`) for secondary metrics and labels; Slate Border (`#E2E8F0` resting, `#CBD5E1` hover/interactive).
- **Primary Accent**: Deep Indigo (`#4338CA` resting, `#4F46E5` hover) reserved strictly for primary actions, active navigation anchors, and selection rings.
- **Semantic Accents**: 
  - Emerald (`#059669` / light tint `#ECFDF5`): Positive revenue, completed milestones, healthy pipeline.
  - Amber (`#D97706` / light tint `#FFFBEB`): Awaiting payment, pending approval, review required.
  - Rose (`#DC2626` / light tint `#FEF2F2`): Overdue invoices, system alerts, destructive confirmation states.

## Typography

Typography prioritizes micro-legibility and vertical rhythm across complex operational dashboards and tables.

### Rules
- **Tabular Figures**: All numerical figures, currency displays, timestamps, and metric summaries must enable `font-feature-settings: "tnum" 1` to ensure aligned vertical scanning.
- **Weights**: Restrict to 400 (Body & Description), 500 (Interactive labels & table headers), and 600 (Section headings & primary metric callouts). Avoid ultra-bold weights.
- **Letter Spacing**: Subtle negative tracking applied on sizes 20px and above to maintain structural density.

## Layout & Spacing

A strictly governed 8-pixel base spatial system forms predictable layout cadences across views.

### Structure
- **Global Shell**: Fixed 256px vertical navigation sidebar on desktop with a fluid, container-constrained content canvas (max-width: 1440px).
- **Responsive Flow**:
  - **Desktop (>= 1200px)**: 12-column grid, 24px gutters, 32px canvas margins.
  - **Tablet (768px - 1199px)**: 8-column grid, 16px gutters, 24px canvas margins; sidebar collapses to an icon bar.
  - **Mobile (< 768px)**: 4-column grid, 16px gutters, 16px canvas margins; navigation moves to bottom bar or sheet overlay.
- **Content Density**: Form fields and data tables default to comfortable compact density (36px control height, 48px row height) to reduce unnecessary scrolling.

## Elevation & Depth

Depth is established primarily through crisp boundary lines and minimal ambient diffusion rather than heavy physical drops.

### Surface Tiers
- **Level 0 (Canvas)**: `#F8FAFC`, flat.
- **Level 1 (Panels & Table Surfaces)**: Pure `#FFFFFF` surface bordered by a crisp `1px solid #E2E8F0` stroke, coupled with a faint ambient shadow: `box-shadow: 0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.04)`.
- **Level 2 (Dropdowns, Popovers & Context Menus)**: `#FFFFFF` surface, `1px solid #CBD5E1`, with elevated projection: `box-shadow: 0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.05)`.
- **Level 3 (Modal Dialogs & Slide-overs)**: `#FFFFFF` surface, `1px solid #E2E8F0`, with deep focal grounding: `box-shadow: 0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.05)`, backed by a `rgba(15, 23, 42, 0.4)` scrim.

## Shapes

The geometry strikes a balance between professional restraint and modern tactile softness using unified 8px to 12px radii.

### Geometry Scale
- **Small Controls (Buttons, Form Inputs, Badges)**: 8px (`0.5rem`) corner radius.
- **Medium Structural (Cards, Data Tables, Flyouts)**: 12px (`0.75rem`) corner radius.
- **Large Modals & Sheets**: 16px (`1rem`) corner radius.
- **Avatars & Status Indicators**: Full circular radius (`9999px`).

## Components

### Buttons
- **Primary**: Solid Deep Indigo (`#4338CA`), pure white text, 8px radius, 36px standard height (40px on standalone forms). Hover: `#4F46E5`. Active: `#3730A3`. Focus: 2px ring with 2px offset (`#4338CA`).
- **Secondary / Outline**: `#FFFFFF` surface, `1px solid #E2E8F0`, text `#334155`. Hover: `#F8FAFC` surface, border `#CBD5E1`, text `#0F172A`.
- **Ghost / Tertiary**: Transparent surface, text `#334155`. Hover: `#F1F5F9` surface, text `#0F172A`.
- **Destructive**: Soft red tint (`#FEF2F2`) background, `#DC2626` text, `1px solid #FCA5A5`. Active/Confirm: Solid `#DC2626` with pure white text.

### Chips & Badges
- **Semantic Badges**: Compact padding (2px vertical, 8px horizontal), 6px text label (`12px` font, 500 weight), 6px radius.
  - *Active / Paid*: `#ECFDF5` background, `#047857` text, subtle `#A7F3D0` 1px border.
  - *Pending / Processing*: `#FFFBEB` background, `#B45309` text, subtle `#FDE68A` 1px border.
  - *Overdue / Alert*: `#FEF2F2` background, `#B91C1C` text, subtle `#FECACA` 1px border.
  - *Neutral / Draft*: `#F1F5F9` background, `#475569` text, subtle `#E2E8F0` 1px border.

### Input Fields
- Height: 38px. Surface: `#FFFFFF`. Border: `1px solid #CBD5E1`. Radius: 8px.
- Internal Spacing: 8px vertical, 12px horizontal.
- Focus: Border shifts to `#4338CA`, accompanied by a uniform 3px outer glow `rgba(67, 56, 202, 0.12)`.
- Placeholder: `#94A3B8`.

### Checkboxes & Radios
- Size: 16px × 16px. Border: `1px solid #CBD5E1`. Radius: 4px for checkboxes, 50% for radios.
- Checked: Solid `#4338CA` fill, white tick mark, no drop shadows.

### Cards & Data Tables
- **Cards**: Surface `#FFFFFF`, border `1px solid #E2E8F0`, border-radius 12px, padding 20px. Level 1 elevation.
- **Data Tables**:
  - Header Row: Background `#F8FAFC`, bottom border `1px solid #E2E8F0`, text 12px medium `#64748B`, uppercase tracking 0.05em.
  - Body Rows: Height 48px, background `#FFFFFF`, bottom border `1px solid #F1F5F9`. Hover state: `#F8FAFC`.
  - Number Columns: Right-aligned with tabular numbers enabled.

### Operational KPI Summary Tiles
- Structured KPI blocks with small overline labels (`12px` muted slate), prominent primary metric (`28px` bold charcoal with tabular numerals), and inline micro-trend badges (e.g., `+12.4%` in emerald badge).