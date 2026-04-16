const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
  PageNumber, Header, Footer, PageBreak, LevelFormat,
} = require("docx");
const fs = require("fs");
const path = require("path");

// ─── Colours ────────────────────────────────────────────────────────────────
const NAVY   = "1F3864";
const TEAL   = "2E75B6";
const LTBLUE = "D6E4F0";
const LTGREY = "F2F2F2";
const WHITE  = "FFFFFF";
const BLACK  = "000000";

// ─── Borders helper ─────────────────────────────────────────────────────────
function border(color = "CCCCCC", size = 4) {
  return { style: BorderStyle.SINGLE, size, color };
}
const cellBorders = (c = "CCCCCC") => ({
  top: border(c), bottom: border(c), left: border(c), right: border(c),
});

// ─── Paragraph helpers ──────────────────────────────────────────────────────
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text, bold: true, color: WHITE, size: 36 })],
    shading: { fill: NAVY, type: ShadingType.CLEAR },
    spacing: { before: 240, after: 120 },
    indent: { left: 200 },
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text, bold: true, color: NAVY, size: 28 })],
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: TEAL } },
    spacing: { before: 300, after: 100 },
  });
}
function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    children: [new TextRun({ text, bold: true, color: TEAL, size: 24 })],
    spacing: { before: 200, after: 60 },
  });
}
function body(text, opts = {}) {
  return new Paragraph({
    children: [new TextRun({ text, size: 22, color: BLACK, ...opts })],
    spacing: { after: 100 },
  });
}
function mono(text) {
  return new Paragraph({
    children: [new TextRun({ text, font: "Courier New", size: 18, color: "2F4F4F" })],
    shading: { fill: "F5F5F5", type: ShadingType.CLEAR },
    spacing: { before: 40, after: 40 },
    indent: { left: 360 },
  });
}
function gap() { return new Paragraph({ children: [new TextRun("")], spacing: { after: 80 } }); }
function pageBreak() { return new Paragraph({ children: [new PageBreak()] }); }

function bullet(text) {
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    children: [new TextRun({ text, size: 22 })],
    spacing: { after: 60 },
  });
}

// ─── Table cell helpers ─────────────────────────────────────────────────────
function hCell(text, width, bg = NAVY) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: cellBorders(TEAL),
    shading: { fill: bg, type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text, bold: true, color: WHITE, size: 20 })],
    })],
  });
}
function dCell(text, width, shade = WHITE, centered = false) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: cellBorders("CCCCCC"),
    shading: { fill: shade, type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({
      alignment: centered ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: [new TextRun({ text: String(text), size: 20 })],
    })],
  });
}

// ─── Raw CSV data ────────────────────────────────────────────────────────────
const rows = [
  // [strategy_short, id, intent_short, tone, fr, ta, es, comp]
  ["A – Advanced","1","Sales follow-up","formal","1.00","1.00","1.00","1.00"],
  ["A – Advanced","2","RFP request","formal","0.80","1.00","1.00","0.93"],
  ["A – Advanced","3","Post-interview thank you","casual","1.00","0.80","1.00","0.93"],
  ["A – Advanced","4","Service outage apology","empathetic","1.00","0.90","1.00","0.97"],
  ["A – Advanced","5","Partnership intro","formal","1.00","1.00","1.00","1.00"],
  ["A – Advanced","6","VP meeting request","formal","0.80","1.00","1.00","0.93"],
  ["A – Advanced","7","Project status update","formal","1.00","1.00","1.00","1.00"],
  ["A – Advanced","8","Complaint escalation","urgent","0.80","1.00","1.00","0.93"],
  ["A – Advanced","9","Conference follow-up","casual","0.60","0.80","1.00","0.80"],
  ["A – Advanced","10","Deadline extension","formal","1.00","1.00","1.00","1.00"],
  ["B – Basic","1","Sales follow-up","formal","1.00","1.00","1.00","1.00"],
  ["B – Basic","2","RFP request","formal","0.60","1.00","1.00","0.87"],
  ["B – Basic","3","Post-interview thank you","casual","1.00","0.70","1.00","0.90"],
  ["B – Basic","4","Service outage apology","empathetic","0.80","0.90","1.00","0.90"],
  ["B – Basic","5","Partnership intro","formal","1.00","1.00","1.00","1.00"],
  ["B – Basic","6","VP meeting request","formal","0.80","1.00","1.00","0.93"],
  ["B – Basic","7","Project status update","formal","1.00","1.00","1.00","1.00"],
  ["B – Basic","8","Complaint escalation","urgent","1.00","1.00","1.00","1.00"],
  ["B – Basic","9","Conference follow-up","casual","0.40","0.70","1.00","0.70"],
  ["B – Basic","10","Deadline extension","formal","0.40","1.00","1.00","0.80"],
];

