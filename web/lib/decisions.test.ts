import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readDecision } from "./decisions";

const END = " _________________ _________________ 1 Cite as: 606 U. S. ____ (2025) Opinion of the Court NOTICE: This opinion is subject to formal revision.";
const sides = (r: ReturnType<typeof readDecision>) => ({
  with: Object.entries(r.votes).filter(([, v]) => v === r.judgment).map(([s]) => s).sort(),
  against: Object.entries(r.votes).filter(([, v]) => v !== r.judgment).map(([s]) => s).sort(),
});

describe("readDecision on clean syllabi", () => {
  it("FCC v. Consumers' Research: 6–3 reversal, Kagan writing, a hyphen-split name", () => {
    const r = readDecision("Pp. 34–37. 109 F. 4th 743, reversed and remanded. KAGAN, J., delivered the opinion of the Court, in which ROBERTS, C. J., and SOTOMAYOR, KAVANAUGH, BARRETT, and JACKSON, JJ., joined. KA - VANAUGH, J., and JACKSON, J., filed concurring opinions. GORSUCH, J., filed a dissenting opinion, in which THOMAS and ALITO, JJ., joined." + END);
    assert.equal(r.clean, true, r.reasons.join("; "));
    assert.equal(r.judgment, "reverse");
    assert.equal(r.outcome, "Reversed and remanded");
    assert.equal(r.author, "kagan");
    assert.deepEqual(sides(r), { with: ["barrett", "jackson", "kagan", "kavanaugh", "roberts", "sotomayor"], against: ["alito", "gorsuch", "thomas"] });
    assert.equal(r.votes.thomas, "affirm");
  });
  it("Catholic Charities: a unanimous Court", () => {
    const r = readDecision("Pp. 13–15. 3 Cite as: 605 U. S. ____ (2025) Syllabus 2024 WI 13, 411 Wis. 2d 1, 3 N. W. 3d 666, reversed and remanded. SOTOMAYOR, J., delivered the opinion for a unanimous Court. THOMAS, J., and JACKSON, J., filed concurring opinions." + END);
    assert.equal(r.clean, true, r.reasons.join("; "));
    assert.equal(r.author, "sotomayor");
    assert.equal(Object.keys(r.votes).length, 9);
    assert.ok(Object.values(r.votes).every((v) => v === "reverse"));
  });
  it("Oklahoma v. EPA: a recusal and a concurrence in the judgment", () => {
    const r = readDecision("Pp. 9–13. 93 F. 4th 1262, reversed and remanded. THOMAS, J., delivered the opinion of the Court, in which SOTOMAYOR, KAGAN, KAVANAUGH, BARRETT, and JACKSON, JJ., joined. GORSUCH, J., filed an opinion concurring in the judgment, in which ROBERTS, C. J., joined. ALITO, J., took no part in the consideration or decision of the case." + END);
    assert.equal(r.clean, true, r.reasons.join("; "));
    assert.deepEqual(r.recused, ["alito"]);
    assert.equal(Object.keys(r.votes).length, 8);
    assert.equal(r.votes.gorsuch, "reverse");
    assert.equal(r.votes.alito, undefined);
  });
  it("Gutierrez v. Saenz: a partial join that concurs in the judgment", () => {
    const r = readDecision("Pp. 13–14. 93 F. 4th 267, reversed and remanded. SOTOMAYOR, J., delivered the opinion of the Court, in which ROBERTS, C. J., and KAGAN, KAVANAUGH, and JACKSON, JJ., joined, and in which BARRETT, J., joined as to all but Part II.B.2. BARRETT, J., filed an opinion concurring in part and concurring in the judgment. THOMAS, J., filed a dissenting opinion. ALITO, J., filed a dissenting opinion, in which THOMAS and GORSUCH, JJ., joined." + END);
    assert.equal(r.clean, true, r.reasons.join("; "));
    assert.deepEqual(sides(r).against, ["alito", "gorsuch", "thomas"]);
    assert.equal(r.votes.barrett, "reverse");
  });
  it("Monsalvo Velazquez v. Bondi: several dissents, one written jointly", () => {
    const r = readDecision("Pp. 11–18. 88 F. 4th 1301, reversed and remanded. 3 Cite as: 604 U. S. ____ (2025) Syllabus GORSUCH, J., delivered the opinion of the Court, in which ROBERTS, C. J., and SOTOMAYOR, KAGAN, and JACKSON, JJ., joined. THOMAS, J., filed a dissenting opinion, in which ALITO, J., joined, and in which KAVANAUGH and BARRETT, JJ., joined as to Parts I and II. ALITO, J., and BARRETT, J., filed dissenting opinions, in which KAVANAUGH, J., joined." + END);
    assert.equal(r.clean, true, r.reasons.join("; "));
    assert.deepEqual(sides(r), { with: ["gorsuch", "jackson", "kagan", "roberts", "sotomayor"], against: ["alito", "barrett", "kavanaugh", "thomas"] });
  });
  it("Free Speech Coalition v. Paxton: an affirmance", () => {
    const r = readDecision("Pp. 34–35. 95 F. 4th 263, affirmed. THOMAS, J., delivered the opinion of the Court, in which ROBERTS, C. J., ALITO, GORSUCH, KAVANAUGH, and BARRETT, JJ., joined. KAGAN, J., filed a dissenting opinion, in which SOTOMAYOR and JACKSON, JJ., joined." + END);
    assert.equal(r.judgment, "affirm");
    assert.equal(r.outcome, "Affirmed");
    assert.equal(r.votes.kagan, "reverse");
  });
  it("EPA v. Calumet: vacated, with the Chief Justice in dissent", () => {
    const r = readDecision("Pp. 18–21. 86 F. 4th 1121, vacated and remanded. THOMAS, J., delivered the opinion of the Court, in which ALITO, SOTOMAYOR, KAGAN, KAVANAUGH, BARRETT, and JACKSON, JJ., joined. GORSUCH, J., filed a dissenting opinion, in which ROBERTS, C. J., joined." + END);
    assert.equal(r.judgment, "vacate_remand");
    assert.equal(r.votes.roberts, "affirm");
    assert.equal(r.clean, true, r.reasons.join("; "));
  });
  it("reads mixed-case names (preliminary-print small caps)", () => {
    const r = readDecision("Pp. 9–10. Reversed and remanded. Kavanaugh, J., delivered the opinion of the Court, in which Roberts, C. J., and Thomas, Alito, Gorsuch, and Barrett, JJ., joined. Kagan, J., filed a dissenting opinion, in which Sotomayor and Jackson, JJ., joined." + END);
    assert.equal(r.clean, true, r.reasons.join("; "));
    assert.equal(r.author, "kavanaugh");
  });
});

