"""
Prompt strategies for the Email Generation Assistant.

Strategy A – Advanced Prompting
    Combines three techniques:
    1. Role-Playing   : The system prompt assigns Claude an expert persona.
    2. Few-Shot        : Two worked examples anchor the expected format and quality.
    3. Chain-of-Thought: The model is asked to reason step-by-step before drafting.

Strategy B – Basic Prompting
    A single, minimal instruction with no persona, examples, or reasoning scaffold.
    Used as the baseline for comparison.
"""

# ---------------------------------------------------------------------------
# Few-shot examples embedded in the advanced prompt
# ---------------------------------------------------------------------------
FEW_SHOT_EXAMPLES = """
--- EXAMPLE 1 ---
INPUT
  Intent    : Thank a client after a successful product demo
  Key Facts : Demo held last Thursday | Showcased inventory module | Client loved the
              reporting dashboard | Next step: send commercial proposal by Friday
  Tone      : Formal

REASONING
  1. Recipient: a business client who attended a product demo
  2. Structure: subject → greeting → thanks + highlight → next step → professional close
  3. Tone cues: "Dear", formal sentence structure, no contractions, polished close

OUTPUT
Subject: Thank You for Attending Our Product Demo

Dear [Client Name],

Thank you for taking the time to join us last Thursday for the product demonstration.
It was a pleasure to walk you through our inventory management module and to hear your
enthusiasm for the reporting dashboard.

As discussed, I will prepare and send across our commercial proposal by this Friday.
Please do not hesitate to reach out if you have any questions in the meantime.

Kind regards,
[Your Name]

--- EXAMPLE 2 ---
INPUT
  Intent    : Check in with a colleague about project progress
  Key Facts : Project deadline is next Monday | Two tasks still outstanding (API integration,
              QA sign-off) | Offer to help if needed
  Tone      : Casual

REASONING
  1. Recipient: a colleague, familiar relationship
  2. Structure: friendly opener → state purpose → specific asks → supportive close
  3. Tone cues: first-name basis, contractions allowed, conversational sign-off

OUTPUT
Subject: Quick Check-In – Project Status

Hi [Name],

Hope you're doing well! I wanted to touch base about the project since we're heading
into the final stretch before Monday's deadline.

I know the API integration and QA sign-off are still in progress – let me know if
there's anything I can do to help push those across the finish line.

Thanks, and talk soon!
[Your Name]
"""

# ---------------------------------------------------------------------------
# Advanced prompt builder  (Strategy A)
# ---------------------------------------------------------------------------
ADVANCED_SYSTEM_PROMPT = (
    "You are an expert business-communication specialist with 20 years of experience "
    "drafting professional emails across industries. Your emails are always clear, "
    "appropriately toned, and include every required piece of information — nothing "
    "superfluous, nothing missing. You follow the user's instructions precisely."
)

ADVANCED_USER_TEMPLATE = """\
Below are two worked examples that show the expected reasoning and output format.
{examples}
---

Now complete the following task using the SAME format.

INPUT
  Intent    : {intent}
  Key Facts : {facts}
  Tone      : {tone}

Think step-by-step (label this section REASONING), then write the email (label it OUTPUT).
Your OUTPUT must contain:
  • A subject line starting with "Subject:"
  • A salutation (Dear / Hi / Hello …)
  • A body that weaves in every key fact naturally
  • A professional closing and placeholder signature

REASONING
"""

def build_advanced_prompt(intent: str, facts: str, tone: str) -> dict:
    """Return a dict with 'system' and 'user' keys for the advanced strategy."""
    user_content = ADVANCED_USER_TEMPLATE.format(
        examples=FEW_SHOT_EXAMPLES,
        intent=intent,
        facts=facts,
        tone=tone,
    )
    return {"system": ADVANCED_SYSTEM_PROMPT, "user": user_content}


# ---------------------------------------------------------------------------
# Basic prompt builder  (Strategy B)
# ---------------------------------------------------------------------------
BASIC_USER_TEMPLATE = """\
Write a professional email.

Intent    : {intent}
Key Facts : {facts}
Tone      : {tone}

Include a subject line, greeting, body, and closing.
"""

def build_basic_prompt(intent: str, facts: str, tone: str) -> dict:
    """Return a dict with 'system' and 'user' keys for the basic strategy."""
    return {
        "system": "You are a helpful assistant.",
        "user": BASIC_USER_TEMPLATE.format(intent=intent, facts=facts, tone=tone),
    }
