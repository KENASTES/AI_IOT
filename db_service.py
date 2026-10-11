"""MongoDB persistence for saved Forkast food scenarios.

Configuration is read from environment variables so credentials never belong in
source code:
    MONGODB_URI          Required MongoDB connection string.
    MONGODB_DATABASE     Optional; defaults to ``forkast_ai_food``.
    MONGODB_COLLECTION   Optional; defaults to ``saved_scenarios``.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Mapping, Sequence

from pymongo import ASCENDING, MongoClient
from pymongo.collection import Collection
from pymongo.errors import ConfigurationError, PyMongoError, ServerSelectionTimeoutError


class DatabaseServiceError(RuntimeError):
    """Raised when a Food Memory operation cannot be completed."""


class MongoFoodMemory:
    """Small, reusable repository for the application's Food Memory feature."""

    def __init__(
        self,
        mongo_uri: str | None = None,
        database_name: str | None = None,
        collection_name: str | None = None,
        server_selection_timeout_ms: int = 5_000,
    ) -> None:
        uri = mongo_uri or os.getenv("MONGODB_URI")
        if not uri:
            raise DatabaseServiceError(
                "MongoDB is not configured. Set the MONGODB_URI environment variable."
            )

        self._database_name = database_name or os.getenv(
            "MONGODB_DATABASE", "forkast_ai_food"
        )
        self._collection_name = collection_name or os.getenv(
            "MONGODB_COLLECTION", "saved_scenarios"
        )

        try:
            self._client = MongoClient(
                uri,
                serverSelectionTimeoutMS=server_selection_timeout_ms,
                connectTimeoutMS=server_selection_timeout_ms,
                retryWrites=True,
            )
            # Fail early with a clear error instead of failing only after the user
            # presses Save in the UI.
            self._client.admin.command("ping")
            self._collection: Collection[dict[str, Any]] = self._client[
                self._database_name
            ][self._collection_name]
            self._ensure_indexes()
        except (ConfigurationError, ServerSelectionTimeoutError, PyMongoError) as exc:
            raise DatabaseServiceError("Could not connect to MongoDB.") from exc

    def _ensure_indexes(self) -> None:
        """Create an index used by a future Food Memory/history screen."""
        try:
            self._collection.create_index(
                [("saved_at", ASCENDING)], name="saved_at_ascending"
            )
        except PyMongoError as exc:
            raise DatabaseServiceError("Could not prepare MongoDB indexes.") from exc

    def save_scenario(
        self,
        scenario: Mapping[str, Any],
        initial_ingredients: Sequence[str] | str,
        constraints: Mapping[str, Any] | None = None,
    ) -> str:
        """Insert one selected scenario and return its MongoDB document id.

        ``scenario`` is deliberately stored as the complete model response. This
        preserves the menu, estimates, and instructions shown to the user at the
        time they saved it.
        """
        if not isinstance(scenario, Mapping) or not scenario.get("menu_name"):
            raise ValueError("scenario must contain a non-empty 'menu_name'.")

        ingredients = _normalise_ingredients(initial_ingredients)
        if not ingredients:
            raise ValueError("At least one initial ingredient is required.")

        document = {
            "scenario": dict(scenario),
            "initial_ingredients": ingredients,
            "constraints": dict(constraints or {}),
            "saved_at": datetime.now(timezone.utc),
        }
        try:
            result = self._collection.insert_one(document)
        except PyMongoError as exc:
            raise DatabaseServiceError("Could not save the food scenario.") from exc
        return str(result.inserted_id)

    def close(self) -> None:
        """Release MongoDB client resources (useful on application shutdown)."""
        self._client.close()


def _normalise_ingredients(ingredients: Sequence[str] | str) -> list[str]:
    """Convert a comma-separated input or sequence into clean, unique values."""
    values = ingredients.split(",") if isinstance(ingredients, str) else ingredients
    return list(dict.fromkeys(item.strip() for item in values if item and item.strip()))
