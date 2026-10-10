# Spec — SCOTUS Predictor

Status: design approved on 2026-10-08, not yet built. The reasoning behind each choice is in [decisions.md](decisions.md).

## 1. Overview
A public portfolio web app. A user submits a Supreme Court case, either as merits briefs or as a plain-English description. Nine AI agents, one per justice, each predict how their justice would vote. Each agent works from that justice's real writings (via retrieval) and a reviewed persona profile.

The app outputs:
- a structured summary of the briefing
- a vote, confidence and role for each justice, with a brief reason and a detailed one
- the final outcome and tally
- how the opinions split
- the predicted opinion author

Accuracy is measured honestly by locking predictions on pending October Term 2026 cases and scoring them against the real decisions.

## 2. Users and access
- **Visitors:** browse the gallery of pre-computed predictions, view any run, and view the scorecard. No sign-in needed.
- **Invited users:** enter an invite code to submit new cases.
- **Owner:** manages invite codes, the roster, profile review and the spending cap.
- A global daily spending cap, enforced against a spend ledger, blocks new runs once reached.
- Every results page shows the disclaimer: "Prediction for educational purposes, not legal advice."

## 3. Functional requirements

### 3.1 Case input (`/new`)
- **Briefs mode (primary):** PDFs for the petitioner's and respondent's merits briefs (required), amicus briefs (optional, several allowed), and the case's oral argument transcript (optional).
- **Description mode (fallback):** a plain-English description of the case. The output carries a warning that it is less reliable.
- **Metadata:** case title, docket number (optional), term, and the prediction phase (before or after argument, inferred from whether a transcript was given).
- **Recusals:** a checkbox for each active justice.
- **Invite code:** required to submit.

### 3.2 Briefing summary
Made with Sonnet. It covers:
- the question presented
- procedural history and the lower-court ruling
- the petitioner's core arguments
- the respondent's core arguments
- the key precedents each side relies on
- the practical stakes
- a short amicus section, if amicus briefs were given

### 3.3 Justice agents
One per non-recused active justice, all running in parallel on Opus.

**Each agent receives:**
- a shared prefix that is cached across all agents: the brief text and the summary
- that justice's profile
- the top-k passages from that justice's library, retrieved with a pgvector search filtered to that justice and keyed to the case's issues
- that justice's questions from the case's oral argument transcript, if one was given

**Each agent returns structured JSON:**
`{ vote: affirm|reverse|vacate_remand|other, confidence: 0–1, role: majority|concur|concur_judgment|dissent, brief_reason (2–3 sentences), detailed_reason (~600–1,000 words), citations: [{passage_id, quote, why}] }`

**Detailed reason covers:**
- the justice's interpretive approach applied to this case
- the precedents and past opinions they'd rely on
- signals from oral argument
- what could change their vote

**Citation validator:** every `passage_id` must be one of the passages retrieved for that justice. On a failure, the agent retries once. If it fails again, the bad citations are removed and the vote is flagged.

### 3.4 Clerk step
**Code handles:**
- the tally
- the majority outcome
- a 4–4 split, reported as "affirmed by an equally divided Court"
- which justice assigns the opinion: the most senior justice in the majority (the Chief Justice if in the majority)

**One Opus call:**
- groups the justices' reasoning into majority joiners, concurrences and concurrences in the judgment only
- predicts the opinion author, weighing who assigns, workload balance across the term and expertise in the area
- gives a one-sentence explanation

### 3.5 Results page (`/runs/[id]`)
- Updates live through Supabase Realtime as the background job runs: the summary, then each justice's card as it finishes, then the decision.
- **Decision panel:** the outcome, the tally (for example 6–3), the majority, concurrences and dissents, the predicted author and the reason for that pick.
- **Justice cards:** the brief view, which expands to the detailed view with linked citations.
- **Badges:** "Locked [timestamp]", "Before argument" or "After argument", and "Not a fair test" for cases decided before the model's knowledge cutoff.
- Each run has its own shareable link.

### 3.6 Gallery (`/`)
- Showcase predictions plus all locked OT2026 predictions, with search and filtering by term and status (pending or decided).

### 3.7 Scorecard (`/scorecard`)
- A scheduled job (Vercel Cron) fetches decisions for locked cases from CourtListener and the Supreme Court Database.
- **Scored for each prediction:** the case outcome, each justice's vote, majority membership and the opinion author.
- **Reported:**
  - totals for the term
  - accuracy per justice
  - before-argument vs after-argument accuracy
  - calibration (confidence vs accuracy)
- Only OT2026 cases locked before their decision date count toward the scorecard.

### 3.8 Roster and profiles
- `data/justices/<slug>/roster.json` holds name, seniority rank, appointment date and whether the justice is active.
- `data/justices/<slug>/profile.md` is written by Claude from the justice's library and reviewed by the owner. It covers:
  - interpretive method
  - positions by area of law
  - how much weight they give precedent
  - signature doctrines
  - typical voting partners
