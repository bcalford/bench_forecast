"use client";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import Bench from "./Bench";
import { ArrowRight, CheckMark } from "./Icons";
import { byslug, justices } from "@/lib/court";
import { CURRENT_TERM, MAX_MB, MIN_DESCRIPTION, type Filing, type Slot } from "@/lib/filing";

type Files = { pet: File | null; resp: File | null; amicus: File[]; transcript: File | null };
const EMPTY_FILES: Files = { pet: null, resp: null, amicus: [], transcript: null };

const mb = (bytes: number) => `${(bytes / 1_000_000).toFixed(1)} MB`;

function checkPdf(file: File) {
  if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) return "That isn't a PDF. Export the brief as a PDF and try again.";
  if (file.size > MAX_MB * 1_000_000) return `That file is ${mb(file.size)}. Briefs must be under ${MAX_MB} MB.`;
  return null;
}

function FileSlot({ id, label, hint, file, error, alert = false, onPick, onClear, multiple = false, required = false }: {
  id: string; label: string; hint: string; file: File | null | undefined; error?: string | null; alert?: boolean;
  onPick: (files: File[]) => void; onClear?: () => void; multiple?: boolean; required?: boolean;
}) {
  const errId = `${id}-err`;
  return (
    <div className={`file-slot${file ? " has-file" : ""}${error ? " has-error" : ""}`}>
      <div className="file-slot-text">
        <label htmlFor={id} className="field-label">
          {label} {required ? <span className="req">Required</span> : <span className="opt">Optional</span>}
        </label>
        {file && !multiple ? (
          <span className="file-name">{file.name} <span className="muted num">{mb(file.size)}</span></span>
        ) : (
          <span className="muted">{hint}</span>
        )}
        {error && <span id={errId} className="field-error" role={alert ? "alert" : undefined}>{error}</span>}
      </div>
      <div className="file-slot-actions">
        <input
          id={id} type="file" accept="application/pdf,.pdf" className="visually-hidden" multiple={multiple}
          aria-invalid={!!error} aria-describedby={error ? errId : undefined}
          onChange={(e) => { onPick([...(e.target.files ?? [])]); e.target.value = ""; }}
        />
        <label htmlFor={id} className="outline-btn">{file && !multiple ? "Replace" : multiple ? "Add PDF" : "Choose PDF"}</label>
        {file && !multiple && onClear && <button type="button" className="link-btn" onClick={onClear}>Remove</button>}
      </div>
    </div>
  );
}

// Where each error in the summary takes you.
const ERROR_TARGETS: Record<string, string> = { title: "title", pet: "pet-file", resp: "resp-file", description: "desc", recused: "f-bench", server: "f-file" };

function jumpTo(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  // The recusal bench has no single input; land on its first seat.
  const target = (id === "f-bench" ? document.querySelector<HTMLElement>(".bench-recusal button") : el) ?? el;
  (target.closest(".field, .file-slot, section") ?? target).scrollIntoView({ block: "center", behavior: "smooth" });
  target.focus({ preventScroll: true });
}

