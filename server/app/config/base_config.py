from __future__ import annotations

from typing import Any, Optional, cast
from dotenv import load_dotenv
from pydantic import BaseModel, Field, SecretStr
import os

from .config_loader import CONFIG

_env_loaded = False


def ensure_env_loaded():
        global _env_loaded
        if not _env_loaded:
                load_dotenv(override=True)
                _env_loaded = True


# ===============================
# CONFIG MODELS (provider and model from config.yaml; env for secrets)
# ===============================


def _secret_from_env_optional(name: str) -> SecretStr:
        ensure_env_loaded()
        val = os.getenv(name, "")
        return SecretStr(val or "")


class ChatConfig(BaseModel):
        provider: Optional[str] = None
        api_key: SecretStr = Field(
                default_factory=lambda: _secret_from_env_optional("GROQ_API_KEY")
        )
        model: str = Field(default="llama-3.1-8b-instant")
        kwargs: dict[str, Any] = Field(default_factory=dict)


class PromptConfig(BaseModel):
        """Configuration for system prompts"""

        system_prompt: str = Field(default="")
        # rewrite_prompt: str = Field(default="")
        # validate_prompt: str = Field(default="")


# ===============================
# CONFIG MANAGER
# ===============================


class ConfigManager:
        _instance = None

        # Config instances
        _chat_model_config: Optional[ChatConfig] = None
        _prompt_config: Optional[PromptConfig] = None

        def __new__(cls):
                if cls._instance is None:
                        cls._instance = super(ConfigManager, cls).__new__(cls)
                        cls._instance._initialize_configs()
                return cls._instance

        def _initialize_configs(self):
                """Initialize all configuration objects once"""
                ensure_env_loaded()
                config_data: dict[str, Any] = CONFIG if CONFIG else {}

                # ---------------- CHAT CONFIG ----------------
                chat_raw: Any = config_data.get("chat_model_config", {})
                chat_data: dict[str, Any] = (
                        cast(dict[str, Any], chat_raw)
                        if isinstance(chat_raw, dict)
                        else {}
                )
                provider = str(chat_data.get("provider") or "groq").strip().lower()
                model = str(
                        chat_data.get("model")
                        or chat_data.get("review_model")
                        or "llama-3.1-8b-instant"
                )
                kwargs_raw: Any = chat_data.get("kwargs", {})
                kwargs: dict[str, Any] = (
                        cast(dict[str, Any], kwargs_raw)
                        if isinstance(kwargs_raw, dict)
                        else {}
                )

                self._chat_model_config = ChatConfig(
                        provider=provider,
                        model=model,
                        kwargs=kwargs,
                )

                # ---------------- PROMPTS ----------------
                prompts_raw: Any = config_data.get("prompts_config", {})
                prompts_config: dict[str, Any] = (
                        cast(dict[str, Any], prompts_raw)
                        if isinstance(prompts_raw, dict)
                        else {}
                )
                self._prompt_config = PromptConfig(
                        system_prompt=str(prompts_config.get("system_prompt")).strip(),
                        # rewrite_prompt=prompts_config.get("rewrite_prompt", ""),
                        # validate_prompt=prompts_config.get("validate_prompt", ""),
                )

        # ---------------- ACCESSORS ----------------
        def prompt_config(self) -> PromptConfig:
                if self._prompt_config is None:
                        raise RuntimeError("Prompt configuration is not initialized")
                return self._prompt_config

        def chat_model_config(self) -> ChatConfig:
                if self._chat_model_config is None:
                        raise RuntimeError(
                                "Chat model configuration is not initialized"
                        )
                return self._chat_model_config
