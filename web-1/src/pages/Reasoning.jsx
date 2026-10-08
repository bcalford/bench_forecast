import { useEffect, useRef, useState } from "react";
import { justices, sampleCase, byslug, voteWord, ownCitations, briefPassages } from "../data.js";
import SeatMark from "../components/SeatMark.jsx";
import { LockSeal } from "../components/Chrome.jsx";
import { ArrowLeft } from "../components/Icons.jsx";

// "[Pet. Br. 14]" becomes a chip that opens the cited brief passage below the paragraph.
function withCitations(text, slug, openCite, setOpenCite) {
  return text.split(/(\[(?:Pet|Resp)\. Br\. \d+\])/g).map((part, i) => {
    const m = part.match(/^\[((Pet|Resp)\. Br\. (\d+))\]$/);
    if (!m) return part;
    const who = m[2] === "Pet" ? "Petitioner's brief" : "Respondent's brief";
    const open = openCite === m[1];
    return (
      <button
        key={i} type="button" className={`cite${open ? " is-open" : ""}`}
        aria-expanded={open} aria-controls={`passage-${slug}`}
        onClick={() => setOpenCite(open ? null : m[1])}
      >
        <span className="visually-hidden">{who}, page {m[3]}. Show passage</span>
        <span aria-hidden="true">{m[1]}</span>
      </button>
    );
  });
}

const CheckMark = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.3" />
    <path d="M4.8 8.2 7 10.4l4.2-4.6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function BriefPassage({ cite: openCite, slug, last }) {
  // Keep the last passage mounted while the panel closes, so it slides shut instead of vanishing.
  const lastCite = useRef(openCite);
  if (openCite) lastCite.current = openCite;
  const cite = lastCite.current;
  const isPet = cite?.startsWith("Pet");
  return (
    <div className={`passage${openCite ? " is-open" : ""}`} id={`passage-${slug}`} inert={!openCite || undefined}>
      <div className="passage-inner">
        {cite && (
          <figure className="passage-body" aria-live="polite">
            <figcaption>
              {isPet ? "Brief for the petitioner" : "Brief for the respondent"}, page <span className="num">{cite.match(/\d+$/)[0]}</span>
            </figcaption>
            <blockquote>{briefPassages[cite]}</blockquote>
            <p className="checked">
              <CheckMark />
              Checked: this page was among the passages retrieved for {last}. Sample brief text.
            </p>
          </figure>
        )}
      </div>
    </div>
  );
}

export default function Reasoning({ focus }) {
  const c = sampleCase;
  const p = c.prediction;
  const ordered = [...justices].sort(
    (a, b) =>
      (a.slug === p.author ? -1 : 0) - (b.slug === p.author ? -1 : 0) ||
      (c.votes[a.slug].vote === "majority" ? 0 : 1) - (c.votes[b.slug].vote === "majority" ? 0 : 1) ||
      a.seniority - b.seniority
  );
  const toc = [{ id: "summary", label: "Briefing summary" }, ...ordered.map((j) => ({ id: `j-${j.slug}`, j }))];
  const [active, setActive] = useState("summary");
  const [openCites, setOpenCites] = useState({}); // one open passage per justice

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { rootMargin: "-20% 0px -65% 0px" }
    );
    toc.forEach((t) => {
      const el = document.getElementById(t.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (focus) document.getElementById(`j-${focus}`)?.scrollIntoView({ block: "start" });
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
      <section className="band band-reader" aria-labelledby="reader-h">
        <div className="wrap reader-head">
          <div>
            <a className="back-link" href="#/case"><ArrowLeft /> <cite className="case-name">{c.title}</cite></a>
            <h1 id="reader-h" className="reader-title">The reasoning</h1>
            <p className="docket-line">
              No. {c.docket} · Predicted {p.outcome.toLowerCase()}, <span className="num">{p.majority}–{p.minority}</span> · Opinion by {byslug[p.author].last}
            </p>
          </div>
          <LockSeal lockedAt={c.lockedAt} phase="Before argument" compact />
        </div>
      </section>

      <div className="wrap reader-body">
        <nav className="toc" aria-label="Contents">
          <ol>
            {toc.map((t) => (
              <li key={t.id}>
                <a href={`#${t.id}`} onClick={(e) => jump(e, t.id)} aria-current={active === t.id ? "true" : undefined}>
                  {t.j ? (
                    <>
                      <SeatMark vote={c.votes[t.j.slug]} isAuthor={t.j.slug === p.author} size={18} showConfidence={false} />
                      {t.j.last}
                    </>
                  ) : (
                    t.label
                  )}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="reader-article">
          <aside className="cite-key" aria-label="How citations work">
            <p>
              <strong>Two kinds of citation.</strong> Each justice's reasoning draws on <em>their own prior opinions</em>,
              retrieved for this case and listed under their reasoning, and on pages of the parties' briefs, marked inline:
              <span className="cite" aria-hidden="true">Pet. Br. 14</span> is page 14 of the petitioner's brief,
              <span className="cite" aria-hidden="true">Resp. Br. 9</span> page 9 of the respondent's.
            </p>
          </aside>

          <section id="summary" className="rsec">
            <h2>Briefing summary</h2>
            {c.summary.map((s) => (
              <div key={s.heading}>
                <h3>{s.heading}</h3>
                <p className="reading">{s.body}</p>
              </div>
            ))}
          </section>

          {ordered.map((j) => {
            const v = c.votes[j.slug];
            const isAuthor = j.slug === p.author;
            return (
              <section key={j.slug} id={`j-${j.slug}`} className="rsec">
                <header className="rsec-head">
                  <SeatMark vote={v} isAuthor={isAuthor} size={44} />
                  <div>
                    <h2>{j.name}</h2>
                    <p className="rsec-meta">
                      {isAuthor ? "Writes the majority opinion" : v.role} · {voteWord(v)} ·{" "}
                      <span className="num">{Math.round(v.confidence * 100)}%</span> confidence
                    </p>
                  </div>
                </header>
                <p className="reading">
                  {withCitations(c.reasoning[j.slug], j.slug, openCites[j.slug], (cite) => setOpenCites((o) => ({ ...o, [j.slug]: cite })))}
                </p>
                <BriefPassage cite={openCites[j.slug] ?? null} slug={j.slug} last={j.last} />
                <div className="own-cites">
                  <h3>From {j.last}'s own opinions</h3>
                  <ol>
                    {ownCitations[j.slug].map((o) => (
                      <li key={o.case + o.role}>
                        <span className="own-cite-src">
                          <cite className="case-name">{o.case}</cite> <span className="num">({o.year})</span>, {o.role}
                        </span>
                        <span className="own-cite-gist">{o.gist}</span>
                        <span className="checked"><CheckMark /> Among the passages retrieved for {j.last}</span>
                      </li>
                    ))}
                  </ol>
                  <p className="fine">Passages are paraphrased for this sample. The live app shows the exact retrieved text.</p>
                </div>
                {isAuthor && (
                  <aside className="note">
                    <h3>Why {j.last} is predicted to write</h3>
                    <p>{p.authorRationale}</p>
                  </aside>
                )}
              </section>
            );
          })}
          <p className="fine">Prediction for educational purposes, not legal advice. Fictional sample case.</p>
        </article>
      </div>
    </main>
  );
}
