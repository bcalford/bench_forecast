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
  bench-green-deep: "#16302a"
  bench-green-idle: "#6f7f78"
  selection-wash: "#cfe0d5"
  field-line: "#7f8580"
  placeholder: "#6b7175"
  field-white: "#ffffff"
  tip-muted: "#b9bdc0"
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
  headline-reader:
    fontFamily: "Public Sans Variable, Public Sans, system-ui, sans-serif"
    fontSize: "clamp(2rem, 4vw, 3rem)"
    fontWeight: 650
    lineHeight: 1.05
  record:
    fontFamily: "Public Sans Variable, Public Sans, system-ui, sans-serif"
    fontSize: "clamp(1.1rem, 2vw, 1.35rem)"
    fontWeight: 500
    letterSpacing: "-0.01em"
  section:
    fontFamily: "Public Sans Variable, Public Sans, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 650
  lede:
    fontFamily: "Public Sans Variable, Public Sans, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 400
    lineHeight: 1.5
  reading-compact:
    fontFamily: "Source Serif 4 Variable, Source Serif 4, Georgia, serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.55
  subhead:
    fontFamily: "Public Sans Variable, Public Sans, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 650
  meta:
    fontFamily: "Public Sans Variable, Public Sans, system-ui, sans-serif"
    fontSize: "14.5px"
    fontWeight: 500
  caption:
    fontFamily: "Public Sans Variable, Public Sans, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 500
    fontFeature: "\"tnum\" 1, \"lnum\" 1"
  micro:
    fontFamily: "Public Sans Variable, Public Sans, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    fontFeature: "\"tnum\" 1, \"lnum\" 1"
  code:
    fontFamily: "ui-monospace, monospace"
    fontSize: "0.9em"
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
  segmented-option-light:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.none}"
    padding: "8px 14px"
  segmented-option-light-pressed:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
  button-file:
    backgroundColor: "{colors.bench-green}"
    textColor: "{colors.on-green}"
    rounded: "{rounded.none}"
    padding: "15px 22px"
  button-file-hover:
    backgroundColor: "{colors.bench-green-deep}"
  text-input:
    backgroundColor: "{colors.field-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "11px 12px"
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
- **Bench Green** (`bench-green`): the masthead and the top band of every page; also the browser theme color. It is a field, not an accent: on the light ground it appears only as the fill of a form's one submit button ("File for forecast"), never as a panel or highlight.
- **Bench Green Deep** (`bench-green-deep`): the submit button's hover. **Bench Green Idle** (`bench-green-idle`): the submit button while a filing is in progress.
- **Bench Green Line** (`bench-green-line`): hairlines, borders and the bench rail inside the green field (masthead underline, ghost and segmented borders, specimen card border, bench bar divider).
- **Green Ink** (`green-ink`): the only green allowed on the light ground. Text links, the docket arrow, citation chip text, "Awaiting the Court" status, focus outline, caret.

### Secondary
- **Brass** (`brass`): on the green field only. Opinion-author seat mark, the lock seal border, icon and "Locked" head, and text selection inside the field.
- **Brass Ink** (`brass-ink`): the darker brass used on the light ground, where `brass` would lack contrast: the opinion-author mark in justice rows and the lock icon in the case page's closing strip.

### Neutral
- **On-Green Paper** (`on-green`): primary text and seat marks on the green field; also the solid button fill and the pressed segmented option.
- **On-Green Muted** (`on-green-muted`): secondary text on the green field (docket line, nav at rest, confidence figures, legend, lede).
- **Ground** (`ground`): the reading ground of every page below the band.
- **Ink** (`ink`): body text, seat marks and confidence bars on the ground, and the strong 1px rule under section headings.
- **Ink Muted** (`ink-muted`): secondary text on the ground (roles, definition terms, docket numbers, fine print, inactive table of contents).
- **Rule** (`rule`): hairline row dividers, the confidence-bar track, table-of-contents spine, footer rule.
- **Cite Wash** (`cite-wash`): background of inline citation chips only.
- **Selection Wash** (`selection-wash`): text selection on the light ground (inside the field, selection is brass).
- **Field Line** (`field-line`): the 1px border of text inputs and of the segmented control on the light ground; darker than `rule` so a field reads as a control, not a divider.
- **Placeholder** (`placeholder`): input placeholder text, kept at 4.5:1 on white.
- **Field White** (`field-white`): the fill of text inputs, the one place pure white appears on the ground; also the solid button's hover fill in the field.
- **Tip Muted** (`tip-muted`): secondary text inside the ink calibration tooltip.

