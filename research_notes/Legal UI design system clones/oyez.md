# Oyez (oyez.org) case page, vote breakdown and justice page: visual spec

Method: on 2026-10-08 I pulled the live raw HTML, CSS bundle (`/styles/main.0cc311b8.css`, 95 KB, Foundation 5.5.3 plus Oyez custom rules), JS bundle (`/scripts/scripts.dc9cbca2.js`), the Angular templates (`/views/case.html`, `/templates/decision.html`, `/views/person.html`, etc.) and the API JSON directly with urllib/curl. Values marked **[CSS]** are copied from the shipped stylesheet. **[TPL]** means from the Angular template, **[JS]** from the JS bundle, **[API]** from api.oyez.org JSON. **[EST]** marks my estimate or inference.

Primary sources:
- HTML shell: https://www.oyez.org/cases/2023/22-451
- CSS: https://www.oyez.org/styles/main.0cc311b8.css (hashed filename, so it will change on redeploy)
- JS: https://www.oyez.org/scripts/scripts.dc9cbca2.js
- Templates: https://www.oyez.org/views/case.html, https://www.oyez.org/templates/decision.html, https://www.oyez.org/views/person.html, https://www.oyez.org/templates/sidebar.html, https://www.oyez.org/views/static/license.html
- API: https://api.oyez.org/cases/2023/22-451, https://api.oyez.org/people/john_g_roberts_jr

---

## 1. Page structure of a case page (header, sidebar, sections, decision, opinions, audio)

