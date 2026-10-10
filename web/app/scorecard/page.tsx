import type { Metadata } from "next";
import Link from "next/link";
import Bench from "@/components/Bench";
import { ArrowRight } from "@/components/Icons";
import { listForecasts } from "@/lib/views";

export const metadata: Metadata = { title: "Scorecard · Bench Forecast" };
export const dynamic = "force-dynamic";

const MEASURES = ["Case outcome", "Individual votes", "Majority membership", "Opinion author"];

// Scoring arrives with the outcomes job (phase 7). Until the Court decides a scored case, this page says so
// and lists what is locked and waiting.
export default async function ScorecardPage() {
  const waiting = (await listForecasts()).filter((r) => r.status === "locked" && r.fairTest);
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
          </div>
          <ol className="record">
            {MEASURES.map((m) => (
              <li key={m} className="record-line">
                <span className="record-measure">{m}</span>
                <span className="record-sentence">Awaiting the first decision</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <div className="wrap score-body">
        <section aria-labelledby="by-justice-h">
          <div className="docket-head">
            <h2 id="by-justice-h" className="section-h">Accuracy by justice</h2>
            <p className="muted">Each seat fills once that justice has a decided case.</p>
          </div>
          <div className="score-bench">
            <Bench votes={{}} neutral interactive={false} label="Vote accuracy by justice, in bench seating order" caption="No cases yet" />
          </div>
        </section>

        <section className="ledger" aria-labelledby="ledger-h">
          <div className="docket-head">
            <h2 id="ledger-h" className="section-h">Locked, waiting to be scored</h2>
          </div>
          {waiting.length === 0 ? (
            <p className="muted">No October Term 2026 forecast is locked yet.</p>
          ) : (
            <ol className="ledger-list">
              {waiting.map((c) => (
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
                    <span className="awaiting">Not yet decided</span>
                  </span>
                  <span className="ledger-score" />
                </li>
              ))}
            </ol>
          )}
        </section>

        <Link className="text-link is-strong" href="/method#scoring">How forecasts are scored <ArrowRight /></Link>
      </div>
    </main>
  );
}