export default function NewCaseForm({ open }: { open: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"briefs" | "description">("briefs");
  const [title, setTitle] = useState("");
  const [docket, setDocket] = useState("");
  const [files, setFiles] = useState<Files>(EMPTY_FILES);
  const [fileErrors, setFileErrors] = useState<Partial<Record<Slot, string | null>>>({});
  const [description, setDescription] = useState("");
  const [recused, setRecused] = useState<Set<string>>(() => new Set());
  const [attempted, setAttempted] = useState(false);
  const [progress, setProgress] = useState<string | null>(null); // non-null while filing
  const [serverError, setServerError] = useState<string | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  const sitting = justices.length - recused.size;
  const phase = files.transcript ? "After argument" : "Before argument";
  const briefCount = [files.pet, files.resp].filter(Boolean).length + files.amicus.length;

  const pick = (slot: Slot) => (picked: File[]) => {
    const bad = picked.map(checkPdf).find(Boolean) ?? null;
    setFileErrors((e) => ({ ...e, [slot]: bad }));
    if (bad || !picked.length) return;
    setFiles((f) => (slot === "amicus" ? { ...f, amicus: [...f.amicus, ...picked] } : { ...f, [slot]: picked[0] }));
  };

  const toggleRecusal = (slug: string) =>
    setRecused((s) => { const n = new Set(s); if (n.has(slug)) n.delete(slug); else n.add(slug); return n; });

  const validate = () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = "Give the case a title, for example “Hartwell v. Department of Commerce”.";
    if (mode === "briefs") {
      if (!files.pet) e.pet = "The petitioner's merits brief is required.";
      if (!files.resp) e.resp = "The respondent's merits brief is required.";
    } else if (description.trim().length < MIN_DESCRIPTION) {
      e.description = `Describe the case in at least ${MIN_DESCRIPTION} characters: the parties, what happened below, and the question.`;
    }
    if (sitting < 2) e.recused = "At least two justices must sit to decide a case.";
    return e;
  };

  const fail = (message: string) => {
    setProgress(null);
    setServerError(message);
    requestAnimationFrame(() => { summaryRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }); summaryRef.current?.focus({ preventScroll: true }); });
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!open || progress) return;
    const e = validate();
    setAttempted(true);
    setServerError(null);
    if (Object.keys(e).length) {
      // Focus the summary: it is announced, and each line jumps to its field.
      requestAnimationFrame(() => { summaryRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }); summaryRef.current?.focus({ preventScroll: true }); });
      return;
    }

    try {
      // 1. Upload the PDFs straight to Storage through signed URLs.
      const toUpload: { slot: Slot; file: File }[] = mode === "briefs"
        ? [
            { slot: "pet", file: files.pet! }, { slot: "resp", file: files.resp! },
            ...files.amicus.map((file) => ({ slot: "amicus" as const, file })),
            ...(files.transcript ? [{ slot: "transcript" as const, file: files.transcript }] : []),
          ]
        : [];
      let caseId: string;
      let briefPaths: string[] = [];
      let transcriptPath: string | null = null;
      if (toUpload.length) {
        setProgress("Preparing the upload…");
        const res = await fetch("/api/filings/uploads", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ files: toUpload.map((u) => ({ slot: u.slot, name: u.file.name })) }),
        });
        const body = await res.json();
        if (!res.ok) return fail(body.error ?? "Could not prepare the upload. Try again.");
        caseId = body.caseId;
        const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
        for (let i = 0; i < toUpload.length; i++) {
          const u = body.uploads[i] as { slot: Slot; path: string; token: string };
          setProgress(`Uploading ${i + 1} of ${toUpload.length}…`);
          const { error } = await db.storage.from("briefs").uploadToSignedUrl(u.path, u.token, toUpload[i].file, { contentType: "application/pdf" });
          if (error) return fail(`“${toUpload[i].file.name}” didn't upload. Check your connection and try again.`);
          if (u.slot === "transcript") transcriptPath = u.path; else briefPaths.push(u.path);
        }
      } else {
        caseId = crypto.randomUUID();
        briefPaths = [];
      }

      // 2. File the case; the server starts the run and returns its page.
      setProgress("Filing…");
      const filing: Filing = {
        caseId, title: title.trim(), docket: docket.trim(), mode, briefPaths, transcriptPath,
        description: mode === "description" ? description.trim() : "", recused: [...recused],
      };
      const res = await fetch("/api/filings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(filing) });
      const body = await res.json();
      if (!res.ok) return fail(body.error ?? "Could not file the case. Try again.");
      router.push(`/runs/${body.predictionId}`);
    } catch {
      fail("Something went wrong on the way to the server. Check your connection and try again.");
    }
  };

  // Re-validated on every change once the visitor has tried to file, so fixed fields clear at once.
  const errors: Record<string, string> = attempted ? validate() : {};
  if (serverError) errors.server = serverError;
  const ready = {
    title: !!title.trim(),
    briefs: mode === "briefs" ? !!(files.pet && files.resp) : description.trim().length >= MIN_DESCRIPTION,
  };

  return (
    <main id="main">
      <section className="band band-new" aria-labelledby="new-h">
        <div className="wrap new-head">
          <div>
            <h1 id="new-h" className="reader-title">Forecast a case</h1>
            <p className="docket-line">
              File the merits briefs and the nine agents predict each justice&apos;s vote. A run takes about five minutes, and you can watch each vote land.
            </p>
          </div>
        </div>
      </section>

      <form className="wrap new-body" onSubmit={submit} noValidate>
        <div className="new-form">
          {Object.keys(errors).length > 0 && (
            <div className="error-summary" ref={summaryRef} tabIndex={-1} aria-labelledby="err-h">
              <h2 id="err-h">
                {errors.server && Object.keys(errors).length === 1
                  ? "The case wasn't filed"
                  : `Fix ${Object.keys(errors).length === 1 ? "this" : `these ${Object.keys(errors).length} things`} to file the case`}
              </h2>
              <ul>
                {Object.entries(errors).map(([key, msg]) => (
                  <li key={key}>
                    <a href={`#${ERROR_TARGETS[key]}`} onClick={(ev) => { ev.preventDefault(); jumpTo(ERROR_TARGETS[key]); }}>{msg}</a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <section className="filing" aria-labelledby="f-case">
            <h2 id="f-case" className="section-h">The case</h2>
            <div className="field">
              <label className="field-label" htmlFor="title">Case title <span className="req">Required</span></label>
              <input id="title" className="text-input case-name-input" maxLength={160} value={title} placeholder="Petitioner v. Respondent"
                aria-invalid={!!errors.title} aria-describedby={errors.title ? "title-err" : undefined}
                onChange={(e) => setTitle(e.target.value)} />
              {errors.title && <span id="title-err" className="field-error">{errors.title}</span>}
            </div>
            <div className="field-row">
              <div className="field">
                <label className="field-label" htmlFor="docket">Docket number <span className="opt">Optional</span></label>
                <input id="docket" className="text-input num" maxLength={20} value={docket} placeholder="25-0000" inputMode="numeric" onChange={(e) => setDocket(e.target.value)} />
              </div>
              <div className="field">
                <span className="field-label">Term <span className="opt">Set automatically</span></span>
                <span className="static-value">{CURRENT_TERM}</span>
              </div>
            </div>
          </section>

          <section className="filing" aria-labelledby="f-briefs">
            <div className="filing-head">
              <h2 id="f-briefs" className="section-h">The briefs</h2>
              <div className="segmented on-light" role="group" aria-label="How to describe the case">
                {([["briefs", "Merits briefs"], ["description", "Describe it instead"]] as const).map(([key, label]) => (
                  <button key={key} type="button" aria-pressed={mode === key} onClick={() => setMode(key)}>{label}</button>
                ))}
              </div>
            </div>

            {mode === "briefs" ? (
              <>
                <FileSlot id="pet-file" label="Brief for the petitioner" hint="The merits brief, as a PDF." required file={files.pet}
                  error={fileErrors.pet || errors.pet} alert={!!fileErrors.pet} onPick={pick("pet")} onClear={() => setFiles((f) => ({ ...f, pet: null }))} />
                <FileSlot id="resp-file" label="Brief for the respondent" hint="The merits brief, as a PDF." required file={files.resp}
                  error={fileErrors.resp || errors.resp} alert={!!fileErrors.resp} onPick={pick("resp")} onClear={() => setFiles((f) => ({ ...f, resp: null }))} />
                <FileSlot id="amicus-file" label="Amicus briefs" hint="Add as many as you have." multiple file={files.amicus[0]}
                  error={fileErrors.amicus} alert onPick={pick("amicus")} />
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
                <FileSlot id="transcript-file" label="Oral argument transcript" hint="Add it once the case has been argued." file={files.transcript}
                  error={fileErrors.transcript} alert onPick={pick("transcript")} onClear={() => setFiles((f) => ({ ...f, transcript: null }))} />
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
                <textarea id="desc" className="text-input text-area" rows={7} maxLength={8000} value={description} aria-invalid={!!errors.description} aria-describedby={errors.description ? "desc-err" : "desc-count"}
                  placeholder="Who the parties are, what happened in the lower courts, and the question the Court agreed to decide."
                  onChange={(e) => setDescription(e.target.value)} />
                <span id="desc-count" className="muted char-count num">{description.trim().length} / {MIN_DESCRIPTION} characters minimum</span>
                {errors.description && <span id="desc-err" className="field-error">{errors.description}</span>}
              </div>
            )}
          </section>

          <section className="filing" aria-labelledby="f-bench">
            <h2 id="f-bench" className="section-h">The bench</h2>
            <p className="muted filing-lede">Pick any justice who is recused. Their seat sits out and they aren&apos;t counted.</p>
            <div className="bench-light bench-recusal">
              <Bench
                votes={{}}
                recused={recused}
                neutral
                onSelect={toggleRecusal}
                label="The bench: pick a seat to mark that justice recused"
                caption={(_, out) => (out ? "Recused" : "Sitting")}
                describe={(j, out) => `${j.name}: ${out ? "recused. Select to restore." : "sitting. Select to mark recused."}`}
              />
            </div>
            <p className="bench-count" aria-live="polite">
              <strong className="num">{sitting} justices sitting.</strong>{" "}
              {sitting % 2 === 0
                ? `An even bench can split ${sitting / 2}–${sitting / 2}; a tie affirms the judgment below by an equally divided Court.`
                : recused.size ? `Recused: ${[...recused].map((s) => byslug[s].last).join(", ")}.` : "No one recused."}
            </p>
            {errors.recused && <span id="recused-err" className="field-error">{errors.recused}</span>}
          </section>

          <section className="filing" aria-labelledby="f-file" id="f-file">
            <h2 id="f-file-h" className="section-h">File it</h2>
            {open ? (
              <p className="muted fine-line">Each forecast runs nine agents and costs a few dollars. Once filed, it locks when the last vote is in and can&apos;t be changed.</p>
            ) : (
              <p className="warn-note" role="status">Filing opens soon. Until then, read the forecasts already made.</p>
            )}
            <button type="submit" className="file-btn" disabled={!!progress || !open}>
              {progress ?? "File for forecast"} {!progress && <ArrowRight />}
            </button>
            <p className="visually-hidden" aria-live="polite">{progress}</p>
          </section>
        </div>

        <aside className="filing-summary" aria-label="What you've filed">
          <h2 className="summary-h">Your filing</h2>
          <ul>
            <li className={ready.title ? "is-done" : ""}><CheckMark on={ready.title} className="sum-mark" /> {title.trim() ? <cite className="case-name">{title.trim()}</cite> : "Case title"}</li>
            <li className={ready.briefs ? "is-done" : ""}>
              <CheckMark on={ready.briefs} className="sum-mark" /> {mode === "briefs" ? `${briefCount || "No"} brief${briefCount === 1 ? "" : "s"} attached` : "Plain-English description"}
            </li>
            <li className="is-info"><span className="sum-gap" aria-hidden="true" /> {sitting} justices sitting</li>
            <li className="is-info"><span className="sum-gap" aria-hidden="true" /> {mode === "briefs" ? phase : "Before argument"}</li>
          </ul>
        </aside>
      </form>
    </main>
  );
}
