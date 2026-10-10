import Link from "next/link";
import Bench, { TallyMarks } from "@/components/Bench";
import { ArrowRight } from "@/components/Icons";
import { listForecasts, loadForecast, type ForecastRow } from "@/lib/views";

export const dynamic = "force-dynamic";

function Row({ r }: { r: ForecastRow }) {
  const locked = r.status === "locked";
  return (
    <li>
      <Link className="docket-row is-link" href={`/runs/${r.id}`}>
        <span className="docket-no num">{r.docket ? `No. ${r.docket}` : "Undocketed"}</span>
        <cite className="docket-title case-name">{r.title}</cite>
        {locked ? <TallyMarks tally={r.tally} /> : <span />}
        <span className="docket-out">
          {locked ? <>{r.outcome} <span className="num">{r.tally[0]}–{r.tally[1]}</span></> : "Running…"}
        </span>
        <span className="docket-phase">{r.fairTest ? r.phase : "Not a fair test"}</span>
        <ArrowRight className="docket-arrow" />
      </Link>
    </li>
  );
}

export default async function Home() {
  const rows = await listForecasts();
  const featuredRow = rows.find((r) => r.status === "locked" && r.fairTest) ?? rows.find((r) => r.status === "locked");
  const featured = featuredRow ? await loadForecast(featuredRow.id) : null;
  const terms = [...new Set(rows.map((r) => r.term))];

  return (
    <main id="main">
      <section className="band band-home" aria-labelledby="home-h">
        <div className="wrap home-hero">
          <div className="home-copy">
            <h1 id="home-h" className="home-title">Forecast the Court, one justice at a time</h1>
            <p className="home-lede">
              Nine agents, each grounded in a justice&apos;s own opinions and oral argument record,
              predict how the Supreme Court will decide a case, and explain why.
            </p>
            <div className="home-actions">
              {featured && <Link className="solid-btn" href={`/runs/${featured.id}`}>Read the latest forecast <ArrowRight /></Link>}
              <Link className={featured ? "ghost-btn" : "solid-btn"} href="/new">Forecast a case</Link>
            </div>
          </div>
          {featured && (
            <Link className="home-specimen" href={`/runs/${featured.id}`} aria-label={`${featured.title}: predicted ${featured.tally[0]} to ${featured.tally[1]}, open the forecast`}>
              <span className="specimen-head">
                <cite className="case-name">{featured.title}</cite>
                <span className="num">{featured.outcome}, {featured.tally[0]}–{featured.tally[1]}{featured.fairTest ? "" : " · Not a fair test"}</span>
              </span>
              <Bench votes={featured.votes} author={featured.author} recused={new Set(featured.recused)} interactive={false} sideLabels={featured.sideLabels} />
            </Link>
          )}
        </div>
      </section>

      {terms.length === 0 ? (
        <section className="wrap docket" aria-labelledby="docket-h">
          <div className="docket-head">
            <h2 id="docket-h" className="section-h">No forecasts yet</h2>
            <p className="muted">Each forecast is locked before the Court releases its decision. The first ones appear here.</p>
          </div>
        </section>
      ) : terms.map((term) => (
        <section key={term} className="wrap docket" aria-labelledby={`docket-${term}`}>
          <div className="docket-head">
            <h2 id={`docket-${term}`} className="section-h">{term}</h2>
            <p className="muted">
              {rows.some((r) => r.term === term && r.fairTest)
                ? "Each forecast is locked before the Court releases its decision."
                : "Backtests of cases the Court has already decided. They show the method at work but are never scored."}
            </p>
          </div>
          <ol className="docket-list">
            {rows.filter((r) => r.term === term).map((r) => <Row key={r.id} r={r} />)}
          </ol>
        </section>
      ))}

      <section className="wrap open-pair" aria-label="How it works">
        <div>
          <h2 className="section-h">Made in the open</h2>
          <p className="open-text">
            Each justice&apos;s agent reasons from that justice&apos;s own opinions and argument questions, and every passage it
            cites must be one it actually retrieved. Code tallies the votes; one more pass predicts the author.
          </p>
          <Link className="text-link is-strong" href="/method">Read the method <ArrowRight /></Link>
        </div>
        <div>
          <h2 className="section-h">Scored in public</h2>
          <p className="open-text">
            Forecasts are locked before the Court rules and scored on the outcome, every vote, majority membership and
            the author. No October Term 2026 case has been decided yet, so no accuracy is claimed.
          </p>
          <Link className="text-link is-strong" href="/scorecard">See the scorecard <ArrowRight /></Link>
        </div>
      </section>
    </main>
  );
}
