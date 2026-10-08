import { useEffect, useMemo, useRef, useState } from "react";
import { justices, sampleCase, byslug, ownCitations } from "../data.js";
import { getDraft } from "../runDraft.js";
import Bench, { BenchLegend } from "../components/Bench.jsx";
import SeatMark from "../components/SeatMark.jsx";
import { LockSeal } from "../components/Chrome.jsx";
import { ArrowRight, Chevron, Replay } from "../components/Icons.jsx";

// Order the demo replay reports agents finishing in; the least certain vote lands last.
const ARRIVAL = ["kagan", "thomas", "alito", "roberts", "jackson", "gorsuch", "sotomayor", "kavanaugh", "barrett"];
const ARRIVAL_MS = 420;
const READING_MS = 1600;
const SUMMARY_MS = 1400;

const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function useReplay(order) {
  const [arrived, setArrived] = useState(null); // null = every sitting vote is in
  const timers = useRef([]);
  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => clear, []);

  const start = (lead = 500) => {
    clear();
    const step = reduceMotion() ? 120 : ARRIVAL_MS;
    setArrived(new Set());
    order.forEach((slug, i) => {
      timers.current.push(setTimeout(() => setArrived((s) => new Set(s).add(slug)), lead + i * step));
    });
    timers.current.push(setTimeout(() => setArrived(null), lead + order.length * step + 250));
  };
  return [arrived, start];
}

// The demo run's opening: reading the briefs, then the summary, then the votes.
function useRunStages(enabled, startVotes) {
  const [stage, setStage] = useState(enabled ? "reading" : "done");
  useEffect(() => {
    if (!enabled) return;
    const fast = reduceMotion();
    const t1 = setTimeout(() => setStage("summary"), fast ? 300 : READING_MS);
    const t2 = setTimeout(() => { setStage("voting"); startVotes(0); }, fast ? 600 : READING_MS + SUMMARY_MS);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [enabled]);
  return [stage, setStage];
}

const nowStamp = () =>
  new Date().toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }) + " ET";

function JusticeRow({ j, v, isAuthor, open, onToggle, reason, recused }) {
  if (recused) {
    return (
      <li className="jrow is-recused" id={`row-${j.slug}`}>
        <div className="jrow-head">
          <SeatMark recused size={36} />
          <span className="jrow-name">
            <span>{j.name}</span>
            <span className="jrow-role">Recused; takes no part in the decision</span>
          </span>
        </div>
      </li>
    );
  }
  const pct = Math.round(v.confidence * 100);
  return (
    <li className={`jrow${open ? " is-open" : ""}`} id={`row-${j.slug}`}>
      <button type="button" className="jrow-head" aria-expanded={open} onClick={onToggle}>
        <SeatMark vote={v} isAuthor={isAuthor} size={36} />
        <span className="jrow-name">
          <span>{j.name}</span>
          <span className="jrow-role">{isAuthor ? "Writes the majority opinion" : v.role}</span>
        </span>
        <span className="jrow-vote">To {v.side.toLowerCase()}</span>
        <span className="jrow-conf">
          <span className="conf-scale" aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>
          <span className="num">{pct}%</span>
        </span>
        <Chevron className="jrow-chev" />
      </button>
      <div className="jrow-body" hidden={!open}>
        <p className="reading">{reason.replace(/\s*\[(?:Pet|Resp)\. Br\. \d+\]/g, "")}</p>
        <a className="text-link" href={`#/reader/${j.slug}`}>
          Full reasoning, with {ownCitations[j.slug].length === 1 ? "one citation" : `${ownCitations[j.slug].length} citations`} from {j.last}'s own opinions <ArrowRight />
        </a>
      </div>
    </li>
  );
}