describe("readDecision on preliminary prints and page breaks", () => {
  it("Wolford v. Lopez: lost 'fi' ligatures and counsel listed after the line-up", () => {
    const r = readDecision("Pp. 210–214. 116 F. 4th 959, reversed and remanded. Alito, J., delivered the opinion of the Court, in which Roberts, C. J., and Thomas, Gorsuch, Kavanaugh, and Barrett, JJ., joined. Barrett, J., fled a concurring opinion, in which Thomas and Gorsuch, JJ., joined as to Part II–B, post, p. 213. Kagan, J., fled a dissenting opinion, post, p. 225. Jackson, J., fled a dissenting opinion, in which Sotomayor, J., joined, post, p. 226. Alan Alexander Beck argued the cause for petitioners. With him on the brief were Mark W. Pennak and Kevin O'Grady. Thomas Example argued the cause for respondents.");
    assert.equal(r.clean, true, r.reasons.join("; "));
    assert.deepEqual(sides(r).against, ["jackson", "kagan", "sotomayor"]);
    assert.equal(r.votes.thomas, "reverse", "a lawyer named Thomas is not the Justice");
  });
  it("United States v. Hemani: 'Affrmed' and a concurrence in the judgment", () => {
    const r = readDecision("Pp. 794–795. Affrmed. Gorsuch, J., delivered the opinion of the Court, in which Roberts, C. J., and Thomas, Sotomayor, Kavanaugh, Barrett, and Jackson, JJ., joined. Thomas, J., fled a concurring opinion, post, p. 795. Jackson, J., fled a concurring opinion, in which Sotomayor, J., joined, post, p. 802. Alito, J., fled an opinion concurring in the judgment, in which Kagan, J., joined, post, p. 806. Principal Deputy Solicitor General Harris argued the cause for the United States.");
    assert.equal(r.clean, true, r.reasons.join("; "));
    assert.equal(r.judgment, "affirm");
    assert.equal(r.outcome, "Affirmed");
    assert.equal(Object.keys(r.votes).length, 9);
  });
  it("Fuld v. PLO: 'which GORSUCH, J., joined' without 'in'", () => {
    const r = readDecision("Pp. 19–21. 82 F. 4th 64 (second judgment) and 74 (first judgment), reversed and remanded. ROBERTS, C. J., delivered the opinion of the Court, in which ALITO, SO - TOMAYOR, KAGAN, KAVANAUGH, BARRETT, and JACKSON, JJ., joined. THOMAS, J., filed an opinion concurring in the judgment, which GORSUCH, J., joined as to Part II." + END);
    assert.equal(r.clean, true, r.reasons.join("; "));
    assert.equal(r.votes.gorsuch, "reverse");
  });
  it("a line-up that runs across a page header", () => {
    const r = readDecision("Pp. 34–37. 109 F. 4th 743, reversed and remanded. KAGAN, J., delivered the opinion of the Court, in which ROBERTS, C. J., and SOTOMAYOR, KAVANAUGH, BARRETT, and JACKSON, JJ., joined. KAVANAUGH, J., and JACKSON, J., filed concurring opinions. 6 FCC v. CONSUMERS’ RESEARCH Syllabus 7 Cite as: 606 U. S. ____ (2025) Syllabus GORSUCH, J., filed a dissenting opinion, in which THOMAS and ALITO, JJ., joined." + END);
    assert.equal(r.clean, true, r.reasons.join("; "));
    assert.deepEqual(sides(r).against, ["alito", "gorsuch", "thomas"]);
  });
});