### Named Rules
**The Shape Not Hue Rule.** A vote is encoded by seat-mark shape: filled disc = majority, open ring = dissent, inner cut or inner dot = writes separately, half-arc above = confidence. No color, anywhere, distinguishes majority from dissent.

**The One Meaning per Seat Rule.** Every seat state has exactly one shape, and no shape is reused for something else:
- **Filled disc (r20):** voted with the majority. Nothing else is ever drawn filled.
- **Open ring, 3px stroke (r18.5):** voted in dissent.
- **Inner cut / inner dot:** writes separately (cut in a disc, dot in a ring).
- **Hairline ring, 1.5px stroke (r18.5):** a justice with no vote in it; used where the page is about the person, not a vote (scorecard accuracy bench, filing-form bench). The half-arc above it may carry a non-vote measure such as accuracy, and the caption under the name says what it is.
- **Dashed ring (r19, 55% opacity):** still deliberating.
- **Dotted ring with a diagonal strike:** recused; takes no part in the tally.
- **Brass (brass-ink on the ground):** predicted opinion author, on top of the vote shape.
Status that is not a seat (a checklist item done, a passage checked) uses the checkmark, never a seat dot. Right/missed tallies use small filled and hollow tally dots and always carry a Right / Missed key.

**The Two Meanings of Brass Rule.** Brass means "opinion author" or "locked before decision". It is never decoration, never a link color, never a hover state.

**The One Field Rule.** Each page has one green field, at the top. The light ground never hosts a green panel, and the green field never hosts a light card.

## Typography

**Display Font:** Public Sans Variable (with Public Sans, system-ui)
**Body Font:** Public Sans Variable for the frame and UI
**Reading Font:** Source Serif 4 Variable (with Georgia), optical sizing on

**Character:** Public Sans is the civic, plain-spoken frame; heavy semibold (650) headlines with tight negative tracking give it authority without ornament. Source Serif 4 takes over wherever the product is explaining a justice's reasoning, so the shift into serif signals "now you are reading the argument".

### Hierarchy
- **Display** (650, clamp(2.4rem, 5vw, 4.1rem), 1.03, -0.03em, max 13ch, balanced): the home page title on the green field.
- **Headline** (650, clamp(2rem, 4.2vw, 3.4rem), 1.04, -0.025em, max 18ch, balanced): the case title, italic because it is a case name. **Headline Reader** is the slightly smaller step for the reader, scorecard and method titles.
- **Record** (500, fluid 1.1 to 1.35rem): the scorecard's season sentences on the green field.
- **Lede** (400, 19px, 1.5, max 44ch): the home intro under the display title.
- **Outcome** (500, clamp(1.25rem, 2.2vw, 1.6rem), -0.01em): the predicted-outcome sentence under the case title; the tally inside it never wraps.
- **Title** (650, 21px, -0.015em): section headings on the ground, always sitting on a 1px ink rule with 12px below. **Section** (24px) is the reader's per-justice heading (21px under 700px).
- **Subhead** (650, 15px): headings inside a reading column, method step or phase list; also the compact UI size for tallies and controls.
- **Reading** (400 serif, 18px, 1.62, max 68ch, pretty wrap): justice reasoning, holdings, briefing prose. **Reading Compact** (17px) sets it in list rows, definition values, quoted passages, the description textarea and everywhere under 700px; ledger case names use 17px too.
- **Body** (400, 16px, 1.5): UI default; definition values run at 15.5px.
- **Label** (600 to 650, 13.5px): definition terms, seat names, lock-seal head, group labels. Sentence case, no tracking.
- **Meta** (500, 14.5px): nav links, table-of-contents links, ledger scores, checklist lines.
- **Small** (400 to 500, 13 to 14px): meta lines, legend, fine print, footer.
- **Caption** (500 to 650, 12.5px, tabular): seat confidence under the bench, citation chips, ledger column heads, "Required" and "Optional" tags. The smallest size allowed for text a reader must act on.
- **Micro** (500, 11px, tabular): only where space is physically fixed: seat names and figures on phones, calibration chart ticks, split-group labels. Never for sentences.
- **Code** (system monospace at 0.9em): table and field names in the Method page's data model and code blocks. Monospace marks literal code only, never as a "technical" costume.

