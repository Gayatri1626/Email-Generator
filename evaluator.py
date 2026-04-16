"""
Three custom evaluation metrics for the Email Generation Assistant.

Metric 1 – Fact Recall Score  (automated)
    Measures what proportion of the key facts stated in the input are
    present in the generated email.  Each fact phrase is split into
    meaningful keywords; a fact is considered "covered" if the majority
    of its keywords appear in the email (case-insensitive).
    Score range: 0.0 – 1.0

Metric 2 – Tone Accuracy Score  (LLM-as-Judge)
    Asks the judge model to rate, on a scale of 1–10, how closely the
    generated email's tone matches the requested tone.
    Score range: 0.0 – 1.0  (raw rating / 10)

Metric 3 – Email Structure Score  (automated / rule-based)
    Checks that the email contains the structural elements expected of a
    professional email: a subject line, a salutation, a substantive body,
    and a closing.  Also penalises emails that are excessively short
    (< 50 words) or extremely long (> 450 words).
    Score range: 0.0 – 1.0
"""

import re
from google import genai
from google.genai import types
from config import GOOGLE_API_KEY, JUDGE_MODEL, MAX_TOKENS_JUDGE

_client = genai.Client(api_key=GOOGLE_API_KEY)

# ---------------------------------------------------------------------------
# Metric 1: Fact Recall Score
# ---------------------------------------------------------------------------
_STOP_WORDS = {
    "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "is", "are", "was", "were", "be", "been", "has",
    "have", "had", "will", "would", "it", "its", "this", "that", "we",
    "our", "i", "my", "your", "their", "per",
}


def _extract_keywords(text: str) -> set:
    """Lowercase, strip punctuation, remove stop words."""
    tokens = re.findall(r"[a-z0-9]+", text.lower())
    return {t for t in tokens if t not in _STOP_WORDS and len(t) > 1}


def fact_recall_score(generated_email: str, key_facts: str) -> float:
    """
    Definition
    ----------
    Each pipe-separated fact phrase in key_facts is converted to a keyword set.
    A fact is "covered" when at least 60 % of its keywords appear anywhere in
    the generated email.  The final score is:
        covered_facts / total_facts

    Logic
    -----
    1. Split key_facts on '|' to get individual fact phrases.
    2. For each fact, extract keywords (ignoring stop words).
    3. Check what fraction of those keywords appear in the email's keyword set.
    4. Mark fact as covered if fraction >= 0.6.
    5. Return covered / total.
    """
    facts = [f.strip() for f in key_facts.split("|") if f.strip()]
    if not facts:
        return 1.0

    email_keywords = _extract_keywords(generated_email)
    covered = 0

    for fact in facts:
        fact_keywords = _extract_keywords(fact)
        if not fact_keywords:
            covered += 1
            continue
        overlap = len(fact_keywords & email_keywords) / len(fact_keywords)
        if overlap >= 0.6:
            covered += 1

    return round(covered / len(facts), 4)


# ---------------------------------------------------------------------------
# Metric 2: Tone Accuracy Score  (LLM-as-Judge via Gemini)
# ---------------------------------------------------------------------------
_TONE_JUDGE_PROMPT = """\
You are an expert evaluator of professional email communication.

Your task: rate how accurately the GENERATED EMAIL reflects the requested tone.

Requested tone : {tone}
Generated email:
\"\"\"
{email}
\"\"\"

On a scale from 1 (completely wrong tone) to 10 (perfect tone match), give a
single integer rating.  Output ONLY the integer — no explanation, no punctuation.
"""


def tone_accuracy_score(generated_email: str, requested_tone: str) -> float:
    """
    Definition
    ----------
    The judge model (gemini-2.0-flash) rates how well the generated email's
    tone matches the requested tone on a 1–10 integer scale.
    Final score = raw_rating / 10.

    Logic
    -----
    1. Build a zero-shot judge prompt with the email and the requested tone.
    2. Call the judge model and parse the integer from its response.
    3. Clamp to [1, 10] for robustness, then normalise to [0.1, 1.0].
    """
    prompt = _TONE_JUDGE_PROMPT.format(tone=requested_tone, email=generated_email)

    response = _client.models.generate_content(
        model=JUDGE_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            max_output_tokens=MAX_TOKENS_JUDGE,
            temperature=0.0,
        ),
    )
    raw = response.text.strip()

    match = re.search(r"\d+", raw)
    if match:
        rating = int(match.group())
        rating = max(1, min(10, rating))
    else:
        rating = 5  # fallback neutral
    return round(rating / 10, 4)


# ---------------------------------------------------------------------------
# Metric 3: Email Structure Score  (automated / rule-based)
# ---------------------------------------------------------------------------
_SALUTATION_PATTERN = re.compile(
    r"\b(dear|hi|hello|greetings|to whom it may concern)\b", re.IGNORECASE
)
_CLOSING_PATTERN = re.compile(
    r"\b(regards|sincerely|kind regards|best regards|yours|thank you|thanks|"
    r"warm regards|warmly|cheers)\b",
    re.IGNORECASE,
)
_SUBJECT_PATTERN = re.compile(r"^subject\s*:", re.IGNORECASE | re.MULTILINE)


def email_structure_score(generated_email: str) -> float:
    """
    Definition
    ----------
    Checks for four structural components of a professional email plus an
    appropriate word-count range.  Each component contributes 0.2 to the score:
        1. Subject line present       (+0.2)
        2. Salutation present         (+0.2)
        3. Substantive body           (+0.2)  — body text > 30 words
        4. Closing phrase present     (+0.2)
        5. Appropriate length         (+0.2)  — 50 ≤ word_count ≤ 450

    Logic
    -----
    Apply regex checks and word-count checks; sum the component scores.
    """
    score = 0.0
    word_count = len(generated_email.split())

    # 1. Subject line
    if _SUBJECT_PATTERN.search(generated_email):
        score += 0.2

    # 2. Salutation
    if _SALUTATION_PATTERN.search(generated_email):
        score += 0.2

    # 3. Substantive body (at least 30 words excluding subject line)
    body_text = re.sub(r"(?i)^subject[^\n]*\n", "", generated_email, count=1).strip()
    if len(body_text.split()) > 30:
        score += 0.2

    # 4. Professional closing
    if _CLOSING_PATTERN.search(generated_email):
        score += 0.2

    # 5. Appropriate length
    if 50 <= word_count <= 450:
        score += 0.2

    return round(score, 4)


# ---------------------------------------------------------------------------
# Convenience wrapper – run all three metrics at once
# ---------------------------------------------------------------------------
def evaluate(generated_email: str, scenario: dict) -> dict:
    """
    Run all three metrics for a single generated email.

    Returns a dict:
        {
            "fact_recall":      float,
            "tone_accuracy":    float,
            "email_structure":  float,
            "composite":        float,   # simple average of all three
        }
    """
    fr = fact_recall_score(generated_email, scenario["key_facts"])
    ta = tone_accuracy_score(generated_email, scenario["tone"])
    es = email_structure_score(generated_email)
    composite = round((fr + ta + es) / 3, 4)

    return {
        "fact_recall":     fr,
        "tone_accuracy":   ta,
        "email_structure": es,
        "composite":       composite,
    }
