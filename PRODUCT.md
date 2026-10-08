# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Primary: hiring managers and engineers at legal-tech and AI companies who land on this portfolio piece and judge its craft and engineering in a few minutes. They skim the gallery, open one run, and decide whether the work is serious.

Secondary (from spec.md): visitors who browse predictions and the scorecard without signing in; invited users who submit new cases with an invite code; the owner, who manages invite codes, the roster, profile review and the spending cap.

## Product Purpose
Bench Forecast takes a Supreme Court case (merits briefs, or a plain-English description as a weaker fallback) and has nine AI agents, one per justice, predict how each justice votes. It outputs a briefing summary, each justice's vote, confidence and role with a brief and a detailed reason, the outcome and tally, the opinion split, and the predicted opinion author.

Success: a visitor understands the prediction and trusts how it was made, and the scorecard shows honest accuracy on locked October Term 2026 cases.

## Positioning
Each justice agent reasons from that justice's real writings (retrieval over their opinions and oral-argument questions) plus a reviewed persona profile, and every citation is validated against the passages actually retrieved. Predictions are locked with a timestamp before the decision and scored afterward against the real outcome, so accuracy is measured, not claimed.

## Operating Context
- Visitors arrive at the gallery (`/`), open a run (`/runs/[id]`), and may check the scorecard (`/scorecard`). Invited users submit at `/new`.
- A results page fills in live as the background job runs: summary first, then each justice's card as it finishes, then the decision.
- Badges on runs: "Locked [timestamp]", "Before argument" / "After argument", "Not a fair test" (cases decided before the model's knowledge cutoff).
- Full requirements: [spec.md](spec.md). Reasoning behind each choice: [decisions.md](decisions.md).

## Capabilities and Constraints
- Justice roster is data-driven (currently Roberts, Thomas, Alito, Sotomayor, Kagan, Gorsuch, Kavanaugh, Barrett, Jackson); recusals supported; a 4–4 split reads "affirmed by an equally divided Court".
- Votes: affirm, reverse, vacate & remand, other. Roles: majority, concur, concur in judgment, dissent.
- Every results page carries: "Prediction for educational purposes, not legal advice."
- Description-mode runs carry a warning that they are less reliable.
- Global daily spending cap blocks new runs once reached.
- Current UI prototype: React 18 + Vite (`web-1/`; the original clone prototype was deleted). Target production stack per spec: Next.js on Vercel, Supabase, Inngest.
- Legal: do not copy Harvey, Oyez or CourtListener stylesheets, images, wordmarks or names (trademarks; CourtListener code is AGPL-3.0; Oyez content is CC BY-NC). See `reports/Legal UI design system clones.md`.

## Brand Commitments
- Name: Bench Forecast (confirmed; already the prototype wordmark. "SCOTUS Predictor" in spec.md is the old working name).
- Voice: neutral and precise.
- Must not read as: an AI startup (dark mode, neon glow, gradients, sparkle icons); partisan (red/blue coding of conservative/liberal justices); a toy, betting-odds board or sports scoreboard.
- The app has its own identity. An earlier prototype cloned Harvey, Oyez and CourtListener (deleted 2026-10-08); only their functional patterns (nine-seat vote strip, long-form reading view with a jump-to table of contents) carried over, never their look.

## Evidence on Hand
- Fictional sample case and votes: `web-1/src/data.js` ("Hartwell v. Department of Commerce").
- No real predictions, scorecard results, users, testimonials or press exist yet. Do not fabricate accuracy numbers or claims of past performance.
- Justice portraits: none owned. Do not use Oyez portraits.

## Product Principles
1. Show the work: every vote traces to reasoning and cited passages from the justice's own writings.
2. Honest about uncertainty: confidence, phase, and "not a fair test" labels are always visible, never buried.
3. Locked before decided: the timestamp is the product's credibility.
4. Readable in minutes, deep on demand: the brief view answers "what happens", the detailed view rewards the careful reader.
