import { useId, useState } from "react";
import { byslug, sampleCase } from "../data.js";
import { getDraft, setDraft } from "../runDraft.js";
import Bench from "../components/Bench.jsx";
import { ArrowRight } from "../components/Icons.jsx";

// Prototype switch: flip to true to see the form when the global daily spend cap is reached.
const DAILY_CAP_REACHED = false;
const MAX_MB = 25;
const MIN_DESCRIPTION = 80;
const CODE_RE = /^BF-[A-Z0-9]{4}-[A-Z0-9]{4}$/i;

const SAMPLE_FILES = {
  pet: { name: "Hartwell – Brief for the Petitioner.pdf", size: 1_840_000, sample: true },
  resp: { name: "Hartwell – Brief for the Respondent.pdf", size: 2_110_000, sample: true },
  amicus: [{ name: "Brief of Commercial Fishermen of America as Amici.pdf", size: 640_000, sample: true }],
  transcript: null,
};
const EMPTY_FILES = { pet: null, resp: null, amicus: [], transcript: null };

const mb = (bytes) => `${(bytes / 1_000_000).toFixed(1)} MB`;

function checkPdf(file) {
  if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) return "That isn't a PDF. Export the brief as a PDF and try again.";
  if (file.size > MAX_MB * 1_000_000) return `That file is ${mb(file.size)}. Briefs must be under ${MAX_MB} MB.`;
  return null;
}

function FileSlot({ label, hint, file, error, onPick, onClear, multiple = false, required = false }) {
  const id = useId();
  return (
    <div className={`file-slot${file ? " has-file" : ""}${error ? " has-error" : ""}`}>
      <div className="file-slot-text">
        <label htmlFor={id} className="field-label">
          {label} {required ? <span className="req">Required</span> : <span className="opt">Optional</span>}
        </label>
        {file ? (
          <span className="file-name">
            {file.name} <span className="muted num">{mb(file.size)}{file.sample ? " · sample" : ""}</span>
          </span>
        ) : (
          <span className="muted">{hint}</span>
        )}
        {error && <span className="field-error" role="alert">{error}</span>}
      </div>
      <div className="file-slot-actions">
        <input
          id={id} type="file" accept="application/pdf,.pdf" className="visually-hidden" multiple={multiple}
          onChange={(e) => { onPick([...e.target.files]); e.target.value = ""; }}
        />
        <label htmlFor={id} className="outline-btn">{file && !multiple ? "Replace" : multiple ? "Add PDF" : "Choose PDF"}</label>
        {file && !multiple && <button type="button" className="link-btn" onClick={onClear}>Remove</button>}
      </div>
    </div>
  );
}

