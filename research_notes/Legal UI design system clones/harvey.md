# Harvey (harvey.ai) Visual Design System: Implementation Spec

Research date: 2026-10-08. Method: I fetched the raw HTML of https://www.harvey.ai and its 7 linked Next.js CSS chunks (`/_next/static/immutable/chunks/*.css`, about 260 KB total) with Python urllib and parsed them programmatically. I also checked the CSS of /platform, /platform/assistant, /platform/vault and /blog for fonts. Two product screenshots from the Sanity CDN were viewed visually.

Labels used below: **[CSS]** means verified verbatim from the live stylesheet or HTML. **[3P]** means a third-party claim. **[EST]** means my estimate from screenshots or inference.

Primary source for every [CSS] item: [harvey.ai homepage + CSS chunks](https://www.harvey.ai) (CSS e.g. `https://www.harvey.ai/_next/static/immutable/chunks/0bjmlnu58j0w3.css`).

---

## 1. Font families: what is actually loaded, foundry, license, free substitutes

### Takeaway
harvey.ai loads exactly three brand font files, all self-hosted:
- `HarveySerifFont` Regular 400
- `HarveySerifFont` Italic 400
- `HarveySansFont`, a variable file named `HarveySansDiatypeVariable`

The sans is ABC Diatype (Dinamo, commercial). The serif is a custom-named, subsetted file. Fonts In Use attributes Harvey's display serif to TWK Ghost (WELTKERN, commercial). No Söhne Mono or any mono brand font is loaded on the marketing site today.

For a free clone, use **Instrument Serif** (or Newsreader) for the serif, **Inter** (or Geist) for the sans, and **Geist Mono / IBM Plex Mono** if you need a mono.

### Cited Findings
- [CSS] Preloaded font files on every page checked (/, /platform, /platform/assistant, /platform/vault, /blog):
  - `/_next/static/immutable/media/HarveySansDiatypeVariable-s.p.2rrvpa2vn2v8k.woff2`
  - `subset_HarveySerif_Regular-s.p.2it-i9ai-8xs6.woff2`
  - `subset_HarveySerif_Italic-s.p.2vt1i-33agtbq.woff2`

  Source: [harvey.ai](https://www.harvey.ai)
- [CSS] The exact `@font-face` rules:
  ```css
  @font-face{font-family:HarveySerifFont;src:url(subset_HarveySerif_Regular…woff2)format("woff2");font-display:swap;font-weight:400;font-style:normal}
  @font-face{font-family:HarveySerifFont;src:url(subset_HarveySerif_Italic…woff2)format("woff2");font-display:swap;font-weight:400;font-style:italic}
  @font-face{font-family:HarveySerifFont Fallback;src:local(Arial);ascent-override:97.54%;descent-override:36.07%;line-gap-override:0.0%;size-adjust:99.24%}
  @font-face{font-family:HarveySansFont;src:url(HarveySansDiatypeVariable…woff2)format("woff2");font-display:swap}
  @font-face{font-family:HarveySansFont Fallback;src:local(Arial);ascent-override:97.44%;descent-override:36.04%;line-gap-override:0.0%;size-adjust:99.34%}
  ```
  The `… Fallback` faces with metric overrides are the signature of `next/font/local`. The `<html>` element carries the classes `harveyseriffont_…__variable harveysansfont_…__variable`. — [harvey.ai](https://www.harvey.ai)
- [CSS] Font stacks:
  - `--harvey-serif: "HarveySerifFont", "HarveySerifFont Fallback"`
  - `--harvey-sans: "HarveySansFont", "HarveySansFont Fallback"`
  - `--font-harvey-serif: var(--harvey-serif), var(--font-fallback)`
  - `--font-fallback: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif`
  - `html { font-family: var(--font-harvey-sans) }`

  Source: [harvey.ai](https://www.harvey.ai)
- [CSS] Only weight 400 (regular and italic) of the serif ships. All headings are set at weight 400. The sans is variable; the CSS uses 400 and 500 (`font-medium`). — [harvey.ai](https://www.harvey.ai)
- [CSS] The strings "Söhne", "Sohne" and "Ghost" do not appear anywhere in the live CSS. The string "Diatype" appears in the sans font filename. KaTeX fonts are also bundled, for math rendering in blog posts. — [harvey.ai](https://www.harvey.ai)
- [3P] Fonts In Use says the June 2025 "Practice Made Perfect" out-of-home campaign set the wordmark, headlines and display copy in **TWK Ghost** (designed by Nolan Paparelli, published by **WELTKERN**). It says **ABC Diatype by Dinamo** is the supporting sans for body copy and UI. It credits the brand foundation to Portland studio **Geist**, working with brand consultant Shawn Farsai; the campaign was with Geist and Daybreak. — [Fonts In Use #77027](https://fontsinuse.com/uses/77027/harvey)
- [3P] webdesignhot's auto-generated design.md lists:
  - Display: HarveySerifFont (display 96, h1 72, h2 48)
  - Body: HarveySansFont 16px
  - Label: **"Söhne Mono" 13px**

  This Söhne Mono claim is **not corroborated** by the current live CSS. It may come from an older crawl, or from a product/demo embed. — [webdesignhot OpenAI vs Harvey](https://www.webdesignhot.com/design.md/openai/diff/harvey/)
- [3P] Licensing:
  - ABC Diatype is a commercial Dinamo typeface released in 2020. — [maxibestof.one Diatype](https://maxibestof.one/typefaces/diatype)
  - Fonts In Use marks the Harvey specimens "License: All Rights Reserved" (that refers to the images). — [Fonts In Use](https://fontsinuse.com/uses/77027/harvey)

### Inferences
- **HarveySerifFont is most likely a renamed, subsetted TWK Ghost build or a custom derivative of it.** The evidence: Fonts In Use ties Ghost to the wordmark and headlines; the "subset_" prefix and the rename suggest a licensed web build; and only a single 400 weight plus italic ships. This is not proven: no foundry metadata was inspected, and I did not download the font files, per the constraint. Treat both brand fonts as **commercial/proprietary. Do not use them.**
- The wordmark is literally text, `<div class="font-harvey-serif text-xl">:Harvey:</div>`, rendered with colons. Headlines inline the brand as ":Harvey:", e.g. "Introducing :Harvey: II". This suggests a custom ligature or glyph set triggered by `font-feature-settings:"liga","calt"` in the serif ([CSS] headings enable `"liga" on, "calt" on`). In a clone, render it as plain "Harvey" in the serif, or as a small SVG.
- **Free substitutes (Google Fonts)**, with reasoning:

  | Brand font | Best free substitute | Why | Alternates |
  |---|---|---|---|
  | HarveySerif / TWK Ghost (high-contrast, sharp, slightly narrow editorial serif; 400 only, used very large with tight tracking) | **Instrument Serif** (400 + italic, OFL) | Same shape of family: a single 400 weight plus italic. High contrast and slightly condensed proportions read as "legal journal" at 48–160px. | **Newsreader** (variable opsz; use opsz 72, weight 400) for more text-like warmth. **Fraunces** (opsz 144, SOFT 0, WONK 0) if you need more contrast. Avoid Playfair: too ball-terminal and fashion-y. |
  | HarveySansFont / ABC Diatype (neutral neo-grotesk, slightly mechanical, used 400/500) | **Inter** (variable; or Inter Tight for display) | Closest neutral grotesk with a variable 400/500 and similar x-height. Metrics are close to the Arial fallback that the site's override targets (~99% size-adjust). | **Geist** (Vercel, OFL, on Google Fonts): its slightly more geometric/technical tone is close to Diatype's flavor. **Hanken Grotesk** or **Schibsted Grotesk** as alternatives. |
  | (Söhne Mono, per a 3P claim only) | **Geist Mono** or **IBM Plex Mono** | Söhne Mono is commercial (Klim). Geist Mono pairs naturally with Geist/Inter. | JetBrains Mono |

### Gaps
- I did not confirm the true origin of HarveySerif (custom commission vs. renamed Ghost). That needs inspecting the font's name table, which was intentionally not done, or a statement from Harvey, WELTKERN or Geist. No Geist studio case study page for Harvey was found by search.
- The fonts used inside the product app (app.harvey.ai, behind login) were not verifiable. In screenshots the product UI sans looks like a neutral grotesk (Diatype or Inter-like) [EST].

---

## 2. Type scale (h1/h2/h3/body/labels/buttons)

### Takeaway
There are two parallel scales.

1. A **serif heading scale**: weight 400, line-height **1.05**, letter-spacing **-0.0125em** (display sizes) or **-0.01em** (smaller sizes), `text-wrap: balance/pretty`. It is responsive at 1025 / 1445 / 1730 px.
2. A **sans body scale**: `text-body-0..3` = 24 / 20 / 16 / 14 px, all with line-height **1.3** and weight 400. Medium (500) is used for emphasis, labels and buttons.

h4 and `text-heading-4` switch to the **sans at 500**.

### Cited Findings
- [CSS] Size tokens (rem, 1rem = 16px). Note that Harvey has overridden Tailwind's defaults:

  | Token | rem | px |
  |---|---|---|
  | `--text-2xs` | .625 | 10 |
  | `--text-xs` | .75 | 12 |
  | `--text-sm` | .875 | 14 |
  | `--text-base` | 1 | 16 |
  | `--text-md` | 1.25 | 20 |
  | `--text-lg` | 1.5 | 24 |
  | `--text-xl` | 1.75 | 28 |
  | `--text-2xl` | 2 | 32 |
  | `--text-3xl` | 2.25 | 36 |
  | `--text-4xl` | 2.5 | 40 |
  | `--text-5xl` | 3 | 48 |
  | `--text-6xl` | 3.5 | 56 |
  | `--text-7xl` | 4 | 64 |
  | `--text-8xl` | 4.5 | 72 |
  | `--text-9xl` | 5 | 80 |
  | `--text-10xl` | 6 | 96 |
  | `--text-11xl` | 7 | 112 |
  | `--text-12xl` | 8 | 128 |
  | `--text-13xl` | 9 | 144 |
  | `--text-14xl` | 10 | 160 |

  Source: [harvey.ai](https://www.harvey.ai)
- [CSS] Shared heading base (`.heading-base`, h1–h3):
  ```css
  font-family: var(--font-harvey-serif); font-weight:400; font-style:normal;
  font-feature-settings:"liga" on,"calt" on; line-height:1.05; text-wrap:pretty;
  ```
  Source: [harvey.ai](https://www.harvey.ai)
- [CSS] Responsive heading utilities used on the homepage. Breakpoint columns are min-widths; the base is mobile.

  | Class | Letter-spacing | Base | ≥1025px | ≥1445px | ≥1730px | Homepage use |
  |---|---|---|---|---|---|---|
  | `.text-heading-0` | -.0125em, balance | 112px | 128 | 144 | 160 | giant display |
  | `.text-heading-1` | -.0125em, balance | 48px | 72 | 80 | 96 | hero H1 "Build a Frontier Legal Organization"; big stat numbers "200,000+" |
  | `.text-heading-2` | -.01em | 36px | 48 | 56 | 64 | section H2 "One Platform for Legal Work" |
  | `.text-heading-3` | -.01em | 28px | 32 | 36 | 40 | card/sub-section H3, case-study card titles |
  | `.text-heading-4` | -.01em, line-height 1.1 | 28px (`--text-xl`) | – | – | – | **sans, weight 500**; e.g. "Enterprise-Grade Security and Controls" |

  Source: [harvey.ai](https://www.harvey.ai)
- [CSS] Legacy/prose element defaults:
  - `h1`/`.heading-1`: 40px → 48 → 64 → 72, -.0125em
  - `.heading-0`: 48 → 64 → 72 → 96
  - `h2`/`.heading-2`: 32px, -.01em
  - `h3`/`.heading-3`: 24px
  - `h4`/`.heading-4`: 20px, **sans 500**

  Source: [harvey.ai](https://www.harvey.ai)
- [CSS] Body: `.text-body-N { font-family: var(--font-harvey-sans); font-weight:400; line-height:1.3 }`, with sizes:
  - `body-0` = 24px (`--text-lg`)
  - `body-1` = 20px
  - `body-2` = 16px
  - `body-3` = 14px

  On the homepage, hero/section lead paragraphs use `text-body-1` (20px) in `text-secondary`. Card copy uses `text-body-2` (16px). Nav and footer links use `text-body-3` (14px) at 500. — [harvey.ai](https://www.harvey.ai)
- [CSS] Buttons use `.universal-text-2 {font-size:16px; font-weight:500; line-height:1.3}` for the large CTA, and `.universal-text-3 {font-size:14px; font-weight:400; line-height:1.3}` for small buttons. Nav buttons are `text-sm` (14px) `font-medium` with `leading-[130%]`. — [harvey.ai](https://www.harvey.ai)
- [CSS] html: `line-height:1.5; text-rendering:geometricPrecision; -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale`. — [harvey.ai](https://www.harvey.ai)
- [CSS] Other tokens:
  - `--tracking-tight: -.025em`, `--tracking-wide: .025em`
  - `--leading-tight: 1.25`, `--leading-snug: 1.375`
  - Weights available: 400 / 500 / 700. 700 is effectively unused.

  Source: [harvey.ai](https://www.harvey.ai)

### Inferences
- There are no uppercase eyebrow/overline label styles and no mono labels on the live marketing site. "Labels" are 14px sans 500, or 14px sans 400 in a muted color.
- The visual signature is a **huge, light (400) serif headline with tight negative tracking and 1.05 leading over generous ivory space, with small (14–20px) sans copy**. Never bold the serif.
- If you substitute Instrument Serif, keep `letter-spacing: -0.0125em` and `line-height: 1.05`. If you substitute Newsreader, consider -0.02em.

### Gaps
- Exact rendered sizes inside the product app are not public. From screenshots [EST]: app body text is about 14px sans, thread title about 14px medium, and the composer placeholder about 15–16px.

---

## 3. Color palette

### Takeaway
The palette is strictly **warm neutrals**: an "ink" near-black `#0f0e0d` to an "ivory" off-white `#fafaf9`, with warm grays in between. Sections switch theme with `data-theme="white" | "gray" | "black"`. There is **no brand accent color**. The only non-neutrals are:
- muted "atmosphere" tones used in imagery: casal `#333f40`, velvet `#373340`, bronze `#593d3a`, blush `#d9cdcc`
- functional red, green and yellow
- a highlighter yellow `#f6f202`

### Cited Findings
- [CSS] Raw palette:

  | Token | Hex |
  |---|---|
  | `--color-gray-950-ink` | **#0f0e0d** |
  | `--color-gray-900` | #1f1d1a |
  | `--color-gray-800` | #33312c |
  | `--color-gray-700` | #524f49 |
  | `--color-gray-600` | #706d66 |
  | `--color-gray-500` | #8f8b85 |
  | `--color-gray-400` | #adaba5 |
  | `--color-gray-300` | #cccac6 |
  | `--color-gray-200` | #e5e5e3 |
  | `--color-gray-100` | #f2f1f0 |
  | `--color-gray-50-ivory` | **#fafaf9** |
  | `--color-white` | #fff |
  | `--color-black` | #000 |
  | `--color-dark-casal` | #333f40 (deep teal-gray) |
  | `--color-dark-velvet` | #373340 (deep violet-gray) |
  | `--color-dark-bronze` | #593d3a (deep brown-red) |
  | `--color-light-blush` | #d9cdcc |
  | `--color-red-50` | #feeaea |
  | `--color-red-500` | #f26161 |
  | `--color-green` | #16a34a |
  | `--color-yellow` | #eab308 |
  | `--color-highlighter` | #f6f202 (ink #33312c, radius 3px) |

  Source: [harvey.ai](https://www.harvey.ai)
- [CSS] Semantic tokens by theme:

  | Semantic token | `:root` / `[data-theme=black]` (dark) | `[data-theme=white]` (light) | `[data-theme=gray]` |
  |---|---|---|---|
  | text-primary | #fafaf9 | #0f0e0d | #0f0e0d |
  | text-secondary | #cccac6 | #33312c | #33312c |
  | text-muted | #8f8b85 | #706d66 | #524f49 |
  | text-disabled | #33312c | #adaba5 | #adaba5 |
  | text-emphasis | #e5e5e3 | #0f0e0d | #0f0e0d |
  | background-primary | #0f0e0d | #fafaf9 | #f2f1f0 |
  | background-secondary | #1f1d1a | #f2f1f0 | #e5e5e3 |
  | background-primary-hover | #1f1d1a | #f2f1f0 | #e5e5e3 |
  | background-secondary-hover | #33312c | #e5e5e3 | #cccac6 |
  | background-primary-inverse | #fafaf9 | #0f0e0d | #0f0e0d |
  | border-primary | #33312c | #cccac6 | #cccac6 |
  | border-secondary | #524f49 | #e5e5e3 | #e5e5e3 |
  | border-tertiary | #1f1d1a | – | – |
  | nav-blur-tint | ink @ 60% α | ivory @ 72% α (`oklch(from #fafaf9 l c h / .72)`) | – |
  | destructive | text #f26161; bg #feeaea | | |

  Source: [harvey.ai](https://www.harvey.ai)
- [CSS] Homepage section theme order:
  1. Header and HeadlineHeroSection: **white** (ivory)
  2. CustomerLogoGrid: white
  3. AudienceRouter: white
  4. CenteredMediaHero ("Introducing Harvey II"): white
  5. Products: white
  6. QuoteCarousel: **gray** (#f2f1f0)
  7. CaseStudyCarousel: **black** (ink)
  8. StatsSection: black
  9. PolicyLinkGrid (security): black
  10. Footer: **black**
  11. The top announcement banner is black.

  Source: [harvey.ai](https://www.harvey.ai)
- [3P] webdesignhot reports bg #0f0e0d, surface #1a1918, brand #fafaf9, border rgba(255,255,255,0.12), text-muted rgba(255,255,255,0.56). These are computed approximations from a dark-mode crawl. The live CSS uses the opaque grays above instead. — [webdesignhot](https://www.webdesignhot.com/design.md/openai/diff/harvey/)

### Inferences
- In a light-first React clone: page `#fafaf9`, alternate band `#f2f1f0`, dark band and footer `#0f0e0d`, body text `#0f0e0d`, secondary `#33312c`, muted `#706d66`, hairlines `#cccac6` (primary) or `#e5e5e3` (secondary).
- "Accent" is achieved by **inversion** (ink button on ivory, ivory button on ink), not by hue. If a highlight is needed, use `#f6f202` sparingly as a text highlighter.
- Imagery uses grainy, painterly textures in the casal, velvet and bronze tones behind product UI frames. I saw these in the screenshots: brown-red behind Assistant, teal-gray behind Vault, violet-gray tiles.

### Gaps
- I could not pixel-sample screenshots (no image library available). Product app colors below are visual estimates.

---

## 4. Spacing, widths, grid, radii, shadows, buttons, cards, nav, footer

### Takeaway
The site is built with Tailwind v4 on a 4px base (`--spacing: .25rem`), plus a semantic spacing set:

| Token | px |
|---|---|
| xs | 7 |
| sm | 14 |
| md | 28 |
| lg | 56 |
| xl | 112 |
| 2xl | 140 |

Other layout facts:
- Page max-width is 1728px; nav max-width is 1920px.
- Side gutters are 28 / 32 / 36 / 40px across breakpoints.
- Radii are tiny (buttons use 4px).
- There are effectively **no drop shadows**.
- The header is 72px, fixed, with a translucent blur.
- The footer is ink-colored, with a CTA row and a 5-column link grid.

### Cited Findings
- [CSS] Semantic spacing:
  - `--spacing-xs: .4375rem` (7px)
  - `--spacing-sm: .875rem` (14px)
  - `--spacing-md: 1.75rem` (28px)
  - `--spacing-lg: 3.5rem` (56px)
  - `--spacing-xl: 7rem` (112px)
  - `--spacing-2xl: 8.75rem` (140px)
  - `--spacing-top-page-spacing: 4.125rem` (66px)

  Sections use `pt-lg` / `pt-xl` / `pt-2xl` and `pb-xl` / `pb-lg`. For example, the hero is `pt-lg`, the logo grid `pt-xl pb-xl`, and the media hero `pt-2xl`. — [harvey.ai](https://www.harvey.ai)
- [CSS] Widths:
  - `--max-width-page-width: 1728px`
  - `--max-width-nav: 1920px`
  - `--max-width-media: 1092px`
  - `--max-width-post: 675px` (blog article column)
  - `--form-max-width: 814px`
  - Paragraph caps: `max-w-120` (480px), `max-w-140` (560px), `max-w-200` (800px)
  - Container pattern: `max-w-page-width mx-auto px-7 md:px-8 lg:px-9 xl:px-10`

  Source: [harvey.ai](https://www.harvey.ai)
- [CSS] Breakpoints:
  - `--breakpoint-sm: 431px`
  - `--breakpoint-md: 1025px`
  - Media queries also present: 768, 1100/1106 (header nav switch), **1445**, **1730**, 96rem (1536)
  - Heading sizes step at 1025 / 1445 / 1730

  Source: [harvey.ai](https://www.harvey.ai)
- [CSS] Grid: CSS grid utilities `grid-cols-2`, `md:grid-cols-3..6`, `lg:grid-cols-10`, `lg:grid-cols-12`, `md:grid-cols-[2fr_3fr]`, subgrid. Examples:
  - Hero H1 spans `col-span-full md:col-span-3 lg:col-span-5`.
  - Stats rows use `col-span-2 md:col-span-3 lg:col-span-6` for the label and `lg:col-span-4` for the number.

  Source: [harvey.ai](https://www.harvey.ai)
- [CSS] Radii:
  - `--radius-xs: 2px`, `--radius-sm: 4px`, `--radius-md: 6px`, `--radius-lg: 8px`, `--radius-xl: 12px`
  - Buttons use `rounded-sm` (4px)
  - Form inputs: `--form-input-border-radius: 4px`, `--form-input-height: 3rem` (48px)
  - Carousel arrow buttons are `rounded-full`

  Source: [harvey.ai](https://www.harvey.ai)
- [CSS] Shadows: none. The only `box-shadow` values in the CSS are Tailwind ring plumbing, a form focus ring (`0 0 0 2px/4px gray-500`), an autofill inset, and an inset glow. Depth comes from borders, inversion and backdrop blur. — [harvey.ai](https://www.harvey.ai)
- [CSS] Motion:
  - `.transition-colors-soft {transition-property: color,background-color,border-color,fill,stroke; duration:.3s; timing: cubic-bezier(.3,.3,.3,1)}`
  - Easing: `--ease-out: cubic-bezier(0,.7,.3,1)`, `--ease-in-out: cubic-bezier(.7,0,.3,1)`
  - Default duration .15s
  - Scroll reveal: `motion-safe:opacity-0 translateY(32px)`, then animated in

  Source: [harvey.ai](https://www.harvey.ai)
- [CSS] Buttons (exact class lists):
  - **Primary CTA, light section:** `h-12 px-5 rounded-sm bg-gray-950-ink text-gray-50-ivory hover:bg-gray-800 active:bg-gray-700 focus:ring-2 focus:ring-offset-2 universal-text-2 font-medium leading-none`. That is 48px tall, 20px horizontal padding, 4px radius, ink fill, ivory 16px/500 text.
  - **Primary CTA, dark section/footer:** `bg-gray-50-ivory text-gray-950-ink hover:bg-gray-500 active:bg-gray-300`, same size.
  - **Small header CTA:** `h-8` (32px) with `universal-text-3` (14px).
  - **Outline "Login":** `h-8 rounded-sm border border-[var(--text-primary)] py-[7px] pl-3 pr-[7px] hover:bg-primary-inverse hover:text-primary-inverse`.
  - **Secondary outline (mobile menu):** `h-12 px-5 rounded-sm bg-transparent border border-primary-inverse hover:text-gray-500`.
  - **Text links:** `text-body-3 font-medium` with a hover-revealed "→" arrow that slides in (`opacity-0 -translate-x-1` → `opacity-100 translate-x-0`).
  - **Carousel arrows:** 48px (72px at md) circles, `border border-gray-50-ivory/30 bg-gray-50-ivory/15 backdrop-blur-[15px]`.

  Source: [harvey.ai](https://www.harvey.ai)
- [CSS] Header/nav:
  - `<header class="fixed top-0 inset-x-0 z-header" data-theme="white">`
  - A blur layer `bg-nav-blur-tint backdrop-blur-[16px]`, which is ivory at 72% alpha on light sections.
  - Inner bar: `max-w-[1920px] mx-auto h-[72px] (--base-header-height:4.5rem) px-7 md:px-8 lg:px-9 xl:px-10 flex items-center justify-between`.
  - Left: the serif text wordmark at `text-xl` (28px).
  - Center: nav absolutely centered (`lg:absolute lg:left-1/2 lg:-translate-x-1/2`). Items are 14px/500 with a 1px inverse underline indicator.
  - Right: outline "Login" and an ink "Request a Demo" (`h-8`).
  - Above the header sits an optional black announcement banner (`--base-header-banner-height: 2.75rem` = 44px, 14px text, marquee on mobile).
  - Mega-menu dropdown items: title `text-body-3 font-medium` + "→", description `text-body-3 text-header-subtext` (secondary color).

  Source: [harvey.ai](https://www.harvey.ai)
- [CSS] Footer:
  - `<footer data-theme="black" class="bg-primary">` → `max-w-page-width mx-auto py-lg px-7…xl:px-10`.
  - Row 1: H3 "Unlock Professional Class AI for Your Organization" (serif) plus an ivory "Request a Demo" button, separated by `border-b border-primary` (#33312c) with `pb-lg`.
  - Row 2: logo and copyright on the left ("Copyright © 2026 Harvey AI Corporation…", 14px muted, `max-w-[224px]`). On the right, a nav `grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-sm` with column headings Platform / Solutions / Company / Resources / Follow (`text-body-3 font-medium text-gray-500`). Links are 14px/500, ivory, with `hover:text-secondary` and the arrow reveal.

  Source: [harvey.ai](https://www.harvey.ai)
- [CSS] Homepage section sequence:
  1. Headline hero: H1 at left (5 of 12 cols) plus a 20px secondary lead
  2. Customer logo grid: "3,000+ Legal Organizations Build on Harvey", heading-3 centered
  3. Audience router: "For Law Firms" / "For In-House" cards with heading-3 and body-2
  4. Centered media hero: full-bleed product video/image up to 1648px
  5. Product tabs: Agents / Spaces / Vault / Contract Intelligence / Command Center / Research. Active tab is `text-primary`, inactive `text-muted`, at body-0 (24px)/500.
  6. Quote carousel on gray
  7. Case-study carousel on black: serif white heading-3 over imagery
  8. Stats on black: label at body-1 plus a huge heading-1 number, in rows divided by borders
  9. Security link grid
  10. Footer

  Source: [harvey.ai](https://www.harvey.ai)
- [CSS] Tables: `--table-border-color: var(--border-secondary)`. Forms: inputs 48px tall, 4px radius, 1px `#adaba5` border, hover border ink, 16px text; form bg ivory. — [harvey.ai](https://www.harvey.ai)

### Inferences
- Cards on the marketing site are mostly **borderless image tiles with text below**, or simple **1px hairline-divided rows**. There are no elevated white cards with shadows. Image tiles have small radii [EST: about 8px, `rounded-lg`, per the 1350×1012 tile assets that show rounded corners].
- To reproduce the feel:
  - Use extreme scale contrast (96px serif vs. 14–20px sans).
  - Keep 112–140px vertical rhythm between sections.
  - Alternate ivory, gray and ink bands.
  - Use 1px warm-gray dividers and 4px-radius rectangular buttons.

### Gaps
- Exact card radius and padding values for each section component were not individually extracted.

---

## 5. Framework and tooling

### Takeaway
The marketing site is **Next.js (App Router, Turbopack-style hashed `/_next/static/immutable/` chunks) + Tailwind CSS v4 + Sanity CMS**. It uses Radix-style primitives (`data-state` / `data-radix` attributes present), Embla carousel, Mux video, KaTeX and Marketo forms. It is not Webflow or Framer.

### Cited Findings
- [CSS] Evidence in the HTML/CSS:
  - **Next.js:** `_next` paths, `next/font` metric-fallback faces, and a `BAILOUT_TO_CLIENT_SIDE_RENDERING` template.
  - **Tailwind v4:** `@layer properties`, `--tw-*` variables, `--spacing` multiplier utilities like `calc(var(--spacing)*7)`, `--text-*--line-height` tokens, and the `lightningcss` light/dark markers.
  - **Sanity:** images from `cdn.sanity.io/images/07s0r5r6/production/…`.
  - **Other markers:** the strings `data-radix`, `embla` and `mux` appear in the page. Marketo `mktoForm` styles, nprogress, Transcend consent (`transcend-cdn.com/airgap.js`) and GTM are also present.
  - **Generator:** no `<meta name="generator">`; "webflow" and "framer" are absent.

  Source: [harvey.ai](https://www.harvey.ai)

### Inferences
- Harvey's token system maps cleanly onto a Tailwind v4 `@theme` block in a React/Vite or Next app. Radix UI or shadcn/ui primitives, restyled with these tokens, are a faithful component base.

### Gaps
- The product app's stack (app.harvey.ai) is not publicly inspectable.

---

## 6. Product UI (Assistant / Vault) layout patterns

### Takeaway
Public product screenshots show a **light, ivory/white, near-monochrome three-pane app**:
1. A narrow icon-only left rail
2. A centered chat column with a bottom floating composer
3. A collapsible right "Progress / Context / Properties" panel

Vault is a project page with a centered prompt composer above a hairline-divided files table. Everything uses neutral grays, ink primary buttons, 1px borders, small radii and no heavy shadows.

### Cited Findings
- [EST, from the official marketing screenshot on /platform/assistant, alt "AI chat messages discussing a DRL with a checklist of tasks and Word documents…"] **Assistant view:**
  - **Left rail:** about 44px wide, icon-only (new +, agents, folders, tables, library, history, copy). A black square "H" logo sits at the top.
  - **Top bar:** "← Response to DRL" (14px medium) plus a muted "Set client matter". "Share" and a panel-toggle button on the right.
  - **Messages:** user messages are right-aligned light-gray rounded bubbles (about 12px radius, background ≈ #f2f1f0). Assistant replies are plain unboxed text in a ~480px-wide centered column, 14px sans with about 1.5 line-height.
  - **Composer:** pinned at the bottom, about 500px wide, rounded ~12px, light-gray fill, 1px border, placeholder "Ask Harvey anything…". Icons: "+" (left), settings/mic (right), and a square gray/ink send button with "→".
  - **Right panel (about 240px, 1px left border):** collapsible sections each headed by a 14px medium title with a chevron.
    - "Progress" (4 of 4 steps): checklist with strikethrough completed steps in muted gray.
    - "Context": segmented control Outputs | Sources, with the active pill white on a gray track. A file list with .docx icons, then two outline buttons "Add to Vault" and "Download".
    - "Properties": key–value rows (Agent: Harvey; Knowledge: iManage / EDGAR chips; Model: …).

  Source: [harvey.ai/platform/assistant](https://www.harvey.ai/platform/assistant)
- [EST, from the "Vault Hero" image on /platform/vault] **Vault project view:**
  - **Header:** "← Project Acme Virtual Data Room" with a muted "345 files". Outline buttons "Queries" and "Share" (about 6–8px radius, 1px border) on the right.
  - **Above the composer:** centered pill-ish outline actions "Review table" and "Draft document". Dropdowns "Matters ▾" and "Prompts ▾".
  - **Composer:** a large rounded (~12px) light-gray card. Folder chip "Material Contracts" on top, prompt text at about 16px. A footer row with "Files / Sources / Improve" text-icon buttons and a black square send button.
  - **Suggestion chips:** "Analyze change of control", "Loan portfolio review", "··· View all".
  - **Files table:** "Files" title. Toolbar with "Last synced 1 min ago", a "Refresh" outline button, a search input and "Filters". Columns Name / Category / Type / Last modified / Size. Rows are about 45px tall, separated by 1px hairlines with no zebra striping. Category is shown as small outline chips with a colored dot (red "Financial Statement", amber "Corporate Governance").

  Source: [harvey.ai/platform/vault](https://www.harvey.ai/platform/vault)
- [3P, official release notes] Documented product UI features:
  - Collapsible Vault sidebar
  - Global search button in the left sidebar (threads, projects, workflows)
  - Admin notices in the left sidebar
  - Assist mode redesigned to a "cleaner chat-style layout, visible thinking states, and follow-up suggestions that persist in the thread"
  - "Featured knowledge sources" in the Assistant composer

  Source: [Harvey blog: The Brief, May 2025](https://www.harvey.ai/blog/the-brief-may-2025)
- [3P] Vault Review tables support:
  - per-cell edit/verify with activity tracking
  - row assignment
  - red flag markers on cells
  - a slideout status panel (assigned/verified/flagged counts)
  - filters for (un)verified/(un)flagged/(un)assigned
  - citation columns in exports

  Source: [Harvey Release Notes](https://help.harvey.ai/release-notes/page/3) and [Vault release notes](https://help.harvey.ai/release-notes/category/vault/page/2)
- [3P] July 15, 2026 release: Assistant now plans multi-step requests, checks in at decision points, and tracks multiple tasks in parallel. This matches the "Progress" checklist panel. — [Harvey Release Notes](https://help.harvey.ai/release-notes/page/3)

### Inferences
- A simple React clone of the product should have:
  - an icon rail (44–56px)
  - a main column with max-width ~720px, centered
  - a sticky bottom composer card (12px radius, `#f2f1f0`-ish fill, 1px `#e5e5e3` border, ink 32px square send button with 6px radius)
  - a right inspector (~280px) with collapsible sections
- Assistant answers render as plain document-like text, not bubbles. Only user turns get bubbles.
- Product UI typography appears to be all-sans (no serif) at 13–16px. The serif is reserved for marketing and brand moments.
- Marketing presents product UI inside a rounded "device frame" (about 12px radius, thin dark bezel) floating on grainy, painterly colored backgrounds (bronze, casal, velvet).

### Gaps
- Real in-app CSS tokens (exact app hex values, radii, font) are not publicly available. All product-UI values above are visual estimates from marketing renders, which may be idealized.
- I found no public dark-mode screenshots of the app.

---

### Quick-start token block for a React clone (derived from the [CSS] findings above; fonts substituted)

```css
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500&display=swap');
:root{
  --font-serif:"Instrument Serif", Georgia, serif;           /* sub for HarveySerifFont */
  --font-sans:"Inter", -apple-system, "Segoe UI", sans-serif; /* sub for ABC Diatype */
  --ink:#0f0e0d; --g900:#1f1d1a; --g800:#33312c; --g700:#524f49; --g600:#706d66;
  --g500:#8f8b85; --g400:#adaba5; --g300:#cccac6; --g200:#e5e5e3; --g100:#f2f1f0; --ivory:#fafaf9;
  --bg:var(--ivory); --bg-2:var(--g100); --text:var(--ink); --text-2:var(--g800); --muted:var(--g600);
  --border:var(--g300); --border-2:var(--g200);
  --space-xs:7px; --space-sm:14px; --space-md:28px; --space-lg:56px; --space-xl:112px; --space-2xl:140px;
  --radius-sm:4px; --radius-md:6px; --radius-lg:8px; --radius-xl:12px;
  --header-h:72px; --page-max:1728px;
  --ease-soft:cubic-bezier(.3,.3,.3,1);
}
[data-theme=black]{--bg:var(--ink);--bg-2:var(--g900);--text:var(--ivory);--text-2:var(--g300);--muted:var(--g500);--border:var(--g800);--border-2:var(--g700)}
[data-theme=gray]{--bg:var(--g100);--bg-2:var(--g200);--muted:var(--g700)}
h1,.h1{font:400 clamp(48px,6vw,96px)/1.05 var(--font-serif);letter-spacing:-.0125em;text-wrap:balance}
h2,.h2{font:400 clamp(36px,4vw,64px)/1.05 var(--font-serif);letter-spacing:-.01em}
h3,.h3{font:400 clamp(28px,2.4vw,40px)/1.05 var(--font-serif);letter-spacing:-.01em}
.body-0{font:400 24px/1.3 var(--font-sans)} .body-1{font:400 20px/1.3 var(--font-sans)}
.body-2{font:400 16px/1.3 var(--font-sans)} .body-3{font:400 14px/1.3 var(--font-sans)}
.btn{height:48px;padding:0 20px;border-radius:4px;background:var(--text);color:var(--bg);font:500 16px/1 var(--font-sans);transition:background-color .3s var(--ease-soft)}
.btn:hover{background:var(--g800)}
.container{max-width:var(--page-max);margin:0 auto;padding:0 28px} @media(min-width:1025px){.container{padding:0 36px}} @media(min-width:1445px){.container{padding:0 40px}}
```
(The `clamp()` values approximate Harvey's stepped breakpoints at 1025/1445/1730. The breakpoint-to-padding mapping in `.container` is inferred.)
