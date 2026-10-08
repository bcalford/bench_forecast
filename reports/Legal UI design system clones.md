# Rebuild Harvey, Oyez, and CourtListener in React

All three designs can be rebuilt as plain React with CSS custom properties. None of them needs a framework, and the measurements are now known down to the pixel. The research did not just eyeball screenshots: it read the live stylesheets (Harvey, Oyez) and the open-source repository (CourtListener). **Harvey** is the hardest to copy because its look depends on two commercial typefaces: a custom serif (attributed to WELTKERN's TWK Ghost) and Dinamo's ABC Diatype. Swap in **Instrument Serif** and **Inter**, keep Harvey's exact warm-gray palette (`#0f0e0d` ink to `#fafaf9` ivory), and you keep almost all of the feel. **Oyez's** vote panel is simpler than it looks. It is one row of nine equal slots, ordered by seniority or ideology. Majority justices show at full opacity, minority at **50%**, and non-participants at **10%**. The slots zig-zag by 1.5rem, and the colors come from opacity, not red and green. **CourtListener's** 2025 reading view is Bootstrap 3 plus one small stylesheet. Its signature is **Georgia 15px at a 2.3 line-height**, set justified, with a sticky "Jump To" table of contents (a 2px rail with a `#B53C2C` active segment) and page numbers floated into the right margin. The legal risk is not in the fonts you choose but in what you copy. CourtListener's code is **AGPL-3.0**, Oyez's content and portraits are **CC BY-NC 4.0**, and "Oyez" and Harvey's ":Harvey:" wordmark are trademarks. So reimplement the measurements in your own code, and do not lift stylesheets, images, or names.

## Harvey's look is two typefaces and eleven warm grays

Harvey's marketing site is **Next.js + Tailwind CSS v4 + Sanity CMS**, with Radix-style primitives, the Embla carousel, and Mux video ([harvey.ai](https://www.harvey.ai)). It self-hosts exactly three font files: `HarveySerifFont` Regular 400, `HarveySerifFont` Italic 400, and a variable `HarveySansFont` whose filename is `HarveySansDiatypeVariable`. Every stack falls back to `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, …` ([harvey.ai](https://www.harvey.ai)). Fonts In Use credits Harvey's display type to **TWK Ghost** (Nolan Paparelli, published by WELTKERN) and its body and UI type to **ABC Diatype** by Dinamo. It also credits the brand foundation to the studio Geist ([Fonts In Use](https://fontsinuse.com/uses/77027/harvey)). Diatype is a commercial Dinamo release from 2020 ([maxibestof.one](https://maxibestof.one/typefaces/diatype)). The serif file is renamed and subsetted, so whether it is Ghost itself or a custom derivative is unconfirmed. Either way, treat both brand fonts as off-limits. One third-party crawl claims Söhne Mono 13px labels ([webdesignhot](https://www.webdesignhot.com/design.md/openai/diff/harvey/)). The live CSS contains no "Söhne" string, so ignore that claim ([harvey.ai](https://www.harvey.ai)).

The typography rule is extreme contrast in scale with no bold. **All serif headings are weight 400**, set at line-height **1.05**, with letter-spacing **-0.0125em** on display sizes and **-0.01em** below that. They also use `text-wrap: balance` or `pretty` and turn on the `"liga"` and `"calt"` font features. Body copy is the sans at **400, line-height 1.3**, and **500** is used for buttons, nav, and labels ([harvey.ai](https://www.harvey.ai)). The headings step up in size at the 1025, 1445, and 1730px breakpoints:

| Role | Font | Mobile → ≥1025 → ≥1445 → ≥1730px | Weight / LH / tracking |
|---|---|---|---|
| `text-heading-1` (hero, big stats) | serif | 48 → 72 → 80 → 96 | 400 / 1.05 / -0.0125em |
| `text-heading-2` (section) | serif | 36 → 48 → 56 → 64 | 400 / 1.05 / -0.01em |
| `text-heading-3` (card titles) | serif | 28 → 32 → 36 → 40 | 400 / 1.05 / -0.01em |
| `text-heading-4` | **sans** | 28 | 500 / 1.1 / -0.01em |
| body-0 / 1 / 2 / 3 | sans | 24 / 20 / 16 / 14 | 400 / 1.3 |
| Large CTA / small button | sans | 16 / 14 | 500 / 400, LH 1.3 |

Source for the table: [harvey.ai](https://www.harvey.ai).

The palette has **no brand hue**. The ramp is ink `#0f0e0d`, `#1f1d1a`, `#33312c`, `#524f49`, `#706d66`, `#8f8b85`, `#adaba5`, `#cccac6`, `#e5e5e3`, `#f2f1f0`, ivory `#fafaf9`. Sections switch between `data-theme="white"` (ivory background, ink text, `#33312c` secondary text, `#706d66` muted text, `#cccac6` / `#e5e5e3` borders), `gray` (`#f2f1f0` background), and `black` (ink background, ivory text, `#33312c` borders). The only other colors are imagery tones (casal `#333f40`, velvet `#373340`, bronze `#593d3a`, blush `#d9cdcc`), functional red `#f26161` on `#feeaea`, green `#16a34a`, yellow `#eab308`, and a highlighter yellow `#f6f202` ([harvey.ai](https://www.harvey.ai)). On the homepage the bands run ivory for the hero, logos, audience router, and products; gray for quotes; and ink for case studies, stats, security, and the footer. Accent comes from **inversion** (an ink button on ivory, an ivory button on ink), not from color.

Layout comes from a 4px Tailwind base plus a semantic spacing scale: **7 / 14 / 28 / 56 / 112 / 140px** (xs through 2xl). Sections are separated by 112–140px of padding. The page max-width is **1728px**, the gutters are 28 / 32 / 36 / 40px, the blog column is **675px**, and paragraphs are capped at 480–800px ([harvey.ai](https://www.harvey.ai)). Radii are small: 2 / 4 / 6 / 8 / 12px, with **4px buttons**. There are **no drop shadows**; depth comes from 1px borders, inversion, and backdrop blur. The primary CTA is 48px tall with 20px horizontal padding, a 4px radius, an ink fill, and ivory 16px/500 text. Its hover state is `#33312c` and its active state is `#524f49`, with a 0.3s `cubic-bezier(.3,.3,.3,1)` color transition. The header is fixed, **72px** tall, and tinted ivory at 72% opacity with a 16px backdrop blur. It holds a serif text wordmark at 28px on the left, centered 14px/500 nav links, and on the right an outline "Login" button and a 32px ink CTA. The footer is ink. It has a serif CTA row separated by a `#33312c` rule, then a five-column grid of 14px links ([harvey.ai](https://www.harvey.ai)).

The product UI sits behind a login, so its values are estimates taken from official marketing renders. The Assistant has three panes: an icon-only left rail about 44px wide, a centered chat column, and a collapsible right panel about 240px wide. That panel holds Progress, Context, and Properties sections, separated by a 1px border. User turns appear in light-gray bubbles with a radius of about 12px. Assistant replies are **plain, unboxed document text** at about 14px. The composer is pinned to the bottom, about 12px rounded, and fills in light gray behind a square ink send button ([harvey.ai/platform/assistant](https://www.harvey.ai/platform/assistant)). Vault adds a files table with rows about 45px tall, hairline dividers, no zebra striping, and outline chips with a colored dot ([harvey.ai/platform/vault](https://www.harvey.ai/platform/vault)). The product appears to be all sans. The serif is kept for marketing and brand moments.

## Oyez's vote panel is one row of nine dimmed portraits

Oyez is an AngularJS 1.x single-page app styled with **Foundation 5.5.3**. It reads from an unauthenticated JSON API at `api.oyez.org` ([scripts.js](https://www.oyez.org/scripts/scripts.dc9cbca2.js)). Both of its fonts are on Google Fonts: **Merriweather** (400, 700, and their italics) for titles and section heads, and **Merriweather Sans** (300–700) for everything else ([Oyez CSS](https://www.oyez.org/styles/main.0cc311b8.css)). The body text is Merriweather Sans **14px/24px, `#222` on `#F8F8F8`**. Every label uses one recurring "eyebrow" style: **10px/24px, weight 700, uppercase, letter-spacing .17em, `#0E7AAA`**. Secondary text is 12px/24px. Section h2s are Merriweather 400 at 28px/36px, and the sidebar title is Merriweather 400 at 42px/54px ([Oyez CSS](https://www.oyez.org/styles/main.0cc311b8.css)).

A case page is a flex row with two columns. On the left is a sidebar one-third wide, filled with `#0E7AAA` from 1025px up. It holds a white case title and "Media" and "Opinions" link lists. On the right is a content column two-thirds wide. It opens with a metadata grid (rows capped at 1000px, each with a `1px solid #222` top rule and 50% cells with eyebrow labels), followed by the stacked sections "Facts of the case", "Question", and "Conclusion". The prose is capped at 40rem, and each section has a 3rem bottom margin. **There are no tabs.** The vote figure sits inside "Conclusion", above the conclusion text ([case.html](https://www.oyez.org/views/case.html); [Oyez CSS](https://www.oyez.org/styles/main.0cc311b8.css)). The surface is flat, with no shadows or radii except a 3px search input. Links use Foundation's `#008CBA` (`#0078a0` on hover), and the dark overhead strip is `#222`.

The vote component is a centered `<figure class="oy-decision">`. Its caption is one blue eyebrow heading built from the template, `{majority}–{minority} decision for {winning_party}`, a line break, then `{decision_type} by {author}`. Below that sits a 12px holding line, for example "Chevron U.S.A. v. NRDC is overruled." Unanimous cases read "Unanimous decision", and per curiam cases read "*Per Curiam* opinion" ([decision.html](https://www.oyez.org/templates/decision.html)). The portrait row works like this:

| Property | Value |
|---|---|
| Row container | `position:relative; max-width:45rem (720px); margin:0 auto; height:7em` (9em at ≥1025px) |
| Slot | `position:absolute; width:11.111%; max-width:5rem (80px); transform:translateX(n×100%)` |
| Zig-zag | Odd slots (1, 3, 5, 7, 9) get `margin-top:1.5rem` with the caption **below**; even slots have no offset and the caption **above** |
| Portrait | `width:150%; margin-left:-25%`, so neighbors overlap. The source PNGs are **300×200 RGBA cut-outs**, with no border or radius |
| Caption | Merriweather Sans 12px/24px **italic**, nowrap, width 200%, centered. Last name only below 1921px wide |
| Vote state | majority: full opacity; `minority img {opacity:.5}`; `none img {opacity:.1}` |
| Sort | "Sort: by seniority \| by ideology", 12px, active link italic and underlined. Slots slide with `transform .5s cubic-bezier(0.23,1,.32,1)` |

Sources: [Oyez CSS](https://www.oyez.org/styles/main.0cc311b8.css), [decision.html](https://www.oyez.org/templates/decision.html), and the [Roberts thumbnail](https://api.oyez.org/sites/default/files/images/people/john_g_roberts_jr/john_g_roberts_jr.thumb.png).

The data shape maps directly onto a prediction model. `decisions[]` carries `majority_vote`, `minority_vote`, `winning_party`, `decision_type`, and `description`. Each entry in `votes[]` carries `vote` (`majority` | `minority` | `none`), `opinion_type`, `joining`, `seniority` (1 = Chief), a signed `ideology` (negative = liberal, sorted leftmost), and `member.thumbnail.href` ([api.oyez.org](https://api.oyez.org/cases/2023/22-451)). In Loper Bright, for example, Jackson is `none` and renders at 10% opacity. Sorted by ideology, the row runs Sotomayor, Kagan, Jackson, Roberts, Kavanaugh, Barrett, Gorsuch, Alito, Thomas. Oyez does not document where its `ideology` numbers come from. If your model produces its own ideal points, sort by those instead. Thumbnail paths are inconsistent, so always read `thumbnail.href` rather than building the URL. CORS on the API was not tested, so plan to proxy requests or cache them at build time.

## CourtListener's reading view is Georgia at 2.3 leading on a Bootstrap sheet

Free Law Project launched the unified view in March 2025 as a "single-page design that presents every part of a case… in one uninterrupted flow." It added a table of contents, page numbers in the margin that can be clicked and shared, and automatically linked citations ([free.law](https://free.law/2025/03/21/case-law-redesign/)). Under the hood it is a Django template on a **customized Bootstrap 3.3.0**, with jQuery, htmx for lazy tab counts, and one page stylesheet, `opinions.css`, written in native CSS nesting ([opinions.html](https://github.com/freelawproject/courtlistener/blob/main/cl/opinion_page/templates/opinions.html); [opinions.css](https://github.com/freelawproject/courtlistener/blob/main/cl/assets/static-global/css/opinions.css)). It is not Tailwind. FLP's newer "v2" system (Tailwind 3, Alpine, Inter, Cooper Hewitt, DM Mono) so far covers dockets and search, not opinions ([tailwind.config.js](https://github.com/freelawproject/courtlistener/blob/main/cl/assets/tailwind/tailwind.config.js)). The live pages sit behind an AWS WAF challenge, so every value below comes from the repository rather than a rendered page.

The page is a white "sheet" on a **`#E9E8E8`** canvas. The container is 1170px max (970 and 750px at smaller breakpoints), with 1px `#c2c2c2` borders on the sides and bottom ([override.css](https://github.com/freelawproject/courtlistener/blob/main/cl/assets/static-global/css/override.css); [bootstrap.css](https://github.com/freelawproject/courtlistener/blob/main/cl/assets/static-global/css/bootstrap/3.3.0/bootstrap.css)). Inside it sit a **25% sidebar and a 75% main column**, about 292px and 877px at full width. From 767px up the sidebar is `position:sticky; top:0; height:100vh; overflow-y:auto; padding:20px` (3px on top). Its "Jump To" TOC lists Top, Caption, Syllabus, Summary and similar sections, then one entry per opinion ("Lead Opinion by Roberts", "Dissent by …"). Each row is 12px and 2.5em tall. A `2px solid lightgrey` rail runs down the left edge, and the active row turns **`#B53C2C` bold** with a maroon rail segment, driven by a scrollspy ([opinions.css](https://github.com/freelawproject/courtlistener/blob/main/cl/assets/static-global/css/opinions.css); [opinions.js](https://github.com/freelawproject/courtlistener/blob/main/cl/assets/static-global/js/opinions.js)).

The main column opens with a `whitesmoke` (`#F5F5F5`) caption box that bleeds to the column edges. Inside it, a top row holds a date pill (1px `#B53C2C` border and text, 20px radius) and action buttons. Below that come the case name at **3em of 15px ≈ 45px, weight 500, line-height 1.1**, the court at 25px, and a 16px metadata list of `<strong>Label:</strong> value` rows (Citations, Docket, Author, Joined By, Disposition…). A justified tab bar follows: Opinion | Authorities | Cited By | Summaries | Similar Cases | PDF. Inactive tabs are `#e7e7e7` and the active tab is white, with 5px top radii ([opinions.html](https://github.com/freelawproject/courtlistener/blob/main/cl/opinion_page/templates/opinions.html); [opinions.css](https://github.com/freelawproject/courtlistener/blob/main/cl/assets/static-global/css/opinions.css)). Every section is then an h2 or h3 with **`margin-top:50px`**, followed by a **`2px solid black`** rule, then the body text ([opinion_tabs_content.html](https://github.com/freelawproject/courtlistener/blob/main/cl/opinion_page/templates/includes/opinion_tabs_content.html)).

The reading typography is `Georgia, "Times New Roman", Times, serif` at **15px, line-height 2.3em (34.5px), letter-spacing .2px, `text-align: justify`**, with a **2em paragraph indent** and blockquotes indented 3em. The UI chrome uses Bootstrap's Helvetica Neue stack on a reduced **12px** base, with headings at 31 / 25 / 21 / 15px for h1–h4 and body text in `#333` ([override.css](https://github.com/freelawproject/courtlistener/blob/main/cl/assets/static-global/css/override.css); [bootstrap.css](https://github.com/freelawproject/courtlistener/blob/main/cl/assets/static-global/css/bootstrap/3.3.0/bootstrap.css)). Links are `#009`, visited case links `#9d11b3`, and text selection is `#B53C2C`.

The three signature features are built like this. **Margin page numbers**: JavaScript rewrites every star-pagination variant into `<a class="page-label" id="123" href="#123">*123</a>`. Inline, the label is italic, .8em, `#555`. Its `::after` places `data-label` absolutely at `right:-1em` in `dimgray`, and the labels are hidden below 768px ([opinions.js](https://github.com/freelawproject/courtlistener/blob/main/cl/assets/static-global/js/opinions.js); [opinions.css](https://github.com/freelawproject/courtlistener/blob/main/cl/assets/static-global/css/opinions.css)). **Footnotes**: marks become `<sup><a href="#fnN" id="fnrefN">`, and bodies become `<footnote id="fnN">` blocks at the end of each opinion. Footnote text is 12px with line-height 1.5em and 40px left padding, and the label hangs in bold. The first footnote gets a `1px solid black` top rule, and each footnote ends in a blue "↵" jump-back link. **Linked citations**: eyecite wraps each citation server-side in `<span class="citation" data-id><a href="…#pin">`. A citation that matches several cases gets a `multiple-matches` class, and one that cannot be resolved gets `no-link` and is italicized. A pin cite links to the target opinion's page anchor, such as `#122` ([annotate_citations.py](https://github.com/freelawproject/courtlistener/blob/main/cl/citations/annotate_citations.py)).

## Only Oyez's fonts are free to ship as-is

Of the fonts these sites load, the only ones you can use as-is are Oyez's two Merriweather families, CourtListener's system stacks, and its v2 web fonts. Harvey's brand fonts must be replaced. The licenses for the open fonts below come from general knowledge of Google Fonts and SIL OFL distribution, not from re-reading the license files in this research ([Google Fonts: Merriweather](https://fonts.google.com/specimen/Merriweather)).

| Site | Font as loaded | License status | What to use in the app |
|---|---|---|---|
| Harvey | HarveySerifFont (attributed to TWK Ghost, WELTKERN) | Commercial / proprietary | **Instrument Serif** 400 + italic (OFL). Alternates: Newsreader at opsz 72, or Fraunces |
| Harvey | HarveySansFont (ABC Diatype, Dinamo) | Commercial | **Inter** 400/500 (OFL). Alternates: Geist, Hanken Grotesk |
| Harvey (unverified claim) | Söhne Mono (Klim) | Commercial | Geist Mono or IBM Plex Mono |
| Oyez | Merriweather, Merriweather Sans | SIL OFL 1.1, free | Use directly if you want the literal Oyez look |
| CourtListener | Georgia, Helvetica Neue, Palatino | System fonts; free to *reference*, not to redistribute | Reference Georgia in the stack, or self-host **Source Serif 4** (OFL) for consistency across platforms |
| CourtListener | Warnock Pro (Adobe) | Commercial; only shows if the user has it installed | Leave it out of the stack |
| CourtListener v2 | Inter, Cooper Hewitt, DM Mono | SIL OFL 1.1 | Free to self-host |

Sources for the substitute reasoning: [harvey.ai](https://www.harvey.ai), [Fonts In Use](https://fontsinuse.com/uses/77027/harvey), [fonts.css](https://github.com/freelawproject/courtlistener/blob/main/cl/assets/tailwind/fonts.css).

Instrument Serif is the best match for Harvey's serif because it ships the same shape of family, a single 400 weight plus italic, and its high contrast and slight condensation hold up at 48–96px. Keep Harvey's `-0.0125em` tracking and 1.05 leading. Avoid Playfair Display: its ball terminals read as fashion, not law. Inter's metrics sit close to the Arial fallback that Harvey's `size-adjust: 99.34%` targets, so line lengths will barely move.

## Copy measurements, never files, logos, or portraits

Three different legal regimes apply, and they constrain different things. **CourtListener's code is AGPL-3.0** ([LICENSE.txt](https://github.com/freelawproject/courtlistener/blob/main/LICENSE.txt)). If you paste `opinions.css`, `opinions.js`, `override.css`, or the templates into your app, even lightly edited, the app becomes a derivative work. Because users reach it over a network, AGPL §13 would then require you to offer them the complete source. Measurements, hex values, and layout ideas such as "page numbers float in the right margin" are generally not copyrightable expression. Rewriting them as your own React components and CSS (a clean-room approach, with this report as the spec layer) avoids that obligation. This is not legal advice. CourtListener's opinion text is public-domain law, but its API has its own terms and needs a token.

**Oyez content is CC BY-NC 4.0**, and "Oyez" is a registered trademark of Oyez, Inc. ([oyez.org license](https://www.oyez.org/views/static/license.html)). Its case text, its data (including the `ideology` scores), and its cut-out justice thumbnails need attribution and are restricted to non-commercial use. If the vote-prediction app could ever earn money, or might be shown to investors as a product, source portraits elsewhere: commission your own, or use official Court portraits after checking each one's rights. Each Oyez portrait credits its own source, for example "The Collection of the Supreme Court of the United States," so rights differ from image to image ([api.oyez.org](https://api.oyez.org/people/john_g_roberts_jr)). Do not use the Oyez name or logo.

**Harvey's** risk is in its brand, not its code. Its fonts are licensed and must not be downloaded or reused. Its wordmark is set as ":Harvey:" in the serif with ligatures, which points to custom glyphs, and its marketing imagery and product screenshots are its own ([harvey.ai](https://www.harvey.ai)). Reproduce the *system*: the warm-gray ramp, the serif-over-sans scale contrast, 4px buttons, and alternating ivory and ink bands. Give the app its own name and wordmark, so it reads as "in the style of" Harvey, not as Harvey.

## Each screen borrows one site's skeleton, wrapped in Harvey's skin

The unifying move is to **use Harvey's tokens as the only theme**: ivory and ink, Instrument Serif headings at 400, Inter body text, 1px warm-gray hairlines, and 4px buttons. Then rebuild Oyez's and CourtListener's *structures* inside that theme, rather than importing their blues and maroons. This is a design recommendation derived from the specs above. It gives three borrowed layouts a single visual voice.

**App shell and case list (Harvey).** Use a fixed 72px header with the ivory blur at 72% opacity and `backdrop-filter: blur(16px)`. Put your own serif wordmark on the left and 14px/500 nav (Cases, Justices, Methodology) in the center. Hero headlines use `heading-1` (48 → 96px), and lead paragraphs use body-1, 20px, in `#33312c`. Lay out case cards as hairline-divided rows, not shadowed cards: each row has the case name in `heading-3` serif and the docket and term in 14px muted Inter. Use one ink "Predict" CTA (48px, 4px radius). Put the methodology and accuracy section on an ink band with huge serif stat numbers, as Harvey's StatsSection does, and finish with an ink footer. If you add an "ask the model" panel, copy Harvey's Assistant pattern: answers render as unboxed document text, with a bottom composer of 12px radius, an `#f2f1f0` fill, and a 1px `#e5e5e3` border.

**Decision screen (Oyez vote panel).** Rebuild `oy-decision` exactly: a 720px row of nine absolutely positioned slots at 11.111% each, max 80px, with the 1.5rem zig-zag, 150%-wide portraits, and 12px italic last-name captions. Majority justices show at full opacity, minority at **.5**, and recused or non-participating at **.1**. Above it, use Oyez's heading structure but in Harvey type: an eyebrow line such as "PREDICTED 6–3 FOR LOPER BRIGHT · MAJORITY OPINION BY ROBERTS" in Inter 500, 12px, uppercase, `.12em` tracking, `#706d66`. Below the row, set the predicted holding in Instrument Serif at about 28px instead of Oyez's 12px line, because in this app the prediction is the headline. Keep the "Sort: by seniority | by ideology" toggle and the 0.5s `cubic-bezier(0.23,1,.32,1)` slide. Two additions suit predictions. First, a small per-justice confidence value under each caption, in 12px tabular Inter. Second, an optional faint dashed outline for low-confidence slots, so opacity keeps meaning only majority versus minority. Lay out the rest of the page as Oyez does: a left one-third column with the case title and metadata eyebrows, and a right two-thirds column with Facts, Question, and Prediction sections, each with prose capped at 40rem. Make the column a hairline-bordered ivory panel rather than Oyez's `#0E7AAA` fill.

**Per-justice reasoning and brief summary (CourtListener reading view).** Use a `grid-template-columns: 280px minmax(0,1fr)` layout inside a 1170px sheet. The sticky TOC (`top: 72px` to clear the Harvey header, `height: calc(100vh - 72px)`) lists Caption, Brief Summary, Question Presented, then one entry per justice ("Roberts: majority", "Kagan: dissent"). Each row is 12px and 2.5em tall, with a 2px `#cccac6` rail and an **ink** active segment in place of maroon. An IntersectionObserver replaces CourtListener's scroll handler. Use an `#f2f1f0` caption box for case metadata, with `<strong>`-label rows, and a 999px-radius date pill with a 1px ink outline. Every section gets a serif h2 with 50px top margin, then a `2px solid #0f0e0d` rule, then the body. Set the body in **Source Serif 4** (or Georgia) at 15–16px with 2em indents, justified, with `hyphens:auto`. CourtListener's literal leading is 2.3. Consider **1.9–2.0** for long AI-written reasoning, which is a judgment call. Use the margin-page-number pattern for citations to brief pages ("Pet. Br. 14"): anchor each number, float the label 1em into a right padding of at least 3em, and hide it below 768px. Render footnotes at the end of each section with two-way `#fnN` / `#fnrefN` links. Link citations to CourtListener cluster URLs with `#page` pin fragments, linking and attributing CourtListener as the source rather than copying its HTML. Do the page-number and footnote normalization once, at data-build time, not as DOM rewriting after render.

## Conclusion

The three sites form a clear stack of responsibilities. Harvey supplies a brand system with almost no hue. Oyez supplies a data visualization whose whole grammar is position plus opacity. CourtListener supplies a long-form reading layout tuned for citation. Because Harvey avoids color, the other two layouts can sit inside it without clashing, once their single accent colors (Oyez blue, CourtListener maroon) are replaced with ink. The real constraints are legal, not technical. Portraits and ideology scores are the parts most likely to block commercial use, so source them independently early. Treat this report, not the AGPL source, as the spec the React code is written from.

## Consolidated CSS tokens

These are ready to paste into `src/tokens.css` and import once in `main.jsx`. Values marked "adapted" are design choices from the screen mapping above; everything else is a measured value from the sources cited in this report.

```css
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600&family=Source+Serif+4:ital,wght@0,400;0,600;1,400&display=swap');

:root {
  /* ---------- Type families (free substitutes) ---------- */
  --font-display: "Instrument Serif", Georgia, serif;                  /* for HarveySerif / TWK Ghost */
  --font-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; /* for ABC Diatype */
  --font-reading: "Source Serif 4", Georgia, "Times New Roman", Times, serif; /* CourtListener reading body */
  --font-mono: "Geist Mono", "IBM Plex Mono", ui-monospace, monospace;

  /* ---------- Harvey warm-gray ramp ---------- */
  --ink: #0f0e0d;  --g900: #1f1d1a; --g800: #33312c; --g700: #524f49; --g600: #706d66;
  --g500: #8f8b85; --g400: #adaba5; --g300: #cccac6; --g200: #e5e5e3; --g100: #f2f1f0;
  --ivory: #fafaf9; --white: #ffffff;
  --casal: #333f40; --velvet: #373340; --bronze: #593d3a; --blush: #d9cdcc;
  --red: #f26161; --red-bg: #feeaea; --green: #16a34a; --yellow: #eab308; --highlighter: #f6f202;

  /* ---------- Semantic (light / "white" theme) ---------- */
  --bg: var(--ivory);  --bg-2: var(--g100);  --bg-hover: var(--g100);
  --text: var(--ink);  --text-2: var(--g800); --muted: var(--g600); --disabled: var(--g400);
  --border: var(--g300); --border-2: var(--g200);
  --nav-tint: rgb(250 250 249 / .72);
  --accent: var(--ink);                       /* adapted: replaces Oyez #0E7AAA and CL #B53C2C */

  /* ---------- Type scale ---------- */
  --h1: clamp(48px, 6vw, 96px);  --h2: clamp(36px, 4vw, 64px);  --h3: clamp(28px, 2.4vw, 40px);
  --body-0: 24px; --body-1: 20px; --body-2: 16px; --body-3: 14px; --caption: 12px; --eyebrow: 10px;
  --lh-display: 1.05; --lh-ui: 1.3; --lh-reading: 2;   /* CourtListener literal: 2.3 */
  --track-display: -0.0125em; --track-heading: -0.01em;
  --track-eyebrow: .17em;                              /* Oyez; use .12em for Inter (adapted) */

  /* ---------- Spacing / layout ---------- */
  --s-xs: 7px; --s-sm: 14px; --s-md: 28px; --s-lg: 56px; --s-xl: 112px; --s-2xl: 140px;
  --header-h: 72px; --page-max: 1728px; --gutter: 28px;
  --prose-max: 40rem;       /* Oyez abstracts */
  --vote-row-max: 45rem;    /* Oyez decision-image */
  --reader-max: 1170px; --toc-w: 280px;   /* CourtListener container / sidebar */
  --radius-xs: 2px; --radius-sm: 4px; --radius-md: 6px; --radius-lg: 8px; --radius-xl: 12px; --radius-pill: 999px;

  /* ---------- Motion ---------- */
  --ease-soft: cubic-bezier(.3,.3,.3,1);  --ease-out: cubic-bezier(0,.7,.3,1);
  --ease-slide: cubic-bezier(0.23,1,.32,1); /* Oyez vote re-sort */
  --dur-color: .3s; --dur-slide: .5s;

  /* ---------- Vote panel ---------- */
  --vote-majority: 1; --vote-minority: .5; --vote-none: .1;
  --vote-stagger: 1.5rem;

  /* ---------- Reading view ---------- */
  --rule-section: 2px solid var(--ink);
  --rule-footnote: 1px solid var(--ink);
  --toc-rail: var(--g300); --toc-active: var(--ink);
  --page-num: var(--g600);
  --link: var(--ink); --link-underline: var(--g400);
}

[data-theme="black"] {
  --bg: var(--ink); --bg-2: var(--g900); --bg-hover: var(--g900);
  --text: var(--ivory); --text-2: var(--g300); --muted: var(--g500); --disabled: var(--g800);
  --border: var(--g800); --border-2: var(--g700);
  --nav-tint: rgb(15 14 13 / .6); --accent: var(--ivory);
}
[data-theme="gray"] { --bg: var(--g100); --bg-2: var(--g200); --muted: var(--g700); }

/* ---------- Base ---------- */
html { font-family: var(--font-sans); line-height: 1.5; -webkit-font-smoothing: antialiased; text-rendering: geometricPrecision; }
body { margin: 0; background: var(--bg); color: var(--text); }
h1, h2, h3 { font-family: var(--font-display); font-weight: 400; line-height: var(--lh-display); font-feature-settings: "liga" on, "calt" on; text-wrap: balance; }
h1 { font-size: var(--h1); letter-spacing: var(--track-display); }
h2 { font-size: var(--h2); letter-spacing: var(--track-heading); }
h3 { font-size: var(--h3); letter-spacing: var(--track-heading); }
.eyebrow { font: 500 12px/24px var(--font-sans); text-transform: uppercase; letter-spacing: .12em; color: var(--muted); }
.btn { height: 48px; padding: 0 20px; border: 0; border-radius: var(--radius-sm); background: var(--text); color: var(--bg);
       font: 500 16px/1 var(--font-sans); transition: background-color var(--dur-color) var(--ease-soft); cursor: pointer; }
.btn:hover { background: var(--g800); }
.header { position: fixed; inset: 0 0 auto; height: var(--header-h); background: var(--nav-tint); backdrop-filter: blur(16px); z-index: 10; }

/* ---------- Oyez-style vote row ---------- */
.vote-row { position: relative; max-width: var(--vote-row-max); margin: 0 auto; height: 9em; }
.vote-slot { position: absolute; left: 0; width: 11.1111%; max-width: 5rem; display: flex; flex-direction: column;
             transition: transform var(--dur-slide) var(--ease-slide); }   /* set transform: translateX(calc(var(--i) * 100%)) inline */
.vote-slot:nth-child(odd)  { margin-top: var(--vote-stagger); }
.vote-slot:nth-child(even) { flex-direction: column-reverse; }
.vote-slot img { width: 150%; margin-left: -25%; display: block; }
.vote-slot figcaption { width: 200%; margin-left: -50%; text-align: center; white-space: nowrap; height: 1.5rem;
                        font: italic 400 12px/24px var(--font-sans); }
.vote-slot.minority img { opacity: var(--vote-minority); }
.vote-slot.none img     { opacity: var(--vote-none); }

/* ---------- CourtListener-style reader ---------- */
.reader { display: grid; grid-template-columns: var(--toc-w) minmax(0, 1fr); max-width: var(--reader-max); margin: 0 auto; }
.toc { position: sticky; top: var(--header-h); height: calc(100vh - var(--header-h)); overflow-y: auto; padding: 20px; }
.toc li { list-style: none; height: 2.5em; position: relative; font: 400 12px/2.5em var(--font-sans); }
.toc li::before { content: ""; position: absolute; left: 0; top: 0; height: 100%; border-left: 2px solid var(--toc-rail); }
.toc li a { padding-left: 10px; color: var(--text); text-decoration: none; }
.toc li.active { font-weight: 600; }
.toc li.active::before { border-left-color: var(--toc-active); }
.reader section > h2 { margin-top: 50px; font-size: 32px; }
.reader section > hr { border: 0; border-top: var(--rule-section); }
.reading { font: 400 16px/var(--lh-reading) var(--font-reading); letter-spacing: .2px; text-align: justify; hyphens: auto; padding-right: 3em; }
.reading p { margin: 0; text-indent: 2em; }
.reading blockquote { margin-left: 3em; } .reading blockquote > * { text-indent: 0; }
.page-label { font-style: italic; font-size: .8em; margin: 0 4px 0 2px; color: var(--page-num); } /* not positioned, so ::after anchors to .reading */
.page-label::after { content: attr(data-label); position: absolute; right: 0; text-indent: 0; color: var(--page-num); font-size: 1em; }
.reading { position: relative; } /* adapted: CL uses right:-1em into its gutter; right:0 lands inside our 3em padding-right */
.footnotes > li:first-child { border-top: var(--rule-footnote); }
.footnotes > li { padding: 10px 0 0 40px; font: 400 12px/1.5 var(--font-reading); list-style: none; }
.case-date-pill { border: 1px solid var(--accent); border-radius: var(--radius-pill); padding: 0 10px; color: var(--accent); }
.caption-box { background: var(--bg-2); padding: 10px 10px 0 20px; }
@media (max-width: 767px) { .reader { grid-template-columns: 1fr; } .toc { position: static; height: auto; } .page-label::after { display: none; } }
```
