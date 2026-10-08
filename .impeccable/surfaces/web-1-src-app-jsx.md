---
version: 1
slug: "web-1-src-app-jsx"
primary_target: "web-1/src/App.jsx"
related_targets: ["web-1/src"]
---

# Surface: Bench Forecast web prototype (web-1), led by the case result page

Mode: Read (the visitor came to understand a prediction). Home and reader inherit the same world.
Audience: hiring managers at legal-tech/AI companies, skimming in minutes. Job: grasp the predicted outcome, see who votes how and why, trust the lock.
Constraints: no AI-startup look, no red/blue partisan coding, no toy/scoreboard feel. Sample data is fictional and labeled as such. Light page (daylight office, laptop).
Memorable moment: the nine seats in true bench order gliding into the 6 | 3 split.

## Direction contract

THESIS: The vote is shown where the justices actually sit. One shallow arc of nine seats in real bench order (Chief center, seniority alternating outward) carries the outcome. It refuses the category default of a flat row of nine portraits and a colored majority/dissent bar.

OWN-WORLD: A deep bench-green field (#1F3D34) owns the masthead and the bench band; the reading ground is a cool off-white (#F6F6F4) with ink #1A1C1E. Brass (#B08A2E) appears only for the opinion author and the lock seal. Public Sans with tabular figures runs the frame; Source Serif 4 sets the reading column. Seats are authored SVG marks: filled = majority, open ring = dissent, notched = writes separately, brass ring = author. A confidence arc wraps each seat. Hairline rules only, no cards-as-structure, no shadows except the lifted seat on focus.

STORY: The visitor sees the outcome and tally first, then the arc showing who stands where. They read the author pick and the lock timestamp, open any justice's brief reason in place, then continue to the full reasoning page with its citations.

FIRST VIEWPORT: A green masthead (wordmark left; Cases, Scorecard, Method nav). Directly below it, the same green band holds a docket line, the case title in large Public Sans, and the outcome sentence "Reversed and remanded, 6–3". On the right of the band sits a brass lock seal: "Locked Oct 8, 2026, 9:14 AM ET · Before argument". The arc of nine seats spans the band's full width under the title, with name and confidence under each seat. Under the arc sit a segmented control (Bench | Split) and a "Replay the run" action. The ruled justice list begins below the band on the light ground.

FORM: The Court's bench seating chart, candidate 2 of my ordered list (safer-register lineup, chosen by the user). Seed key 935ff42c. Signature interaction: Bench to Split glide (FLIP) plus a Replay that snaps seats in one at a time as agents "finish".

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Adaptations from the contract (recorded after finish review)
- Nav reads "Forecasts, Sample case, Reasoning", not "Cases, Scorecard, Method": the prototype has no separate Scorecard or Method routes; both live as sections on the home page. "Forecasts" hides under 700px because the wordmark already links home.
- The arrangement control reads "As seated | By vote" instead of "Bench | Split": plainer for first-time visitors.
- "Notched" for writes-separately became an inner cut (majority) or an inner dot (dissent); the legend shows both.
- Confidence is a half-arc "seat back" above each mark (not a full ring), so it can't read as a loading spinner.
- The Bench/Split glide animates left/top on nine elements instead of a FLIP transform; it's cheap at this count.
