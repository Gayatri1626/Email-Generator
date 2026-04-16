"""
Email generator – wraps the Google GenAI SDK (google-genai).

Usage
-----
from generator import generate_email
from prompts import build_advanced_prompt, build_basic_prompt

email = generate_email(build_advanced_prompt, scenario, model="gemini-2.0-flash")
"""

from google import genai
from google.genai import types
from config import GOOGLE_API_KEY, MAX_TOKENS_GENERATION

_client = genai.Client(api_key=GOOGLE_API_KEY)


def generate_email(prompt_builder, scenario: dict, model: str) -> str:
    """
    Generate an email for a given scenario using the provided prompt strategy.

    Parameters
    ----------
    prompt_builder : callable
        A function that accepts (intent, facts, tone) and returns
        {"system": str, "user": str}.
    scenario : dict
        A single test-scenario dict with keys: intent, key_facts, tone.
    model : str
        The Gemini model ID to use (e.g. "gemini-2.0-flash").

    Returns
    -------
    str
        The raw text of the generated email (subject + body).
    """
    prompt = prompt_builder(
        intent=scenario["intent"],
        facts=scenario["key_facts"],
        tone=scenario["tone"],
    )

    response = _client.models.generate_content(
        model=model,
        contents=prompt["user"],
        config=types.GenerateContentConfig(
            system_instruction=prompt["system"],
            max_output_tokens=MAX_TOKENS_GENERATION,
            temperature=0.7,
        ),
    )
    return response.text.strip()
