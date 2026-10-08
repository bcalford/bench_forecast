---
name: Bench Forecast
description: Supreme Court vote forecasts, shown where the justices actually sit.
colors:
  bench-green: "#1f3d34"
  bench-green-line: "#33584c"
  on-green: "#edf0ea"
  on-green-muted: "#b9c4bc"
  brass: "#c9a24c"
  brass-ink: "#7d5f17"
  ground: "#f6f6f4"
  ink: "#1a1c1e"
  ink-muted: "#4b5157"
  rule: "#d8dbd7"
  green-ink: "#2a5547"
  cite-wash: "#e5ebe6"
typography:
  display:
    fontFamily: "Public Sans Variable, Public Sans, system-ui, sans-serif"
    fontSize: "clamp(2.4rem, 5vw, 4.1rem)"
    fontWeight: 650
    lineHeight: 1.03
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Public Sans Variable, Public Sans, system-ui, sans-serif"
    fontSize: "clamp(2rem, 4.2vw, 3.4rem)"
    fontWeight: 650
    lineHeight: 1.04
    letterSpacing: "-0.025em"
  outcome:
    fontFamily: "Public Sans Variable, Public Sans, system-ui, sans-serif"
    fontSize: "clamp(1.25rem, 2.2vw, 1.6rem)"
    fontWeight: 500
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Public Sans Variable, Public Sans, system-ui, sans-serif"
    fontSize: "21px"
    fontWeight: 650
    letterSpacing: "-0.015em"
  reading:
    fontFamily: "Source Serif 4 Variable, Source Serif 4, Georgia, serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.62
  body:
    fontFamily: "Public Sans Variable, Public Sans, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Public Sans Variable, Public Sans, system-ui, sans-serif"
    fontSize: "13.5px"
    fontWeight: 650
    fontFeature: "\"tnum\" 1, \"lnum\" 1"
rounded:
  none: "0px"
  cite: "2px"
spacing:
  hair: "4px"
  xs: "8px"
  row: "14px"
  md: "24px"
  lg: "48px"
  column: "72px"
  section: "96px"
  gutter: "clamp(16px, 4vw, 40px)"
components:
  button-solid:
    backgroundColor: "{colors.on-green}"
    textColor: "{colors.bench-green}"
    rounded: "{rounded.none}"
    padding: "13px 18px"
  button-ghost:
    backgroundColor: "{colors.bench-green}"
    textColor: "{colors.on-green}"
    rounded: "{rounded.none}"
    padding: "8px 14px"
  segmented-option:
    backgroundColor: "{colors.bench-green}"
    textColor: "{colors.on-green-muted}"
    rounded: "{rounded.none}"
    padding: "8px 14px"
  segmented-option-pressed:
    backgroundColor: "{colors.on-green}"
    textColor: "{colors.bench-green}"
  nav-link:
    textColor: "{colors.on-green-muted}"
    padding: "6px 0"
  nav-link-current:
    textColor: "{colors.on-green}"
  text-link:
    textColor: "{colors.green-ink}"
  cite-chip:
    backgroundColor: "{colors.cite-wash}"
    textColor: "{colors.green-ink}"
    rounded: "{rounded.cite}"
    padding: "2px 6px"
  lock-seal:
    backgroundColor: "{colors.bench-green}"
    textColor: "{colors.on-green}"
    rounded: "{rounded.none}"
    padding: "14px 18px 14px 14px"
---

# Design System: Bench Forecast

## Overview

**Creative North Star: "The Bench Seating Chart"**

