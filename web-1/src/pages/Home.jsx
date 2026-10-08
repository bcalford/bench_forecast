import { sampleCase, recentCases } from "../data.js";
import Bench, { TallyMarks } from "../components/Bench.jsx";
import { ArrowRight } from "../components/Icons.jsx";

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
              <a className="solid-btn" href="#/run/sample">Watch the Hartwell sample run <ArrowRight /></a>
              <a className="ghost-btn" href="#/case">Read the Hartwell sample</a>
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
          {recentCases.filter((rc) => rc.href).map((rc) => (
            <li key={rc.docket}>
              <a className="docket-row is-link" href={rc.href}>
                <span className="docket-no num">No. {rc.docket}</span>
                <cite className="docket-title case-name">{rc.title}</cite>
                <TallyMarks tally={rc.tally} />
                <span className="docket-out">
                  {rc.outcome} <span className="num">{rc.tally[0]}–{rc.tally[1]}</span>
                </span>
                <span className="docket-phase">{rc.phase}</span>
                <ArrowRight className="docket-arrow" />
              </a>
            </li>
          ))}
        </ol>
      </section>

      <section className="wrap open-pair" aria-label="How it works">
        <div>
          <h2 className="section-h">Made in the open</h2>
          <p className="open-text">
            Each justice's agent reasons from that justice's own opinions and argument questions, and every passage it
            cites must be one it actually retrieved. Code tallies the votes; one more pass predicts the author.
          </p>
          <a className="text-link is-strong" href="#/method">Read the method <ArrowRight /></a>
        </div>
        <div>
          <h2 className="section-h">Scored in public</h2>
          <p className="open-text">
            Forecasts are locked before the Court rules and scored on the outcome, every vote, majority membership and
            the author. No OT2026 case has been decided yet, so no accuracy is claimed.
          </p>
          <a className="text-link is-strong" href="#/scorecard/sample">Preview the scorecard with a sample season <ArrowRight /></a>
        </div>
      </section>
    </main>
  );
}