### Named Rules
**The Tabular Figures Rule.** Every number that can change or be compared (tallies, confidence percents, timestamps, docket numbers) is set with tabular lining figures.

**The Serif Means Reasoning Rule.** Source Serif 4 is used only for explanatory prose (reasoning, holdings, facts). Headings, labels, controls and citation chips stay in Public Sans, even inside serif paragraphs.

**The Italic Case Name Rule.** Case names are italic wherever they appear, in titles and in running text.

## Layout

A single centered column capped at 1200px with a fluid gutter (clamp(16px, 4vw, 40px)). Every page opens with the green field (64px masthead row plus a band, 32 to 64px top padding) and continues on the ground.

- **Case page:** two-column grid on the ground, flexible justice list plus a 340px sticky decision column (top 24px), 72px column gap; the briefing spans both below (Facts and Question presented only, beside a 280px facts column), then the closing strip ends the page.
- **Home:** the band holds a 0.9fr / 1.1fr hero (title and actions left, a live bench specimen right, 64px gap); the first action starts the sample run. The ground carries a docket table (fixed-width grid columns, 18px row padding; rows without a page set their title in ink-muted) and one closing pair of columns, "Made in the open" and "Scored in public", each a ruled heading, a short paragraph and one link, 72px apart.
- **Reader:** a 200px sticky table of contents beside a 68ch article, 72px gap; sections separated by 48px padding, a hairline, and 48px margin.
- **Rhythm:** list rows breathe at 14px vertical padding; sections at 48px; columns at 72px; page bottom at 96px.

Responsive behavior:
- **Under 960px:** all two-column grids collapse to one column; the decision column unsticks and follows the justice list; the reader table of contents becomes a sticky horizontal scroller with an underline indicator, flush to the article (no gap); the docket drops its phase column; the method grid goes to two columns.
- **Under 700px:** the case head stacks and the lock seal slims; the docket line drops the lower-court clause; the bench key folds into a "Key to the marks" disclosure; small inline links and citation chips keep their look but get an invisible hit area padded to 44px; interactive benches run edge to edge so each seat's tap area is about 43px wide; the bench shrinks to 30px marks with three-letter names but keeps confidence figures at 11px; justice rows drop the confidence bar and keep the percent; docket rows reflow to a two-column stack with the phase in the meta line.
- **Scorecard ledger:** column heads (No. · Case · Forecast · Court · Outcome · votes) show on wide screens; under 960px the heads hide and each row carries its own small labels.

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
- **Disabled (in the field):** 40% opacity with a not-allowed cursor, for ghost buttons and unpressed segmented options, so a control that is waiting never reads as live. A pressed option stays at full strength so the current arrangement remains legible.

### Segmented Control
- **Style:** a 1px bench-green-line frame holding flush text options (600, 14px, 8px 14px).
- **State:** rest is on-green-muted text; hover on-green; pressed inverts to an on-green fill with bench-green text.
- **On the light ground:** the frame is `field-line`; rest is ink-muted, hover ink; pressed is ink text at 650 inside a 1px ink hairline frame, never a solid fill. Its keyboard focus ring (2px green-ink, offset 3px) still wins over the pressed frame.

### Inputs / Fields
- **Style:** field-white fill, 1px `field-line` border, square corners, 11px 12px padding, 16px text; placeholder in `placeholder`.
- **Focus:** 2px green-ink outline flush to the box, border turns green-ink.
- **Labels:** 650 at 14px above the field, with a Caption tag beside it ("Required", "Optional", or "Set automatically" for a value the system fills in, shown as plain text rather than an input).
- **Errors:** each message sits under its field with a small filled ink diamond and is tied to the control with `aria-describedby`. A failed submit shows an **error summary** at the top of the form (2px ink rule above, `rule` below, a 650 heading "Fix these N things to file the case", one green-ink link per error that jumps to and focuses its field) and moves focus to it. No color carries the error.
- **Submit:** the one bench-green fill on the ground (650, 16.5px, 15px 22px, trailing arrow); hover bench-green-deep, in-progress bench-green-idle with a progress cursor.