// Re-derives the decision from the sitting justices, so recusals change the tally,
// the majority, the opinion assignment and, on an even split, the outcome itself.
function decide(recused) {
  const p = sampleCase.prediction;
  const sitting = justices.filter((j) => !recused.has(j.slug));
  const side = (slug) => (sampleCase.votes[slug].vote === "majority" ? "Reverse" : "Affirm");
  const reverse = sitting.filter((j) => side(j.slug) === "Reverse");
  const affirm = sitting.filter((j) => side(j.slug) === "Affirm");
  const tie = reverse.length === affirm.length;
  const winning = tie ? null : reverse.length > affirm.length ? "Reverse" : "Affirm";
  const asPredicted = winning === "Reverse";

  const winners = sitting.filter((j) => side(j.slug) === winning).sort((a, b) => a.seniority - b.seniority);
  const author = tie ? null : asPredicted && winners.some((j) => j.slug === p.author) ? p.author : winners[0].slug;

  const votes = Object.fromEntries(
    justices.map((j) => {
      const base = sampleCase.votes[j.slug];
      const s = side(j.slug);
      let role = base.role;
      if (tie) role = `Votes to ${s.toLowerCase()}`;
      else if (!asPredicted) role = s === winning ? "Joins majority" : "Dissents";
      else if (j.slug === author) role = "Majority opinion";
      else if (base.role === "Majority opinion") role = "Joins majority";
      return [j.slug, { ...base, side: s, role, vote: s === (winning ?? "Reverse") ? "majority" : "minority" }];
    })
  );

  const outcome = tie
    ? "Affirmed by an equally divided Court"
    : asPredicted ? p.outcome.replace(/^./, (m) => m.toUpperCase()) : "Affirmed";
  const holding = tie
    ? "With the sitting justices split evenly, the judgment below stands. An equally divided affirmance sets no precedent."
    : asPredicted ? p.holding : "The agency's rule stands; the judgment below is affirmed.";
  const rationale = !author ? null
    : author === p.author ? p.authorRationale
    : `${byslug[author].last} is the most senior justice in the majority, so assigns the opinion and is the likeliest author.`;

  const winnersSlugs = new Set(winners.map((j) => j.slug));
  const losers = sitting.filter((j) => !tie && !winnersSlugs.has(j.slug));
  const concurring = asPredicted ? sitting.filter((j) => sampleCase.votes[j.slug].role === "Concurrence") : [];
  return {
    votes, tie, author, outcome, holding, rationale, concurring, losers,
    tally: tie ? [reverse.length, affirm.length] : [winners.length, losers.length],
    sitting,
  };
}

