# Decisions — SCOTUS Predictor

Settled in the design-grilling session on 2026-10-08. Each entry lists the question, the options considered, the choice and the reason.

---

## Q1 — Who is this for?
- **Options:** (a) personal/learning, run locally · (b) portfolio/demo other people can try · (c) real product with accounts, billing and a legal disclaimer
- **Decision:** (b) Portfolio/demo that other people can try.
- **Why:** It has to be public and polished, without the overhead of a full product.

## Q2 — What does "trained on each justice's writings" mean technically?
- **Options:** (a) fine-tune a model per justice · (b) retrieval (RAG) over each justice's corpus plus a persona profile · (c) persona prompt only
- **Decision:** (b) RAG plus a persona profile, on Claude.
- **Why:** It gives the best reasoning for the cost, uses the strongest models, and lets every explanation cite real opinions. Fine-tuning tends to copy writing style rather than legal reasoning.

## Q3 — Justice roster
- **Options:** hard-coded nine · configurable data
- **Decision:** Configurable and data-driven, seeded with the current nine: Roberts, Thomas, Alito, Sotomayor, Kagan, Gorsuch, Kavanaugh, Barrett, Jackson.
- **Why:** A retirement or new appointment means changing data, not code.

## Q4 — What does the user submit?
- **Options:** (a) cert petition · (b) merits briefs · (c) plain-English description · (d) docket number with automatic fetch
- **Decision:** (b) merits brief PDFs as the main input, with (c) a plain-English description as a fallback.
- **Why:** Merits briefs give the richest signal. Predicting whether the Court grants cert is a different problem and is left out of scope.

## Q5 — What exactly is predicted?
- **Decision:** For each justice: vote, confidence score, and role (join the majority, concur or dissent). For the Court: who is in the majority and who is predicted to write the opinion.
- **Why:** You asked for all of these, including the author prediction.

## Q6 — Independent votes or deliberation?
- **Options:** (a) independent · (b) simulated conference where agents see each other's reasoning
- **Decision:** (a) Independent for v1.
- **Why:** It's simple and runs in parallel. A conference round can be added later as an optional second pass.

## Q7 — How do we know it's any good?
- **Decision:** Build a small backtesting harness from the start that uses the most recently decided cases, and keep a running scorecard as new decisions come down.
- **Why:** The project only has credibility if its accuracy is measured honestly. Q15 sets the exact method.

## Q8 — What kind of application?
- **Options:** (a) local web app · (b) command-line tool · (c) hosted web app
- **Decision:** (a) Web app built with Next.js and the Claude API. Q9 makes it public.
- **Why:** A results page with an expandable card for each justice suits the output best.

## Q9 — Where does it run, and who pays?
- **Options:** public on your key with a cap · public, visitors bring their own key · local only plus a demo
- **Decision:** Deployed publicly (Vercel) on your API key with a daily run cap. Visitors browse a free gallery of pre-computed cases.
- **Why:** Anyone can try it without a key, and cost stays bounded. A run is roughly $1–5.

## Q10 — What goes into each justice's library?
- **Options:** Supreme Court opinions they wrote · oral argument transcripts · lower-court opinions · speeches, books and confirmation hearings
- **Decision:** Supreme Court opinions they wrote, oral argument transcripts, and lower-court opinions.
- **Why:** These are the strongest signals. Lower-court opinions matter for the newer justices. Speeches and books are hard to collect and add less.

## Q11 — How are the justice profiles written?
- **Options:** Claude writes them and you review · hand-written · none
- **Decision:** Claude generates each profile from the library, and you review it. Profiles are stored as editable files and rebuilt each term.
- **Why:** This scales, stays grounded in the library, and keeps a human check.

## Q12 — What does the briefing summary cover?
- **Options:** full structure with amicus · full structure without amicus · short summary only
- **Decision:** Question presented, procedural history and lower-court ruling, each side's core arguments, key precedents each side relies on, practical stakes, and a short amicus section. Summaries made from a plain description carry a warning that they are less reliable.
- **Why:** This structure matches how practitioners read a case.

## Q13 — How are the majority opinion and its author predicted?
- **Options:** code plus one AI step · an AI agent decides everything · code only
- **Decision:** Code handles the tally, the tie rule, seniority and who assigns the opinion. One Claude call groups the justices' reasoning (joining the majority vs concurring in the judgment) and picks the author, with a one-line explanation.
- **Why:** The rules that never vary are reliable in code. Grouping reasoning needs judgment.

## Q14 — Recusals
- **Decision:** Supported. You mark a justice as recused, that agent doesn't run, and a 4–4 split means "affirmed by an equally divided Court," which sets no precedent.
- **Why:** It's realistic and cheap to support.

## Q15 — How exactly does scoring work?
- **Options:** locked OT2026 predictions with automatic outcomes · backtest past cases only · manual scorecard
- **Decision:** Predictions on pending October Term 2026 cases are locked with a timestamp. Real outcomes are pulled automatically on a schedule (CourtListener or the Supreme Court Database). Scoring covers the case outcome, each justice's vote, majority membership and the opinion author. Results go on a public scorecard. Older cases run as demos labeled "not a fair test."
- **Why:** The model's knowledge runs to about June 2026, so earlier decisions may already be in its training data. Only OT2026 is a clean test.

## Q16 — Which models?
- **Options:** Opus for the justices and Sonnet for utility steps · Sonnet everywhere · Opus everywhere
- **Decision:** Claude Opus 5.5 for the nine justices and the clerk step, Claude Sonnet 5.5 for the brief summary and PDF extraction, Voyage AI for embeddings, and prompt caching so all agents share the briefs.
- **Why:** The best reasoning goes where it matters, and the rest is cheaper. Pricing gets checked before any API code is written.

