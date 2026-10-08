// Sample data for a fictional case. The real app will fill this in from the prediction pipeline.
// ideology: negative = liberal, positive = conservative (illustrative ordering only).

export const justices = [
  { slug: "roberts", name: "John G. Roberts, Jr.", last: "Roberts", seniority: 1, ideology: 0.3 },
  { slug: "thomas", name: "Clarence Thomas", last: "Thomas", seniority: 2, ideology: 3.0 },
  { slug: "alito", name: "Samuel A. Alito, Jr.", last: "Alito", seniority: 3, ideology: 2.6 },
  { slug: "sotomayor", name: "Sonia Sotomayor", last: "Sotomayor", seniority: 4, ideology: -3.2 },
  { slug: "kagan", name: "Elena Kagan", last: "Kagan", seniority: 5, ideology: -2.2 },
  { slug: "gorsuch", name: "Neil M. Gorsuch", last: "Gorsuch", seniority: 6, ideology: 1.8 },
  { slug: "kavanaugh", name: "Brett M. Kavanaugh", last: "Kavanaugh", seniority: 7, ideology: 0.7 },
  { slug: "barrett", name: "Amy Coney Barrett", last: "Barrett", seniority: 8, ideology: 1.0 },
  { slug: "jackson", name: "Ketanji Brown Jackson", last: "Jackson", seniority: 9, ideology: -3.0 },
];

export const sampleCase = {
  title: "Hartwell v. Department of Commerce",
  docket: "25-1187",
  term: "October Term 2026",
  lowerCourt: "United States Court of Appeals for the D.C. Circuit",
  granted: "Jun 30, 2026",
  argued: "Dec 8, 2026",
  phase: "Pre-argument",
  lockedAt: "Oct 8, 2026, 9:14 AM ET",
  petitioner: "Hartwell Fisheries, LLC",
  respondent: "Department of Commerce",
  facts:
    "A federal fisheries rule requires certain commercial vessels to carry, and pay for, government-appointed monitors. Hartwell Fisheries challenged the rule, arguing the statute never authorized the agency to shift monitoring costs onto the regulated industry. The D.C. Circuit upheld the rule, deferring to the agency's reading of an ambiguous provision.",
  prediction: {
    winner: "Hartwell Fisheries",
    majority: 6,
    minority: 3,
    outcome: "Reversed and remanded",
    author: "roberts",
    authorRationale:
      "Roberts is the senior justice in the majority and has authored the Court's recent agency-deference opinions.",
    holding:
      "The statute does not authorize the agency to require vessels to fund their own monitors; the judgment below is reversed.",
  },
  votes: {
    roberts: { vote: "majority", role: "Writes for the Court", confidence: 0.86 },
    thomas: { vote: "majority", role: "Concurrence", confidence: 0.93 },
    alito: { vote: "majority", role: "Joins majority", confidence: 0.9 },
    sotomayor: { vote: "minority", role: "Joins dissent", confidence: 0.84 },
    kagan: { vote: "minority", role: "Dissent", confidence: 0.81 },
    gorsuch: { vote: "majority", role: "Concurrence", confidence: 0.91 },
    kavanaugh: { vote: "majority", role: "Joins majority", confidence: 0.78 },
    barrett: { vote: "majority", role: "Joins majority", confidence: 0.69 },
    jackson: { vote: "minority", role: "Joins dissent", confidence: 0.83 },
  },
  summary: [
    { heading: "Question presented", body: "Whether the Magnuson-Stevens Act authorizes the agency to require industry-funded monitoring, and what deference the agency's reading receives." },
    { heading: "Procedural history", body: "The district court granted summary judgment to the government. The D.C. Circuit affirmed, finding the statute ambiguous and the agency's reading reasonable." },
    { heading: "Petitioner's argument", body: "Congress expressly provided for industry funding in three specific fisheries; its silence elsewhere is deliberate. Courts must exercise independent judgment on statutory meaning." },
    { heading: "Respondent's argument", body: "The Act's broad grant to impose 'necessary and appropriate' conditions encompasses monitor costs, and the agency's long-standing practice confirms it." },
  ],
  reasoning: {
    roberts:
      "The Chief Justice's approach to agency power centers on the judiciary's duty to say what the law is. Where Congress specified cost-shifting for some fisheries but not others, he is likely to read that contrast as meaningful [Pet. Br. 14]. His opinions favor incremental holdings, so expect a narrow ruling confined to this statute rather than a broad pronouncement on agency funding.",
    thomas:
      "Justice Thomas has long questioned deference doctrines on separation-of-powers grounds. He will almost certainly vote to reverse and may write separately to argue that the delegation itself raises constitutional concerns [Pet. Br. 31].",
    alito:
      "Justice Alito tends to scrutinize regulatory burdens on small businesses closely. The cost figures in the record are likely to weigh heavily in his assessment [Pet. Br. 6].",
    sotomayor:
      "Justice Sotomayor is likely to emphasize the practical consequences for fisheries conservation and the agency's expertise in setting monitoring levels [Resp. Br. 22].",
    kagan:
      "Justice Kagan, a frequent author of dissents in agency cases, would likely argue that the statute's broad text delegates exactly this kind of judgment to the agency [Resp. Br. 18].",
    gorsuch:
      "Justice Gorsuch's skepticism of administrative power and attention to individual liberty make reversal very likely; a concurrence on the major-questions doctrine is plausible [Pet. Br. 27].",
    kavanaugh:
      "Justice Kavanaugh frequently looks to statutory structure and historical practice. He is likely to join the majority while noting the limits of the holding.",
    barrett:
      "Justice Barrett is the least certain vote. Her textualism points toward reversal, but she has cautioned against reading too much into congressional silence [Resp. Br. 12].",
    jackson:
      "Justice Jackson is likely to focus on the statutory text granting broad authority and on Congress's evident purpose of sustaining fisheries [Resp. Br. 9].",
  },
};

