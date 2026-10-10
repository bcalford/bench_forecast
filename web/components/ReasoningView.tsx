"use client";
import { useEffect, useState, type MouseEvent } from "react";
import Link from "next/link";
import SeatMark from "./SeatMark";
import { LockSeal } from "./Chrome";
import { ArrowLeft, CheckMark } from "./Icons";
import { justices } from "@/lib/court";
import type { ForecastView } from "@/lib/views";

const paragraphs = (text: string) => text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
const year = (date: string | null) => (date ? date.slice(0, 4) : null);

export default function ReasoningView({ f }: { f: ForecastView }) {
  const voted = justices.filter((j) => f.votes[j.slug]);
  const ordered = [...voted].sort((a, b) =>
    (a.slug === f.author ? -1 : 0) - (b.slug === f.author ? -1 : 0) ||
    (f.votes[a.slug].vote === "majority" ? 0 : 1) - (f.votes[b.slug].vote === "majority" ? 0 : 1) ||
    a.seniority - b.seniority,
  );
  const toc = [{ id: "summary", label: "Briefing summary", slug: null as string | null }, ...ordered.map((j) => ({ id: `j-${j.slug}`, label: j.last, slug: j.slug }))];
  const [active, setActive] = useState("summary");

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { rootMargin: "-20% 0px -65% 0px" },
    );
    toc.forEach((t) => { const el = document.getElementById(t.id); if (el) obs.observe(el); });
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On phones the contents rail is a horizontal strip; keep the active item scrolled into view.
  useEffect(() => {
    const link = document.querySelector<HTMLElement>('.toc a[aria-current="true"]');
    const strip = link?.closest("ol");
    if (!link || !strip || strip.scrollWidth <= strip.clientWidth) return;
    strip.scrollTo({ left: link.offsetLeft - 16, behavior: "smooth" });
  }, [active]);

  const jump = (e: MouseEvent, id: string) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
  };

  const s = f.summary;
  const sections = s
    ? [
        ["Facts", s.facts], ["Question presented", s.question_presented], ["Procedural history", s.procedural_history],
        ["The petitioner's argument", s.petitioner_argument], ["The respondent's argument", s.respondent_argument],
      ]
    : [];

  return (
    <main id="main">
      <section className="band band-reader" aria-labelledby="reader-h">
        <div className="wrap reader-head">
          <div>
            <Link className="back-link" href={`/runs/${f.id}`}><ArrowLeft /> <cite className="case-name">{f.title}</cite></Link>
            <h1 id="reader-h" className="reader-title">The reasoning</h1>
            <p className="docket-line">
              {f.docket ? `No. ${f.docket}` : "Not yet docketed"}
              {f.outcome && <> · Predicted {f.outcome.toLowerCase()}, <span className="num">{f.tally[0]}–{f.tally[1]}</span></>}
              {f.author && <> · {justices.find((j) => j.slug === f.author)?.last} writes for the Court</>}
            </p>
          </div>
          <LockSeal lockedAt={f.lockedAt} phase={f.phase} open={f.status !== "locked"} compact />
        </div>
      </section>

      <div className="wrap reader-body">
        <nav className="toc" aria-label="Contents">
          <ol>
            {toc.map((t) => (
              <li key={t.id}>
                <a href={`#${t.id}`} onClick={(e) => jump(e, t.id)} aria-current={active === t.id ? "true" : undefined}>
                  {t.slug ? (
                    <><SeatMark vote={f.votes[t.slug]} isAuthor={t.slug === f.author} size={22} showConfidence={false} />{t.label}</>
                  ) : t.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="reader-article">
          <aside className="cite-key" aria-label="How citations work">
            <p>
              <strong>Where the citations come from.</strong> Each justice&apos;s agent read passages from that justice&apos;s
              own prior opinions, retrieved for this case. Every passage it cites is listed under its reasoning, quoted
              exactly, and checked against what was retrieved.
            </p>
          </aside>

          <section id="summary" className="rsec">
            <h2>Briefing summary</h2>
            {sections.map(([heading, body]) => (
              <div key={heading}>
                <h3>{heading}</h3>
                {paragraphs(body).map((p, i) => <p key={i} className="reading">{p}</p>)}
              </div>
            ))}
            {s && s.issues.length > 0 && (
              <div>
                <h3>The issues</h3>
                <ol className="reading issue-list">{s.issues.map((i) => <li key={i}>{i}</li>)}</ol>
              </div>
            )}
          </section>

          {ordered.map((j) => {
            const v = f.votes[j.slug];
            const isAuthor = j.slug === f.author;
            return (
              <section key={j.slug} id={`j-${j.slug}`} className="rsec">
                <header className="rsec-head">
                  <SeatMark vote={v} isAuthor={isAuthor} size={44} />
                  <div>
                    <h2>{j.name}</h2>
                    <p className="rsec-meta">
                      {v.roleKey === "divided" ? v.role : <>{v.role} · {v.disposition}</>} · <span className="num">{Math.round(v.confidence * 100)}%</span> confidence
                    </p>
                  </div>
                </header>
                {paragraphs(v.detailedReason).map((p, i) => <p key={i} className="reading">{p}</p>)}
                {v.citations.length > 0 && (
                  <div className="own-cites">
                    <h3>From {j.last}&apos;s own opinions</h3>
                    <ol>
                      {v.citations.map((c, i) => (
                        <li key={`${c.passage_id}-${i}`}>
                          <span className="own-cite-src">
                            {c.url ? <a href={c.url}><cite className="case-name">{c.case_name ?? "Opinion"}</cite></a> : <cite className="case-name">{c.case_name ?? "Opinion"}</cite>}
                            {year(c.date) && <> <span className="num">({year(c.date)})</span></>}
                            {c.label && <>, {c.label}</>}
                          </span>
                          <blockquote className="own-cite-quote">{c.quote}</blockquote>
                          <span className="own-cite-gist">{c.why}</span>
                          <span className="checked"><CheckMark /> Quoted exactly from a passage retrieved for {j.last}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                {v.flagged && (
                  <p className="fine">One or more citations here could not be matched to a retrieved passage after a retry, so they are flagged.</p>
                )}
                {isAuthor && f.authorRationale && (
                  <aside className="note">
                    <h3>Why {j.last} is predicted to write</h3>
                    <p>{f.authorRationale}</p>
                  </aside>
                )}
              </section>
            );
          })}
          <p className="fine">Prediction for educational purposes, not legal advice. Each justice&apos;s reasoning is a model&apos;s forecast, not that justice&apos;s words.</p>
        </article>
      </div>
    </main>
  );
}