// Column widths (total = 9360)
const CW = [1200, 360, 2100, 900, 880, 880, 880, 1160];

function dataTable() {
  const headers = ["Strategy","#","Intent","Tone","Fact Recall","Tone Acc.","Structure","Composite"];
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => hCell(h, CW[i])),
  });

  const dataRows = rows.map((r, idx) => {
    const shade = idx < 10
      ? (idx % 2 === 0 ? LTBLUE : WHITE)
      : (idx % 2 === 0 ? LTGREY : WHITE);
    return new TableRow({
      children: r.map((v, i) => dCell(v, CW[i], shade, i >= 4)),
    });
  });

  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: CW,
    rows: [headerRow, ...dataRows],
  });
}

function avgTable() {
  const cw2 = [3600, 1440, 1440, 1440, 1440];
  const headerRow = new TableRow({
    tableHeader: true,
    children: ["Strategy","Fact Recall","Tone Accuracy","Structure","Composite"].map(
      (h, i) => hCell(h, cw2[i], TEAL)
    ),
  });
  const rowA = new TableRow({ children: [
    dCell("Strategy A – Advanced (Role + Few-Shot + CoT)", cw2[0], LTBLUE),
    dCell("0.90", cw2[1], LTBLUE, true),
    dCell("0.95", cw2[2], LTBLUE, true),
    dCell("1.00", cw2[3], LTBLUE, true),
    dCell("0.9500", cw2[4], LTBLUE, true),
  ]});
  const rowB = new TableRow({ children: [
    dCell("Strategy B – Basic (Minimal Prompt)", cw2[0], WHITE),
    dCell("0.80", cw2[1], WHITE, true),
    dCell("0.94", cw2[2], WHITE, true),
    dCell("1.00", cw2[3], WHITE, true),
    dCell("0.9100", cw2[4], WHITE, true),
  ]});
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: cw2,
    rows: [headerRow, rowA, rowB],
  });
}

