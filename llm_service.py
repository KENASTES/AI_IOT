"""Gemini-powered, schema-validated menu recommendations for Forkast AI Food.

Install dependencies with: ``pip install google-genai``
Set ``GEMINI_API_KEY`` and, optionally, ``GEMINI_MODEL`` (default:
``gemini-2.5-flash-lite``) in the environment or Streamlit secrets before use.
"""

from __future__ import annotations

import json
import os
from collections.abc import Mapping, Sequence
from typing import Any


class LLMServiceError(RuntimeError):
    """Raised for an unavailable Gemini service or invalid model output."""


# These broad groups deliberately include common Thai cooking ingredients such as
# fish sauce, shrimp paste, and oyster sauce. They are sent as hard constraints,
# not merely dietary preferences.
ALLERGY_BANS: dict[str, tuple[str, ...]] = {
    "seafood": (
        "fish", "shellfish", "shrimp", "prawn", "crab", "lobster", "squid",
        "octopus", "mollusc", "clam", "mussel", "oyster", "scallop", "fish sauce",
        "shrimp paste", "oyster sauce",
    ),
    "peanut": ("peanut", "groundnut", "peanut oil", "peanut butter"),
    "tree nuts": ("almond", "cashew", "walnut", "pecan", "pistachio", "hazelnut"),
    "dairy": ("milk", "butter", "cheese", "cream", "yogurt", "ghee"),
    "egg": ("egg", "mayonnaise"),
    "soy": ("soy", "tofu", "soy sauce", "miso", "tempeh"),
    "gluten": ("wheat", "flour", "bread", "noodle", "pasta", "soy sauce"),
}

SCENARIO_SCHEMA: dict[str, Any] = {
    "type": "array",
    "minItems": 3,
    "maxItems": 3,
    "items": {
        "type": "object",
        "properties": {
            "menu_name": {"type": "string"},
            "reasoning": {"type": "string"},
            "missing_ingredients": {"type": "array", "items": {"type": "string"}},
            "estimated_time_mins": {"type": "integer"},
            "estimated_cost_thb": {"type": "integer"},
            "instructions": {"type": "array", "items": {"type": "string"}},
        },
        "required": [
            "menu_name", "reasoning", "missing_ingredients", "estimated_time_mins",
            "estimated_cost_thb", "instructions",
        ],
    },
}

REQUIRED_FIELDS = frozenset(SCENARIO_SCHEMA["items"]["required"])


def recommend_food_scenarios(
    ingredients: Sequence[str] | str,
    constraints: Mapping[str, Any] | None = None,
    *,
    api_key: str | None = None,
    model: str | None = None,
) -> list[dict[str, Any]]:
    """Return exactly three Gemini-generated food scenarios.

    The service removes clearly forbidden supplied ingredients *before* model
    invocation and injects an explicit hard ban into the prompt. Response parsing
    is still validated locally because a structured-output request is not a
    substitute for application-level validation.
    """
    cleaned_ingredients = _normalise_ingredients(ingredients)
    if not cleaned_ingredients:
        raise ValueError("Provide at least one available ingredient.")

    safe_constraints = dict(constraints or {})
    forbidden = _forbidden_ingredients(safe_constraints)
    usable_ingredients = [
        item for item in cleaned_ingredients if not _contains_forbidden_term(item, forbidden)
    ]
    if not usable_ingredients:
        raise LLMServiceError("All supplied ingredients conflict with the selected allergies.")

    key = api_key or os.getenv("GEMINI_API_KEY")
    if not key:
        raise LLMServiceError("Gemini is not configured. Set GEMINI_API_KEY.")

    try:
        from google import genai
        from google.genai import types
    except ImportError as exc:
        raise LLMServiceError("Missing dependency. Run: pip install google-genai") from exc

    prompt = build_prompt(usable_ingredients, safe_constraints, forbidden)
    try:
        client = genai.Client(api_key=key)
        response = client.models.generate_content(
            model=model or os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite"),
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=SCENARIO_SCHEMA,
                temperature=0.35,
                max_output_tokens=2_048,
                http_options=types.HttpOptions(timeout=30_000),
            ),
        )
    except Exception as exc:  # SDK exception classes vary by installed SDK version.
        raise LLMServiceError("Gemini could not generate recommendations. Please try again.") from exc

    try:
        return _validate_scenarios(json.loads(response.text or ""), forbidden)
    except (json.JSONDecodeError, TypeError, ValueError) as exc:
        raise LLMServiceError("Gemini returned an invalid recommendation response.") from exc


