# CourtListener unified single-page opinion view (2025 redesign): implementation spec

Researched 2026-10-08 against `freelawproject/courtlistener` `main` (latest commit touching `opinions.css`: 2026-04-28). Labels used below:
- **[SRC]**: value quoted from the repo source.
- **[DERIVED]**: computed from source values (for example, em × parent px, or Bootstrap grid math).
- **[EST]**: estimate or inference; not verified.

Live pages could not be fetched. `courtlistener.com/opinion/...` returns an **AWS WAF JavaScript challenge** (HTTP 202, about 2 KB) to non-browser clients. The REST API (`/api/rest/v4/clusters/{id}/`) returns 401 without a token. All rendered-markup claims below therefore come from templates, JS and Python source, not from a live DOM.

Primary source files (all on `main`):
- Page template: https://github.com/freelawproject/courtlistener/blob/main/cl/opinion_page/templates/opinions.html
- Tab nav: https://github.com/freelawproject/courtlistener/blob/main/cl/opinion_page/templates/includes/opinion_tabs.html
- Opinion body / tabs content: https://github.com/freelawproject/courtlistener/blob/main/cl/opinion_page/templates/includes/opinion_tabs_content.html
- Page CSS: https://github.com/freelawproject/courtlistener/blob/main/cl/assets/static-global/css/opinions.css
- Page JS: https://github.com/freelawproject/courtlistener/blob/main/cl/assets/static-global/js/opinions.js
- Global CSS: https://github.com/freelawproject/courtlistener/blob/main/cl/assets/static-global/css/override.css
- Bootstrap (vendored, customized): https://github.com/freelawproject/courtlistener/blob/main/cl/assets/static-global/css/bootstrap/3.3.0/bootstrap.css
- Base layout: https://github.com/freelawproject/courtlistener/blob/main/cl/assets/templates/base.html
- Citation annotation: https://github.com/freelawproject/courtlistener/blob/main/cl/citations/annotate_citations.py
- New v2 design tokens, not used by the opinion page: https://github.com/freelawproject/courtlistener/blob/main/cl/assets/tailwind/tailwind.config.js, `input.css`, `fonts.css`

---

## Page structure, grid, TOC, page numbers, footnotes, citations (layout + markup)

### Takeaway
The 2025 "unified opinion view" is **not** a Tailwind page. It is a Django template on **Bootstrap 3.3.0 (customized) + jQuery + htmx**, plus one small page stylesheet, `opinions.css`, scoped under `body.opinion-body`. The layout is a Bootstrap `container` holding two columns:
- Left: a sticky `col-sm-3` sidebar with a "Jump To" TOC.
- Right: a `col-sm-9` main column with a grey caption box (date pill, action buttons, large case name, court, metadata list), a justified tab bar, then every section in one continuous `<article>`. Each section is an `h2`/`h3` title followed by a 2px black rule.

Page numbers are injected by JS as `<a class="page-label">` whose `::after` floats the number into the margin. Footnotes are normalized by JS into `<footnote>` elements with two-way `#fnN` / `#fnrefN` links.

### Cited Findings

