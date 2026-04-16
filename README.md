# Email Generation Assistant

An AI-powered assistant that generates professional emails from structured inputs, with a custom evaluation framework to compare prompting strategies.

---

## Project Structure

```
Email-Generator/
├── config.py               # API key loading & model constants
├── prompts.py              # Prompt strategies (advanced & basic)
├── generator.py            # Google Generative AI SDK wrapper
├── evaluator.py            # 3 custom evaluation metrics
├── run_evaluation.py       # Main script – runs both strategies & writes results
├── requirements.txt
├── .env.example
├── data/
│   └── test_scenarios.json # 10 test scenarios + human reference emails
└── results/                # Created automatically on first run
    ├── evaluation_results.csv
    └── evaluation_results.json
```

---

## Setup

### 1. Clone / download the repository

```bash
git clone <repo-url>
cd Email-Generator
```

### 2. Create a virtual environment (recommended)

```bash
python -m venv venv
# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Set your API key

```bash
cp .env.example .env
# Open .env and set:  GOOGLE_API_KEY=AIza...
# Get your key at: https://aistudio.google.com/app/apikey
```

### 5. Run the evaluation

```bash
python run_evaluation.py
```

Results are written to `results/evaluation_results.csv` and `results/evaluation_results.json`.

---

## Prompt Template

### Strategy A – Advanced Prompting (Role + Few-Shot + Chain-of-Thought)

**System prompt (Role-Playing)**
> "You are an expert business-communication specialist with 20 years of experience drafting professional emails across industries…"

**User prompt structure**
```
[Two worked examples showing INPUT → REASONING → OUTPUT]

INPUT
  Intent    : {intent}
  Key Facts : {key_facts}
  Tone      : {tone}

Think step-by-step (label this section REASONING), then write the email (label it OUTPUT).
Your OUTPUT must contain: subject line, salutation, body, professional closing.
```

The three techniques work together:
| Technique | Purpose |
|-----------|---------|
| Role-Playing | Primes the model to apply professional communication expertise |
| Few-Shot Examples | Anchors format, length, and quality expectations with concrete samples |
| Chain-of-Thought | Forces the model to reason about recipient, structure, and tone before drafting |

### Strategy B – Basic Prompting (baseline)

```
Write a professional email.

Intent    : {intent}
Key Facts : {key_facts}
Tone      : {tone}

Include a subject line, greeting, body, and closing.
```

No persona, no examples, no reasoning scaffold. Used as the comparison baseline.

---

## Custom Evaluation Metrics

### Metric 1 – Fact Recall Score *(automated)*

**Definition:** What fraction of the input key-facts are present in the generated email?

**Logic:**
1. Split `key_facts` on `|` to get individual fact phrases.
2. Tokenise each fact, remove stop words → keyword set.
3. A fact is **covered** when ≥ 60 % of its keywords appear in the email text.
4. Score = `covered_facts / total_facts`

**Range:** 0.0 – 1.0 (higher = more facts included)

---

### Metric 2 – Tone Accuracy Score *(LLM-as-Judge)*

**Definition:** How closely does the generated email's tone match the requested tone?

**Logic:**
1. Send the generated email and the requested tone to `gemini-2.0-flash` with a zero-shot judge prompt.
2. The judge outputs a single integer rating from 1 (wrong tone) to 10 (perfect match).
3. Score = `raw_rating / 10`

**Range:** 0.0 – 1.0 (higher = better tone match)

---

### Metric 3 – Email Structure Score *(automated / rule-based)*

**Definition:** Does the email contain the four structural elements of a professional email, and is it an appropriate length?

**Logic:**  
Each component contributes 0.2 to the score:
| Component | Check |
|-----------|-------|
| Subject line | Regex: `^Subject:` |
| Salutation | Regex: `Dear / Hi / Hello / Greetings` |
| Substantive body | Body word count > 30 |
| Professional closing | Regex: `Regards / Sincerely / Thanks / Warmly` etc. |
| Appropriate length | 50 ≤ total word count ≤ 450 |

**Range:** 0.0 – 1.0 (higher = better structure)

---

## Model Comparison & Analysis

Both strategies use `gemini-2.0-flash`. The comparison isolates the effect of **prompting quality** rather than model capability.

After running `run_evaluation.py`, see the printed summary table and the saved CSV/JSON for:
- Raw scores for all 10 scenarios across all 3 metrics
- Per-strategy averages
- Composite score (simple mean of the three metrics)

A written comparative analysis is included in the Final Report (see Deliverables).

---

## Deliverables

| Item | Location |
|------|----------|
| Source code | This repository |
| Prompt template | `prompts.py` + this README |
| Metric definitions | `evaluator.py` + this README |
| Raw evaluation data (CSV) | `results/evaluation_results.csv` |
| Raw evaluation data (JSON) | `results/evaluation_results.json` |
| Comparative analysis | Final Report (PDF/Google Doc) |