// ─── Document ────────────────────────────────────────────────────────────────
const doc = new Document({
  numbering: {
    config: [{
      reference: "bullets",
      levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022",
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } }],
    }],
  },
  styles: {
    default: {
      document: { run: { font: "Arial", size: 22, color: BLACK } },
    },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: "Arial", color: WHITE },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: NAVY },
        paragraph: { spacing: { before: 300, after: 100 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "Arial", color: TEAL },
        paragraph: { spacing: { before: 200, after: 60 }, outlineLevel: 2 } },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
      },
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          children: [
            new TextRun({ text: "Email Generation Assistant – Evaluation Report", size: 18, color: "888888" }),
            new TextRun({ text: "\t", size: 18 }),
            new TextRun({ text: "April 2026", size: 18, color: "888888" }),
          ],
          tabStops: [{ type: "right", position: 9360 }],
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" } },
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          children: [
            new TextRun({ text: "Page ", size: 18, color: "888888" }),
            new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "888888" }),
            new TextRun({ text: " of ", size: 18, color: "888888" }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: "888888" }),
          ],
          alignment: AlignmentType.CENTER,
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" } },
        })],
      }),
    },
    children: [

      // ── COVER ──────────────────────────────────────────────────────────────
      new Paragraph({
        children: [new TextRun({ text: "", size: 22 })],
        spacing: { before: 1440, after: 0 },
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        shading: { fill: NAVY, type: ShadingType.CLEAR },
        spacing: { before: 240, after: 0 },
        children: [new TextRun({ text: "Email Generation Assistant", bold: true, size: 56, color: WHITE, font: "Arial" })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        shading: { fill: NAVY, type: ShadingType.CLEAR },
        spacing: { before: 0, after: 0 },
        children: [new TextRun({ text: "Evaluation Report", bold: true, size: 44, color: LTBLUE, font: "Arial" })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        shading: { fill: NAVY, type: ShadingType.CLEAR },
        spacing: { before: 200, after: 480 },
        children: [new TextRun({ text: "AI Engineer Candidate Assessment  |  April 2026", size: 24, color: "AAAAAA", font: "Arial" })],
      }),

      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 400, after: 200 },
        children: [new TextRun({ text: "Model: gemini-2.0-flash  |  10 Test Scenarios  |  2 Prompting Strategies  |  3 Custom Metrics", size: 22, color: "555555", italics: true })],
      }),

      pageBreak(),

      // ── SECTION 1: PROMPT TEMPLATES ────────────────────────────────────────
      h1("Section 1 – Prompt Templates"),
      gap(),

      h2("1.1  Strategy A – Advanced Prompting"),
      body("Strategy A combines three techniques to maximise output quality:"),
      bullet("Role-Playing: A system prompt assigns the model an expert persona"),
      bullet("Few-Shot Examples: Two worked examples anchor format, length, and quality"),
      bullet("Chain-of-Thought: The model reasons step-by-step (REASONING) before writing (OUTPUT)"),
      gap(),

      h3("System Prompt (Role-Playing)"),
      mono("You are an expert business-communication specialist with 20 years of experience"),
      mono("drafting professional emails across industries. Your emails are always clear,"),
      mono("appropriately toned, and include every required piece of information — nothing"),
      mono("superfluous, nothing missing. You follow the user's instructions precisely."),
      gap(),

      h3("User Prompt Template"),
      mono("Below are two worked examples that show the expected reasoning and output format."),
      mono("[FEW-SHOT EXAMPLES INSERTED HERE — see Section 1.1.1 below]"),
      mono(""),
      mono("Now complete the following task using the SAME format."),
      mono(""),
      mono("INPUT"),
      mono("  Intent    : {intent}"),
      mono("  Key Facts : {key_facts}"),
      mono("  Tone      : {tone}"),
      mono(""),
      mono("Think step-by-step (label this section REASONING), then write the email (OUTPUT)."),
      mono("Your OUTPUT must contain:"),
      mono("  - A subject line starting with 'Subject:'"),
      mono("  - A salutation (Dear / Hi / Hello ...)"),
      mono("  - A body that weaves in every key fact naturally"),
      mono("  - A professional closing and placeholder signature"),
      mono(""),
      mono("REASONING"),
      gap(),

      h3("1.1.1  Few-Shot Examples"),
      body("Example 1 – Formal follow-up after a product demo:", { bold: true }),
      mono("INPUT"),
      mono("  Intent    : Thank a client after a successful product demo"),
      mono("  Key Facts : Demo held last Thursday | Showcased inventory module |"),
      mono("              Client loved the reporting dashboard | Send proposal by Friday"),
      mono("  Tone      : Formal"),
      mono(""),
      mono("REASONING"),
      mono("  1. Recipient: business client who attended a demo"),
      mono("  2. Structure: subject -> greeting -> thanks + highlights -> next step -> close"),
      mono("  3. Tone cues: 'Dear', formal sentences, no contractions, polished sign-off"),
      mono(""),
      mono("OUTPUT"),
      mono("Subject: Thank You for Attending Our Product Demo"),
      mono(""),
      mono("Dear [Client Name],"),
      mono(""),
      mono("Thank you for joining us last Thursday for the product demonstration."),
      mono("It was a pleasure to walk you through the inventory module and to hear"),
      mono("your enthusiasm for the reporting dashboard."),
      mono(""),
      mono("As discussed, I will send across our commercial proposal by this Friday."),
      mono("Please reach out if you have any questions in the meantime."),
      mono(""),
      mono("Kind regards,"),
      mono("[Your Name]"),
      gap(),

      body("Example 2 – Casual check-in with a colleague:", { bold: true }),
      mono("INPUT"),
      mono("  Intent    : Check in with a colleague about project progress"),
      mono("  Key Facts : Deadline is next Monday | Two tasks outstanding |"),
      mono("              Offer to help if needed"),
      mono("  Tone      : Casual"),
      mono(""),
      mono("REASONING"),
      mono("  1. Recipient: familiar colleague"),
      mono("  2. Structure: friendly opener -> specific asks -> supportive close"),
      mono("  3. Tone cues: first-name basis, contractions OK, casual sign-off"),
      mono(""),
      mono("OUTPUT"),
      mono("Subject: Quick Check-In – Project Status"),
      mono(""),
      mono("Hi [Name],"),
      mono(""),
      mono("Hope you're doing well! Just wanted to touch base before Monday's deadline."),
      mono("I know the API integration and QA sign-off are still in progress — let me"),
      mono("know if there's anything I can do to help."),
      mono(""),
      mono("Thanks, and talk soon!"),
      mono("[Your Name]"),
      gap(),

      h2("1.2  Strategy B – Basic Prompting (Baseline)"),
      body("Strategy B uses a single, minimal instruction with no persona, no examples, and no reasoning scaffold. It serves as the control condition for the comparison."),
      gap(),

      h3("System Prompt"),
      mono("You are a helpful assistant."),
      gap(),

      h3("User Prompt Template"),
      mono("Write a professional email."),
      mono(""),
      mono("Intent    : {intent}"),
      mono("Key Facts : {key_facts}"),
      mono("Tone      : {tone}"),
      mono(""),
      mono("Include a subject line, greeting, body, and closing."),

      pageBreak(),

      // ── SECTION 2: METRICS ─────────────────────────────────────────────────
      h1("Section 2 – Custom Evaluation Metrics"),
      body("Three metrics were designed specifically for the email generation task. They use a combination of automated Python scripting and LLM-as-a-Judge to measure different quality dimensions."),
      gap(),

      h2("2.1  Metric 1 – Fact Recall Score"),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [1800, 7560],
        rows: [
          new TableRow({ children: [
            hCell("Type", 1800, TEAL),
            dCell("Automated (Python keyword overlap)", 7560, LTBLUE),
          ]}),
          new TableRow({ children: [
            hCell("Range", 1800, TEAL),
            dCell("0.0 – 1.0  (higher = more facts included)", 7560, WHITE),
          ]}),
        ],
      }),
      gap(),

      h3("Definition"),
      body("Measures what proportion of the input key facts are present in the generated email. Each fact phrase is checked for keyword coverage; a fact is 'covered' when at least 60% of its meaningful keywords appear in the email text."),
      gap(),

      h3("Logic"),
      bullet("Split key_facts on '|' to get individual fact phrases"),
      bullet("Tokenise each phrase; remove stop words (a, the, and, …) and short tokens"),
      bullet("Build the email's keyword set the same way"),
      bullet("For each fact: overlap = (fact keywords found in email) / (total fact keywords)"),
      bullet("Fact is covered if overlap >= 0.60"),
      bullet("Score = covered_facts / total_facts"),
      gap(),

      h2("2.2  Metric 2 – Tone Accuracy Score"),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [1800, 7560],
        rows: [
          new TableRow({ children: [
            hCell("Type", 1800, TEAL),
            dCell("LLM-as-Judge (gemini-2.0-flash, temperature = 0)", 7560, LTBLUE),
          ]}),
          new TableRow({ children: [
            hCell("Range", 1800, TEAL),
            dCell("0.0 – 1.0  (raw rating / 10)", 7560, WHITE),
          ]}),
        ],
      }),
      gap(),

      h3("Definition"),
      body("Asks the judge model to rate how closely the generated email's tone matches the requested tone on a 1–10 integer scale. The score is then normalised to 0–1."),
      gap(),

      h3("Judge Prompt"),
      mono("You are an expert evaluator of professional email communication."),
      mono(""),
      mono("Your task: rate how accurately the GENERATED EMAIL reflects the requested tone."),
      mono(""),
      mono("Requested tone : {tone}"),
      mono("Generated email:"),
      mono("\"\"\""),
      mono("{email}"),
      mono("\"\"\""),
      mono(""),
      mono("On a scale from 1 (completely wrong tone) to 10 (perfect tone match), give a"),
      mono("single integer rating. Output ONLY the integer."),
      gap(),

      h3("Logic"),
      bullet("Build the zero-shot judge prompt with the email and the requested tone"),
      bullet("Call gemini-2.0-flash at temperature 0 for deterministic scoring"),
      bullet("Parse the first integer from the response"),
      bullet("Clamp to [1, 10] for robustness; divide by 10 to normalise"),
      gap(),

      h2("2.3  Metric 3 – Email Structure Score"),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [1800, 7560],
        rows: [
          new TableRow({ children: [
            hCell("Type", 1800, TEAL),
            dCell("Automated rule-based (regex + word count)", 7560, LTBLUE),
          ]}),
          new TableRow({ children: [
            hCell("Range", 1800, TEAL),
            dCell("0.0 – 1.0  (0.2 per structural component)", 7560, WHITE),
          ]}),
        ],
      }),
      gap(),

      h3("Definition"),
      body("Checks that the generated email contains the four structural elements of a professional email, and that its length falls within a sensible range (50–450 words)."),
      gap(),

      h3("Scoring Breakdown"),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [5000, 2860, 1500],
        rows: [
          new TableRow({ children: [
            hCell("Component", 5000, TEAL),
            hCell("Check", 2860, TEAL),
            hCell("Points", 1500, TEAL),
          ]}),
          ...[
            ["Subject line present", "Regex: ^Subject:", "+0.2"],
            ["Salutation present", "Regex: Dear / Hi / Hello / Greetings", "+0.2"],
            ["Substantive body", "Body word count > 30", "+0.2"],
            ["Professional closing", "Regex: Regards / Sincerely / Thanks / Warmly", "+0.2"],
            ["Appropriate length", "50 <= total word count <= 450", "+0.2"],
          ].map(([c, ch, p], i) => new TableRow({ children: [
            dCell(c, 5000, i % 2 === 0 ? LTGREY : WHITE),
            dCell(ch, 2860, i % 2 === 0 ? LTGREY : WHITE),
            dCell(p, 1500, i % 2 === 0 ? LTGREY : WHITE, true),
          ]})),
        ],
      }),

      pageBreak(),

      // ── SECTION 3: RAW DATA ────────────────────────────────────────────────
      h1("Section 3 – Raw Evaluation Data"),
      body("All 10 test scenarios were run through both strategies using gemini-2.0-flash. The table below shows raw scores for each scenario across the three custom metrics."),
      gap(),

      h2("3.1  Per-Scenario Results"),
      dataTable(),
      gap(),

      h2("3.2  Average Scores per Strategy"),
      avgTable(),
      gap(),

      body("Note: Email Structure scored 1.00 for all 20 runs — gemini-2.0-flash reliably produces well-structured emails regardless of prompt style.", { italics: true, color: "666666" }),

      pageBreak(),

      // ── SECTION 4: COMPARATIVE ANALYSIS ───────────────────────────────────
      h1("Section 4 – Comparative Analysis"),
      gap(),

      h2("4.1  Which Strategy Performed Better?"),
      body("Strategy A (Advanced: Role + Few-Shot + CoT) outperformed Strategy B (Basic) on the composite metric: 0.9500 vs 0.9100, a difference of +0.04 (4 percentage points)."),
      gap(),

      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [3000, 2120, 2120, 2120],
        rows: [
          new TableRow({ children: [
            hCell("Metric", 3000, NAVY),
            hCell("Strategy A", 2120, TEAL),
            hCell("Strategy B", 2120, TEAL),
            hCell("Difference", 2120, TEAL),
          ]}),
          new TableRow({ children: [
            dCell("Fact Recall", 3000, LTBLUE),
            dCell("0.90", 2120, LTBLUE, true),
            dCell("0.80", 2120, LTBLUE, true),
            dCell("+0.10 (+12.5%)", 2120, LTBLUE, true),
          ]}),
          new TableRow({ children: [
            dCell("Tone Accuracy", 3000, WHITE),
            dCell("0.95", 2120, WHITE, true),
            dCell("0.94", 2120, WHITE, true),
            dCell("+0.01 (+1.1%)", 2120, WHITE, true),
          ]}),
          new TableRow({ children: [
            dCell("Email Structure", 3000, LTBLUE),
            dCell("1.00", 2120, LTBLUE, true),
            dCell("1.00", 2120, LTBLUE, true),
            dCell("0.00 (tie)", 2120, LTBLUE, true),
          ]}),
          new TableRow({ children: [
            dCell("Composite", 3000, WHITE),
            dCell("0.9500", 2120, WHITE, true),
            dCell("0.9100", 2120, WHITE, true),
            dCell("+0.04 (+4.4%)", 2120, WHITE, true),
          ]}),
        ],
      }),
      gap(),

      body("Strategy A is the clear winner on Fact Recall — the metric where the gap is most significant. The few-shot examples and chain-of-thought reasoning together ensure the model explicitly considers each key fact before drafting, reducing omissions."),
      gap(),

      h2("4.2  Biggest Failure Mode of Strategy B"),
      body("Strategy B's primary failure mode is Fact Omission in complex or casual scenarios. The two lowest-scoring scenarios for Strategy B were:"),
      gap(),

      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [2800, 1600, 3960],
        rows: [
          new TableRow({ children: [
            hCell("Scenario", 2800, NAVY),
            hCell("Fact Recall (B)", 1600, TEAL),
            hCell("Root Cause", 3960, TEAL),
          ]}),
          new TableRow({ children: [
            dCell("9 – Conference follow-up (casual)", 2800, LTBLUE),
            dCell("0.40", 1600, LTBLUE, true),
            dCell("Casual tone causes the model to omit specific facts (LinkedIn, NLP project) in favour of generic friendly phrasing", 3960, LTBLUE),
          ]}),
          new TableRow({ children: [
            dCell("10 – Deadline extension (formal)", 2800, WHITE),
            dCell("0.40", 1600, WHITE, true),
            dCell("Without a CoT scaffold, the model generalises the reason for the extension rather than citing the specific API change detail", 3960, WHITE),
          ]}),
          new TableRow({ children: [
            dCell("2 – RFP request (formal)", 2800, LTBLUE),
            dCell("0.60", 1600, LTBLUE, true),
            dCell("Five densely packed facts — the basic prompt lacks a mechanism to enumerate and verify each one individually", 3960, LTBLUE),
          ]}),
        ],
      }),
      gap(),

      body("In all three cases, the pattern is the same: the more facts the input contains, and the more casual or complex the tone, the more likely Strategy B is to drop or vaguely paraphrase specific details. The minimal prompt gives the model no explicit instruction to enumerate and verify each fact before writing."),
      gap(),

      h2("4.3  Production Recommendation"),
      body("Recommendation: Deploy Strategy A (Advanced Prompting) for production.", { bold: true }),
      gap(),

      body("Justification based on metric data:"),
      bullet("Fact Recall +12.5% over Strategy B. In professional email communication, missing a key fact can undermine trust, require follow-up, or cause misunderstandings. A 10-point gap in fact coverage is a material quality difference."),
      bullet("Tone Accuracy is nearly equivalent (0.95 vs 0.94), confirming that the advanced prompt does not over-constrain the model's natural language quality."),
      bullet("Email Structure is perfect for both strategies (1.00), confirming that adding the Role + Few-Shot + CoT scaffold does not introduce structural regressions."),
      bullet("The composite score of 0.9500 vs 0.9100 reflects a meaningful overall improvement at no additional cost — both strategies use the same model (gemini-2.0-flash) and the only difference is the prompt."),
      gap(),

      body("The advanced prompt's chain-of-thought scaffold is particularly valuable for high-stakes professional email scenarios: escalations, partnership proposals, and deadline requests — precisely the emails where accuracy and completeness matter most. The small increase in prompt token count is a worthwhile trade-off for the reliability gains demonstrated by the evaluation data."),
      gap(),

      body("For future improvements, the evaluation data suggests addressing the casual-tone fact-recall weakness (Scenario 9, score 0.80 for Strategy A) by expanding the few-shot examples to include at least one casual, fact-dense scenario."),
    ],
  }],
});

Packer.toBuffer(doc).then(buffer => {
  const outPath = path.join(__dirname, "Email_Generation_Assistant_Report.docx");
  fs.writeFileSync(outPath, buffer);
  console.log("Report written to:", outPath);
}).catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