**Overall layout / grid**
- `opinions.html` extends `base.html`. It fills `{% block sidebar %}` with `<div class="col-sm-3 opinion-sidebar hidden-print" id="sidebar">` and `{% block content %}` with `<div class="col-sm-9 main-document">`. It sets `{% block body-classes %}opinion-body{% endblock %}`. [SRC] — [opinions.html](https://github.com/freelawproject/courtlistener/blob/main/cl/opinion_page/templates/opinions.html)
- The base page wraps everything in `<div class="container round-bottom">`. Inside are a navbar (`.navbar-brand` height 140px, logo `.cl-full-logo` height 115px), a sub-nav, then the sidebar and content blocks. [SRC] — [base.html](https://github.com/freelawproject/courtlistener/blob/main/cl/assets/templates/base.html), [override.css](https://github.com/freelawproject/courtlistener/blob/main/cl/assets/static-global/css/override.css)
- Container widths: 750px at ≥768px, 970px at ≥992px, 1170px at ≥1200px. Container padding is 15px left and right. [SRC] — [bootstrap.css](https://github.com/freelawproject/courtlistener/blob/main/cl/assets/static-global/css/bootstrap/3.3.0/bootstrap.css)
- The page sits on a grey canvas: `body { background-color: #E9E8E8 }`. The `.container` is white with `border-left/right/bottom: 1px solid #c2c2c2`, so the page looks like a white sheet on grey. [SRC] — [override.css](https://github.com/freelawproject/courtlistener/blob/main/cl/assets/static-global/css/override.css)
- At the 1170px container, the sidebar column is 292.5px and the main column is 877.5px, each with 15px gutters. The usable main text width is therefore about 847px. [DERIVED from Bootstrap grid: 25% / 75%]
- `.opinion-body header { margin-bottom: 0 }` removes the global 30px header gap, so the caption box sits flush under the nav. `.main-document { padding-bottom: 5em }`. [SRC] — [opinions.css](https://github.com/freelawproject/courtlistener/blob/main/cl/assets/static-global/css/opinions.css)

**Sticky sidebar / TOC ("Jump To")**
- At `min-width: 767px` the `#sidebar` has:
  - `display:flex; flex-direction:column; justify-content:space-between`
  - `height:100vh; padding:20px; padding-top:3px; overflow-y:auto`
  - `position:sticky; top:0`

  A `.sidebar-bottom { margin-top:auto }` area holds the donate or "Sponsored by" block, centered, `margin-bottom:20px`. [SRC] — [opinions.css](https://github.com/freelawproject/courtlistener/blob/main/cl/assets/static-global/css/opinions.css)
- JS adjusts the sidebar height so it does not overlap the 175px header. Above 767px: `height: calc(100vh - (175 - scrollTop)px)` while `scrollTop <= 175`, otherwise `100vh`. On mobile: `auto`. [SRC] — [opinions.js](https://github.com/freelawproject/courtlistener/blob/main/cl/assets/static-global/js/opinions.js)
- The TOC markup is `<div id="opinion-toc" class="sidebar-section"><h3><span>Jump To</span></h3>`, followed by `<li class="jump-links"><a id="nav_top" href="#">Top</a></li>` entries. The entries, in order:
  - Top, then Caption (`#caption`).
  - Then **either** Headmatter (`#o`, when Harvard headmatter exists) **or** whichever of these the case has: Correction, Attorneys, Headnotes, Syllabus, Summary, History, Disposition.
  - Then one `li.jump-links.sub-opinion` per opinion (`#o1`, `#o2`, …). Its label is the type plus author, e.g. "Lead Opinion by Roberts", "Concurrence by …", "Dissent by …".

  [SRC] — [opinions.html](https://github.com/freelawproject/courtlistener/blob/main/cl/opinion_page/templates/opinions.html)
- TOC styling:
  - `.sidebar-section { margin-bottom:3em }`. `.sidebar-section h3 { margin-top:0; margin-bottom:.6em; border-bottom:1px solid #ddd }`. `h3 > span { padding:.5em 0 .1em; line-height:1.4em }`. [SRC] — [override.css](https://github.com/freelawproject/courtlistener/blob/main/cl/assets/static-global/css/override.css)
  - `.jump-links { font-size:12px; padding-top:5px }`.
  - `li.jump-links { height:2.5em; list-style:none; padding-left:0; position:relative }`.
  - Track: `li.jump-links::before { content:""; border-left:2px solid lightgrey; height:100%; position:absolute; left:0; top:0 }`.
  - Links: `li.jump-links > a { padding-left:10px; color:black }`. Active link: `font-weight:500; color:black`.
  - Active item: `li.jump-links.active { color:#B53C2C; font-weight:bold }`, and its `::before` becomes `border-left:2px solid #B53C2C`.
  - The result is a continuous vertical grey rail with a maroon segment for the current section.

  [SRC] — [opinions.css](https://github.com/freelawproject/courtlistener/blob/main/cl/assets/static-global/css/opinions.css)
- Scrollspy: on scroll, the JS walks `.jump-link` headings. The current section is the last one where `scrollY >= offsetTop - offsetHeight/3`. It then moves the `active` class to the matching `nav_<id>` link and its `li`. `html { scroll-behavior:smooth }`. [SRC] — [opinions.js](https://github.com/freelawproject/courtlistener/blob/main/cl/assets/static-global/js/opinions.js), [opinions.css](https://github.com/freelawproject/courtlistener/blob/main/cl/assets/static-global/css/opinions.css)

**Metadata header ("caption square")**
- `#caption-square { background-color: whitesmoke /* #F5F5F5 */; margin: -20px -15px 0 -15px }`. This bleeds the grey box to the column edges. [SRC] — [opinions.css](https://github.com/freelawproject/courtlistener/blob/main/cl/assets/static-global/css/opinions.css)
- `#opinion-caption { margin-top:20px; margin-bottom:20px; padding:10px 10px 0 20px; font-size:15px; letter-spacing:.2px; line-height:2.3em }`. [SRC] — same file
- Top row: `<div class="flex justify-content-between top-row">` (`.top-row { height:32px; line-height:28px }`). It holds:
  - A date pill, `<span class="case-date-new">` (`border:1px solid #B53C2C; color:#B53C2C; padding:0 10px; border-radius:20px`).
  - Action buttons in `.action-buttons { display:flex; column-gap:5px }`: "Get Citation Alerts" (bell icon, split dropdown), Download, "Add Note".

  [SRC] — [opinions.html](https://github.com/freelawproject/courtlistener/blob/main/cl/opinion_page/templates/opinions.html), [opinions.css](https://github.com/freelawproject/courtlistener/blob/main/cl/assets/static-global/css/opinions.css)
- Case name: `<h1 class="case-caption jump-link select-all" id="caption">` with `.case-caption { font-size:3em; font-weight:500; line-height:1.1em; margin-top:50px; text-align:left }`. Court: `<h4 class="case-court">` with `font-size:25px`. [SRC] — same files
  - 3em × the 15px parent = **45px** case name, line-height about 49.5px. [DERIVED]
- Metadata list: `<div class="case-details"><ul class="list-unstyled">`, where each row is `<li><strong>Label:</strong> value</li>`.
  - Rows: Citations (comma-separated `span.select-all`), Docket Number, Precedential Status (shown only if not "Precedential"), Supreme Court DB ID (SCOTUS, links to scdb.wustl.edu), Panel, Judges, Author, Joined By, Nature of Suit, Posture, Other Dates, Disposition.
  - `.case-details { font-size:16px; letter-spacing:.2px; line-height:2.3em }`. Note that a later rule `.case-details li { line-height:1.5em }` exists too.

  [SRC] — same files
- Tab bar: below the metadata is `<ul class="nav nav-tabs hidden-print nav-justified">` with tabs Opinion | Authorities (n) | Cited By (n) | Summaries (n) | Similar Cases (n) | PDF.
  - The counts are lazy-loaded: `hx-get="update_opinion_tabs" hx-trigger="load" hx-swap="outerHTML"`.
  - Tabs have `background:#e7e7e7` and top radii of 5px. The active tab is `#ffffff` with a white bottom border, which joins it to the white content below.
  - Below 991px the tabs stack, full width, `margin-bottom:5px`.

  [SRC] — [opinion_tabs.html](https://github.com/freelawproject/courtlistener/blob/main/cl/opinion_page/templates/includes/opinion_tabs.html), [opinions.html](https://github.com/freelawproject/courtlistener/blob/main/cl/opinion_page/templates/opinions.html), [opinions.css](https://github.com/freelawproject/courtlistener/blob/main/cl/assets/static-global/css/opinions.css)

**Continuous body: summaries → majority → concurrence → dissent**
- The "Opinion" tab renders one `<div class="tab-pane fade in active" id="opinion"><article>` containing, in order:
  1. Either `<h2 class="opinion-section-title jump-link" id="o">Headmatter</h2><hr class="hr-opinion"><div class="serif-text harvard" id="headmatter">`, or separate h2 sections (Correction, Attorneys, Headnotes, Syllabus, Summary, History, Disposition), each with the same `h2 + hr.hr-opinion + div.serif-text.harvard` pattern.
  2. A loop over `cluster.ordered_opinions`. Each opinion renders `<h3 class="opinion-section-title jump-link" id="o{n}">{Type} by <a href=judge>{Name}</a></h3><hr class="hr-opinion">`, then a source wrapper `div#harvard-text | #columbia-text | #lawbox-text | #resource-org-text | #default-text` with `.v-offset-above-2`, then `<div class="subopinion-content"><div class="serif-text harvard">…html_with_citations…</div>`.

  [SRC] — [opinion_tabs_content.html](https://github.com/freelawproject/courtlistener/blob/main/cl/opinion_page/templates/includes/opinion_tabs_content.html)
- Section heading and rule: `.opinion-section-title { margin-top:50px }`; `.hr-opinion { border-top:2px solid black }`. Roman-numeral part headers use `.center-header { text-align:center; font-size:2em }`. [SRC] — [opinions.css](https://github.com/freelawproject/courtlistener/blob/main/cl/assets/static-global/css/opinions.css)
- Paragraphs: `#opinion p { text-indent:2em }`; `blockquote { margin-left:3em; display:block }`; `blockquote > * { text-indent:0 }`; `cross_reference { font-style:italic }`. [SRC] — same
- "Summaries" here means a separate tab of judge-written parentheticals (`#all-summaries { margin-top:20px }`). Each item has `.summary-group-metadata` with date · case link · court, and a "Show all N summaries like this" collapse. The *cluster* `summary` and `syllabus` fields appear inline in the continuous flow. [SRC] — [opinion_tabs_content.html](https://github.com/freelawproject/courtlistener/blob/main/cl/opinion_page/templates/includes/opinion_tabs_content.html), [opinions.css](https://github.com/freelawproject/courtlistener/blob/main/cl/assets/static-global/css/opinions.css)

**Margin page numbers (star pagination)**
- The source HTML carries several page-number forms: `<page-number label="*123" citation-index="1">` (Harvard/CAP), `<span class="star-pagination" label|number|pagescheme>` (Columbia, ANON-2020), and `strong` elements containing `[123]` (Lawbox).
- `opinions.js` replaces each with `<a class="page-label" data-citation-index="{i}" data-label="{n}" href="#{n}" id="{n}">*{n}</a>`. Each page is therefore an anchor (`#123`) that can be shared or pin-cited. [SRC] — [opinions.js](https://github.com/freelawproject/courtlistener/blob/main/cl/assets/static-global/js/opinions.js)
- Inline styling: `a.page-label { font-style:italic; font-size:.8em; margin:0 4px 0 2px; color:#555555 }`.
- Margin label: `a.page-label::after { content:attr(data-label); display:inline; position:relative; float:right; width:0; font-size:1em; color:dimgray /* #696969 */ }`.
  - Inside `.harvard`: `right:-1.0em; position:absolute; text-indent:0`. The number hangs just outside the right edge of the text column.
  - Labels inside footnotes are hidden.
  - Below 768px all margin labels are hidden (`display:none`).
- Columbia / `span.star-pagination::after` uses `float:left; left:-4.5em` (in `p`) or `-2.5em` (in `div`). That puts those labels in the **left** margin. [SRC] — [opinions.css](https://github.com/freelawproject/courtlistener/blob/main/cl/assets/static-global/css/opinions.css)

**Clickable footnotes**
- The JS normalizes all footnote variants into one pattern:
  - The mark becomes `<sup><a href="#fn{i}" id="fnref{i}">{label}</a></sup>`.
  - The body becomes `<footnote id="fn{i}" label="{label}">…<a class="jumpback" href="#fnref{i}">↵</a></footnote>`.
  - Variants handled: `div.footnotes > div.footnote` and `a.footnote` from Harvard/Resource.org, and `footnotemark` from Columbia.
  - When counts of marks and footnotes disagree, it falls back to "scroll to the nearest footnote with the same label below the current position", with a 500ms jQuery animate, and the reverse for the jump-back.

  [SRC] — [opinions.js](https://github.com/freelawproject/courtlistener/blob/main/cl/assets/static-global/js/opinions.js)
- Footnote CSS:
  - `footnote { display:block; padding-top:10px; padding-left:40px; font-size:12px; line-height:1.5em }`.
  - `footnote:first-of-type { border-top:1px solid black; width:100% }` draws a separator rule above the first footnote.
  - Hanging label: `footnote::before { content:attr(label); font-weight:bold; color:#000; margin-right:26px; margin-left:-35px }`.
  - `footnote > p { display:inline }`.
  - Marks: `footnotemark { font-weight:bold; font-size:.8em; vertical-align:super; line-height:0; color:blue; text-decoration:underline; cursor:pointer }`.
  - `.jumpback { color:blue; font-weight:bold; margin-left:5px; cursor:pointer }`.
  - `sup { font-size:.9em }`.

  [SRC] — [opinions.css](https://github.com/freelawproject/courtlistener/blob/main/cl/assets/static-global/css/opinions.css)
- Footnotes render **at the end of each opinion section** (inline in the flow, not as side-notes or popovers). [SRC: template has no separate footnote region; JS only rewrites in place] — [opinion_tabs_content.html](https://github.com/freelawproject/courtlistener/blob/main/cl/opinion_page/templates/includes/opinion_tabs_content.html)

**Linked citations / pin cites**
- Server-side (eyecite), `html_with_citations` wraps each citation in one of three forms:
  - Resolved: `<span class="citation" data-id="{opinion_pk}"><a href="{cluster_url}#{pin}" aria-description="Citation for case: {case name ≤60 chars}">…</a></span>`.
  - Ambiguous: `<span class="citation multiple-matches"><a href="/c/{reporter}/{vol}/{page}/">`.
  - Unresolved: `<span class="citation no-link">`, styled italic via `span.citation.no-link { font-style:italic }`.
- Pin cites: if a pin cite exists, the URL gets `#` plus the first number of the pin (e.g. `#122` for "122-123"). It lands on the target opinion's `a.page-label` with `id="122"`. Id. and supra citations use the full span. [SRC] — [annotate_citations.py](https://github.com/freelawproject/courtlistener/blob/main/cl/citations/annotate_citations.py), [opinions.css](https://github.com/freelawproject/courtlistener/blob/main/cl/assets/static-global/css/opinions.css)
- Plain-text sources wrap text in `<pre class="inline">` and use the monospace `"andale mono","lucida console",monospace` with `white-space:pre`. [SRC] — [annotate_citations.py](https://github.com/freelawproject/courtlistener/blob/main/cl/citations/annotate_citations.py), [override.css](https://github.com/freelawproject/courtlistener/blob/main/cl/assets/static-global/css/override.css)

**Example live URLs (new view)**
- Recent SCOTUS opinions on the unified view, from the public search API:
  - https://www.courtlistener.com/opinion/10881681/trump-v-slaughter/ (filed 2026-06-29)
  - https://www.courtlistener.com/opinion/10882239/trump-v-barbara/ (2026-06-30)
  - https://www.courtlistener.com/opinion/10881682/trump-v-cook/ (2026-06-29)

  Source: [CourtListener search API v4](https://www.courtlistener.com/api/rest/v4/search/?q=%22Loper+Bright%22&type=o&court=scotus&order_by=dateFiled+desc). The live DOM itself was blocked by the WAF.

**Launch context**
- The 2025-03-21 Free Law Project post "A Faster, Smarter, Unified Case Law Experience" announces the redesign. Key points:
  - "single-page design that presents every part of a case—from metadata and summaries to concurrences and dissents—in one uninterrupted flow"
  - a "new, table of contents to jump directly to any section"
  - "Page numbers appear in the margin and can be clicked or shared"
  - "Citations are automatically linked within and between cases"
  - new tabs: Table of Authorities, Summaries (Parentheticals), Cited By, Related & Similar Cases, plus 5M+ CAP scanned PDFs in a PDF tab

  — [free.law blog](https://free.law/2025/03/21/case-law-redesign/)
- The `opinions.css` commit history matches that launch: "feat(opinions): standardize the fields displayed in authorities, cited by and similar cases tab" (2025-03-21). The last change was "show PDF accordion for multiple opinions" (2026-04-28). [SRC] — [GitHub commits API, opinions.css](https://github.com/freelawproject/courtlistener/commits/main/cl/assets/static-global/css/opinions.css)

### Inferences
- A React clone maps cleanly to this tree:
  - `<Layout grid: 25%/75% inside max-w 1170px white sheet on #E9E8E8>`
  - `<StickyTOC>` with a 2px rail and a `#B53C2C` active segment, plus an IntersectionObserver in place of their scroll handler
  - `<CaptionBox bg #F5F5F5>`
  - `<Tabs>`
  - `<Article>` with sections `{id, title, html}` separated by `<hr 2px black>`
- Page-number normalization and footnote linking are best done once at data-ingest time (server or build step), not with jQuery DOM rewriting. [EST]
- The right-margin page number needs about 2–3em of right padding on the reading column, or the absolutely positioned `::after` labels will overflow at `right:-1em`. CourtListener gets that space for free from Bootstrap's 15px gutter plus the container border. [EST]

### Gaps
- The rendered live DOM and computed styles could not be checked, because the AWS WAF challenge blocks non-browser fetches. Exact rendered widths, and how sticky interacts with the 175px header, are inferred from source.
- I did not inspect the screenshot assets in the blog post, so visual nuances not encoded in CSS (e.g. icon set details) are unverified.

---

## Typography (families, sizes, weights, line-heights, letter-spacing) and licensing

### Takeaway
The opinion page uses system or commercial font stacks with **no web fonts loaded for it**:
- Opinion body: **Georgia** 15px, line-height 2.3em (34.5px), letter-spacing 0.2px, justified.
- UI chrome (nav, TOC, metadata): Bootstrap's **"Helvetica Neue", Helvetica, Arial**, on a customized 12px base.
- Some headings use a `.serif` class: "Warnock Pro" (commercial Adobe), then Palatino, Book Antiqua, Georgia.

The newer "v2" Tailwind system, used for the docket and search redesign and not the opinion page, uses **Inter** (OFL), **Cooper Hewitt** (OFL) and **DM Mono** (OFL), all self-hosted.

### Cited Findings
- `.serif-text { font-family: Georgia, "Times New Roman", Times, serif; font-size:15px; letter-spacing:0.2px }`. This class is on every opinion body div. [SRC] — [override.css](https://github.com/freelawproject/courtlistener/blob/main/cl/assets/static-global/css/override.css)
- The body text block rules repeat these values with `text-align:justify; line-height:2.3em`:
  - `.harvard > * { font-size:15px; letter-spacing:.2px; text-align:justify; line-height:2.3em; padding:0; margin:0; background:white; border:none }`
  - `div.subopinion-content > .harvard { font-size:15px; letter-spacing:.2px; line-height:2.3em; text-align:justify }`
  - `#columbia-text` uses the same values.

  [SRC] — [opinions.css](https://github.com/freelawproject/courtlistener/blob/main/cl/assets/static-global/css/opinions.css)
- `.serif { font-family: "Warnock Pro","Palatino","Book Antiqua",Georgia,serif }` is used on `h3.bottom.serif` case names in the Authorities and Cited-By lists. `.alt` uses "Warnock Pro","Book Antiqua",Georgia italic `#666`. [SRC] — [override.css](https://github.com/freelawproject/courtlistener/blob/main/cl/assets/static-global/css/override.css)
- Base UI font, from the vendored, customized Bootstrap 3.3.0: `body { font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; font-size:12px; line-height:1.42857143; color:#333333; background-color:#ffffff }` (override.css then sets `body` background to `#E9E8E8`).
  - Heading sizes: h1 31px, h2 25px, h3 21px, h4 15px, h5 12px, h6 11px.
  - Heading margins: h1–h3 `margin-top:17px; margin-bottom:8.5px`; h4–h6 `8.5px` top and bottom.
  - `p { margin:0 0 8.5px }`.

  These are smaller than stock Bootstrap (14px base). [SRC] — [bootstrap.css](https://github.com/freelawproject/courtlistener/blob/main/cl/assets/static-global/css/bootstrap/3.3.0/bootstrap.css)
- Heading weight and line-height were not re-read; stock Bootstrap 3 is `font-weight:500; line-height:1.1; font-family:inherit` for h1–h6. [EST: Bootstrap default, not re-verified in this fork]
- Opinion-page type scale, as specified (sizes in px are derived where marked):

  | Element | Font | Size | Weight / style | Other |
  |---|---|---|---|---|
  | Case name `.case-caption` | Helvetica stack | 3em → ~45px [DERIVED] | 500 | line-height 1.1em |
  | Court `.case-court` | Helvetica stack | 25px | — | — |
  | Section titles | Helvetica stack | h2 25px / h3 21px (Bootstrap) | — | margin-top 50px |
  | Metadata `.case-details` | Helvetica stack | 16px | labels `<strong>` | letter-spacing .2px |
  | TOC `.jump-links` | Helvetica stack | 12px | active 500 / bold | row height 2.5em (30px) [DERIVED] |
  | Page label (inline) | — | .8em | italic | `#555` |
  | Page label (margin) | — | — | — | `dimgray` |
  | Footnotes | — | 12px | — | line-height 1.5em |
  | Authorities / cited-by `.meta-data-header` / `.meta-data-value` | — | 14px | header bold | — |

  [SRC] — [opinions.css](https://github.com/freelawproject/courtlistener/blob/main/cl/assets/static-global/css/opinions.css), [override.css](https://github.com/freelawproject/courtlistener/blob/main/cl/assets/static-global/css/override.css)
- Icon font: Font Awesome 4 (`css/font-awesome.css`, `fa-bell-o`, `fa-rss`, `fa-external-link`; the PDF accordion uses glyphs `\f0d8` / `\f0d7`). [SRC] — [base.html](https://github.com/freelawproject/courtlistener/blob/main/cl/assets/templates/base.html), [opinions.css](https://github.com/freelawproject/courtlistener/blob/main/cl/assets/static-global/css/opinions.css)
- v2 (Tailwind) fonts are self-hosted via `@font-face` in `cl/assets/tailwind/fonts.css`, with no Google Fonts link:
  - Cooper Hewitt: Thin and Medium files, both declared `font-weight:500`.
  - Inter: 400 / 500 / 600 / 700.
  - DM Mono: Medium.
  - All woff2, woff and otf; `font-display:swap`.
  - Tailwind maps `sans:['Inter','sans-serif']`, `cooper:['Cooper Hewitt','sans-serif']`, `mono:['DM Mono','mono']`.

  [SRC] — [fonts.css](https://github.com/freelawproject/courtlistener/blob/main/cl/assets/tailwind/fonts.css), [tailwind.config.js](https://github.com/freelawproject/courtlistener/blob/main/cl/assets/tailwind/tailwind.config.js)
- v2 type scale (`fontSize`, size and line-height pairs):
  - Text: xs 12/18, sm 14/20, md 16/24, lg 18/28, xl 20/28.
  - Display: display-xs 24/32, display-sm 30/38, display-md 32/40, display-lg 40/48, display-xl 44/52.
  - Cooper variants: display-sm-cooper 28/44, lg-cooper 18/26.
  - Base headings: h1 = `font-cooper text-display-sm font-semibold md:text-display-lg`; h2 = `text-display-xs font-semibold text-greyscale-900`; h3 = `text-xl font-semibold`; h4 = `text-lg font-semibold`.

  [SRC] — [tailwind.config.js](https://github.com/freelawproject/courtlistener/blob/main/cl/assets/tailwind/tailwind.config.js), [input.css](https://github.com/freelawproject/courtlistener/blob/main/cl/assets/tailwind/input.css)
- Font licenses (from my own knowledge; no license files exist in the repo `fonts/` dirs):
  - Georgia, Helvetica Neue and Palatino are proprietary *system* fonts (Microsoft / Apple / Linotype), used without distribution.
  - "Warnock Pro" is a commercial Adobe font and only renders if the user has it installed; in practice it falls back to Palatino or Georgia.
  - Inter (Rasmus Andersson), DM Mono (Colophon/Google) and Cooper Hewitt (Cooper Hewitt Smithsonian Design Museum / Chester Jenkins) are all **SIL Open Font License 1.1**.

  [EST: licensing from general knowledge; no license file found in the repo tree]

### Inferences
- To reproduce the look, set the opinion body to `font-family: Georgia, "Times New Roman", Times, serif; font-size: 15px; line-height: 2.3; letter-spacing: .2px; text-align: justify; p { text-indent: 2em }`. The very loose 2.3 leading is the signature of this view.
- For a free, cross-platform substitute closer to the intended book look, consider **Source Serif 4** or **Libre Caslon / EB Garamond** (OFL) in place of Georgia, but Georgia itself needs no license because it is a system font. [EST]
- To build in the newer FLP visual language, use Inter plus Cooper Hewitt (OFL, free to self-host) with the v2 tokens.

### Gaps
- No font license text is committed beside the font files in the repo, so the licenses above come from general knowledge, not the repo.
- The rendered computed font-size of section `h2`/`h3` inside `.opinion-body` was not confirmed live.

---

## Color palette, spacing, radii

### Takeaway
The opinion page palette is small:
- Brand maroon-red `#B53C2C`, used for the active TOC rail, date pill, active nav underline and `::selection`.
- Text `#333` on white, links `#009` (deep blue), visited case links `#9d11b3`.
- Page labels `#555` / dimgray, rules black (2px section, 1px footnote), borders `#c2c2c2` / `#ddd` / `#e7e7e7`, caption box `whitesmoke`, page canvas `#E9E8E8`.

The v2 Tailwind tokens define a warm greyscale and a `primary` red ramp whose 600 (`#B5362D`) is the near-equivalent of `#B53C2C`.

### Cited Findings
- Brand red `#B53C2C`:
  - `::selection { background:#B53C2C; color:#fff }`
  - logo `.cl-full-logo .cls-1 { fill:#B53C2C }`
  - active navbar item `border-bottom: 3px … #B53C2C`
  - donate link color `#B53C2C`, hover `#d90c0c`

  [SRC] — [override.css](https://github.com/freelawproject/courtlistener/blob/main/cl/assets/static-global/css/override.css)
- Other logo fills: `#968f7f` (warm grey), `#848582`, `#fff`. [SRC] — same
- Links: `a, a:hover, a:focus { color:#009 }`; `a:visited.visitable { color:#9d11b3 }`; grey icon links stay `gray`. [SRC] — same
- Nav: navbar link color `#555555`, padding 13px top / 10px bottom, `border-bottom:3px solid transparent`; navbar bottom border `#e7e7e7`. [SRC] — same
- Canvas and sheet: body `#E9E8E8`; container white with 1px `#c2c2c2` side and bottom borders. [SRC] — same
- Opinion page colors:
  - Caption box `whitesmoke` (#F5F5F5); inactive tabs `#e7e7e7`; active tab `#ffffff`.
  - Section rule `2px solid black`; footnote separator `1px solid black`.
  - TOC rail `lightgrey` (#D3D3D3), active `#B53C2C`.
  - Inline page label `#555555`; margin page number `dimgray` (#696969); Columbia star-pagination `#555555`.
  - Footnote marks and jumpback `blue` (#0000FF); footnote label `#000`.
  - Sidebar `h3` underline `#ddd`.

  [SRC] — [opinions.css](https://github.com/freelawproject/courtlistener/blob/main/cl/assets/static-global/css/opinions.css), [override.css](https://github.com/freelawproject/courtlistener/blob/main/cl/assets/static-global/css/override.css)
- Radii: date pill `20px`; tabs top corners `5px`; legacy `.add-a-note` / `.add-citation-alert` `10px` with a 1px black border; Bootstrap buttons default (about 4px [EST]). [SRC] — [opinions.css](https://github.com/freelawproject/courtlistener/blob/main/cl/assets/static-global/css/opinions.css)
- Spacing values on the opinion page:
  - Section title top margin 50px; case caption top margin 50px.
  - Caption box padding 10/10/0/20px with 20px vertical margins.
  - Sidebar padding 20px (top 3px); sidebar sections 3em apart; TOC rows 2.5em.
  - Footnote padding-left 40px, padding-top 10px.
  - Paragraph indent 2em; blockquote margin-left 3em; `#all-summaries` margin-top 20px; main bottom padding 5em.

  [SRC] — [opinions.css](https://github.com/freelawproject/courtlistener/blob/main/cl/assets/static-global/css/opinions.css), [override.css](https://github.com/freelawproject/courtlistener/blob/main/cl/assets/static-global/css/override.css)
- v2 Tailwind color tokens (exact):
  - **greyscale**: 25 `#FDFCFB`, 50 `#FBFAF8`, 100 `#F5F3EF`, 200 `#E8E4DE`, 300 `#D6D0C6`, 400 `#A8A091`, 500 `#776F61`, 600 `#574F40`, 700 `#453F35`, 800 `#29261F`, 900 `#1C1814`, 950 `#171411`.
  - **primary**: 25 `#FDF9F7`, 50 `#FBF4EF`, 100 `#F7E6DE`, 200 `#EFCBBD`, 300 `#E19684`, 400 `#D56958`, 500 `#CD4137`, 600 `#B5362D`, 700 `#9B2E27`, 800 `#832720`, 900 `#6A201A`, 950 `#4E1713`.
  - **brand** (purple, used for `code`): 100 `#F4EBFF`, 300 `#D6BBFB`, 600 `#7F56D9`, 700 `#6941C6`.
  - Others: yellow 50 `#FFFAEB` / 400 `#FDB022`; amber 450 `#FDB022`; blue 700 `#004EEB`; red 400 `#FF692E` / 500 `#E62E05`.

  [SRC] — [tailwind.config.js](https://github.com/freelawproject/courtlistener/blob/main/cl/assets/tailwind/tailwind.config.js)
- v2 spacing extensions: 4.5 = 18px, 7.5 = 30px, 13 = 52px, 15 = 60px, 18 = 72px, 21 = 84px, 26 = 104px, 35 = 140px, 41 = 164px, 42 = 168px, 45 = 180px, 53 = 212px, 55 = 220px, 70 = 280px. Also `screens.xs = 392px` and `maxWidth.content = 948px`. [SRC] — same file
- v2 layout CSS variables: `--nav-menu-width:222px; --profile-menu-width:228px; --desktop-header-height: spacing.26 (104px); --content-max-width:1280px; --corpus-search-height: spacing.12 (48px)`. [SRC] — [input.css](https://github.com/freelawproject/courtlistener/blob/main/cl/assets/tailwind/input.css)
- v2 component radii and borders:
  - `select`: `rounded-[10px]`, padding 12/14px.
  - checkbox: `rounded`; radio: `rounded-full`.
  - `blockquote`: `border-l-4 border-greyscale-200 pl-6 py-2 text-xl`.
  - `code`: `rounded-[2px]`, brand-100 background, brand-600 text, brand-300 border.
  - Focus ring: `outline-[3px] outline-primary-600/60`.

  [SRC] — same file

### Inferences
Suggested minimal token set for a clone of the 2025 opinion view [EST]:

```
--cl-red: #B53C2C
--text: #333333
--link: #000099
--link-visited: #9d11b3
--page-num: #555555 (inline) / #696969 (margin)
--rule: #000000
--border: #c2c2c2
--border-soft: #dddddd
--tab-bg: #e7e7e7
--caption-bg: #f5f5f5
--canvas: #E9E8E8
--toc-rail: #d3d3d3
--fn-link: #0000ff (consider swapping to --link for consistency)
```

### Gaps
- No dark mode exists in either the legacy or v2 CSS (none found), so any dark palette would be your own design.

---

## Tech stack, build, and AGPL implications

### Takeaway
The unified opinion page runs on:
- Django templates
- Bootstrap 3.3.0 (vendored and customized)
- jQuery
- htmx (lazy tab counts)
- a plain CSS file using native CSS nesting (`opinions.css`)

It is **not** Tailwind and not Alpine. FLP's separate, ongoing "v2" redesign uses Tailwind 3, django-cotton components and Alpine.js. As of October 2026 it covers the docket page (`v2_docket.html`) and search; no v2 opinion template exists yet. The code is AGPL-3.0. Re-implementing the *design* (layout, measurements, colors) in your own React code is generally fine. Copying their CSS, templates or JS verbatim makes those files AGPL-licensed derivatives, with network-use source-disclosure duties.

### Cited Findings
- `opinions.html` loads `css/opinions.css`. Its footer loads `jquery.NobleCount`, `save-notes.js`, `opinions.js` and `htmx(.min).js`. Tab counts come from `hx-get="{% url 'update_opinion_tabs' cluster.pk %}" hx-trigger="load"`. [SRC] — [opinions.html](https://github.com/freelawproject/courtlistener/blob/main/cl/opinion_page/templates/opinions.html)
- `base.html` loads `css/font-awesome.css`, `css/bootstrap/3.3.0/bootstrap(.min).css` and `css/override.css`. [SRC] — [base.html](https://github.com/freelawproject/courtlistener/blob/main/cl/assets/templates/base.html)
- `opinions.css` uses native CSS nesting (`.opinion-body { .harvard > * {…} … }`), with no preprocessor. [SRC] — [opinions.css](https://github.com/freelawproject/courtlistener/blob/main/cl/assets/static-global/css/opinions.css)
- Tailwind config:
  - content globs include `../../**/templates/**/*.html`, `../static-global/js/alpine/components/*.js` and SVGs, confirming Alpine.js plus Tailwind for v2.
  - `input.css` uses `@tailwind base` with `@layer base` component rules and `[x-cloak]`, an Alpine directive.

  [SRC] — [tailwind.config.js](https://github.com/freelawproject/courtlistener/blob/main/cl/assets/tailwind/tailwind.config.js), [input.css](https://github.com/freelawproject/courtlistener/blob/main/cl/assets/tailwind/input.css)
- django-cotton components exist under `cl/assets/templates/cotton/` (button, callout, dialog, tabs, header, footer, layout_with_navigation, eyebrow, library, …) and `cl/opinion_page/templates/cotton/` (docket page, metadata_section, pray_button, docket_filter…). The only v2 page template in `opinion_page` is `v2_docket.html`. [SRC] — [repo tree](https://github.com/freelawproject/courtlistener/tree/main/cl/assets/templates/cotton)
- Recent commits under `cl/opinion_page/templates` (Sept–Oct 2026) are all "v2 docket page" work (htmx, docket alert toggle, filter). Open issues include "v2 pages: count page views" (#8076) and "v2 docket page: …" (#8078, #7975). No v2 opinion issue turned up in the search. [SRC] — [commits](https://github.com/freelawproject/courtlistener/commits/main/cl/opinion_page/templates), [issues](https://github.com/freelawproject/courtlistener/issues?q=v2)
- License: `LICENSE.txt` reads "Copyright 2010, Brian Carver and Michael Lissner … free software … under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version." GitHub's API reports license "Other / NOASSERTION" because of that preamble. [SRC] — [LICENSE.txt](https://github.com/freelawproject/courtlistener/blob/main/LICENSE.txt)
- The vendored Bootstrap 3.3.0 inside the repo is itself MIT, from upstream Bootstrap. [EST: upstream license; the repo copy is customized]

### Inferences
- **AGPL implications** [EST, not legal advice]:
  - Copying `opinions.css`, `opinions.js`, `override.css` or the Django templates verbatim (or lightly modified) into your app creates a derivative of AGPL-3.0 code. If users interact with that app over a network, AGPL §13 requires offering them the *complete corresponding source* of the combined work under AGPL.
  - Design facts, meaning measurements, hex values, layout ideas, and "page numbers float in the right margin", are generally not copyrightable expression. Re-implementing them in your own React components and CSS-in-JS or Tailwind code avoids the obligation.
  - Write fresh code rather than transliterating their selectors line by line. Keep this note as the "spec" layer between their source and your implementation (a clean-room style).
- Their *data* is a separate matter. CourtListener opinion text is public-domain law. API data has its own terms, and the CAP data and PDFs have CAP's terms. Fetching `html_with_citations` through the API (token required) is the easiest way to get pre-linked citations and `<page-number>` / `<footnote>` markup for your React renderer.
- Recommended React stack mirroring their behavior [EST]:
  - CSS grid `grid-template-columns: 280px minmax(0, 1fr)`, inside `max-width: 1170px`.
  - `position: sticky; top: 0; height: 100vh; overflow-y: auto` TOC.
  - IntersectionObserver scrollspy.
  - `dangerouslySetInnerHTML` (sanitized) for opinion HTML, then a post-render effect (or a pre-processing step) that converts `page-number`, `span.star-pagination` and footnote variants into anchors, as `opinions.js` does.

### Gaps
- No public statement found on whether or when the opinion page will move to the v2 Tailwind / Inter / Cooper Hewitt design system; the issue search returned none.
- The live production CSS build output (hashed static files) could not be fetched because of the WAF, so I could not confirm that production matches `main` exactly. It was assumed to, given continuous deployment.
