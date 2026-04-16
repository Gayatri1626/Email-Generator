import os
from dotenv import load_dotenv

load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    raise EnvironmentError("GOOGLE_API_KEY not set. Copy .env.example to .env and fill in your key.")

# Generation models
MODEL_ADVANCED = "gemini-2.0-flash"   # Strategy A: advanced prompting
MODEL_BASIC    = "gemini-2.0-flash"   # Strategy B: basic prompting (same model, different prompt)

# Evaluation judge model
JUDGE_MODEL = "gemini-2.0-flash"

MAX_TOKENS_GENERATION = 600
MAX_TOKENS_JUDGE      = 256
