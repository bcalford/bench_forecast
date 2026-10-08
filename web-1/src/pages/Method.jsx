import { useEffect, useState } from "react";
import { ArrowRight } from "../components/Icons.jsx";

// Fill in once the repository is public; the page shows a marked placeholder until then.
const REPO_URL = "https://github.com/bcalford/bench_forecast";

const SECTIONS = [
  { id: "architecture", label: "Architecture" },
  { id: "retrieval", label: "Retrieval" },
  { id: "agents", label: "The agents" },
  { id: "validator", label: "Citation check" },
  { id: "clerk", label: "The clerk" },
  { id: "scoring", label: "Locking and scoring" },
  { id: "data", label: "Data model" },
  { id: "guardrails", label: "Cost and guardrails" },
  { id: "source", label: "Source code" },
];

const STAGES = [
  { name: "Briefs in", detail: "Merits and amicus PDFs, optional argument transcript" },
  { name: "Extract", detail: "PDF to text", model: "Sonnet" },
  { name: "Summarize", detail: "Question, history, both sides, stakes", model: "Sonnet" },
  { name: "Nine agents", detail: "One per sitting justice, in parallel, on a cached shared prefix", model: "Opus × 9", fan: true },
  { name: "Check citations", detail: "Every cited passage must be one that was retrieved", model: "Code" },
  { name: "Clerk", detail: "Tally, ties and assignment in code; split and author in one call", model: "Code + Opus" },
  { name: "Lock", detail: "Timestamped before the Court rules", lock: true },
];

const SCHEMA = `{
  "vote": "affirm" | "reverse" | "vacate_remand" | "other",
  "confidence": 0.0–1.0,
  "role": "majority" | "concur" | "concur_judgment" | "dissent",
  "brief_reason": "2–3 sentences",
  "detailed_reason": "~600–1,000 words",
  "citations": [
    { "passage_id": "…", "quote": "…", "why": "…" }
  ]
}`;

const TABLES = [
  ["justices", "slug, name, seniority_rank, appointed, active"],
  ["documents", "justice, kind (opinion, oral argument, lower court), case, date, url"],
  ["passages", "document, justice, text, embedding (vector)"],
  ["cases", "title, docket, term, input mode, files, transcript, decided_before_cutoff"],
  ["predictions", "case, phase, status, locked_at, outcome, tally, author, summary, cost"],
  ["justice_votes", "prediction, justice, vote, confidence, role, reasons, citations, flagged"],
  ["outcomes", "case, decided_at, outcome, votes, author"],
  ["scores", "prediction, outcome / votes / majority / author correct"],
  ["spend_ledger", "prediction, model, input and output tokens, cost"],
];

// Nine seats in a shallow arc, each fed from the single cached prefix on the left.
function FanOut() {
  const seats = Array.from({ length: 9 }, (_, i) => {
    const t = (i - 4) / 4;
    return { x: 40 + i * 14, y: 14 + 18 * t * t };
  });
  return (
    <svg className="fan" viewBox="0 0 168 50" aria-hidden="true">
      {seats.map((s, i) => <line key={i} x1="6" y1="25" x2={s.x} y2={s.y} className="fan-line" />)}
      <circle cx="6" cy="25" r="4" className="fan-prefix" />
      {seats.map((s, i) => <circle key={`s${i}`} cx={s.x} cy={s.y} r="4.6" className="fan-seat" />)}
    </svg>
  );
}