export const recentCases = [
  { title: "Hartwell v. Department of Commerce", docket: "25-1187", outcome: "Reverse", tally: [6, 3], phase: "Before argument", href: "#/case" },
  { title: "Alvarez v. Texas", docket: "25-640", outcome: "Affirm", tally: [5, 4], phase: "After argument" },
  { title: "United States v. Okafor", docket: "25-312", outcome: "Reverse", tally: [9, 0], phase: "After argument" },
  { title: "Greene County v. Whitaker", docket: "25-1043", outcome: "Vacate", tally: [7, 2], phase: "Before argument" },
];

export const byslug = Object.fromEntries(justices.map((j) => [j.slug, j]));

// Seats as they sit on the bench, viewed from the courtroom: the Chief in the center,
// then seniority alternating outward (2nd to the Chief's right, which is the viewer's left).
export const benchOrder = (() => {
  const bySeniority = [...justices].sort((a, b) => a.seniority - b.seniority);
  const left = [], right = [];
  bySeniority.slice(1).forEach((j, i) => (i % 2 === 0 ? left : right).push(j));
  return [...left.reverse(), bySeniority[0], ...right];
})();

const WRITING_ROLES = new Set(["Writes for the Court", "Concurrence", "Dissent"]);
export const writesSeparately = (vote) => WRITING_ROLES.has(vote.role);
export const voteWord = (vote) => (vote.vote === "majority" ? "To reverse" : "To affirm");

// Each justice's own prior writing that retrieval would surface for this case. These are real
// opinions on agency power; the passages are our paraphrases (labeled as such), never quotations.
// The live app shows the verbatim retrieved passage and checks the citation against retrieval.
export const ownCitations = {
  roberts: [
    { case: "Loper Bright Enterprises v. Raimondo", year: 2024, role: "opinion of the Court",
      gist: "Courts must use their own judgment to decide whether an agency stayed within its statutory authority, and may not defer to the agency's reading just because the statute is ambiguous." },
  ],
  thomas: [
    { case: "Loper Bright Enterprises v. Raimondo", year: 2024, role: "concurring",
      gist: "Deferring to agencies on the meaning of the law also offends the separation of powers, by shifting judicial power to the executive." },
    { case: "Michigan v. EPA", year: 2015, role: "concurring",
      gist: "Questioned whether deference to agency interpretations can be squared with the Constitution at all." },
  ],
  alito: [
    { case: "Sackett v. EPA", year: 2023, role: "opinion of the Court",
      gist: "Read the statute's terms by their ordinary meaning and rejected an expansive agency reading that burdened property owners." },
  ],
  sotomayor: [
    { case: "SEC v. Jarkesy", year: 2024, role: "dissenting",
      gist: "Warned that the majority's ruling unsettled long-standing precedent and threatened how many agencies do their work." },
  ],
  kagan: [
    { case: "Loper Bright Enterprises v. Raimondo", year: 2024, role: "dissenting",
      gist: "Congress often leaves gaps for agencies with subject-matter expertise to fill, and courts should respect that choice rather than claim the policy call for themselves." },
    { case: "Kisor v. Wilkie", year: 2019, role: "opinion of the Court",
      gist: "Kept deference to agencies' readings of their own regulations, but only after courts exhaust the ordinary tools of interpretation." },
  ],
  gorsuch: [
    { case: "West Virginia v. EPA", year: 2022, role: "concurring",
      gist: "The major questions doctrine protects the separation of powers by requiring clear authorization from Congress before an agency takes on an issue of vast significance." },
  ],
  kavanaugh: [
    { case: "Kisor v. Wilkie", year: 2019, role: "concurring in the judgment",
      gist: "A court that fully uses the traditional tools of interpretation will rarely find a regulation genuinely ambiguous, so deference should rarely come into play." },
  ],
  barrett: [
    { case: "Biden v. Nebraska", year: 2023, role: "concurring",
      gist: "Read the major questions doctrine as part of ordinary textual interpretation: context tells a reasonable reader how much power Congress likely delegated." },
  ],
  jackson: [
    { case: "Corner Post, Inc. v. Board of Governors", year: 2024, role: "dissenting",
      gist: "Criticized the Court's recent turn as upending settled administrative law and inviting a wave of challenges to long-standing agency rules." },
  ],
};

// Brief pages the agents cite inline. Fictional brief text for the fictional sample case.
export const briefPassages = {
  "Pet. Br. 6": "Monitoring costs run as high as $710 a day, roughly a fifth of a typical vessel's daily revenue, and fall hardest on the small family operations that make up most of the fleet.",
  "Pet. Br. 14": "Congress authorized industry-funded observers in three named fisheries. When Congress grants a power in one section and leaves it out of another, the omission is deliberate.",
  "Pet. Br. 27": "Whether an agency may make an entire industry pay for its own supervision is a question of economic and political significance that Congress would not leave to implication.",
  "Pet. Br. 31": "What a statute means is a question for the courts. Deference hands that judicial duty to the very agency whose power is in dispute.",
  "Resp. Br. 9": "The Act's stated purpose is to conserve and manage fishery resources; monitoring is how the agency knows whether its catch limits are being honored.",
  "Resp. Br. 12": "Statutory silence is not a prohibition. Congress's specific provisions for three fisheries confirm the practice; they do not forbid it elsewhere.",
  "Resp. Br. 18": "The Act lets the agency impose conditions necessary and appropriate for conservation. Requiring vessels to carry, and pay for, monitors is such a condition.",
  "Resp. Br. 22": "Without monitors at sea, bycatch and overfishing go unmeasured. The rule reflects decades of the agency's scientific and management experience.",
};