export default function CaseResult({ run = false }) {
  const c = sampleCase;
  const draft = run ? getDraft() : null;
  const recused = useMemo(() => new Set(draft?.recused ?? []), [draft]);
  const d = useMemo(() => decide(recused), [recused]);
  const order = ARRIVAL.filter((s) => !recused.has(s));
  const [lockedAt] = useState(() => (run ? nowStamp() : c.lockedAt));

  const [arrangement, setArrangement] = useState("bench");
  const [selected, setSelected] = useState(d.author ?? d.sitting[0].slug);
  const [openRows, setOpenRows] = useState(() => new Set(run ? [] : [d.author]));
  const [arrived, replay] = useReplay(order);
  const [stage] = useRunStages(run && !!draft, replay);

  // The seal closes (and plays its closing once) whenever a deliberation finishes.
  const [justLocked, setJustLocked] = useState(false);
  const wasDeliberating = useRef(false);
  useEffect(() => {
    if (wasDeliberating.current && arrived === null) setJustLocked(true);
    if (arrived !== null) setJustLocked(false);
    wasDeliberating.current = arrived !== null;
  }, [arrived]);

  if (run && !draft) {
    return (
      <main id="main" className="wrap empty-run">
        <h1 className="section-h">No case filed yet</h1>
        <p className="muted">File a case first, or try the sample briefs, and the forecast runs here.</p>
        <a className="text-link is-strong" href="#/new">Forecast a case <ArrowRight /></a>
      </main>
    );
  }

  const title = draft?.title || c.title;
  const phase = draft?.phase ?? "Before argument";
  const deliberating = arrived !== null;
  const done = !run || (stage === "voting" && !deliberating) || stage === "done";
  const sealed = done && !deliberating;
  const showVotes = stage !== "reading" && stage !== "summary";
  const seatsArrived = showVotes ? arrived : new Set();

  const counted = deliberating ? [...arrived] : d.sitting.map((j) => j.slug);
  const inMaj = deliberating ? counted.filter((s) => d.votes[s].vote === "majority").length : d.tally[0];
  const inMin = deliberating ? counted.length - inMaj : d.tally[1];

  const select = (slug) => {
    if (recused.has(slug)) return;
    setSelected(slug);
    setOpenRows(new Set([slug])); // picking a seat focuses one justice; the others collapse
    // Wait for the row to expand, then center the vote and its reason a little above mid-screen.
    requestAnimationFrame(() => {
      const row = document.getElementById(`row-${slug}`);
      if (!row) return;
      const r = row.getBoundingClientRect();
      const top = window.scrollY + r.top + r.height / 2 - window.innerHeight * 0.42;
      const reduce = reduceMotion();
      window.scrollTo({ top: Math.max(0, top), behavior: reduce ? "auto" : "smooth" });
      // A brief bench-green wash marks the row the eye should land on, once the scroll settles.
      row.animate(
        [
          { backgroundColor: "rgba(42, 85, 71, 0.16)" },
          { backgroundColor: "rgba(42, 85, 71, 0.16)", offset: 0.3 },
          { backgroundColor: "rgba(42, 85, 71, 0)" },
        ],
        { duration: reduce ? 1200 : 2400, delay: reduce ? 0 : 350, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "backwards" }
      );
    });
  };
  const toggle = (slug) =>
    setOpenRows((s) => {
      const n = new Set(s);
      n.has(slug) ? n.delete(slug) : n.add(slug);
      return n;
    });

  const ordered = [...justices].sort(
    (a, b) =>
      (recused.has(a.slug) ? 1 : 0) - (recused.has(b.slug) ? 1 : 0) ||
      (a.slug === d.author ? -1 : 0) - (b.slug === d.author ? -1 : 0) ||
      (d.votes[a.slug].vote === "majority" ? 0 : 1) - (d.votes[b.slug].vote === "majority" ? 0 : 1) ||
      a.seniority - b.seniority
  );

  // One polite announcement per milestone, rather than every vote as it lands.
  const announcement = run && stage === "reading" ? "Reading the briefs."
    : run && stage === "summary" ? "Briefing summarized. The justices' agents are reasoning."
    : deliberating ? "Deliberating."
    : justLocked ? `Forecast locked: ${d.outcome}, ${d.tally[0]} to ${d.tally[1]}.`
    : "";

  const sel = d.votes[selected];
  const caption = !showVotes
    ? stage === "reading" ? "Reading the briefs…" : "Briefing summarized. Each justice's agent is now reasoning."
    : deliberating
      ? "Each seat fills as that justice's agent returns its vote."
      : `${byslug[selected].name} · ${sel.role}${selected === d.author ? " · writes for the Court" : ""} · ${Math.round(sel.confidence * 100)}% confidence`;

  return (
    <main id="main">
      <p className="visually-hidden" aria-live="polite">{announcement}</p>
      <section className="band band-case" aria-labelledby="case-title">
        <div className="wrap">
          {run && (
            <p className="sample-flag" role="note">
              <span>Demo run with sample output. Real forecasts aren't connected yet{draft.source === "own" ? `, so this shows the Hartwell sample's votes under your case title` : ""}.</span>
              {done && (
                <span className="run-actions">
                  <a href="#/new/edit">Edit this filing</a>
                  <a href="#/new/fresh">File another case</a>
                </span>
              )}
            </p>
          )}
          <div className="case-head">
            <div>
              <p className="docket-line">
                {draft
                  ? <>{draft.docket ? `No. ${draft.docket}` : "Not yet docketed"} · {draft.term} · {draft.mode === "description" ? "From a plain-English description (less reliable)" : `${draft.briefCount} briefs filed`}</>
                  : <>No. {c.docket} · {c.term} · On writ of certiorari to the {c.lowerCourt}</>}
              </p>
              <h1 id="case-title" className="case-title">{title}</h1>
              <p className="case-outcome">
                {!showVotes ? (
                  stage === "reading" ? "Reading the briefs…" : "Summarizing the briefing…"
                ) : deliberating ? (
                  <>Deliberating, {arrived.size} of {order.length} votes in, <span className="num">{inMaj}–{inMin}</span></>
                ) : (
                  <>Predicted: {d.outcome}, <span className="num">{inMaj}–{inMin}</span></>
                )}
              </p>
            </div>
            <LockSeal lockedAt={lockedAt} phase={phase} open={!sealed} justLocked={justLocked} />
          </div>

          <Bench
            votes={d.votes}
            author={done ? d.author : null}
            arrangement={arrangement}
            arrived={seatsArrived}
            recused={recused}
            selected={done ? selected : null}
            onSelect={select}
          />

          <div className="bench-bar">
            <div className="segmented" role="group" aria-label="Arrange seats">
              {[["bench", "As seated"], ["split", "By vote"]].map(([key, label]) => (
                <button key={key} type="button" aria-pressed={arrangement === key} onClick={() => setArrangement(key)} disabled={!done}>
                  {label}
                </button>
              ))}
            </div>
            <p className="bench-caption">{caption}</p>
            <button type="button" className="ghost-btn" onClick={() => replay()} disabled={!done || deliberating}>
              <Replay /> Replay the run
            </button>
          </div>
          <BenchLegend />
        </div>
      </section>

      <div className="wrap case-body">
        <div className={`case-top${done ? "" : " is-waiting"}`}>
          <section className="justices" aria-labelledby="votes-h">
            <h2 id="votes-h" className="section-h">How each justice votes</h2>
            {done ? (
              <ol className="jlist">
                {ordered.map((j) => (
                  <JusticeRow
                    key={j.slug}
                    j={j}
                    v={d.votes[j.slug]}
                    isAuthor={j.slug === d.author}
                    open={openRows.has(j.slug)}
                    onToggle={() => toggle(j.slug)}
                    reason={c.reasoning[j.slug]}
                    recused={recused.has(j.slug)}
                  />
                ))}
              </ol>
            ) : (
              <p className="muted waiting-note">Votes appear here once every sitting justice's agent has returned.</p>
            )}
          </section>

          <aside className="decision" aria-labelledby="decision-h">
            <h2 id="decision-h" className="section-h">The predicted decision</h2>
            {done ? (
              <dl className="ruled-dl">
                <div><dt>Holding</dt><dd className="reading">{d.holding}</dd></div>
                {d.author && (
                  <div>
                    <dt>Opinion of the Court</dt>
                    <dd>
                      <strong>{byslug[d.author].name}</strong>
                      <span className="dd-note">{d.rationale}</span>
                    </dd>
                  </div>
                )}
                {d.concurring.length > 0 && <div><dt>Concurring</dt><dd>{d.concurring.map((j) => j.last).join(" and ")}</dd></div>}
                {d.losers.length > 0 && <div><dt>Dissenting</dt><dd>{d.losers.map((j) => j.last).join(", ")}</dd></div>}
                {recused.size > 0 && <div><dt>Recused</dt><dd>{[...recused].map((s) => byslug[s].last).join(", ")}</dd></div>}
              </dl>
            ) : (
              <p className="muted waiting-note">The clerk tallies the votes and predicts the author once deliberation ends.</p>
            )}
            <p className="fine">
              Prediction for educational purposes, not legal advice. {run ? "Demo output." : "Fictional sample case."}
            </p>
          </aside>
        </div>

        <section className={`briefing${run && stage === "reading" ? " is-reading" : ""}`} aria-labelledby="briefing-h">
          <h2 id="briefing-h" className="section-h">The briefing</h2>
          {run && stage === "reading" ? (
            <p className="muted waiting-note">Reading the briefs…</p>
          ) : (
            <div className={`briefing-grid${run ? " reveal" : ""}`}>
              <div className="reading-col">
                <h3>Facts</h3>
                <p className="reading">{c.facts}</p>
                {c.summary.map((s) => (
                  <div key={s.heading}>
                    <h3>{s.heading}</h3>
                    <p className="reading">{s.body}</p>
                  </div>
                ))}
                {done && (
                  <a className="text-link is-strong" href="#/reader">
                    Read every justice's full reasoning <ArrowRight />
                  </a>
                )}
              </div>
              <dl className="facts-dl">
                <div><dt>Petitioner</dt><dd>{c.petitioner}</dd></div>
                <div><dt>Respondent</dt><dd>{c.respondent}</dd></div>
                {run ? (
                  <div><dt>Phase</dt><dd>{phase}</dd></div>
                ) : (
                  <>
                    <div><dt>Granted</dt><dd className="num">{c.granted}</dd></div>
                    <div><dt>Argument</dt><dd className="num">{c.argued}</dd></div>
                  </>
                )}
                <div><dt>Decision</dt><dd className="awaiting">Awaiting the Court</dd></div>
              </dl>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
