import { sampleCase, recentCases } from "../data.js";
import Bench, { TallyMarks } from "../components/Bench.jsx";
import { ArrowRight } from "../components/Icons.jsx";

const STEPS = [
  ["Briefs in", "Merits briefs, amicus briefs and, after argument, the transcript. A plain-English description works too, with a reliability warning."],
  ["One agent per justice", "Each reasons from that justice's own opinions and oral-argument questions, retrieved for this case, plus a reviewed profile."],
  ["Citations checked", "Every passage an agent cites must be one it actually retrieved. Anything else is removed and the vote is flagged."],
  ["The clerk tallies", "Code counts the votes, handles ties and finds who assigns the opinion. One more pass predicts the author and the opinion split."],
  ["Locked, then scored", "The prediction is timestamped before the Court rules and scored against the real decision."],
];

export default function Home() {
  const c = sampleCase;
  return (
    <main id="main">
      <section className="band band-home" aria-labelledby="home-h">
        <div className="wrap home-hero">
          <div className="home-copy">
            <h1 id="home-h" className="home-title">Forecast the Court, one justice at a time</h1>
            <p className="home-lede">
              Nine agents, each grounded in a justice's own opinions and oral argument record,
              predict how the Supreme Court will decide a case, and explain why.
            </p>
            <div className="home-actions">
              <a className="solid-btn" href="#/case">Open the sample forecast <ArrowRight /></a>
              <a className="ghost-btn" href="#/new">Forecast a case</a>
            </div>
          </div>
          <a className="home-specimen" href="#/case" aria-label={`${c.title}: predicted 6 to 3, open the forecast`}>
            <span className="specimen-head">
              <cite className="case-name">{c.title}</cite>
              <span className="num">Reverse, 6–3</span>
            </span>
            <Bench votes={c.votes} author={c.prediction.author} interactive={false} />
          </a>
        </div>
      </section>

      <section className="wrap docket" aria-labelledby="docket-h">
        <div className="docket-head">
          <h2 id="docket-h" className="section-h">October Term 2026</h2>
          <p className="muted">Each forecast is locked before the Court releases its decision. Sample cases, fictional.</p>
        </div>
        <ol className="docket-list">
          {recentCases.map((rc) => {
            const Row = rc.href ? "a" : "div";
            return (
              <li key={rc.docket}>
                <Row className={`docket-row${rc.href ? " is-link" : ""}`} {...(rc.href ? { href: rc.href } : {})}>
                  <span className="docket-no num">No. {rc.docket}</span>
                  <cite className="docket-title case-name">{rc.title}</cite>
                  <TallyMarks tally={rc.tally} />
                  <span className="docket-out">
                    {rc.outcome} <span className="num">{rc.tally[0]}–{rc.tally[1]}</span>
                  </span>
                  <span className="docket-phase">{rc.phase}</span>
                  {rc.href ? <ArrowRight className="docket-arrow" /> : <span className="docket-summary">Summary only</span>}
                </Row>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="wrap method" aria-labelledby="method-h">
        <h2 id="method-h" className="section-h">How a forecast is made</h2>
        <ol className="method-steps">
          {STEPS.map(([h, body]) => (
            <li key={h}>
              <h3>{h}</h3>
              <p>{body}</p>
            </li>
          ))}
        </ol>
        <a className="text-link is-strong" href="#/method">Read the full method <ArrowRight /></a>
      </section>

      <section className="wrap scorecard" aria-labelledby="score-h">
        <div className="docket-head">
          <h2 id="score-h" className="section-h">Scored in public</h2>
          <p className="muted">Only forecasts locked before their decision count. No accuracy is claimed until the Court rules.</p>
        </div>
        <p className="score-empty">
          Scoring starts with the first decided case. Each locked forecast will be scored on four measures:
          the case outcome, every individual vote, majority membership and the opinion author.
          No OT2026 case has been decided yet.
        </p>
        <a className="text-link is-strong" href="#/scorecard">
          Preview the scorecard with a sample season <ArrowRight />
        </a>
      </section>
    </main>
  );
}