describe("readDecision sends unclear decisions to review", () => {
  it("a running head the cleaner misses can't merge a dissent into the majority", () => {
    const r = readDecision("Pp. 9–17. 21 F. 4th 1112, reversed and remanded. ROBERTS, C. J., delivered the opinion of the Court, in which THOMAS, GORSUCH, KAVANAUGH, BARRETT, and JACKSON, JJ., joined. 4 UNITED STATES ex rel. SCHUTTE v. SUPERVALU INC. Syllabus ALITO, J., filed a dissenting opinion, in which SOTOMAYOR and KAGAN, JJ., joined." + END);
    assert.equal(r.clean, false, "must not read 9–0");
  });
  it("an opinion dissenting in part", () => {
    const r = readDecision("Pp. 11–16. Vacated and remanded. ALITO, J., delivered the opinion of the Court, in which ROBERTS, C. J., THOMAS, GORSUCH, KAVANAUGH, and BARRETT, JJ., joined. JACKSON, J., filed an opinion dissenting in part, in which SOTOMAYOR and KAGAN, JJ., joined." + END);
    assert.equal(r.clean, false);
    assert.ok(r.reasons.some((x) => /in part/.test(x)), r.reasons.join("; "));
  });
  it("consolidated cases with different judgments", () => {
    const r = readDecision("Pp. 20–24. No. 25–1, 99 F. 4th 1, reversed and remanded; No. 25–2, 99 F. 4th 2, affirmed. KAGAN, J., delivered the opinion for a unanimous Court." + END);
    assert.equal(r.clean, false);
    assert.ok(r.reasons.some((x) => /more than one judgment/.test(x)), r.reasons.join("; "));
  });
  it("a judgment line it doesn't recognize, after a lower court's 'affirmed'", () => {
    const r = readDecision("The Court of Appeals affirmed. Held: the Special Master's recommendation is adopted. Pp. 5–9. Exceptions overruled. GORSUCH, J., delivered the opinion for a unanimous Court." + END);
    assert.equal(r.clean, false);
    assert.equal(r.judgment, null);
  });
  it("Glossip v. Oklahoma: concurring in part and dissenting in part", () => {
    const r = readDecision("529 P. 3d 218, reversed and remanded. SOTOMAYOR, J., delivered the opinion of the Court, in which ROBERTS, C. J., and KAGAN, KAVANAUGH, and JACKSON, JJ., joined, and in which BARRETT, J., joined as to Part II. BARRETT, J., filed an opinion concurring in part and dissenting in part. THOMAS, J., filed a dissenting opinion, in which ALITO, J., joined, and in which BARRETT, J., joined as to Parts IV– A–1, IV–A–2, and IV–A–3. GORSUCH, J., took no part in the considera- tion or decision of the case." + END);
    assert.equal(r.clean, false);
    assert.ok(r.reasons.some((x) => /in part/.test(x)), r.reasons.join("; "));
    assert.deepEqual(r.recused, ["gorsuch"]);
  });
  it("Trump v. CASA: no judgment line", () => {
    const r = readDecision("P. 26. Applications for partial stays granted. BARRETT, J., delivered the opinion of the Court, in which ROBERTS, C. J., and THOMAS, ALITO, GORSUCH, and KAVANAUGH, JJ., joined. SOTOMAYOR, J., filed a dissenting opinion, in which KAGAN and JACKSON, JJ., joined. JACKSON, J., filed a dissenting opinion." + END);
    assert.equal(r.clean, false);
    assert.equal(r.judgment, null);
    assert.ok(r.reasons.some((x) => /judgment/.test(x)));
  });
  it("a per curiam", () => {
    const r = readDecision("SUPREME COURT OF THE UNITED STATES No. 25–1 ALPHA v. BETA PER CURIAM. The petition is granted and the judgment is reversed.");
    assert.equal(r.clean, false);
    assert.ok(r.reasons.some((x) => /per curiam/i.test(x)));
  });
  it("a plurality", () => {
    const r = readDecision("Reversed and remanded. ALITO, J., announced the judgment of the Court and delivered an opinion, in which ROBERTS, C. J., and THOMAS, J., joined." + END);
    assert.equal(r.clean, false);
    assert.ok(r.reasons.some((x) => /plurality/i.test(x)));
  });
  it("a justice left unaccounted for", () => {
    const r = readDecision("Affirmed. ROBERTS, C. J., delivered the opinion of the Court, in which THOMAS, ALITO, and GORSUCH, JJ., joined. KAGAN, J., filed a dissenting opinion." + END);
    assert.equal(r.clean, false);
    assert.ok(r.reasons.some((x) => /not accounted for/.test(x)));
  });
});

