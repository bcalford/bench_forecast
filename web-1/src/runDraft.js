import { sampleCase } from "./data.js";

// The case filed on #/new, handed to the simulated run on #/run.
// Prototype only: files never leave the browser; only their names travel.
const KEY = "bf-run-draft";
let draft = null;

export function setDraft(d) {
  draft = d;
  try { sessionStorage.setItem(KEY, JSON.stringify(d)); } catch { /* storage unavailable: memory only */ }
}

export function getDraft() {
  if (draft) return draft;
  try { draft = JSON.parse(sessionStorage.getItem(KEY)); } catch { draft = null; }
  return draft;
}

// The Hartwell sample as a filing, so "#/run/sample" can start the run in one click.
export const SAMPLE_DRAFT = {
  title: sampleCase.title,
  docket: sampleCase.docket,
  term: sampleCase.term,
  mode: "briefs",
  phase: "Before argument",
  briefCount: 3,
  recused: [],
  description: "",
  source: "sample",
};
