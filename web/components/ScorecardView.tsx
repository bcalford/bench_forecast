"use client";
// The scorecard (spec §4), ported from web-1/src/pages/Scorecard.jsx onto real scored forecasts, with the
// prototype's clearly labelled sample-season preview. All arithmetic lives in lib/scorecard.ts and lib/scoring.ts.
import { useState, type ReactNode } from "react";
import Link from "next/link";
import Bench from "@/components/Bench";
import { ArrowRight } from "@/components/Icons";
import { byslug, type SeatVote } from "@/lib/court";
import { sampleSeason } from "@/lib/sample-season";
import type { WaitingRow } from "@/lib/scorecard-data";
import { byPhase, perJustice, seasonRecord, type ScoredCase } from "@/lib/scorecard";
import { CALIBRATION_MIN_VOTES, calibration } from "@/lib/scoring";

const pct = (n: number, d: number) => (d ? Math.round((100 * n) / d) : 0);

function CaseMarks({ hits, label }: { hits: boolean[]; label: string }) {
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

function RatioScale({ n, d }: { n: number; d: number }) {
  return (
    <span className="ratio-scale" aria-hidden="true">
      <span style={{ width: `${pct(n, d)}%` }} />
    </span>
  );
}

function RecordLine({ measure, sentence, visual }: { measure: string; sentence: ReactNode; visual: ReactNode }) {
  return (
    <li className="record-line">
      <span className="record-measure">{measure}</span>
      <span className="record-sentence">{sentence}</span>
      <span className="record-visual">{visual}</span>
    </li>
  );
}

function Calibration({ votes }: { votes: { confidence: number; voteRight: boolean }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const points = calibration(votes);

  // Plot area: stated confidence 50–100% across; observed accuracy 40–100% up.
  const W = 340, H = 240, L = 40, R = 12, T = 12, B = 34, Y0 = 0.4;
  const x = (v: number) => L + ((v - 0.5) / 0.5) * (W - L - R);
  const y = (v: number) => T + ((1 - Math.max(v, Y0)) / (1 - Y0)) * (H - T - B);

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

function Ledger({ cases, focus, onClear }: { cases: ScoredCase[]; focus: string | null; onClear: () => void }) {
  return (
    <section className="ledger" aria-labelledby="ledger-h">
      <div className="docket-head">
        <h2 id="ledger-h" className="section-h">Every scored case</h2>
        {focus && (
          <p className="ledger-filter">
            Showing {byslug[focus].last}&apos;s votes · <button type="button" className="link-btn" onClick={onClear}>Show all justices</button>
          </p>
        )}
      </div>
      <LedgerHead />
      <ol className="ledger-list">
        {cases.map((c) => {
          const v = focus ? c.votes.find((x) => x.slug === focus) : undefined;
          const title = <cite className="case-name">{c.title}</cite>;
          return (
            <li key={c.id ?? c.docket} className="ledger-row">
              <span className="ledger-no num">{c.docket}</span>
              <span className="ledger-case">
                {c.id ? <Link href={`/runs/${c.id}`}>{title}</Link> : title}
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
                    {c.predicted.votes[focus!]?.side ?? "Recused"} · <span className="num">{Math.round(v.confidence * 100)}%</span>
                  </>
                ) : (
                  <>
                    <CaseMarks hits={[c.outcomeRight]} label={c.outcomeRight ? "Outcome right" : "Outcome missed"} />
                    <span className="num">{c.votes.filter((x) => x.voteRight).length}/{c.votes.length}</span> votes
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

function PendingLedger({ rows }: { rows: WaitingRow[] }) {
  return (
    <section className="ledger" aria-labelledby="pending-h">
      <div className="docket-head">
        <h2 id="pending-h" className="section-h">Locked, waiting to be scored</h2>
      </div>
      {rows.length === 0 ? (
        <p className="muted">No October Term 2026 forecast is waiting for a decision.</p>
      ) : (
        <>
          <LedgerHead />
          <ol className="ledger-list">
            {rows.map((c) => (
              <li key={c.id} className="ledger-row is-pending">
                <span className="ledger-no num">{c.docket ?? "—"}</span>
                <span className="ledger-case">
                  <Link href={`/runs/${c.id}`}><cite className="case-name">{c.title}</cite></Link>
                  <span className="ledger-dates">{c.phase} · locked {c.lockedAt}</span>
                </span>
                <span className="ledger-tally">
                  <span className="ledger-k">Forecast</span>
                  <span className="num">{c.outcome} {c.tally.join("–")}</span>
                </span>
                <span className="ledger-tally">
                  <span className="ledger-k">Court</span>
                  <span className="awaiting">{c.review ? "Decided · scoring after review" : "Not yet decided"}</span>
                </span>
                <span className="ledger-score" />
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}

export default function ScorecardView({ counted, all, waiting }: { counted: ScoredCase[]; all: ScoredCase[]; waiting: WaitingRow[] }) {
  // Opens on the honest live view; the sample season is a labelled preview.
  const [source, setSource] = useState<"live" | "sample">("live");
  const [focus, setFocus] = useState<string | null>(null);
  const sample = source === "sample";
  const cases = sample ? sampleSeason : counted;
  const votes = cases.flatMap((c) => c.votes);
  const rec = seasonRecord(cases);
  const accuracy = perJustice(cases);
  const benchVotes: Record<string, SeatVote> = Object.fromEntries(
    Object.entries(accuracy).map(([slug, a]) => [slug, { vote: "majority" as const, role: "", confidence: a.right / a.n, writes: false }]),
  );
  const phases = byPhase(sample ? sampleSeason : all);
  const phaseCases = (phase: string) => (sample ? sampleSeason : all).filter((c) => c.phase === phase);

  const n = rec.n;
  const records = [
    {
      measure: "Case outcome",
      sentence: n ? <>Right in <b className="num">{rec.outcomeRight} of {n}</b> decided cases</> : "Awaiting the first decision",
      visual: n ? <CaseMarks hits={cases.map((c) => c.outcomeRight)} label={`${rec.outcomeRight} of ${n} outcomes right`} /> : null,
    },
    {
      measure: "Individual votes",
      sentence: n ? <>Right on <b className="num">{rec.voteRight} of {rec.votes}</b> votes</> : "Awaiting the first decision",
      visual: n ? <RatioScale n={rec.voteRight} d={rec.votes} /> : null,
    },
    {
      measure: "Majority membership",
      sentence: n ? <>Placed <b className="num">{rec.majorityRight} of {rec.votes}</b> justices on the right side</> : "Awaiting the first decision",
      visual: n ? <RatioScale n={rec.majorityRight} d={rec.votes} /> : null,
    },
    {
      measure: "Opinion author",
      sentence: n ? <>Named the author in <b className="num">{rec.authorRight} of {rec.authorN}</b> cases</> : "Awaiting the first decision",
      visual: rec.authorN ? (
        <CaseMarks hits={cases.filter((c) => c.authorRight !== null).map((c) => !!c.authorRight)} label={`${rec.authorRight} of ${rec.authorN} authors right`} />
      ) : null,
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
                Only forecasts locked before their decision count. Cases decided before the models&apos; knowledge cutoff are excluded as <Link href="/method#fairtest">not a fair test</Link>.
              </p>
            </div>
            <div className="segmented" role="group" aria-label="Which results to show">
              {([["live", "OT2026 (live)"], ["sample", "Preview a sample season"]] as const).map(([key, label]) => (
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
            <p className="muted">{n ? "The arc above each seat shows how often that justice's vote was called right. Pick a seat to see their votes below." : "Each seat fills once that justice has a decided case."}</p>
          </div>
          <div className="score-bench">
            <Bench
              votes={benchVotes}
              neutral
              interactive={n > 0}
              selected={focus}
              onSelect={(slug) => setFocus((f) => (f === slug ? null : slug))}
              label="Vote accuracy by justice, in bench seating order"
              caption={(j) => (accuracy[j.slug] ? `${accuracy[j.slug].right} of ${accuracy[j.slug].n}` : "No cases yet")}
              describe={(j) => (accuracy[j.slug] ? `${j.name}: ${accuracy[j.slug].right} of ${accuracy[j.slug].n} votes right` : `${j.name}: no decided cases yet`)}
            />
          </div>
        </section>

        <div className="score-pair">
          <section aria-labelledby="phase-h">
            <h2 id="phase-h" className="section-h">Before and after argument</h2>
            <ol className="phase-list">
              {phases.map((p) => (
                <li key={p.phase}>
                  <h3>{p.phase}</h3>
                  {p.n ? (
                    <>
                      <p>Outcome right in <b className="num">{p.outcomeRight} of {p.n}</b> cases</p>
                      <CaseMarks hits={phaseCases(p.phase).map((c) => c.outcomeRight)} label={`${p.outcomeRight} of ${p.n} outcomes right`} />
                      <p>Votes right: <b className="num">{p.voteRight} of {p.votes}</b></p>
                      <RatioScale n={p.voteRight} d={p.votes} />
                    </>
                  ) : (
                    <p className="muted">No scored cases yet.</p>
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
                Calibration needs {CALIBRATION_MIN_VOTES} scored votes; {votes.length} so far.
              </p>
            )}
          </section>
        </div>

        {n > 0 && <Ledger cases={cases} focus={focus} onClear={() => setFocus(null)} />}
        {!sample && <PendingLedger rows={waiting} />}

        <Link className="text-link is-strong" href="/method#scoring">How forecasts are scored <ArrowRight /></Link>
      </div>
    </main>
  );
}
