import { useMemo, useState } from "react";
import { byslug, recentCases } from "../data.js";
import { sampleSeason } from "../sampleSeason.js";
import Bench from "../components/Bench.jsx";
import { ArrowRight } from "../components/Icons.jsx";

const CALIBRATION_MIN_VOTES = 20;
const BUCKETS = [[0.5, 0.6], [0.6, 0.7], [0.7, 0.8], [0.8, 0.9], [0.9, 1.01]];

const pct = (n, d) => (d ? Math.round((100 * n) / d) : 0);
const count = (xs, f) => xs.filter(f).length;

function CaseMarks({ hits, label }) {
  return (
    <span className="case-marks" role="img" aria-label={label}>
      {hits.map((hit, i) => (
        <svg key={i} viewBox="0 0 12 12" aria-hidden="true">
          <circle cx="6" cy="6" r={hit ? 5 : 4.25} className={hit ? "cm-hit" : "cm-miss"} />
        </svg>
      ))}
    </span>
  );
}

function RatioScale({ n, d }) {
  return (
    <span className="ratio-scale" aria-hidden="true">
      <span style={{ width: `${pct(n, d)}%` }} />
    </span>
  );
}

function RecordLine({ measure, sentence, visual }) {
  return (
    <li className="record-line">
      <span className="record-measure">{measure}</span>
      <span className="record-sentence">{sentence}</span>
      <span className="record-visual">{visual}</span>
    </li>
  );
}