### Takeaway
A case page is a two-column flex layout. On the left is a full-height blue (#0E7AAA) sidebar, 1/3 wide, holding the case title (Merriweather 42px, white), a "Media" list (audio links) and an "Opinions" list. On the right is a 2/3-wide content column. It starts with a metadata grid (party labels, docket, court, citation, dates, advocates), then "Facts of the case", "Question" and "Conclusion" sections. The Conclusion section holds the vote-breakdown figure above the conclusion text. Above everything sit a dark overhead bar (#222) and a white icon nav bar. There are no tabs.

### Cited Findings
- The app shell is AngularJS (`data-ng-app="oyezorgApp"`, `<title>{{meta.fullTitle}}</title>`). The body is `.container.off-canvas-wrap > .inner-wrap > <oy-overhead>, <oy-navigation>, <div class="page" ng-view>`, then `<oy-footer>`. Stylesheets: `styles/vendor.724e8f17.css` (angular-loading-bar only) and `styles/main.0cc311b8.css`. Scripts: Modernizr 2.8.3, `vendor.a07b4858.js`, `scripts.dc9cbca2.js`. — [oyez.org case HTML](https://www.oyez.org/cases/2023/22-451)
- Case view DOM [TPL]: `<main class="case flex">` contains `<oy-sidebar title="{{case.name}}" class="blue">` (with `.media` "Media" list and `.documents` "Opinions" list), then `<article class="content"><div class="content-inner">`, which holds `<aside>` (3 `.row`s of `.cell`s), then `section.abstract` "Facts of the case", `section.abstract` "Question", `section.abstract` "Conclusion" (holding `.decisions` and then the conclusion HTML), an optional "Oral Argument 2.0" paragraph, and `<oy-cite>`. — [views/case.html](https://www.oyez.org/views/case.html)
- Metadata grid [TPL]. Row 1: `{first_party_label}` / first_party, `{second_party_label}` / second_party, "Location" (Google Maps embed, only if present). Row 2: "Docket no.", "Decided by" (court name with the parenthetical stripped, linking to `/courts?court=`; italic "Case pending" when there isn't one), "Lower court". Row 3: left cell has "Citation" (formatted `603 US _ (2024)`, linking to Justia) plus one subcell per timeline event (Granted, Argued, Decided…) with short dates; right cell has "Advocates" (name link plus italic description, e.g. "for the Petitioners"). — [views/case.html](https://www.oyez.org/views/case.html); citation format from the `oyCitation` filter (`volume&nbsp;US&nbsp;page|_&nbsp;(year)`) — [scripts.js](https://www.oyez.org/scripts/scripts.dc9cbca2.js)
- Case title: "v." is wrapped in `<span class="v">` and styled italic #222. — [scripts.js](https://www.oyez.org/scripts/scripts.dc9cbca2.js); [CSS](https://www.oyez.org/styles/main.0cc311b8.css) `main.case .v{font-style:italic;color:#222}`
- Sidebar [CSS]: `.oy-sidebar` becomes `display:flex;width:33.333%` at ≥64.0625em (1025px). `.oy-sidebar.blue .full-sidebar{background-color:#0E7AAA}` with an h1 in #FFF. The h1 is `font-family:Merriweather,serif;font-weight:400;font-size:42px;line-height:54px;margin-bottom:2rem;text-align:center` (left-aligned on desktop). Sidebar h2 ("Media"/"Opinions") is Merriweather Sans 10px/24px, 700, uppercase, letter-spacing .17em, white on desktop. The `.inner` has a 1rem margin; at ≥90.0625em (1441px) it is 75% wide with margin-left 16.667%. — [CSS](https://www.oyez.org/styles/main.0cc311b8.css)
- Sidebar list links (audio/opinions) [CSS]: Merriweather Sans 10px, 700, uppercase, .17em tracking, line-height 1rem, padding `.5rem 0 .5rem 1.5rem`, a 1rem×1rem left background icon (`/images/media/audio.2fa8d7f0.svg` or `/images/media/document.564e2278.svg`), white on desktop. Items have `margin-bottom:1.25rem`. An audio note reads "Note: …" in 12px italic. — [CSS](https://www.oyez.org/styles/main.0cc311b8.css)
- Opinions are sorted syllabus → majority → plurality → concurring → in-part → dissenting [JS `sortOpinions`]. Each link shows the title plus "(JudgeLastName)" and goes to Justia (`justia_opinion_url` dir + `#tab-opinion-{justia_opinion_id}`). — [scripts.js](https://www.oyez.org/scripts/scripts.dc9cbca2.js)
- Audio player: each audio item is an `<oy-media-item>` that opens an iframe modal to `https://apps.oyez.org/player/#/{courtIdentifier}/{oral_argument_audio|opinion_announcement_audio}/{id}`. Oral arguments use `heard_by[0].identifier`; announcements use `decided_by.identifier`. The player is a separate app and is not inline on the case page. — [scripts.js](https://www.oyez.org/scripts/scripts.dc9cbca2.js)
- Content column [CSS]: `.content` is `width:66.667%;float:left;margin-bottom:5rem` at ≥1025px. `main.case .content-inner` is 91.667% wide with margin-left 8.333% at ≥1025px, and 75% wide with margin-left 8.333% at ≥1441px. On mobile it has 1rem side margins. — [CSS](https://www.oyez.org/styles/main.0cc311b8.css)
- Metadata rows [CSS]: `main.case aside .row{margin:2rem auto 0;max-width:62.5rem;border-top:1px solid #222}`. `.cell{width:50%;float:left;padding:0 .9375rem;margin-top:1rem;border-left:1px solid #FFF;font:12px/24px 'Merriweather Sans'}`. The cell h3 is a 10px/24px, 700, uppercase, .17em, **#0E7AAA** label. `.subcell` has a bottom border of 1px #FFF and 1rem padding/margin. The 3rd cell in rows 1–2 drops to a full-width line. — [CSS](https://www.oyez.org/styles/main.0cc311b8.css)
- Section headings [CSS]: `main.case .abstract h2{font-family:Merriweather,serif;font-weight:400;font-size:28px;line-height:36px}`, centered at ≥1441px. `.abstract{margin-bottom:3rem}`. Paragraph and list `max-width:40rem` (centered at ≥1441px). At 641–1024px, `.abstract` is 66.667% wide and centered. — [CSS](https://www.oyez.org/styles/main.0cc311b8.css)
- Global header [CSS]: `.oy-overhead` (≥720px) is a #222 strip, padding 0 30px, wrapper max-width 1340px, white 13px (.8125rem) bold links. Dropdowns are #313131 with 7px 27px 7px 21px padding in Helvetica Neue, plus a right-side search input (white, 1px #1b1b1b border, 3px radius). Below it is `.oy-navigation .nav-bar` (white, border-bottom 1px, padding 1.3125rem 0, inner max-width 1365px, 8.375rem tall at ≥1025px). It has the logo (`images/nav/logo_black.beb12aef.png`, max-width 201px, 1/3 column) and 4 icon links (Cases, Justices, Advocates, Media). Each icon is 3.7625rem square with a caption that is 10px, 700, uppercase, .17em, #222. — [CSS](https://www.oyez.org/styles/main.0cc311b8.css); [navigation.html](https://www.oyez.org/templates/navigation.html); [overhead.html](https://www.oyez.org/templates/overhead.html)
- Footer [CSS]: white, 85px tall, max-width 1340px, padding 0 30px. Sponsor logos (LII/Cornell, CLS, Justia, IIT Chicago-Kent) on the left, 24px social icons on the right. Footer copyright string: '©2016 by Oyez, Inc. "Oyez" is a registered trademark of Oyez, Inc.' and sponsor "Chicago-Kent College of Law at Illinois Tech". — [CSS](https://www.oyez.org/styles/main.0cc311b8.css); [scripts.js](https://www.oyez.org/scripts/scripts.dc9cbca2.js)
- `<oy-cite>` block at the bottom: a 12px Merriweather Sans block with a Merriweather 1rem/36px h2 and an inline list of citation-style tabs. The active tab is `rgba(14,122,170,.9)` and underlined. — [CSS](https://www.oyez.org/styles/main.0cc311b8.css)

### Inferences
- There are **no tabs** on the case page. "Facts / Question / Conclusion" are stacked sections. The only tab-like UI is the citation-format switcher at the bottom and the "Sort: by seniority | by ideology" links.
- In a React clone: `<Header/>` (dark strip plus white icon nav), then `<main style={{display:'flex'}}><Sidebar/> (1/3, #0E7AAA)<article> (2/3)</main>`. Below 1025px, stack the sidebar above the content. The sidebar is not blue on mobile, because `.blue` only applies at ≥64.0625em. [EST: the mobile sidebar falls back to the page background, with the 42px h1 centered]

### Gaps
- I could not render the page (no headless browser was used), so the actual pixel heights and the mobile appearance were not visually confirmed. No screenshots were captured.
- The 2015 redesign blog post (blogs.kentlaw.iit.edu/iscotus/oyez-new-and-improved) returned HTTP 401, so there is no design-rationale source.

---

## 2. The vote breakdown component

### Takeaway
Oyez does **not** split justices into two separate groups. It renders all 9 justices in **one horizontal row of 9 equal slots**, ordered by seniority (default) or by ideology (a toggle). Majority justices appear at full opacity, minority justices at **50% opacity**, and non-participating justices at **10% opacity**. The slots alternate in a zig-zag: odd positions sit 1.5rem lower with the name caption below, and even positions sit higher with the caption above. A centered uppercase blue heading above the row reads, for example, "6–2 DECISION FOR LOPER BRIGHT / MAJORITY OPINION BY JOHN G. ROBERTS, JR.", followed by a one-line holding.

### Cited Findings
- Template [TPL], `templates/decision.html`:
  ```html
  <figure class="oy-decision">
    <figcaption class="decision-description">
      <h3 class="vote-description">
        <span class="vote">{{majority_vote}}–{{minority_vote}} decision</span>   <!-- or "Unanimous decision" if minority_vote==0; or "Decision" if type not majority/plurality opinion -->
        <span class="winner"> for {{winning_party}}</span>
        <span class="author"><br>{{decision_type}} by {{author}}</span>          <!-- or "<i>Per Curiam</i> opinion" -->
      </h3>
      <p class="holding">{{decision.description}}</p>
    </figcaption>
    <div class="decision-image">
      <figure ng-class="[vote.vote, vote.orderClass]" ng-repeat="vote in decision.votes">  <!-- classes: majority|minority|none + first..ninth -->
        <div class="thumbnail"><img src="{{vote.member.thumbnail.href}}" alt="{{vote.member.name}}"></div>
        <figcaption><span class="long">{{member.name}}</span><span class="short">{{member.last_name}}</span></figcaption>
      </figure>
    </div>
  </figure>
  ```
  — [decision.html](https://www.oyez.org/templates/decision.html)
- Ordering logic [JS]: the `oyDecision` directive runs `$filter('orderBy')(votes, orderBy)`, where `orderBy` is `"seniority"` (default) or `"ideology"`. It sorts ascending on the vote's numeric `seniority` (1 = Chief Justice) or `ideology` (negative = liberal → leftmost). Each sorted index 0–8 maps to the class `first…ninth`. `author` is set to the name of the vote whose `opinion_type` is `"majority"` or `"plurality"`. — [scripts.js](https://www.oyez.org/scripts/scripts.dc9cbca2.js)
- Sort UI [TPL/CSS/JS]: `<div class="sort-links"><span class="label">Sort:&nbsp;</span>` followed by the links "by seniority" and "by ideology", floated left, 12px/24px, label italic. The active link is italic and underlined. When there are multiple decisions, a `.decision-cycle` "<< decision 1 of 2 >>" is floated right, and decisions sit in an `<oy-carousel>` that slides with `transform .5s cubic-bezier(0.23,1,.32,1)`. — [case.html](https://www.oyez.org/views/case.html); [CSS](https://www.oyez.org/styles/main.0cc311b8.css)
- Heading style [CSS]: `.oy-decision .decision-description{text-align:center}`. h3: `font-family:'Merriweather Sans';font-size:10px;line-height:24px;letter-spacing:.17em;text-transform:uppercase;font-weight:700;color:#0E7AAA;margin:0`. Holding: `12px/24px Merriweather Sans 400; margin-bottom:.5rem`. — [CSS](https://www.oyez.org/styles/main.0cc311b8.css)
- Row geometry [CSS]:
  - `.oy-decision{margin:0 0 1rem;width:100%;clear:both}`
  - `.decision-image{position:relative;max-width:45rem;margin:0 auto;height:7em}`. Height is `9em` at ≥64.0625em (and in print).
  - `.decision-image figure{position:absolute;left:0;width:11.1111111%;max-width:5rem;margin:0;display:flex;flex-flow:column;transition:transform .5s cubic-bezier(0.23,1,.32,1)}`. Each slot is 1/9 of the row, max 80px.
  - Positions: `.first{transform:none;margin-top:1.5rem}`, `.second{translateX(100%)}`, `.third{translateX(200%);margin-top:1.5rem}` … `.ninth{translateX(800%);margin-top:1.5rem}`. Odd slots (1,3,5,7,9) get `margin-top:1.5rem` with thumbnail `order:1` and caption `order:2` (caption below). Even slots (2,4,6,8) have no offset, with thumbnail `order:2` and caption `order:1` (caption above). The transform transition animates justices sliding to new positions when the sort changes.
  - `.thumbnail{width:150%;margin-left:-25%}`: the portrait is 1.5× the slot width, so neighbouring portraits overlap horizontally.
  - figcaption: `12px/24px Merriweather Sans 400; font-style:italic; white-space:nowrap; height:1.5rem; text-align:center; width:200%; margin-left:-50%`.
  - Name length: `.long` (full name) is hidden and `.short` (last name) is shown by default. At ≥120.0625em (≥1921px) this flips to full names. In practice most users see last names only.
  - `figure.minority img{opacity:.5}`; `figure.none img{opacity:.1}`. Majority images have no opacity rule (full).
  — [CSS](https://www.oyez.org/styles/main.0cc311b8.css)
- Colors in the vote component: only #0E7AAA (heading), body text #222, and opacity. There is no red or green majority/minority coloring and no frame or border on the portraits. — [CSS](https://www.oyez.org/styles/main.0cc311b8.css)
- Portrait assets [API]: `vote.member.thumbnail.href`, e.g. `https://api.oyez.org/sites/default/files/images/people/john_g_roberts_jr/john_g_roberts_jr.thumb.png`. I checked the PNG headers: **300×200 px, 8-bit RGBA (color type 6, i.e. with alpha)** for both the Roberts and Kavanaugh thumbs. These are cut-out portraits on transparent backgrounds, displayed as rectangles with no border-radius (no circle mask in the CSS). — [API image](https://api.oyez.org/sites/default/files/images/people/john_g_roberts_jr/john_g_roberts_jr.thumb.png)
- Live example, Loper Bright v. Raimondo (22-451) [API]: decision `{majority_vote:6, minority_vote:2, winning_party:"Loper Bright", decision_type:"majority opinion", description:"Chevron U.S.A. v. NRDC is overruled."}`. Votes as seniority / ideology / vote / opinion_type:
  - Roberts 1 / 0.514 / majority / majority
  - Thomas 2 / 3.094 / majority / concurrence
  - Alito 3 / 2.532 / majority / none
  - Sotomayor 4 / −4.094 / minority / none
  - Kagan 5 / −2.461 / minority / dissent
  - Gorsuch 6 / 1.119 / majority / concurrence
  - Kavanaugh 7 / 0.524 / majority / none
  - Barrett 8 / 0.685 / majority / none
  - Jackson 9 / −2.045 / **none** (recused, 10% opacity)

  — [api.oyez.org/cases/2023/22-451](https://api.oyez.org/cases/2023/22-451)

### Inferences
- Rendered heading for that case: "6–2 DECISION FOR LOPER BRIGHT" with a line break, then "MAJORITY OPINION BY JOHN G. ROBERTS, JR." [inferred from template plus data; `author` = name of the vote with opinion_type "majority"].
- Sorted by ideology, the row runs Sotomayor, Kagan, Jackson, Roberts, Kavanaugh, Barrett, Gorsuch, Alito, Thomas (liberal on the left).
- A React equivalent can skip absolute positioning. Use a flex row of 9 slots (`width:11.11%`, `max-width:80px`) with `align-items:flex-start`, and alternate `margin-top:1.5rem` and `flex-direction:column|column-reverse` by index. To keep the sliding animation, use absolutely positioned slots with `transform: translateX(index*100%)` as Oyez does. [EST]
- The total row is about 45rem (720px) max. The visible portrait is about 120×80px (150% of an 80px slot at a 3:2 aspect ratio). [EST, derived from CSS]

### Gaps
- `ideology` values are Oyez-provided numbers whose source and method are not documented on the page or in the API (they resemble Martin-Quinn scores, but that is unverified).
- I could not confirm how the component looks for 8-justice or fewer-justice historical courts beyond what the CSS implies (empty trailing slots).

---

## 3. Fonts

### Takeaway
There are two Google Fonts, both SIL Open Font License: **Merriweather** (serif, 400/400i/700/700i) for titles and section headings, and **Merriweather Sans** (300/400/400i/700/700i) for body, labels and UI. Body text is 14px/24px. Labels use one recurring "eyebrow" style: 10px/24px, 700, uppercase, letter-spacing .17em. A leftover Foundation default (`"Helvetica Neue",Helvetica,Roboto,Arial`) applies to unstyled h1–h6.

### Cited Findings
- `@import url(https://fonts.googleapis.com/css?family=Merriweather:400,400italic,700,700italic)` and `@import url(https://fonts.googleapis.com/css?family=Merriweather+Sans:300,400,400italic,700,700italic)`. These are repeated 17× in the bundle, an artifact of the Sass build. There is no @font-face, Typekit or self-hosting. — [CSS](https://www.oyez.org/styles/main.0cc311b8.css)
- font-family usage counts in the bundle: `'Merriweather Sans',sans-serif` ×40; `Merriweather,serif` ×9; Foundation `"Helvetica Neue",Helvetica,Roboto,Arial,sans-serif` ×3. — [CSS](https://www.oyez.org/styles/main.0cc311b8.css)
- Type scale (all [CSS]):
  - body: `font-family:'Merriweather Sans',sans-serif;font-size:14px;line-height:24px;letter-spacing:0;color:#222;background-color:#F8F8F8`
  - sidebar title h1: Merriweather 400, 42px/54px
  - section h2 (Facts/Question/Conclusion), role-banner h2: Merriweather 400, 28px/36px
  - oy-cite h2: Merriweather 400, 1rem/36px
  - eyebrow labels (metadata h3, decision h3, sidebar h2, nav captions, person dt): Merriweather Sans 700, 10px/24px, uppercase, letter-spacing .17em, usually #0E7AAA
  - small body (metadata cells, holding, captions, sort links, dd): Merriweather Sans 400, 12px/24px
  - Foundation p default: 1rem, line-height 1.6, margin-bottom 1.25rem
  - overhead nav: 13px (.8125rem) bold white

  — [CSS](https://www.oyez.org/styles/main.0cc311b8.css)

### Inferences
- License: Merriweather and Merriweather Sans (Sorkin Type) are distributed by Google Fonts under the SIL OFL 1.1 and are free to use and self-host. No substitute is needed. Load `https://fonts.googleapis.com/css2?family=Merriweather:ital,wght@0,400;0,700;1,400;1,700&family=Merriweather+Sans:ital,wght@0,300;0,400;0,700;1,400;1,700&display=swap` or `@fontsource/merriweather` and `@fontsource/merriweather-sans`. [Licensing is general knowledge of Google Fonts (https://fonts.google.com/specimen/Merriweather); not re-fetched in this session.]

### Gaps
- I did not verify the current OFL license text in this session.

---

## 4. Color palette, spacing, borders, widths

### Takeaway
The palette is minimal. The single brand blue **#0E7AAA** is used for the sidebar background, eyebrow labels and the decision heading. Text is **#222**, the page background is **#F8F8F8**, and nav and footer surfaces are white. The overhead strip is **#222** with dropdowns in **#313131**. Links fall back to Foundation's **#008CBA**, hover **#0078a0**. Content is capped at 62.5rem (1000px) for metadata rows, 40rem (640px) for prose and 45rem (720px) for the vote row, and the header and footer wrappers at 1340px.

### Cited Findings
- Most frequent hex values in the bundle: #FFF ×68+8, #333 ×23, #222 ×20, **#0E7AAA ×12**, #ccc ×10, #5e5e5e ×9, #008CBA ×6 (Foundation primary), #999, #444, #DDD, #172C39 ×4, #283E49. Foundation alert and success colors (#43AC6A, #f04124, #f08a24, #a0d3e8) are present but not used by the case page. Also `rgba(14,122,170,.9)` for the active cite tab. — [CSS](https://www.oyez.org/styles/main.0cc311b8.css)
- Specific roles [CSS]:
  - page background `#F8F8F8` (print #FFF)
  - text `#222`
  - brand blue `#0E7AAA` (sidebar bg, labels, decision h3, person role-banner bg)
  - links `#008CBA`, hover `#0078a0`, no underline
  - overhead `#222`, dropdown `#313131`, search input border `#1b1b1b`, 3px radius
  - nav bar `#FFF`
  - footer `#FFF`
  - metadata row top rule `1px solid #222`; cell dividers `1px solid #FFF`
  - `.reviews-banner a` color #0E7AAA, weight 600, 40px tall

  — [CSS](https://www.oyez.org/styles/main.0cc311b8.css)
- Grid and spacing [CSS]: Foundation 5 grid, gutter `.9375rem` (15px) on each side. Breakpoints: small ≤40em (640px), medium 40.0625–64em (641–1024px), large ≥64.0625em (1025px), xlarge ≥90.0625em (1441px), xxlarge ≥120.0625em (1921px). There is also a custom `screen and (min-width:720px)` breakpoint for the overhead and nav. Section spacing: `.abstract` margin-bottom 3rem; metadata `.row` margin-top 2rem; `.content` margin-bottom 5rem. Minimum page height: `.container,body,html{min-height:calc(100vh - 85px)}` (85px is the footer height). — [CSS](https://www.oyez.org/styles/main.0cc311b8.css)
- There are no box-shadows or border-radius on content cards. The case page is flat. — [CSS](https://www.oyez.org/styles/main.0cc311b8.css) (radius only appears on the search input, 3px)

### Inferences
- Suggested tokens: `--oy-blue:#0E7AAA; --oy-ink:#222; --oy-bg:#F8F8F8; --oy-surface:#FFF; --oy-overhead:#222; --oy-dropdown:#313131; --oy-link:#008CBA; --oy-link-hover:#0078a0; --oy-gutter:15px`.

### Gaps
- Exact rendered colors of the SVG nav and media icons were not inspected.

---

## 5. Justice (person) pages

### Takeaway
`/justices/{identifier}` uses the same `main.flex` layout with `oy-sidebar`, but **without** the `blue` class. The sidebar holds a centered name h1, a large portrait gallery with an italic caption, and a `dl.fields` bio list (Born, Died, Religion…) with blue eyebrow `dt`s. Each role is a blue (#0E7AAA) "role-banner" with a white Merriweather 28px role title, institution name and date range, followed by appointment fields. The content column holds the biography HTML, "Cases argued", an embedded "baseball card" iframe and the cite block. The justices index shows a 25%/75% thumbnail and text grid, with former justices' thumbnails in grayscale.

### Cited Findings
- Template [TPL]: `<main class="person flex"><oy-sidebar title="{{person.name}}">`. It contains a `.gallery` of `person.images[]` (img plus figcaption `image_field_caption`) and `aside > dl.fields` with these entries: Born (date plus place), Died, Interred, Ethnicity, Religion, Family status, Mother, Father, Mother's occupation, Father's occupation. Then `.roles`, each with `.role-banner` (h2 role_title, h3 institution_name, oy-date-range) and `dl.fields` (Appointed by, Appointed, Commissioned, Sworn in, Seat, Reason for leaving, Preceded by, Succeeded by). Article: `.biography` (HTML), `aside.cases-argued`, `iframe.baseball` (`https://apps.oyez.org/baseball/?justice=…`), `oy-cite`, `oy-report`. — [views/person.html](https://www.oyez.org/views/person.html); [scripts.js](https://www.oyez.org/scripts/scripts.dc9cbca2.js)
- CSS [CSS]: `.person .oy-sidebar h1{text-align:center}`; inner `margin-bottom:7rem`. Gallery figcaption is 12px italic. `dl.fields dt` is a 10px eyebrow in #0E7AAA with margin-top 1rem; `dd` is 12px/24px. `.role-banner{background-color:#0E7AAA;text-align:center;margin-top:2rem;padding:.5rem}` with h2 Merriweather 28px/36px #FFF and h3 as a 10px eyebrow (white via `.font-white`). Justices index: `.justices li .thumbnail{width:25%}`, `.right{width:75%}`, `.role h3` eyebrow, `.justices li.former .thumbnail img{filter:grayscale(100%)}`. — [CSS](https://www.oyez.org/styles/main.0cc311b8.css)
- People API [API] keys: `ID, name, first_name, middle_name, last_name, name_suffix, date_of_birth, place_of_birth, date_of_death, place_of_death, gender, ethnicity, family_status, mother, father, mothers_occupation, fathers_occupation, biography (HTML), roles[], thumbnail{href}, images[{file{href,mime,size}, image_field_caption}], religion, length_of_service, identifier, law_school, number_of_children, home_state`. Roberts' large image is `…/john_g_roberts_jr.jpg`, captioned "The Collection of the Supreme Court of the United States". — [api.oyez.org/people/john_g_roberts_jr](https://api.oyez.org/people/john_g_roberts_jr)

### Inferences
- The person sidebar is not blue. On desktop its background is the page #F8F8F8 [EST, since `.blue` is absent], and only the role banners carry the brand blue.

### Gaps
- The large portrait dimensions and the baseball-card iframe design were not inspected.

---

## 6. Tech stack and public JSON API (data shape for the vote component)

### Takeaway
Oyez is an AngularJS 1.x SPA styled with Foundation 5.5.3 (Sass) and backed by a Drupal-style JSON API at `https://api.oyez.org` (a constant `OY_API_HOST`). It needs no auth and supports CORS-free GET via plain HTTP. `GET /cases/{term}/{docket}` returns everything the case page needs, including `decisions[].votes[]` with `vote`, `seniority`, `ideology`, `opinion_type`, `joining` and `member.thumbnail.href`.

### Cited Findings
- `angular.module("oyezorgApp").constant("OY_API_HOST","https://api.oyez.org")`. Routes and templates include `views/case.html`, `views/person.html`, `views/justices.html`, `views/cases.html`, `templates/decision.html`, `templates/carousel*.html`, `templates/sidebar.html`. External apps: `apps.oyez.org/player/#` (audio), `apps.oyez.org/docreader/#`, `apps.oyez.org/baseball/?justice=`. — [scripts.js](https://www.oyez.org/scripts/scripts.dc9cbca2.js)
- Foundation version string "5.5.3" appears in the CSS meta tags. — [CSS](https://www.oyez.org/styles/main.0cc311b8.css)
- Case JSON top-level keys [API]: `ID, name, href, view_count, docket_number, additional_docket_numbers, manner_of_jurisdiction, first_party, second_party, timeline[{event, dates[unix], href}], lower_court{ID,name,href}, facts_of_the_case (HTML), question (HTML), conclusion (HTML), advocates[{advocate{name, identifier,…}, advocate_description}], oral_argument_audio[{id,title,public_note,unavailable,display_title,href}], citation{volume,page,year,href}, decisions[], first_party_label, second_party_label, heard_by[], decided_by{name, identifier, members[]}, term, location, opinion_announcement[], description, written_opinion[{id,title,type{value,label},justia_opinion_id,justia_opinion_url,judge_full_name,judge_last_name,title_overwrite}], related_cases, justia_url, argument2_url`. — [api.oyez.org/cases/2023/22-451](https://api.oyez.org/cases/2023/22-451)
- Decision shape [API]:
  ```json
  { "description": "Chevron U.S.A. v. NRDC is overruled.",
    "majority_vote": 6, "minority_vote": 2,
    "winning_party": "Loper Bright",
    "decision_type": "majority opinion",
    "href": "https://api.oyez.org/case_decision/case_decision/17275",
    "votes": [ {
      "member": { "ID": 15086, "name": "John G. Roberts, Jr.", "last_name": "Roberts",
                  "identifier": "john_g_roberts_jr", "href": "https://api.oyez.org/people/john_g_roberts_jr",
                  "roles": [{ "role_title": "Chief Justice of the United States", "appointing_president": "George W. Bush", "date_start": 1127970000, "date_end": 0, "...": "..." }],
                  "thumbnail": { "id": 32683, "mime": "image/png", "size": 52305,
                                 "href": "https://api.oyez.org/sites/default/files/images/people/john_g_roberts_jr/john_g_roberts_jr.thumb.png" },
                  "length_of_service": 7428 },
      "vote": "majority",            // "majority" | "minority" | "none"
      "opinion_type": "majority",    // "majority" | "plurality" | "concurrence" | "dissent" | "none" ...
      "joining": null,               // or [{ID, name, ...}] of justices whose opinion they joined
      "seniority": 1, "ideology": 0.514,
      "href": "https://api.oyez.org/decision_vote/decision_vote/213193" } ] }
  ```
  — [api.oyez.org/cases/2023/22-451](https://api.oyez.org/cases/2023/22-451)
- After loading, the client adds `description` strings ("Voted with the majority" / "Voted with the minority" / "Did not participate"; the last is written to a misspelled key, `desciption`, in the source) and sets `decision.author`. — [scripts.js](https://www.oyez.org/scripts/scripts.dc9cbca2.js)
- Dates are unix seconds. A timeline date in the future is shown as italic "Pending". — [scripts.js `oyDateRange`](https://www.oyez.org/scripts/scripts.dc9cbca2.js); [case.html](https://www.oyez.org/views/case.html)
- Some thumbnail paths are inconsistent (`/files/filefield_paths/Kavanaugh-thumb.png`, `barret-thumb.png`), so always use `member.thumbnail.href` rather than constructing URLs. — [API](https://api.oyez.org/cases/2023/22-451)

### Inferences
- A minimal React vote component needs only `decision.{majority_vote, minority_vote, winning_party, decision_type, description}` and `votes[].{vote, seniority, ideology, opinion_type, member.{name,last_name,thumbnail.href}}`.
- Fetching api.oyez.org from the browser may run into CORS. I did not test the response headers [EST], so proxy the requests or cache them at build time.

### Gaps
- CORS headers and rate limits of api.oyez.org were not checked.
- There is no official API documentation. The shape above is observed, not contractual.

---

## 7. Terms of use and licensing

### Takeaway
Oyez content is released under **CC BY-NC 4.0** (attribution, non-commercial). "Oyez" is a registered trademark of Oyez, Inc. Justice portraits carry their own source captions, such as "The Collection of the Supreme Court of the United States", so image rights may differ from the text license. A clone should reproduce the layout pattern with its own branding and attribute any Oyez data or images it uses.

### Cited Findings
- "All content on oyez.org and other sites and projects maintained by Oyez is released under the Creative Commons Attribution-NonCommercial 4.0 International License." "'Oyez' is a registered trademark of Oyez, Inc." Licensing questions go to comments@oyez.org. — [oyez.org/views/static/license.html](https://www.oyez.org/views/static/license.html)
- The footer copyright string reads '©2016 by Oyez, Inc.' Sponsors are Chicago-Kent College of Law at Illinois Tech, Cornell LII, Justia and CLS. — [scripts.js](https://www.oyez.org/scripts/scripts.dc9cbca2.js)
- Portrait images carry per-image captions crediting their source (e.g. the Supreme Court Collection). — [api.oyez.org/people/john_g_roberts_jr](https://api.oyez.org/people/john_g_roberts_jr)

### Inferences
- Commercial use of Oyez text, data or images would need permission. Official Supreme Court portraits are often public-domain US government works, but Oyez's cut-out PNG thumbnails are derivative files. Treat them as CC BY-NC unless cleared otherwise [EST, not legal advice]. Fonts (OFL) and CSS layout ideas are not covered by this content license.

### Gaps
- There is no separate Terms of Service page in the SPA route list beyond license and privacy-policy. I did not fetch the privacy policy.
