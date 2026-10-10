// Retrieval sanity check (spec.md §9): a known topic per justice should return that justice's own relevant writing.
//   npx tsx --env-file=.env.local scripts/try/retrieval-check.ts
import { retrieveForJustice } from "../../lib/retrieval";

const CHECKS: Record<string, string[]> = {
  roberts: ["incremental narrow holdings and judicial restraint", "Voting Rights Act preclearance coverage formula"],
  thomas: ["original meaning of the Fourteenth Amendment privileges or immunities", "history and tradition test for firearms regulation"],
  alito: ["religious liberty and free exercise of religion", "abortion and the Constitution"],
  sotomayor: ["capital punishment and the death penalty", "qualified immunity for police officers"],
  kagan: ["major questions doctrine and agency delegation", "stare decisis and statutory precedent"],
  gorsuch: ["tribal sovereignty and treaties with Indian tribes", "nondelegation doctrine and separation of powers"],
  kavanaugh: ["Fourth Amendment searches and police", "statutory interpretation and textualism"],
  barrett: ["standing and Article III", "originalism and precedent"],
  jackson: ["Voting Rights Act section 2 vote dilution", "race-conscious admissions"],
};

async function main() {
  for (const [justice, queries] of Object.entries(CHECKS)) {
    const started = Date.now();
    const hits = await retrieveForJustice(justice, queries, { perQuery: 6, total: 6, perDocument: 1 });
    console.log(`\n${justice} (${Date.now() - started} ms): ${queries.join(" | ")}`);
    for (const h of hits) console.log(`  ${h.similarity.toFixed(3)}  ${h.caseName.slice(0, 48).padEnd(48)} ${(h.date ?? "").slice(0, 4)}  ${(h.label ?? h.kind).slice(0, 30)}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