- `data/justices/<slug>/voting.md` is generated from the Supreme Court Database: base rates by issue area and agreement with each colleague (decisions.md Q23). The profile generator and every justice agent read it.
- Profiles and voting records are rebuilt each term.

## 4. Architecture
```
Next.js (App Router, TypeScript) on Vercel
 ├─ /  /new  /runs/[id]  /scorecard
 ├─ app/api/inngest/route.ts         Inngest handler
 └─ app/api/cron/outcomes/route.ts   outcome fetch + scoring
Inngest job: predictCase
 1. extract   — PDFs → text, locally (native PDF only for scanned briefs; decisions.md Q22)
 2. summarize — briefing summary (Sonnet)
 3. fan-out   — one justice agent per non-recused justice (Opus, parallel, cached shared prefix)
                → citation validator
 4. clerk     — code (tally, ties, assigner) + one Opus call (grouping, author)
 5. persist + lock (locked_at, phase)
Supabase: Postgres + pgvector, Storage (PDFs), Realtime (progress)
Voyage AI: embeddings for library passages and retrieval queries
Offline scripts: corpus ingestion, embedding, profile generation
```

### Repo layout
```
app/                      pages + API routes
lib/agents/               justice.ts, summarizer.ts, clerk.ts
lib/retrieval.ts          Voyage embed + pgvector search
lib/schemas.ts            zod schemas for all LLM outputs
lib/clerk-rules.ts        tally, tie rule, seniority assigner (pure functions)
inngest/predictCase.ts
scripts/ingest/           CourtListener opinions, supremecourt.gov OA transcripts, lower-court opinions
scripts/profiles/generate.ts
data/justices/<slug>/     roster.json, profile.md
supabase/migrations/
```

## 5. Data model
| Table | Key columns |
|---|---|
| `justices` | slug, name, seniority_rank, appointed, active |
| `documents` | justice_id, kind (`scotus_opinion` \| `oral_argument` \| `lower_court`), case_name, date, url |
| `passages` | document_id, justice_id, text, embedding (vector) |
| `cases` | title, docket, term, input_mode, file paths, oa_transcript_path, decided_before_cutoff |
| `predictions` | case_id, phase, status, locked_at, outcome, tally, author_pred, clerk_rationale, summary_json, cost_usd |
| `justice_votes` | prediction_id, justice_id, vote, confidence, role, brief_reason, detailed_reason, citations (jsonb), flagged |
| `outcomes` | case_id, decided_at, outcome, votes (jsonb), author |
| `scores` | prediction_id, outcome_correct, votes_correct, majority_correct, author_correct |
| `invite_codes` | code, max_runs, used_runs, active |
| `spend_ledger` | prediction_id, model, input_tokens, output_tokens, cost_usd, created_at |

## 6. Models and cost
- **Opus 5.5:** the justice agents and the clerk step.
- **Sonnet 5.5:** the briefing summary (and reading any scanned brief as a native PDF).
- **Voyage AI:** embeddings.
- **Prompt caching:** the shared brief prefix is cached for all nine agents.
- **Target cost:** about $1–5 per run. Confirm current pricing with the `claude-api` skill before writing API code.
- **Daily cap:** checked against `spend_ledger` before a job is queued.

## 7. Guardrails
- Prompts never include the real outcome of the case being predicted. A leakage check runs on test cases.
- Cases decided before the knowledge cutoff (about June 2026) are labeled "not a fair test" and kept out of the scorecard.
- Every citation is checked against the passages actually retrieved.
- The disclaimer appears on every results page.

## 8. Build phases
1. Scaffold Next.js, Supabase and Inngest. Write the schema migrations and the roster seed.
2. Corpus ingestion and embedding for all nine justices, then a retrieval sanity check.
3. Generate the profiles. **The owner reviews them.**
4. Prediction pipeline (summarizer → justice agents → validator → clerk), run end to end from the command line on a single case.
5. UI: submit page, live run page, gallery.
6. Gating (invite codes and the spending cap), then deploy to Vercel.
7. Scorecard: OT2026 case list, locked predictions, outcomes cron job, scorecard page.

## 9. Verification
- Unit tests for `lib/clerk-rules.ts`: the seniority assigner, a 4–4 tie, recusals, and grouping joiners vs concurrences on fixture votes.
- Citation validator tests: an invented `passage_id` is rejected.
- Retrieval check: for each justice, a known query returns that justice's own passages.
- End to end: from the UI, run one recently decided case (labeled "not a fair test") and one pending OT2026 case. Confirm the live updates, all nine cards, the clerk result, the lock timestamp and the logged cost.
- Cron: run the outcomes job by hand against a decided case and confirm the scores are written.

## 10. Out of scope (v1)
- Predicting whether the Court grants cert
- A simulated conference where agents see each other's reasoning
- Speeches, books and confirmation testimony in the libraries
- A mock opinion written in each justice's voice
- User accounts beyond invite codes