### Cards / Containers
There are no cards. Two framed objects exist, both 1px borders with no fill: the **lock seal** (brass border) and the **home specimen** (bench-green-line border, brightening on hover). Everything else is ruled rows. Two tinted surfaces are allowed on the ground: the citation chip, and the opened brief passage (a light wash under a 1px green-ink top rule).

### Navigation
- **Masthead:** wordmark left; text links right (500 at 14.5px, on-green-muted). Hover goes to on-green; the current page gets on-green text and a 2px on-green underline. "Forecast a case" is framed in a 1px on-green-muted box; when current, the frame brightens and its bottom edge thickens to 2px, never a fill. Under 700px the masthead takes two rows: the wordmark, then the nav with short labels ("Sample", "Forecast"), every link 44px tall.
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
A brass-bordered square frame on the green field: brass lock icon, "Locked" head in brass (700, 13.5px), the timestamp in on-green (600, 15px, tabular), and the phase in on-green-muted. A compact variant (reader header) tightens the padding but keeps all three lines.

### Closing Strip
The case page ends on a ruled strip, never a panel: 1px ink rule above, `rule` below, 22px vertical padding. A 20px lock icon in brass-ink, then the lock restated in Small type ("**Locked [time], [phase].** Awaiting the Court; the forecast is scored against its decision.", the bold part in ink 650), then the page's one closing action as a strong text link to the reader. It appears only once the forecast is locked. Under 960px the link drops below the text.

### Checkmark
A 16px circle (1.3 stroke) with a check (1.5 stroke) drawn inside; empty circle when not yet done. Used for the filing checklist and "Among the passages retrieved" notes. It inherits text color.

### Bench Key
Four items, never more: Majority and Dissent together; the center mark (cut or dot) meaning "writes an opinion"; brass for "Writes for the Court"; arc and percent as "confidence in that justice's vote". The percent is always described as confidence in a vote, never as the chance a side wins.

### Labels
The sample is named two ways only: "Hartwell sample" (to read it) and "Watch … run" (to animate it). The opinion author is always "Writes for the Court". Court terms (certiorari; reverse, affirm, vacate; concurrence; dissent; recused) are glossed in a "What the court terms mean" disclosure beside the case facts.

### Tally Marks
For list rows where seat order is not known: nine 10px marks, majority filled first then dissent rings, 3px apart, in ink.

### Right / Missed Dots
12px dots on the scorecard: filled = called right, hollow = missed. One per case for outcome and author rows; one in each ledger row's score. Any group of them carries a Right / Missed key.

## Do's and Don'ts

### Do:
- **Do** open every page with the green field (masthead plus band) and continue on the ground.
- **Do** encode votes with seat-mark shape only: filled, ring, inner cut, inner dot, brass for author.
- **Do** set every comparable number with tabular lining figures.
- **Do** separate content with 1px hairlines and put a 1px ink rule under each section heading.
- **Do** keep reasoning prose in Source Serif 4 at 17 to 18px, max 68ch.
- **Do** keep corners square; the citation chip's 2px is the only radius.
- **Do** use `brass-ink` instead of `brass` whenever the author mark or the lock sits on the light ground.
- **Do** draw a seat as a hairline ring when the page is about a justice rather than a vote.
- **Do** keep text a reader must act on at 12.5px or larger; 11px is for fixed-space labels only.

### Don't:
- **Don't** color-code majority and dissent, and never use red or blue for justices or blocs.
- **Don't** use brass for anything other than the opinion author and the lock.
- **Don't** add box-shadows, cards, gradients, glows or dark mode.
- **Don't** place green panels on the light ground or light cards inside the green field.
- **Don't** use serif for headings, labels, controls or chips.
- **Don't** draw the confidence gauge as a full ring; it is a half-arc above the mark so it cannot read as a loading spinner.
- **Don't** reuse the filled seat disc for status, presence or "done"; it means majority only.
- **Don't** use monospace except for literal code and field names.