function Calibration({ votes }) {
  const [hover, setHover] = useState(null);
  const points = BUCKETS.map(([lo, hi]) => {
    const b = votes.filter((v) => v.confidence >= lo && v.confidence < hi);
    const stated = b.reduce((s, v) => s + v.confidence, 0) / (b.length || 1);
    return { lo, hi: Math.min(hi, 1), n: b.length, stated, observed: count(b, (v) => v.voteRight) / (b.length || 1) };
  }).filter((p) => p.n > 0);

  // Plot area: stated confidence 50–100% across; observed accuracy 40–100% up.
  const W = 340, H = 240, L = 40, R = 12, T = 12, B = 34, Y0 = 0.4;
  const x = (v) => L + ((v - 0.5) / 0.5) * (W - L - R);
  const y = (v) => T + ((1 - Math.max(v, Y0)) / (1 - Y0)) * (H - T - B);

  return (
    <figure className="calib">
      <svg viewBox={`0 0 ${W} ${H}`} className="calib-svg" role="group"
        aria-label="Calibration: stated confidence against how often those votes were right">
        {[0.4, 0.6, 0.8, 1].map((t) => (
          <g key={t} aria-hidden="true">
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="calib-grid" />
            <text x={L - 8} y={y(t) + 4} className="calib-tick" textAnchor="end">{Math.round(t * 100)}%</text>
          </g>
        ))}
        {[0.5, 0.6, 0.7, 0.8, 0.9, 1].map((t) => (
          <text key={t} x={x(t)} y={H - B + 18} className="calib-tick" textAnchor="middle" aria-hidden="true">{Math.round(t * 100)}%</text>
        ))}
        <line x1={x(0.5)} y1={y(0.5)} x2={x(1)} y2={y(1)} className="calib-ideal" aria-hidden="true" />
        <text x={x(0.66)} y={y(0.66) + 16} className="calib-note" aria-hidden="true" transform={`rotate(-${(Math.atan2(y(0.5) - y(1), x(1) - x(0.5)) * 180) / Math.PI} ${x(0.66)} ${y(0.66) + 16})`}>
          perfectly calibrated
        </text>
        {points.map((p, i) => (
          <g key={p.lo}>
            <line x1={x(p.stated)} x2={x(p.stated)} y1={y(p.stated)} y2={y(p.observed)} className="calib-gap" />
            <circle
              cx={x(p.stated)} cy={y(p.observed)} r={hover === i ? 7 : 5.5}
              className="calib-dot" tabIndex={0} role="img"
              aria-label={`Stated ${Math.round(p.stated * 100)}%, right ${Math.round(p.observed * 100)}% of ${p.n} votes`}
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)} onBlur={() => setHover(null)}
            />
            <circle cx={x(p.stated)} cy={y(p.observed)} r="16" className="calib-hit" aria-hidden="true"
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
          </g>
        ))}
      </svg>
      {hover !== null && (
        <div className="calib-tip" style={{ left: `${(x(points[hover].stated) / W) * 100}%`, top: `${(y(points[hover].observed) / H) * 100}%` }}>
          <strong>Said {Math.round(points[hover].stated * 100)}%</strong>
          <span>Right {Math.round(points[hover].observed * 100)}% of the time</span>
          <span className="muted">{points[hover].n} votes</span>
        </div>
      )}
      <figcaption>Stated confidence (across) against how often those votes were right (up).</figcaption>
      <details className="calib-table">
        <summary>View as a table</summary>
        <table>
          <thead><tr><th scope="col">Confidence</th><th scope="col">Votes</th><th scope="col">Right</th></tr></thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.lo}>
                <td className="num">{Math.round(p.lo * 100)}–{Math.round(p.hi * 100)}%</td>
                <td className="num">{p.n}</td>
                <td className="num">{Math.round(p.observed * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

// Column heads for wide screens; each row keeps its own labels for screen readers and phones.
function LedgerHead() {
  return (
    <div className="ledger-head" aria-hidden="true">
      <span>No.</span><span>Case</span><span>Forecast</span><span>Court</span><span>Outcome · votes</span>
    </div>
  );
}

function MarksKey() {
  return (
    <p className="marks-key" aria-hidden="true">
      <CaseMarks hits={[true]} label="" /> Right <CaseMarks hits={[false]} label="" /> Missed
    </p>
  );
}

function Ledger({ cases, focus, onClear }) {
  return (
    <section className="ledger" aria-labelledby="ledger-h">
      <div className="docket-head">
        <h2 id="ledger-h" className="section-h">Every scored case</h2>
        {focus && (
          <p className="ledger-filter">
            Showing {byslug[focus].last}'s votes · <button type="button" className="link-btn" onClick={onClear}>Show all justices</button>
          </p>
        )}
      </div>
      <LedgerHead />
      <ol className="ledger-list">
        {cases.map((c) => {
          const v = focus && c.votes.find((x) => x.slug === focus);
          return (
            <li key={c.docket} className="ledger-row">
              <span className="ledger-no num">{c.docket}</span>
              <span className="ledger-case">
                <cite className="case-name">{c.title}</cite>
                <span className="ledger-dates num">Locked {c.locked} · Decided {c.decided} · {c.phase}</span>
              </span>
              <span className="ledger-tally">
                <span className="ledger-k">Forecast</span>
                <span className="num">{c.predicted.disposition} {c.predicted.tally.join("–")}</span>
              </span>
              <span className="ledger-tally">
                <span className="ledger-k">Court</span>
                <span className="num">{c.actual.disposition} {c.actual.tally.join("–")}</span>
              </span>
              <span className="ledger-score">
                {v ? (
                  <>
                    <CaseMarks hits={[v.voteRight]} label={v.voteRight ? "Vote right" : "Vote missed"} />
                    {c.predicted.votes[focus].side} · <span className="num">{Math.round(v.confidence * 100)}%</span>
                  </>
                ) : (
                  <>
                    <CaseMarks hits={[c.outcomeRight]} label={c.outcomeRight ? "Outcome right" : "Outcome missed"} />
                    <span className="num">{count(c.votes, (x) => x.voteRight)}/9</span> votes
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function PendingLedger() {
  return (
    <section className="ledger" aria-labelledby="ledger-h">
      <div className="docket-head">
        <h2 id="ledger-h" className="section-h">Locked, waiting to be scored</h2>
      </div>
      <LedgerHead />
      <ol className="ledger-list">
        {recentCases.filter((c) => c.href).map((c) => (
          <li key={c.docket} className="ledger-row is-pending">
            <span className="ledger-no num">{c.docket}</span>
            <span className="ledger-case">
              <cite className="case-name">{c.title}</cite>
              <span className="ledger-dates">{c.phase}</span>
            </span>
            <span className="ledger-tally">
              <span className="ledger-k">Forecast</span>
              <span className="num">{c.outcome} {c.tally.join("–")}</span>
            </span>
            <span className="ledger-tally">
              <span className="ledger-k">Court</span>
              <span className="awaiting">Not yet decided</span>
            </span>
            <span className="ledger-score" />
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function Scorecard({ focus: routeFocus }) {
  // Opens on the honest live view; "#/scorecard/sample" opens the sample-season preview.
  const [source, setSource] = useState(routeFocus === "sample" ? "sample" : "live");
  const [focus, setFocus] = useState(null);
  const sample = source === "sample";
  const cases = sample ? sampleSeason : [];
  const votes = cases.flatMap((c) => c.votes);

  const perJustice = useMemo(() => {
    const out = {};
    for (const c of sampleSeason) for (const v of c.votes) {
      out[v.slug] ??= { right: 0, n: 0 };
      out[v.slug].n++;
      if (v.voteRight) out[v.slug].right++;
    }
    return Object.fromEntries(
      Object.entries(out).map(([slug, a]) => [slug, { vote: "majority", role: "", confidence: a.right / a.n, ...a }])
    );
  }, []);

  const phases = ["Before argument", "After argument"].map((phase) => {
    const cs = cases.filter((c) => c.phase === phase);
    const vs = cs.flatMap((c) => c.votes);
    return { phase, cs, vs };
  });

  const n = cases.length;
  const records = [
    {
      measure: "Case outcome",
      sentence: n ? <>Right in <b className="num">{count(cases, (c) => c.outcomeRight)} of {n}</b> decided cases</> : "Awaiting the first decision",
      visual: n ? <CaseMarks hits={cases.map((c) => c.outcomeRight)} label={`${count(cases, (c) => c.outcomeRight)} of ${n} outcomes right`} /> : null,
    },
    {
      measure: "Individual votes",
      sentence: n ? <>Right on <b className="num">{count(votes, (v) => v.voteRight)} of {votes.length}</b> votes</> : "Awaiting the first decision",
      visual: n ? <RatioScale n={count(votes, (v) => v.voteRight)} d={votes.length} /> : null,
    },
    {
      measure: "Majority membership",
      sentence: n ? <>Placed <b className="num">{count(votes, (v) => v.majorityRight)} of {votes.length}</b> justices on the right side</> : "Awaiting the first decision",
      visual: n ? <RatioScale n={count(votes, (v) => v.majorityRight)} d={votes.length} /> : null,
    },
    {
      measure: "Opinion author",
      sentence: n ? <>Named the author in <b className="num">{count(cases, (c) => c.authorRight)} of {n}</b> cases</> : "Awaiting the first decision",
      visual: n ? <CaseMarks hits={cases.map((c) => c.authorRight)} label={`${count(cases, (c) => c.authorRight)} of ${n} authors right`} /> : null,
    },
  ];

  return (
    <main id="main">
      <section className="band band-score" aria-labelledby="score-title">
        <div className="wrap">
          <div className="score-head">
            <div>
              <h1 id="score-title" className="reader-title">Scorecard</h1>
              <p className="docket-line">
                Only forecasts locked before their decision count. Cases decided before the model's knowledge cutoff are excluded as <a href="#/method/fairtest">not a fair test</a>.
              </p>
            </div>
            <div className="segmented" role="group" aria-label="Which results to show">
              {[["live", "OT2026 (live)"], ["sample", "Preview a sample season"]].map(([key, label]) => (
                <button key={key} type="button" aria-pressed={source === key} onClick={() => { setSource(key); setFocus(null); }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {sample && (
            <p className="sample-flag" role="note">
              <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M10 3 18 17H2Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="M10 8.5v3.5M10 14.2v.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              Sample data, not real results. Sixteen synthetic cases show how the scorecard reads once the Court starts deciding.
            </p>
          )}

          <ol className="record">
            {records.map((r) => <RecordLine key={r.measure} {...r} />)}
          </ol>
          {n > 0 && <MarksKey />}
        </div>
      </section>

      <div className="wrap score-body">
        <section aria-labelledby="by-justice-h">
          <div className="docket-head">
            <h2 id="by-justice-h" className="section-h">Accuracy by justice</h2>
            <p className="muted">{sample ? "The arc above each seat shows how often that justice's vote was called right. Pick a seat to see their votes below." : "Each seat fills once that justice has a decided case."}</p>
          </div>
          <div className="score-bench">
            <Bench
              votes={perJustice}
              neutral
              arrived={sample ? null : new Set()}
              selected={focus}
              onSelect={(slug) => setFocus((f) => (f === slug ? null : slug))}
              label="Vote accuracy by justice, in bench seating order"
              describe={(j, v, pending) =>
                pending ? `${j.name}: no decided cases yet` : `${j.name}: ${v.right} of ${v.n} votes right, ${Math.round(v.confidence * 100)}%`
              }
            />
          </div>
        </section>

        <div className="score-pair">
          <section aria-labelledby="phase-h">
            <h2 id="phase-h" className="section-h">Before and after argument</h2>
            <ol className="phase-list">
              {phases.map(({ phase, cs, vs }) => (
                <li key={phase}>
                  <h3>{phase}</h3>
                  {cs.length ? (
                    <>
                      <p>Outcome right in <b className="num">{count(cs, (c) => c.outcomeRight)} of {cs.length}</b> cases</p>
                      <CaseMarks hits={cs.map((c) => c.outcomeRight)} label={`${count(cs, (c) => c.outcomeRight)} of ${cs.length} outcomes right`} />
                      <p>Votes right: <b className="num">{count(vs, (v) => v.voteRight)} of {vs.length}</b></p>
                      <RatioScale n={count(vs, (v) => v.voteRight)} d={vs.length} />
                    </>
                  ) : (
                    <p className="muted">No decided cases yet.</p>
                  )}
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="calib-h">
            <h2 id="calib-h" className="section-h">Is the confidence honest?</h2>
            {votes.length >= CALIBRATION_MIN_VOTES ? (
              <>
                <p className="calib-lede">
                  When a forecast says 80%, it should be right about 80% of the time. Dots above the line mean the forecast was underconfident; dots below mean it was overconfident.
                </p>
                <Calibration votes={votes} />
              </>
            ) : (
              <p className="muted calib-lede">
                Calibration needs at least {CALIBRATION_MIN_VOTES} scored votes before it means anything. It appears once enough decisions are in.
              </p>
            )}
          </section>
        </div>

        {sample ? <Ledger cases={sampleSeason} focus={focus} onClear={() => setFocus(null)} /> : <PendingLedger />}

        <a className="text-link is-strong" href="#/case">See how a single forecast is made <ArrowRight /></a>
      </div>
    </main>
  );
}