## Q17 — Where are the data stored?
- **Options:** Supabase · Neon + Vercel Blob · a dedicated vector database
- **Decision:** Supabase: Postgres with pgvector, Storage for PDFs, and its built-in auth.
- **Why:** One service covers all of it, and the free tier fits a demo.

## Q18 — Who can run new predictions?
- **Options:** invite codes plus a daily cap · sign-in with a per-user quota · owner-only runs
- **Decision:** Invite codes, plus a hard daily spending cap across all runs. Anyone can browse the gallery and scorecard.
- **Why:** This is the simplest way to control cost while still letting invited people try it.

## Q19 — How do runs and their progress work?
- **Options:** background job with live progress · one long streaming request · submit and check back later
- **Decision:** A durable background job (Inngest). The results page fills in live: the summary first, then each justice's card as it finishes, then the decision. The link to the run can be shared.
- **Why:** A run takes minutes, longer than a normal Vercel request allows, and watching it fill in is a good demo.

## Q20 — What goes in each justice's card?
- **Options:** as proposed with citations required · citations optional · add a mock opinion in the justice's voice
- **Decision:**
  - **Brief view:** the vote, a confidence percentage, the role, and a 2–3 sentence reason.
  - **Detailed view (about 600–1,000 words):** the justice's interpretive approach applied to this case, the precedents and past opinions they'd rely on, signals from oral argument, and what could change their vote.
  - **Citations:** every citation must point to a passage that was actually retrieved, with a link.
- **Why:** Required citations keep the explanations grounded and checkable.

## Q21 — The case's own oral argument transcript
- **Options:** optional input · briefs only
- **Decision:** It's an optional input, uploaded or fetched from supremecourt.gov, and each agent sees its own justice's questions. Predictions made before and after argument are locked separately.
- **Why:** The justices' questions at argument are among the strongest predictors, and comparing the two predictions on the scorecard is interesting in itself.

## Q22 — How the briefs reach the models (2026-10-08)
- **Options:** Claude reads the PDFs natively · extract text locally, native PDF only as a fallback
- **Decision:** Extract brief text locally with the same PDF library the corpus ingest uses (`web/lib/briefs.ts`). A brief with no text layer (a scan) falls back to native PDF input.
- **Why:** Native PDF input bills every page as text and as an image. On FCC v. Consumers' Research the two merits briefs (223 pages) came to 472,832 tokens as PDFs and 123,932 as text, so 3.8× fewer, and the briefs are read by the summarizer and by all nine justice agents. The summary from the text was complete and neutral ($0.27, 16 s). This replaces the separate "extract" step in spec.md §4 and §6; Sonnet 5.5 still writes the summary.

## Q23 — Voting data alongside the writings (2026-10-09)
- **Options:** profiles and retrieval from the justices' writings only · add each justice's voting record
- **Decision:** Add each justice's record from the Supreme Court Database (justice-centered file, 2026 Release 01, argued cases): rates in the majority and for the petitioner, overall and by issue area; how often they write separately; agreement with each current colleague in all and in divided cases, career and last three terms; whose separate opinions they join. Generated by `web/scripts/profiles/voting.ts` into `data/justices/<slug>/voting.md` (and `.json`). It feeds the profile generator and is given to each justice agent as the prior that the case-specific passages move it from.
- **Why:** Votes predict votes better than prose does, and the writings alone cannot show voting partners (they hold a justice's own opinions, not who joined them).
- **Attribution required:** Harold J. Spaeth, Lee Epstein, et al., 2026 Supreme Court Database, Version 2026 Release 01. Cite it on the Method page.

## Q24 — Lower-court opinions deferred to v2 (2026-10-10)
- **Options:** CourtListener as planned · ask CourtListener for a higher limit · switch to GovInfo · defer
- **Decision:** Defer. v1's libraries are the Supreme Court record: opinions OT2011–OT2025, every argument transcript, and the SCDB voting record (Q23).
- **Why:** CourtListener limits this account to 5 requests/minute, 50/hour and 125/day; the ~1,250 requests the lower-court set needs would take about 10 days. The set mainly helps the justices with shorter Supreme Court records (Barrett, Jackson). `web/scripts/ingest/lower-courts.ts` is written and tested (author-line matching, joinder and panel exclusion, district-court handling), and 53 opinions are cached, so v2 can resume with a higher limit or point the same logic at GovInfo.

## Q25 — Vector search on this database instance (2026-10-10)
- **Options:** HNSW index · exact search · IVFFlat index · upgrade the database's compute size
- **Decision:** IVFFlat (`lists = 280`, `probes = 20`, iterative scan for the one-justice filter), migration 6. Retrieval runs at most three searches at a time per justice and retries a timeout.
- **Why:** The HNSW build needed more shared memory than the instance has (1 GB failed; 256 MB fell back to an on-disk build that stalled at 78%). Exact search reads every vector out of TOAST storage and took 6.3 s for Jackson's 4,804 passages, so the larger libraries would pass the API's statement limit. IVFFlat built in 5 minutes in 128 MB; a search runs in about 1 s in the database (1.5–5 s through the API, with some cold-cache retries). Retrieval quality checked per justice (Shelby County for Roberts, West Virginia v. EPA dissent for Kagan, Kisela and Mullenix dissents for Sotomayor, and so on).
- **Revisit:** a larger compute size would let the index stay in memory (searches well under a second) and make an HNSW build possible.
