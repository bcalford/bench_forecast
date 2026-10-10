"use client";
// One forecast, live. While the job runs, the page follows `predictions` and `justice_votes` over Supabase
// Realtime and re-renders from the server on each change; once locked it is a static record with a replay.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import Bench, { BenchLegend } from "./Bench";
import SeatMark from "./SeatMark";
import { LockSeal } from "./Chrome";
import { ArrowRight, Chevron, Lock, Replay } from "./Icons";
import { byslug, justices } from "@/lib/court";
import type { ForecastView, VoteView } from "@/lib/views";

const ARRIVAL_MS = 420;
const reduceMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const WAITING: Record<string, string> = {
  queued: "Queued. The run starts in a moment…",
  summarizing: "Reading and summarizing the briefs…",
  retrieving: "Finding each justice's prior writing on these questions…",
  deliberating: "Each justice's agent is reasoning…",
  clerk: "All votes in. The clerk is tallying and predicting the author…",
};

// Re-render from the server whenever the job writes to this forecast. A slow poll backs up Realtime.
function useLive(id: string, running: boolean) {
  const router = useRouter();
  useEffect(() => {
    if (!running) return;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const refresh = () => router.refresh();
    const poll = setInterval(refresh, 8000);
    if (!url || !key) return () => clearInterval(poll);
    const db = createClient(url, key);
    const channel = db
      .channel(`forecast-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "predictions", filter: `id=eq.${id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "justice_votes", filter: `prediction_id=eq.${id}` }, refresh)
      .subscribe();
    return () => { clearInterval(poll); db.removeChannel(channel); };
  }, [id, running, router]);
}

// Plays the locked forecast's votes back in the order they actually landed.
function useReplay(order: string[]) {
  const [arrived, setArrived] = useState<Set<string> | null>(null); // null = every sitting vote is in
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => clear, []);
  const start = () => {
    clear();
    const step = reduceMotion() ? 120 : ARRIVAL_MS;
    setArrived(new Set());
    order.forEach((slug, i) => timers.current.push(setTimeout(() => setArrived((s) => new Set(s).add(slug)), 500 + i * step)));
    timers.current.push(setTimeout(() => setArrived(null), 500 + order.length * step + 250));
  };
  return [arrived, start] as const;
}

const paragraphs = (text: string) => text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

