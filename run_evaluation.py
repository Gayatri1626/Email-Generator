"""
Main evaluation script.

Usage
-----
    python run_evaluation.py

What it does
------------
1. Loads all 10 test scenarios from data/test_scenarios.json.
2. Generates emails for each scenario using BOTH strategies:
     Strategy A – advanced prompt  (Role + Few-Shot + Chain-of-Thought)
     Strategy B – basic prompt     (minimal instruction)
3. Evaluates each generated email with the three custom metrics:
     - Fact Recall Score      (automated keyword-overlap)
     - Tone Accuracy Score    (LLM-as-Judge)
     - Email Structure Score  (automated rule-based)
4. Writes two output files to results/:
     evaluation_results.csv   – one row per scenario × strategy
     evaluation_results.json  – same data with extra fields (generated email text)
5. Prints a summary comparison table to stdout.
"""

import json
import os
import time
import pandas as pd

from config import MODEL_ADVANCED, MODEL_BASIC
from prompts import build_advanced_prompt, build_basic_prompt
from generator import generate_email
from evaluator import evaluate

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
SCENARIOS_PATH = os.path.join(os.path.dirname(__file__), "data", "test_scenarios.json")
RESULTS_DIR    = os.path.join(os.path.dirname(__file__), "results")
CSV_PATH       = os.path.join(RESULTS_DIR, "evaluation_results.csv")
JSON_PATH      = os.path.join(RESULTS_DIR, "evaluation_results.json")

os.makedirs(RESULTS_DIR, exist_ok=True)


# ---------------------------------------------------------------------------
# Strategy registry
# ---------------------------------------------------------------------------
STRATEGIES = [
    {
        "name":           "Strategy A – Advanced (Role + Few-Shot + CoT)",
        "prompt_builder": build_advanced_prompt,
        "model":          MODEL_ADVANCED,
    },
    {
        "name":           "Strategy B – Basic (Minimal Prompt)",
        "prompt_builder": build_basic_prompt,
        "model":          MODEL_BASIC,
    },
]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    with open(SCENARIOS_PATH, encoding="utf-8") as f:
        scenarios = json.load(f)

    all_rows  = []   # flat records for CSV
    full_data = []   # full records (include email text) for JSON

    print("=" * 70)
    print("Email Generation Assistant – Evaluation Run")
    print("=" * 70)

    for strategy in STRATEGIES:
        print(f"\n>>> Running: {strategy['name']}")
        print("-" * 60)

        for scenario in scenarios:
            sid = scenario["id"]
            print(f"  Scenario {sid:02d} | tone={scenario['tone']:<12} | intent={scenario['intent'][:40]}...")

            # Generate
            try:
                email_text = generate_email(
                    prompt_builder=strategy["prompt_builder"],
                    scenario=scenario,
                    model=strategy["model"],
                )
            except Exception as exc:
                print(f"    [ERROR] Generation failed: {exc}")
                email_text = ""

            # Evaluate
            try:
                scores = evaluate(email_text, scenario)
            except Exception as exc:
                print(f"    [ERROR] Evaluation failed: {exc}")
                scores = {
                    "fact_recall":     0.0,
                    "tone_accuracy":   0.0,
                    "email_structure": 0.0,
                    "composite":       0.0,
                }

            print(
                f"    fact_recall={scores['fact_recall']:.2f}  "
                f"tone_accuracy={scores['tone_accuracy']:.2f}  "
                f"email_structure={scores['email_structure']:.2f}  "
                f"composite={scores['composite']:.2f}"
            )

            flat_row = {
                "strategy":          strategy["name"],
                "scenario_id":       sid,
                "intent":            scenario["intent"],
                "tone":              scenario["tone"],
                "fact_recall":       scores["fact_recall"],
                "tone_accuracy":     scores["tone_accuracy"],
                "email_structure":   scores["email_structure"],
                "composite":         scores["composite"],
            }
            all_rows.append(flat_row)

            full_data.append({
                **flat_row,
                "generated_email": email_text,
                "reference_email": scenario["reference_email"],
            })

            # Small pause to avoid rate-limit bursts
            time.sleep(0.5)

    # ---------------------------------------------------------------------------
    # Save outputs
    # ---------------------------------------------------------------------------
    df = pd.DataFrame(all_rows)
    df.to_csv(CSV_PATH, index=False)
    print(f"\n[+] CSV saved  → {CSV_PATH}")

    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(full_data, f, indent=2, ensure_ascii=False)
    print(f"[+] JSON saved → {JSON_PATH}")

    # ---------------------------------------------------------------------------
    # Summary table
    # ---------------------------------------------------------------------------
    print("\n" + "=" * 70)
    print("SUMMARY – Average Scores per Strategy")
    print("=" * 70)

    metric_cols = ["fact_recall", "tone_accuracy", "email_structure", "composite"]
    summary = df.groupby("strategy")[metric_cols].mean().round(4)
    print(summary.to_string())

    print("\n" + "=" * 70)
    print("METRIC DEFINITIONS")
    print("=" * 70)
    definitions = {
        "fact_recall": (
            "Automated | Fraction of input key-facts whose keywords (≥60% overlap) "
            "appear in the generated email. Range: 0–1."
        ),
        "tone_accuracy": (
            "LLM-as-Judge | claude-sonnet-4-6 rates tone match 1–10; normalised to 0–1. "
            "Range: 0–1."
        ),
        "email_structure": (
            "Automated rule-based | Checks subject line, salutation, substantive body, "
            "professional closing, and appropriate word count (50–450 words). Range: 0–1."
        ),
        "composite": (
            "Simple average of the three metrics above. Range: 0–1."
        ),
    }
    for metric, defn in definitions.items():
        print(f"\n  {metric}:\n    {defn}")

    print("\n[Done]")


if __name__ == "__main__":
    main()