The vote is shown where the justices actually sit. One deep bench-green field owns the top of every page (masthead plus a band holding the page's headline object), and below it a calm, cool off-white reading ground carries ruled lists and long-form text. The signature object is the bench: nine authored seat marks on a shallow curve in true seating order (Chief center, seniority alternating outward), which can glide into a majority | dissent split.

The register is a court reporter's, not a dashboard's. Structure comes from hairline rules and typographic weight, never from cards, shadows, or fills. Vote meaning is carried by shape, never by hue: the system has exactly one chromatic accent, brass, and it marks only the opinion author and the lock seal. Density is moderate: generous column gaps (72px) and section breaks (88 to 96px), tight 14px row rhythm inside lists.

Confirmed rejections, carried from PRODUCT.md brand commitments: no AI-startup look (dark mode, neon, gradients, sparkle icons), no red/blue partisan coding, no scoreboard or betting-odds feel.

**Key Characteristics:**
- One green field at the top of each page; light reading ground below.
- Shape carries the vote (filled, ring, inner cut, inner dot); color never does.
- Brass is reserved for two meanings: opinion author and the lock.
- Hairline rules as the only structure; square corners throughout.
- Public Sans with tabular figures runs the frame; Source Serif 4 sets reasoning prose.

## Colors

A two-field palette: one deep, slightly cool green and a near-neutral paper, with a single warm metal accent.

### Primary
- **Bench Green** (`bench-green`): the masthead and the top band of every page; also the browser theme color. It is a field, not an accent: it never appears as a button fill or highlight on the light ground.
- **Bench Green Line** (`bench-green-line`): hairlines, borders and the bench rail inside the green field (masthead underline, ghost and segmented borders, specimen card border, bench bar divider).
- **Green Ink** (`green-ink`): the only green allowed on the light ground. Text links, the docket arrow, citation chip text, "Awaiting the Court" status, focus outline, caret.

### Secondary
- **Brass** (`brass`): on the green field only. Opinion-author seat mark, the lock seal border, icon and "Locked" head, and text selection inside the field.
- **Brass Ink** (`brass-ink`): the darker brass used for the opinion-author mark on the light ground (justice list rows), where `brass` would lack contrast.

### Neutral
- **On-Green Paper** (`on-green`): primary text and seat marks on the green field; also the solid button fill and the pressed segmented option.
- **On-Green Muted** (`on-green-muted`): secondary text on the green field (docket line, nav at rest, confidence figures, legend, lede).
- **Ground** (`ground`): the reading ground of every page below the band.
- **Ink** (`ink`): body text, seat marks and confidence bars on the ground, and the strong 1px rule under section headings.
- **Ink Muted** (`ink-muted`): secondary text on the ground (roles, definition terms, docket numbers, fine print, inactive table of contents).
- **Rule** (`rule`): hairline row dividers, the confidence-bar track, table-of-contents spine, footer rule.
- **Cite Wash** (`cite-wash`): background of inline citation chips only.

### Named Rules
**The Shape Not Hue Rule.** A vote is encoded by seat-mark shape: filled disc = majority, open ring = dissent, inner cut or inner dot = writes separately, half-arc above = confidence. No color, anywhere, distinguishes majority from dissent.

**The Two Meanings of Brass Rule.** Brass means "opinion author" or "locked before decision". It is never decoration, never a link color, never a hover state.

**The One Field Rule.** Each page has one green field, at the top. The light ground never hosts a green panel, and the green field never hosts a light card.

## Typography

**Display Font:** Public Sans Variable (with Public Sans, system-ui)
**Body Font:** Public Sans Variable for the frame and UI
**Reading Font:** Source Serif 4 Variable (with Georgia), optical sizing on

**Character:** Public Sans is the civic, plain-spoken frame; heavy semibold (650) headlines with tight negative tracking give it authority without ornament. Source Serif 4 takes over wherever the product is explaining a justice's reasoning, so the shift into serif signals "now you are reading the argument".

### Hierarchy
- **Display** (650, clamp(2.4rem, 5vw, 4.1rem), 1.03, -0.03em, max 13ch, balanced): the home page title on the green field.
- **Headline** (650, clamp(2rem, 4.2vw, 3.4rem), 1.04, -0.025em, max 18ch, balanced): the case title, italic because it is a case name. The reader title uses a slightly smaller step (clamp(2rem, 4vw, 3rem), 1.05).
- **Outcome** (500, clamp(1.25rem, 2.2vw, 1.6rem), -0.01em): the predicted-outcome sentence under the case title; the tally inside it never wraps.
- **Title** (650, 21px, -0.015em): section headings on the ground, always sitting on a 1px ink rule with 12px below. Reader section headings step up to 24px (21px under 700px).
- **Subhead** (650, 15 to 16px): headings inside a reading column or method step.
- **Reading** (400 serif, 18px, 1.62, max 68ch, pretty wrap): justice reasoning, holdings, briefing prose. Drops to 17px in list rows, definition values and under 700px.
- **Body** (400, 16px, 1.5): UI default; definition values run at 15.5px.
- **Label** (600 to 650, 13.5px): definition terms, seat names, lock-seal head, group labels. Sentence case, no tracking.
- **Small** (400 to 500, 13 to 14.5px): meta lines, nav, legend, fine print, footer.

### Named Rules
**The Tabular Figures Rule.** Every number that can change or be compared (tallies, confidence percents, timestamps, docket numbers) is set with tabular lining figures.

**The Serif Means Reasoning Rule.** Source Serif 4 is used only for explanatory prose (reasoning, holdings, facts). Headings, labels, controls and citation chips stay in Public Sans, even inside serif paragraphs.

**The Italic Case Name Rule.** Case names are italic wherever they appear, in titles and in running text.

## Layout

A single centered column capped at 1200px with a fluid gutter (clamp(16px, 4vw, 40px)). Every page opens with the green field (64px masthead row plus a band, 32 to 64px top padding) and continues on the ground.

- **Case page:** two-column grid on the ground, flexible justice list plus a 340px sticky decision column (top 24px), 72px column gap; the briefing spans both below, itself a flexible prose column plus a 280px facts column.
- **Home:** the band holds a 0.9fr / 1.1fr hero (title and actions left, a live bench specimen right, 64px gap). The ground carries a docket table (fixed-width grid columns, 18px row padding), a five-step method grid, and a scorecard section, separated by 72 to 88px.
- **Reader:** a 200px sticky table of contents beside a 68ch article, 72px gap; sections separated by 48px padding, a hairline, and 48px margin.
- **Rhythm:** list rows breathe at 14px vertical padding; sections at 48px; columns at 72px; page bottom at 96px.

Responsive behavior:
- **Under 960px:** all two-column grids collapse to one column; the decision column unsticks and follows the justice list; the reader table of contents becomes a sticky horizontal scroller with an underline indicator, flush to the article (no gap); the docket drops its phase column; the method grid goes to two columns.
- **Under 700px:** the case head stacks; the bench shrinks to 30px marks with three-letter names and hides confidence figures; justice rows drop the confidence bar; docket rows reflow to a two-column stack; nav hides "Forecasts" since the wordmark links home.

## Elevation & Depth

The system is flat. There are no box-shadows anywhere. Depth is conveyed by the two-field split (green above, ground below), by hairline rules, and by one motion cue: a seat lifts 4px when hovered or selected. The reader table of contents, when sticky on small screens, sits on an opaque ground with a bottom rule rather than a shadow.

### Named Rules
**The Hairline Only Rule.** Structure is 1px rules: `rule` between rows, `ink` under section headings, `bench-green-line` inside the field. No cards, no shadows, no filled panels as containers.

**The Lift Not Shadow Rule.** The only elevation cue is translation: a seat mark moves up 4px on hover or selection. Nothing casts a shadow.

## Shapes

Square-cornered everywhere: buttons, segmented controls, the lock seal, the home specimen frame and the table of contents have 0px radius. The single exception is the inline citation chip (2px), softened so it reads as a tag inside serif prose rather than a box.

The recurring silhouettes are circles and a shallow parabola: seat marks are circles on a 64px grid (disc r20, ring r18.5), the confidence gauge is a half-arc above each mark, the bench rail is a 10px round-capped curve, and the wordmark is nine dots on the same curve. The authored icon set (lock, arrows, chevron, replay) is drawn on a 20px grid with 1.5 stroke and round joins.

## Components

### Buttons
Plain, rectangular, and quiet; they live on the green field.
- **Shape:** square corners (0px).
- **Solid:** on-green fill with bench-green text, 650 weight at 15.5px, 13px 18px padding, trailing arrow icon. Hover brightens the fill to white and nudges the arrow 3px right (0.2s).
- **Ghost:** transparent with a 1px bench-green-line border, on-green text, 600 at 14px, 8px 14px padding, leading icon. Hover raises the border to on-green-muted. Disabled shows muted text and a progress cursor.
- **Focus:** 2px outline offset 3px; green-ink on the ground, on-green inside the field.

### Segmented Control
- **Style:** a 1px bench-green-line frame holding flush text options (600, 14px, 8px 14px).
- **State:** rest is on-green-muted text; hover on-green; pressed inverts to an on-green fill with bench-green text.

### Cards / Containers
There are no cards. Two framed objects exist, both 1px borders with no fill: the **lock seal** (brass border) and the **home specimen** (bench-green-line border, brightening on hover). Everything else is ruled rows.

### Navigation
- **Masthead:** wordmark (nine-dot curve plus "Bench Forecast", 700 at 17px) left; text links right (500 at 14.5px, on-green-muted). Hover goes to on-green; the current page gets on-green text and a 2px on-green underline.
- **Reader table of contents:** a 1px rule spine with 14.5px links; current section is ink, 650, with a 1px ink segment on the spine. Under 960px it becomes a horizontal sticky strip with a 2px underline on the current item.
- **Text links:** green-ink, 600, no underline at rest, underline on hover, trailing arrow that nudges 3px.

### Justice Row
- **Style:** a full-width disclosure row: 36px seat mark, name (600, 16px) over role (ink-muted, 14px), vote, a 3px confidence bar (ink on rule track) with percent, and a chevron that rotates 180° when open (0.25s). Rows are separated by `rule` hairlines.
- **Open:** the body indents 52px to align with the name and sets the reasoning in serif at 17px, followed by a text link to full reasoning.

### Citation Chip
Inline in serif prose: Public Sans 650 at 12.5px, green-ink on cite-wash, 2px 6px padding, 2px radius, never wraps.

### The Bench (signature)
Nine seat marks on a 10px bench-green-line rail, positioned by percent along a parabola. Under each: last name (600, 13.5px) and confidence (12.5px, tabular). The selected seat gets a 2px on-green underline under its name and the 4px lift. Switching "As seated" to "By vote" glides seats to two groups (0.75s, ease-out cubic-bezier(0.22, 1, 0.36, 1)) while the rail fades out and group labels ("Majority 6", "Dissent 3") fade in. "Replay the run" resets seats to dashed pending circles and snaps each in (scale 0.8 to 1, 0.34s, cubic-bezier(0.16, 1, 0.3, 1)) as its agent returns. All motion collapses under reduced-motion.

### Lock Seal
A brass-bordered square frame on the green field: brass lock icon, "Locked" head in brass (700, 13.5px), the timestamp in on-green (600, 15px, tabular), and the phase in on-green-muted. A compact variant drops the phase.

### Tally Marks
For list rows where seat order is not known: nine 10px marks, majority filled first then dissent rings, 3px apart, in ink.

## Do's and Don'ts

### Do:
- **Do** open every page with the green field (masthead plus band) and continue on the ground.
- **Do** encode votes with seat-mark shape only: filled, ring, inner cut, inner dot, brass for author.
- **Do** set every comparable number with tabular lining figures.
- **Do** separate content with 1px hairlines and put a 1px ink rule under each section heading.
- **Do** keep reasoning prose in Source Serif 4 at 17 to 18px, max 68ch.
- **Do** keep corners square; the citation chip's 2px is the only radius.
- **Do** use `brass-ink` instead of `brass` whenever the author mark sits on the light ground.

### Don't:
- **Don't** color-code majority and dissent, and never use red or blue for justices or blocs.
- **Don't** use brass for anything other than the opinion author and the lock.
- **Don't** add box-shadows, cards, gradients, glows or dark mode.
- **Don't** place green panels on the light ground or light cards inside the green field.
- **Don't** use serif for headings, labels, controls or chips.
- **Don't** draw the confidence gauge as a full ring; it is a half-arc above the mark so it cannot read as a loading spinner.