export default function Method({ focus }) {
  const [active, setActive] = useState(SECTIONS[0].id);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { rootMargin: "-20% 0px -65% 0px" }
    );
    SECTIONS.forEach((s) => { const el = document.getElementById(s.id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (focus) document.getElementById(focus)?.scrollIntoView({ block: "start" });
  }, [focus]);

  // On phones the contents rail is a horizontal strip; keep the active item scrolled into view.
  useEffect(() => {
    const link = document.querySelector('.toc a[aria-current="true"]');
    const strip = link?.closest("ol");
    if (!strip || strip.scrollWidth <= strip.clientWidth) return;
    strip.scrollTo({ left: link.offsetLeft - 16, behavior: "smooth" });
  }, [active]);

  const jump = (e, id) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <main id="main">
      <section className="band band-method" aria-labelledby="method-title">
        <div className="wrap">
          <h1 id="method-title" className="reader-title">Method</h1>
          <p className="method-lede">
            How a forecast is made, from the briefs to a locked prediction, and how it is scored.
          </p>
          <p className="sample-flag" role="note">
            This page describes the system as designed. The prototype runs on sample data; the pipeline is being built.
          </p>

          <ol className="jobgraph" aria-label="The forecasting job, in order">
            {STAGES.map((s) => (
              <li key={s.name} className={`stage${s.fan ? " is-fan" : ""}${s.lock ? " is-lock" : ""}`}>
                <span className="stage-dot" aria-hidden="true" />
                <span className="stage-name">{s.name}</span>
                {s.fan && <FanOut />}
                <span className="stage-detail">{s.detail}</span>
                {s.model && <span className="stage-model">{s.model}</span>}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <div className="wrap reader-body">
        <nav className="toc" aria-label="Contents">
          <ol>
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} onClick={(e) => jump(e, s.id)} aria-current={active === s.id ? "true" : undefined}>{s.label}</a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="reader-article method-article">
          <section id="architecture" className="rsec">
            <h2>Architecture</h2>
            <p className="reading">
              A forecast is one durable background job. A run takes minutes, longer than a web request is allowed to live,
              so the job runs on Inngest and the results page fills in live as each step finishes: the briefing summary first,
              then each justice's vote as their agent returns, then the decision.
            </p>
            <dl className="stack-dl">
              <div><dt>App</dt><dd>Next.js (App Router, TypeScript) on Vercel</dd></div>
              <div><dt>Job runner</dt><dd>Inngest, one <code>predictCase</code> function with durable steps</dd></div>
              <div><dt>Database</dt><dd>Supabase Postgres with pgvector, Storage for PDFs, Realtime for live progress</dd></div>
              <div><dt>Embeddings</dt><dd>Voyage AI, for library passages and retrieval queries</dd></div>
              <div><dt>Models</dt><dd>Claude Opus for the nine agents and the clerk; Claude Sonnet for extraction and the summary</dd></div>
            </dl>
          </section>

          <section id="retrieval" className="rsec">
            <h2>Retrieval</h2>
            <p className="reading">
              Each justice has a library: the Supreme Court opinions they wrote, their questions at oral argument, and their
              lower-court opinions, which matter most for the newer justices. Libraries are split into passages and embedded.
              For a new case, each agent runs a vector search filtered to its own justice and keyed to the case's issues, and
              takes the top passages.
            </p>
            <p className="reading">
              Each agent also gets a written profile of its justice: interpretive method, positions by area of law, weight given
              to precedent, signature doctrines and usual voting partners. Claude drafts the profile from the library; a person
              reviews it. Profiles are rebuilt each term.
            </p>
            <p className="aside-note">
              Why retrieval instead of fine-tuning: fine-tuning tends to copy how a justice writes rather than how they reason,
              and it cannot cite. Retrieval lets every explanation point at real passages.
            </p>
          </section>

          <section id="agents" className="rsec">
            <h2>The agents</h2>
            <p className="reading">
              One agent per sitting justice, all running at once and independently; they do not see each other's reasoning.
              Every agent receives the same shared prefix, the brief text and the summary, which is cached so it is paid for once
              rather than nine times. After the prefix comes what is particular to that justice: their profile, their retrieved
              passages and, if a transcript was filed, their own questions from argument.
            </p>
            <p className="reading">Each agent must answer in this shape, validated before anything is saved:</p>
            <pre className="code"><code>{SCHEMA}</code></pre>
          </section>

          <section id="validator" className="rsec">
            <h2>Citation check</h2>
            <p className="reading">
              Every <code>passage_id</code> an agent cites must be one of the passages actually retrieved for that justice. If an
              answer cites anything else, the agent gets one retry. If it fails again, the bad citations are removed and the vote is
              flagged on the results page, so a confident-sounding reason can never rest on a source that was not in front of it.
            </p>
            <a className="text-link" href="#/reader">See checked citations in the sample reasoning <ArrowRight /></a>
          </section>

          <section id="clerk" className="rsec">
            <h2>The clerk</h2>
            <p className="reading">
              The rules that never change live in plain code: the tally, the majority, a 4–4 split reported as "affirmed by an
              equally divided Court", and who assigns the opinion (the most senior justice in the majority, the Chief Justice when
              in it). One further Opus call does the part that needs judgment: grouping the justices into those joining the majority,
              concurring, or concurring only in the judgment, and predicting the author from who assigns, the term's workload and
              expertise in the area.
            </p>
          </section>

          <section id="scoring" className="rsec">
            <h2>Locking and scoring</h2>
            <p className="reading">
              When the job finishes, the prediction is saved with a <code>locked_at</code> timestamp and its phase, before or after
              argument. A scheduled job fetches decisions from CourtListener and the Supreme Court Database and scores every locked
              case on four measures: the outcome, each justice's vote, majority membership and the opinion author. The scorecard
              reports term totals, accuracy by justice, before versus after argument, and calibration.
            </p>
            <div id="fairtest" className="defn">
              <h3>Not a fair test</h3>
              <p>
                The models were trained on text up to about June 2026. A case decided before then may already be in what they
                learned, so its forecast proves nothing. Those cases are labeled "Not a fair test" and never count toward the
                scorecard. Only October Term 2026 cases locked before their decision date are scored.
              </p>
            </div>
            <a className="text-link" href="#/scorecard">Open the scorecard <ArrowRight /></a>
          </section>

          <section id="data" className="rsec">
            <h2>Data model</h2>
            <table className="data-table">
              <thead><tr><th scope="col">Table</th><th scope="col">Holds</th></tr></thead>
              <tbody>
                {TABLES.map(([t, holds]) => (
                  <tr key={t}><th scope="row"><code>{t}</code></th><td>{holds}</td></tr>
                ))}
              </tbody>
            </table>
          </section>

          <section id="guardrails" className="rsec">
            <h2>Cost and guardrails</h2>
            <ul className="rule-list">
              <li><strong>About $1–5 a run.</strong> Nine Opus agents share one cached prefix, so the briefs are paid for once.</li>
              <li><strong>A daily cap.</strong> Every model call is written to a spend ledger, checked before a new job is queued; filing pauses once the day's budget is spent.</li>
              <li><strong>No leakage.</strong> Prompts never contain the real outcome of the case being predicted, and a leakage check runs on test cases.</li>
              <li><strong>Invite-only filing.</strong> Anyone can browse forecasts; filing a new case needs an invite code.</li>
              <li><strong>Not legal advice.</strong> Every results page says so.</li>
            </ul>
          </section>

          <section id="source" className="rsec">
            <h2>Source code</h2>
            {REPO_URL ? (
              <a className="text-link is-strong" href={REPO_URL}>View the repository <ArrowRight /></a>
            ) : (
              <p className="repo-slot">Repository link coming once the code is public.</p>
            )}
          </section>
        </article>
      </div>
    </main>
  );
}