function JusticeRow({ slug, v, isAuthor, open, onToggle, recused, href }: {
  slug: string; v?: VoteView; isAuthor: boolean; open: boolean; onToggle: () => void; recused: boolean; href: string;
}) {
  const j = byslug[slug];
  if (recused || !v) {
    return (
      <li className="jrow is-recused" id={`row-${slug}`}>
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
  const n = v.citations.length;
  return (
    <li className={`jrow${open ? " is-open" : ""}`} id={`row-${slug}`}>
      <button type="button" className="jrow-head" aria-expanded={open} onClick={onToggle}>
        <SeatMark vote={v} isAuthor={isAuthor} size={36} />
        <span className="jrow-name">
          <span>{j.name}</span>
          <span className="jrow-role">{v.role}</span>
        </span>
        <span className="jrow-vote">{v.disposition}</span>
        <span className="jrow-conf">
          <span className="conf-scale" aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>
          <span className="num">{pct}%</span>
        </span>
        <Chevron className="jrow-chev" />
      </button>
      <div className="jrow-body" hidden={!open}>
        <p className="reading">{v.briefReason}</p>
        <Link className="text-link" href={href}>
          Full reasoning, with {n === 1 ? "one citation" : `${n} citations`} from {j.last}&apos;s own opinions <ArrowRight />
        </Link>
      </div>
    </li>
  );
}

export default function RunView({ f }: { f: ForecastView }) {
  const running = f.status !== "locked" && f.status !== "failed";
  useLive(f.id, running);
  const recused = new Set(f.recused);
  const [arrangement, setArrangement] = useState<"bench" | "split">("bench");
  const [arrived, replay] = useReplay(f.arrival);
  const [selected, setSelected] = useState<string | null>(f.author ?? f.sitting[0] ?? null);
  const [openRows, setOpenRows] = useState<Set<string>>(() => new Set(f.author ? [f.author] : []));
  const reasoningHref = (slug?: string) => `/runs/${f.id}/reasoning${slug ? `#j-${slug}` : ""}`;

  // The seal closes (and plays its closing once) when the job locks while the page is open, or a replay ends.
  const [justLocked, setJustLocked] = useState(false);
  const wasOpen = useRef(running);
  const replaying = arrived !== null;
  const sealed = f.status === "locked" && !replaying;
  useEffect(() => {
    if (wasOpen.current && sealed) setJustLocked(true);
    if (!sealed) setJustLocked(false);
    wasOpen.current = !sealed;
  }, [sealed]);

  const done = f.status === "locked";
  const failed = f.status === "failed";
  const showVotes = f.arrival.length > 0;
  const seatsArrived = replaying ? arrived : done ? null : new Set(f.arrival);
  const counted = replaying ? [...arrived] : f.arrival;
  const inMaj = done && !replaying ? f.tally[0] : counted.filter((s) => f.votes[s]?.vote === "majority").length;
  const inMin = done && !replaying ? f.tally[1] : counted.length - inMaj;
  const outcome = f.outcome ?? "";
  const outcomeHead = outcome.slice(0, outcome.lastIndexOf(" ") + 1);
  const outcomeLast = outcome.slice(outcome.lastIndexOf(" ") + 1);

  const select = (slug: string) => {
    if (recused.has(slug) || !f.votes[slug]) return;
    setSelected(slug);
    setOpenRows(new Set([slug])); // picking a seat focuses one justice; the others collapse
    requestAnimationFrame(() => {
      const row = document.getElementById(`row-${slug}`);
      if (!row) return;
      const r = row.getBoundingClientRect();
      const reduce = reduceMotion();
      window.scrollTo({ top: Math.max(0, window.scrollY + r.top + r.height / 2 - window.innerHeight * 0.42), behavior: reduce ? "auto" : "smooth" });
      row.animate(
        [{ backgroundColor: "rgba(42, 85, 71, 0.16)" }, { backgroundColor: "rgba(42, 85, 71, 0.16)", offset: 0.3 }, { backgroundColor: "rgba(42, 85, 71, 0)" }],
        { duration: reduce ? 1200 : 2400, delay: reduce ? 0 : 350, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "backwards" },
      );
    });
  };
  const toggle = (slug: string) => setOpenRows((s) => { const n = new Set(s); if (n.has(slug)) n.delete(slug); else n.add(slug); return n; });

  const ordered = [...justices].sort((a, b) =>
    (recused.has(a.slug) ? 1 : 0) - (recused.has(b.slug) ? 1 : 0) ||
    (a.slug === f.author ? -1 : 0) - (b.slug === f.author ? -1 : 0) ||
    (f.votes[a.slug]?.vote === "majority" ? 0 : 1) - (f.votes[b.slug]?.vote === "majority" ? 0 : 1) ||
    a.seniority - b.seniority,
  );

  const sel = selected ? f.votes[selected] : undefined;
  const caption = failed
    ? "This run stopped before every vote was in."
    : !showVotes ? WAITING[f.stage] ?? "Working…"
    : !done || replaying ? "Each seat fills as that justice's agent returns its vote."
    : sel && selected ? `${byslug[selected].name} · ${sel.role} · ${Math.round(sel.confidence * 100)}% confidence in this vote` : "";

  const announcement = failed ? "The forecast run failed."
    : !showVotes ? WAITING[f.stage] ?? ""
    : running ? `${f.arrival.length} of ${f.sitting.length} votes in.`
    : justLocked ? `Forecast locked: ${outcome}, ${f.tally[0]} to ${f.tally[1]}.` : "";

  return (
    <main id="main">
      <p className="visually-hidden" aria-live="polite">{announcement}</p>
      <section className="band band-case" aria-labelledby="case-title">
        <div className="wrap">
          {failed && (
            <p className="sample-flag" role="alert">
              <span>The run stopped: {f.error ?? "an unexpected error"}. Nothing was locked, and nothing here is a forecast.</span>
            </p>
          )}
          {!f.fairTest && (
            <p className="sample-flag" role="note">
              <span>Not a fair test. The Court decided this case before the models&apos; training cutoff, so they may already know the result. It never counts toward the <Link href="/scorecard">scorecard</Link>.</span>
            </p>
          )}
          <div className="case-head">
            <div>
              <p className="docket-line">
                {f.docket ? `No. ${f.docket}` : "Not yet docketed"} · {f.term}
              </p>
              <h1 id="case-title" className="case-title">{f.title}</h1>
              <p className="case-outcome">
                {!showVotes ? (
                  failed ? "No forecast" : WAITING[f.stage] ?? "Working…"
                ) : !done || replaying ? (
                  <>Deliberating, {counted.length} of {f.sitting.length} votes in, <span className="num">{inMaj}–{inMin}</span></>
                ) : (
                  <>Predicted: {outcomeHead}<span className="nowrap">{outcomeLast}, <span className="num">{inMaj}–{inMin}</span></span></>
                )}
              </p>
            </div>
            <LockSeal lockedAt={f.lockedAt} phase={f.phase} open={!sealed} justLocked={justLocked} />
          </div>

          <Bench
            votes={f.votes}
            author={sealed ? f.author : null}
            arrangement={arrangement}
            arrived={showVotes ? seatsArrived : new Set()}
            recused={recused}
            selected={sealed ? selected : null}
            onSelect={select}
            sideLabels={f.sideLabels}
          />

          <div className="bench-bar">
            <div className="segmented" role="group" aria-label="Arrange seats">
              {([["bench", "As seated"], ["split", "By vote"]] as const).map(([key, label]) => (
                <button key={key} type="button" aria-pressed={arrangement === key} onClick={() => setArrangement(key)} disabled={!sealed}>
                  {label}
                </button>
              ))}
            </div>
            <p className="bench-caption">{caption}</p>
            {done && (
              <button type="button" className="ghost-btn" onClick={replay} disabled={replaying}>
                <Replay /> Watch it run again
              </button>
            )}
          </div>
          <BenchLegend collapsible sideLabels={f.sideLabels} />
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
                    key={j.slug} slug={j.slug} v={f.votes[j.slug]} isAuthor={j.slug === f.author}
                    open={openRows.has(j.slug)} onToggle={() => toggle(j.slug)} recused={recused.has(j.slug)}
                    href={reasoningHref(j.slug)}
                  />
                ))}
              </ol>
            ) : (
              <p className="muted waiting-note">Votes appear here once every sitting justice&apos;s agent has returned.</p>
            )}
          </section>

          <aside className="decision" aria-labelledby="decision-h">
            <h2 id="decision-h" className="section-h">The predicted decision</h2>
            {done ? (
              <dl className="ruled-dl">
                <div><dt>Judgment</dt><dd className="reading">{outcome}, {f.tally[0]} to {f.tally[1]}</dd></div>
                {f.author && (
                  <div>
                    <dt>Writes for the Court</dt>
                    <dd>
                      <strong>{byslug[f.author]?.name}</strong>
                      {f.authorRationale && <span className="dd-note">{f.authorRationale}</span>}
                    </dd>
                  </div>
                )}
                {f.concurring.length > 0 && <div><dt>Concurring</dt><dd>{f.concurring.map((s) => byslug[s].last).join(" and ")}</dd></div>}
                {f.dissenting.length > 0 && <div><dt>Dissenting</dt><dd>{f.dissenting.map((s) => byslug[s].last).join(", ")}</dd></div>}
                {f.recused.length > 0 && <div><dt>Recused</dt><dd>{f.recused.map((s) => byslug[s].last).join(", ")}</dd></div>}
              </dl>
            ) : (
              <p className="muted waiting-note">The clerk tallies the votes and predicts the author once deliberation ends.</p>
            )}
            <p className="fine">Prediction for educational purposes, not legal advice.</p>
          </aside>
        </div>

        <section className={`briefing${f.summary ? "" : " is-reading"}`} aria-labelledby="briefing-h">
          <h2 id="briefing-h" className="section-h">The briefing</h2>
          {!f.summary ? (
            <p className="muted waiting-note">{failed ? "No summary was written." : "Reading the briefs…"}</p>
          ) : (
            <div className={`briefing-grid${running ? " reveal" : ""}`}>
              <div className="reading-col">
                <h3>Facts</h3>
                {paragraphs(f.summary.facts).map((p, i) => <p key={i} className="reading">{p}</p>)}
                <h3>Question presented</h3>
                <p className="reading">{f.summary.question_presented}</p>
              </div>
              <div className="facts-col">
                <dl className="facts-dl">
                  <div><dt>Petitioner</dt><dd>{f.petitioner}</dd></div>
                  <div><dt>Respondent</dt><dd>{f.respondent}</dd></div>
                  <div><dt>Forecast</dt><dd>{f.phase}</dd></div>
                </dl>
                <details className="terms">
                  <summary>What the court terms mean</summary>
                  <dl>
                    <div><dt>Certiorari</dt><dd>The Court&apos;s order agreeing to review a lower court&apos;s decision.</dd></div>
                    <div><dt>Reverse, affirm, vacate</dt><dd>Overturn the decision below, leave it standing, or set it aside and send the case back.</dd></div>
                    <div><dt>Concurrence</dt><dd>An opinion by a justice who agrees with the result but writes separately to give other reasons.</dd></div>
                    <div><dt>Dissent</dt><dd>An opinion by a justice who disagrees with the majority&apos;s result.</dd></div>
                    <div><dt>Recused</dt><dd>Sitting out the case, usually because of a conflict of interest; that justice casts no vote.</dd></div>
                  </dl>
                </details>
              </div>
            </div>
          )}
        </section>

        {sealed && (
          <section className="closing" aria-label="Lock and next step">
            <Lock className="closing-icon" />
            <p className="closing-text">
              <strong>Locked <time className="num">{f.lockedAt}</time>, {f.phase.toLowerCase()}.</strong>{" "}
              Awaiting the Court; the forecast is scored against its decision.
            </p>
            <Link className="text-link is-strong" href={reasoningHref()}>
              Read every justice&apos;s full reasoning <ArrowRight />
            </Link>
          </section>
        )}
      </div>
    </main>
  );
}