export default function NewCase({ focus }) {
  // "Edit this filing" (#/new/edit) reopens the last filing; PDFs themselves can't be carried between pages here.
  const [prior] = useState(() => (focus === "edit" ? getDraft() : null));
  const priorSample = prior?.source === "sample";
  const [mode, setMode] = useState(prior?.mode ?? "briefs");
  const [title, setTitle] = useState(prior?.title ?? "");
  const [docket, setDocket] = useState(prior?.docket ?? "");
  const [files, setFiles] = useState(priorSample && prior.mode === "briefs" ? SAMPLE_FILES : EMPTY_FILES);
  const [fileErrors, setFileErrors] = useState({});
  const [description, setDescription] = useState(prior?.description ?? "");
  const [recused, setRecused] = useState(() => new Set(prior?.recused ?? []));
  const [code, setCode] = useState("");
  const [usingSample, setUsingSample] = useState(priorSample);
  const reattach = prior && !priorSample && prior.mode === "briefs";
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const sitting = 9 - recused.size;
  const phase = files.transcript ? "After argument" : "Before argument";
  const briefCount = [files.pet, files.resp, files.transcript].filter(Boolean).length + files.amicus.length;

  const useSample = () => {
    setMode("briefs");
    setTitle(sampleCase.title);
    setDocket(sampleCase.docket);
    setFiles(SAMPLE_FILES);
    setFileErrors({});
    setErrors({});
    setUsingSample(true);
  };

  const pick = (slot) => (picked) => {
    const bad = picked.map(checkPdf).find(Boolean);
    setFileErrors((e) => ({ ...e, [slot]: bad }));
    if (bad) return;
    setUsingSample(false);
    setFiles((f) => (slot === "amicus" ? { ...f, amicus: [...f.amicus, ...picked] } : { ...f, [slot]: picked[0] }));
  };

  const toggleRecusal = (slug) =>
    setRecused((s) => {
      const n = new Set(s);
      n.has(slug) ? n.delete(slug) : n.add(slug);
      return n;
    });

  const validate = () => {
    const e = {};
    if (!title.trim()) e.title = "Give the case a title, for example “Hartwell v. Department of Commerce”.";
    if (mode === "briefs") {
      if (!files.pet) e.pet = "The petitioner's merits brief is required.";
      if (!files.resp) e.resp = "The respondent's merits brief is required.";
    } else if (description.trim().length < MIN_DESCRIPTION) {
      e.description = `Describe the case in at least ${MIN_DESCRIPTION} characters: the parties, what happened below, and the question.`;
    }
    if (sitting < 2) e.recused = "At least two justices must sit to decide a case.";
    if (!usingSample && !code.trim()) e.code = "Filing your own case needs an invite code. To try it without one, use the sample briefs.";
    else if (code.trim() && !CODE_RE.test(code.trim())) e.code = "Invite codes look like BF-7Q2K-M4XD. Check for a missing dash.";
    return e;
  };

  const submit = (ev) => {
    ev.preventDefault();
    if (DAILY_CAP_REACHED) return;
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      requestAnimationFrame(() => document.querySelector(".field-error")?.closest("section, .field")?.scrollIntoView({ block: "center", behavior: "smooth" }));
      return;
    }
    setSubmitting(true);
    setDraft({
      title: title.trim(),
      docket: docket.trim(),
      term: "October Term 2026",
      mode,
      phase: mode === "briefs" ? phase : "Before argument",
      briefCount,
      recused: [...recused],
      description: mode === "description" ? description.trim() : "",
      source: usingSample ? "sample" : "own",
    });
    setTimeout(() => { window.location.hash = "#/run"; }, 700);
  };

  const ready = {
    title: !!title.trim(),
    briefs: mode === "briefs" ? !!(files.pet && files.resp) : description.trim().length >= MIN_DESCRIPTION,
    code: usingSample || CODE_RE.test(code.trim()),
  };
  const submitLabel = submitting ? "Filing…" : usingSample && !code.trim() ? "Run the sample forecast" : "File for forecast";

  return (
    <main id="main">
      <section className="band band-new" aria-labelledby="new-h">
        <div className="wrap new-head">
          <div>
            <h1 id="new-h" className="reader-title">Forecast a case</h1>
            <p className="docket-line">
              File the merits briefs and the nine agents predict each justice's vote. Filing your own case needs an invite code; anyone can run the sample.
            </p>
          </div>
          <button type="button" className="solid-btn" onClick={useSample}>
            Use the Hartwell sample briefs <ArrowRight />
          </button>
        </div>
      </section>

      <form className="wrap new-body" onSubmit={submit} noValidate>
        <div className="new-form">
          <section className="filing" aria-labelledby="f-case">
            <h2 id="f-case" className="section-h">The case</h2>
            <div className="field">
              <label className="field-label" htmlFor="title">Case title <span className="req">Required</span></label>
              <input id="title" className="text-input case-name-input" maxLength={160} value={title} placeholder="Petitioner v. Respondent"
                aria-invalid={!!errors.title} onChange={(e) => { setTitle(e.target.value); setUsingSample(false); }} />
              {errors.title && <span className="field-error" role="alert">{errors.title}</span>}
            </div>
            <div className="field-row">
              <div className="field">
                <label className="field-label" htmlFor="docket">Docket number <span className="opt">Optional</span></label>
                <input id="docket" className="text-input num" value={docket} placeholder="25-1187" inputMode="numeric" onChange={(e) => setDocket(e.target.value)} />
              </div>
              <div className="field">
                <span className="field-label">Term</span>
                <span className="static-value">October Term 2026</span>
              </div>
            </div>
          </section>

          <section className="filing" aria-labelledby="f-briefs">
            <div className="filing-head">
              <h2 id="f-briefs" className="section-h">The briefs</h2>
              <div className="segmented on-light" role="group" aria-label="How to describe the case">
                {[["briefs", "Merits briefs"], ["description", "Describe it instead"]].map(([key, label]) => (
                  <button key={key} type="button" aria-pressed={mode === key} onClick={() => setMode(key)}>{label}</button>
                ))}
              </div>
            </div>

            {mode === "briefs" ? (
              <>
                {reattach && !files.pet && (
                  <p className="warn-note" role="note">Your details and recusals are restored. Attach the briefs again: this prototype doesn't keep files between pages.</p>
                )}
                <FileSlot label="Brief for the petitioner" hint="The merits brief, as a PDF." required file={files.pet}
                  error={fileErrors.pet || errors.pet} onPick={pick("pet")} onClear={() => setFiles((f) => ({ ...f, pet: null }))} />
                <FileSlot label="Brief for the respondent" hint="The merits brief, as a PDF." required file={files.resp}
                  error={fileErrors.resp || errors.resp} onPick={pick("resp")} onClear={() => setFiles((f) => ({ ...f, resp: null }))} />
                <FileSlot label="Amicus briefs" hint="Add as many as you have." multiple file={files.amicus[0]}
                  error={fileErrors.amicus} onPick={pick("amicus")} />
                {files.amicus.length > 0 && (
                  <ul className="amicus-list">
                    {files.amicus.map((f, i) => (
                      <li key={f.name + i}>
                        <span>{f.name} <span className="muted num">{mb(f.size)}</span></span>
                        <button type="button" className="link-btn" onClick={() => setFiles((x) => ({ ...x, amicus: x.amicus.filter((_, k) => k !== i) }))}>Remove</button>
                      </li>
                    ))}
                  </ul>
                )}
                <FileSlot label="Oral argument transcript" hint="Add it once the case has been argued." file={files.transcript}
                  error={fileErrors.transcript} onPick={pick("transcript")} onClear={() => setFiles((f) => ({ ...f, transcript: null }))} />
                <p className="phase-line">
                  Forecast phase: <strong>{phase}</strong>
                  <span className="muted"> · {files.transcript ? "the transcript adds each justice's questions from argument" : "add the transcript to forecast after argument"}</span>
                </p>
              </>
            ) : (
              <div className="field">
                <p className="warn-note" role="note">
                  A description gives the agents far less to reason from than the briefs. Forecasts from descriptions are marked less reliable.
                </p>
                <label className="field-label" htmlFor="desc">What is the case about? <span className="req">Required</span></label>
                <textarea id="desc" className="text-input text-area" rows={7} value={description} aria-invalid={!!errors.description}
                  placeholder="Who the parties are, what happened in the lower courts, and the question the Court agreed to decide."
                  onChange={(e) => setDescription(e.target.value)} />
                <span className="muted char-count num">{description.trim().length} / {MIN_DESCRIPTION} characters minimum</span>
                {errors.description && <span className="field-error" role="alert">{errors.description}</span>}
              </div>
            )}
          </section>

          <section className="filing" aria-labelledby="f-bench">
            <h2 id="f-bench" className="section-h">The bench</h2>
            <p className="muted filing-lede">Pick any justice who is recused. Their seat sits out and they aren't counted.</p>
            <div className="bench-light bench-recusal">
              <Bench
                votes={Object.fromEntries(Object.keys(byslug).map((s) => [s, { vote: "majority", role: "", confidence: 0 }]))}
                recused={recused}
                onSelect={toggleRecusal}
                selected={null}
                label="The bench: pick a seat to mark that justice recused"
                caption={(j, v, out) => (out ? "Recused" : "Sitting")}
                describe={(j, v, pending, out) => `${j.name}: ${out ? "recused. Select to restore." : "sitting. Select to mark recused."}`}
              />
            </div>
            <p className="bench-count" aria-live="polite">
              <strong className="num">{sitting} justices sitting.</strong>{" "}
              {sitting % 2 === 0
                ? `An even bench can split ${sitting / 2}–${sitting / 2}; a tie affirms the judgment below by an equally divided Court.`
                : recused.size ? `Recused: ${[...recused].map((s) => byslug[s].last).join(", ")}.` : "No one recused."}
            </p>
            {errors.recused && <span className="field-error" role="alert">{errors.recused}</span>}
          </section>

          <section className="filing" aria-labelledby="f-file">
            <h2 id="f-file" className="section-h">File it</h2>
            <div className="field">
              <label className="field-label" htmlFor="code">
                Invite code {usingSample ? <span className="opt">Not needed for the sample</span> : <span className="req">Required</span>}
              </label>
              <input id="code" className="text-input num code-input" value={code} placeholder="BF-0000-0000" autoComplete="off" spellCheck={false}
                aria-invalid={!!errors.code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
              {errors.code && <span className="field-error" role="alert">{errors.code}</span>}
            </div>
            {DAILY_CAP_REACHED ? (
              <p className="warn-note" role="status">The daily forecasting budget is spent. Try again after midnight ET.</p>
            ) : (
              <p className="muted fine-line">Each forecast runs nine agents and costs a few dollars, so new filings share a daily budget.</p>
            )}
            <button type="submit" className="file-btn" disabled={submitting || DAILY_CAP_REACHED}>
              {submitLabel} {!submitting && <ArrowRight />}
            </button>
          </section>
        </div>

        <aside className="filing-summary" aria-label="What you've filed">
          <h2 className="summary-h">Your filing</h2>
          <ul>
            <li className={ready.title ? "is-done" : ""}><Mark on={ready.title} /> {title.trim() ? <cite className="case-name">{title.trim()}</cite> : "Case title"}</li>
            <li className={ready.briefs ? "is-done" : ""}>
              <Mark on={ready.briefs} /> {mode === "briefs" ? `${briefCount || "No"} brief${briefCount === 1 ? "" : "s"} attached` : "Plain-English description"}
            </li>
            <li className="is-done"><Mark on /> {sitting} justices sitting</li>
            <li className="is-done"><Mark on /> {mode === "briefs" ? phase : "Before argument"}</li>
            <li className={ready.code ? "is-done" : ""}><Mark on={ready.code} /> {usingSample && !CODE_RE.test(code.trim()) ? "Sample run, no code needed" : "Invite code"}</li>
          </ul>
          <p className="fine">Prototype: files stay in your browser and the run uses sample output.</p>
        </aside>
      </form>
    </main>
  );
}

function Mark({ on }) {
  return (
    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" className="sum-mark">
      <circle cx="6" cy="6" r={on ? 5 : 4.25} className={on ? "cm-hit" : "cm-miss"} />
    </svg>
  );
}