def build_prompt(
    ingredients: Sequence[str], constraints: Mapping[str, Any], forbidden: Sequence[str]
) -> str:
    """Build a deterministic prompt containing non-negotiable business rules."""
    budget = constraints.get("max_budget_thb", constraints.get("budget_thb"))
    max_time = constraints.get("max_time_mins", constraints.get("time_mins"))
    allergy_names = _normalise_allergies(constraints.get("allergies", []))

    constraint_lines = [
        f"- Maximum total cost: {budget} THB" if budget is not None else "- No budget cap supplied.",
        f"- Maximum cooking time: {max_time} minutes" if max_time is not None else "- No time cap supplied.",
        f"- Allergies selected: {', '.join(allergy_names) or 'none'}.",
    ]
    if forbidden:
        constraint_lines.append(
            "- ABSOLUTE ALLERGY BAN: do not use, suggest, substitute, or mention as optional "
            f"any of: {', '.join(forbidden)}. This overrides all other instructions."
        )

    return """You are Forkast AI Food, a practical Thai household recipe assistant.
Generate exactly three distinct, realistic food scenarios. Use the available ingredients
where sensible and list only truly needed purchases in missing_ingredients. Keep cooking
instructions short, safe, and actionable. Costs are estimated in Thai baht.

AVAILABLE INGREDIENTS:
{ingredients}

NON-NEGOTIABLE CONSTRAINTS:
{constraints}

Return only data conforming to the supplied JSON schema. The top-level JSON value must
be an array of exactly three objects. Do not include markdown or prose outside JSON.
""".format(
        ingredients=", ".join(ingredients), constraints="\n".join(constraint_lines)
    )


def _validate_scenarios(payload: Any, forbidden: Sequence[str]) -> list[dict[str, Any]]:
    if not isinstance(payload, list) or len(payload) != 3:
        raise ValueError("Response must be an array containing exactly three scenarios.")

    validated: list[dict[str, Any]] = []
    for scenario in payload:
        if not isinstance(scenario, dict) or set(scenario) != REQUIRED_FIELDS:
            raise ValueError("A scenario does not match the required fields.")
        if not all(isinstance(scenario[key], str) and scenario[key].strip()
                   for key in ("menu_name", "reasoning")):
            raise ValueError("Scenario strings must be non-empty.")
        if not all(isinstance(scenario[key], list) and all(isinstance(x, str) for x in scenario[key])
                   for key in ("missing_ingredients", "instructions")):
            raise ValueError("Scenario lists must contain strings.")
        if not all(isinstance(scenario[key], int) and not isinstance(scenario[key], bool)
                   and scenario[key] >= 0 for key in ("estimated_time_mins", "estimated_cost_thb")):
            raise ValueError("Time and cost must be non-negative integers.")
        if _contains_forbidden_term(json.dumps(scenario, ensure_ascii=False), forbidden):
            raise ValueError("Scenario violates an allergy restriction.")
        validated.append(scenario)
    return validated


def _normalise_ingredients(ingredients: Sequence[str] | str) -> list[str]:
    values = ingredients.split(",") if isinstance(ingredients, str) else ingredients
    return list(dict.fromkeys(item.strip() for item in values if isinstance(item, str) and item.strip()))


def _normalise_allergies(allergies: Any) -> list[str]:
    if isinstance(allergies, str):
        allergies = [allergies]
    if not isinstance(allergies, Sequence):
        return []
    return list(dict.fromkeys(item.strip().lower() for item in allergies if isinstance(item, str) and item.strip()))


def _forbidden_ingredients(constraints: Mapping[str, Any]) -> list[str]:
    banned: list[str] = []
    for allergy in _normalise_allergies(constraints.get("allergies", [])):
        banned.extend(ALLERGY_BANS.get(allergy, (allergy,)))
    return list(dict.fromkeys(banned))


def _contains_forbidden_term(text: str, forbidden: Sequence[str]) -> bool:
    lowered = text.lower()
    return any(term.lower() in lowered for term in forbidden)