describe("readDecision: 'in which all other Members joined'", () => {
  it("counts every justice with the judgment", () => {
    const r = readDecision("Pp. 4–12. 98 F. 4th 1, reversed and remanded. ROBERTS, C. J., delivered the opinion of the Court, in which all other Members joined." + END);
    assert.equal(r.clean, true, r.reasons.join("; "));
    assert.equal(r.author, "roberts");
    assert.equal(Object.keys(r.votes).length, 9);
    assert.ok(Object.values(r.votes).every((v) => v === "reverse"));
  });
  it("still applies a recusal and a concurrence", () => {
    const r = readDecision("Pp. 4–12. Affirmed. BARRETT, J., delivered the opinion of the Court, in which all other Members joined as to Parts I and III. THOMAS, J., filed a concurring opinion. KAGAN, J., took no part in the consideration or decision of the case." + END);
    assert.equal(r.clean, true, r.reasons.join("; "));
    assert.equal(Object.keys(r.votes).length, 8);
    assert.equal(r.votes.kagan, undefined);
    assert.equal(r.recused.join(), "kagan");
  });
  it("sends a dissent alongside it to review", () => {
    const r = readDecision("Pp. 4–12. Affirmed. BARRETT, J., delivered the opinion of the Court, in which all other Members joined. GORSUCH, J., filed a dissenting opinion." + END);
    assert.equal(r.clean, false);
    assert.ok(r.reasons.some((x) => /both with and against/.test(x)));
  });
  it("sends 'all other Members joined except …' to review", () => {
    const r = readDecision("Pp. 4–12. Affirmed. BARRETT, J., delivered the opinion of the Court, in which all other Members joined except GORSUCH, J." + END);
    assert.equal(r.clean, false);
  });
});
