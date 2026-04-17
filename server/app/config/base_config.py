from __future__ import annotations

from pathlib import Path
from typing import Any, Optional, cast
from dotenv import load_dotenv
from pydantic import BaseModel, Field, SecretStr, ValidationError
import os

from .config_loader import CONFIG

# Server root: two levels up from this file (app/config → app → server)
_SERVER_ROOT = Path(__file__).resolve().parents[2]

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


class ServerConfig(BaseModel):
        use_dummy: bool = True
        default_grade_level: str = "8"
        default_interest: str = "General"


class PromptConfig(BaseModel):
        """Configuration for system prompts"""

        system_prompt: str = Field(default="")
        example_prompt: str = Field(default="")
        # rewrite_prompt: str = Field(default="")
        # validate_prompt: str = Field(default="")


class CacheConfig(BaseModel):
        enabled: bool = True
        ttl: int = 3600
        provider: str = "memory"


class GradeRule(BaseModel):
        start: int
        end: int
        rules: str


class GradeRulesConfig(BaseModel):
        version: str = Field(default="")
        rules: list[GradeRule] = Field(default_factory=list)


# ===============================
# CONFIG MANAGER
# ===============================


class ConfigManager:
        _instance = None

        # Config instances
        _chat_model_config: Optional[ChatConfig] = None
        _prompt_config: Optional[PromptConfig] = None
        _server_config: Optional[ServerConfig] = None
        _grade_rules_config: Optional[GradeRulesConfig] = None
        _cache_config: Optional[CacheConfig] = None

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

                # ---------------- SERVER CONFIG ----------------
                server_raw: Any = config_data.get("server_config", {})
                server_data: dict[str, Any] = (
                        cast(dict[str, Any], server_raw)
                        if isinstance(server_raw, dict)
                        else {}
                )
                self._server_config = ServerConfig(
                        use_dummy=bool(server_data.get("use_dummy", True)),
                        default_grade_level=str(
                                server_data.get("default_grade_level", "8")
                        ),
                        default_interest=str(
                                server_data.get("default_interest", "General")
                        ),
                )

                # ---------------- PROMPTS ----------------
                prompts_raw: Any = config_data.get("prompts_config", {})
                prompts_config: dict[str, Any] = (
                        cast(dict[str, Any], prompts_raw)
                        if isinstance(prompts_raw, dict)
                        else {}
                )
                system_prompt_file = prompts_config.get("system_prompt_file")
                if system_prompt_file:
                        prompt_path = _SERVER_ROOT / str(system_prompt_file)
                        system_prompt = prompt_path.read_text(encoding="utf-8").strip()
                else:
                        system_prompt = str(
                                prompts_config.get("system_prompt", "")
                        ).strip()

                example_prompt_file = prompts_config.get("example_prompt_file")
                if example_prompt_file:
                        example_path = _SERVER_ROOT / str(example_prompt_file)
                        example_prompt = example_path.read_text(encoding="utf-8").strip()
                else:
                        example_prompt = str(
                                prompts_config.get("example_prompt", "")
                        ).strip()

                self._prompt_config = PromptConfig(
                        system_prompt=system_prompt,
                        example_prompt=example_prompt,
                )

                # ---------------- CACHE CONFIG ----------------
                cache_raw: Any = config_data.get("cache_config", {})
                cache_data: dict[str, Any] = (
                        cast(dict[str, Any], cache_raw)
                        if isinstance(cache_raw, dict)
                        else {}
                )
                self._cache_config = CacheConfig(
                        enabled=bool(cache_data.get("enabled", True)),
                        ttl=int(cache_data.get("ttl", 3600)),
                        provider=str(cache_data.get("provider", "memory")),
                )

                # ---------------- GRADE RULES (rules + version from config/grade_rules.yaml via config_loader) ----------------
                grade_rules_raw: Any = config_data.get("grade_rules", [])
                grade_rules_list: list[GradeRule] = []
                if isinstance(grade_rules_raw, list):
                        for item in cast(list[Any], grade_rules_raw):
                                if isinstance(item, dict):
                                        try:
                                                grade_rules_list.append(
                                                        GradeRule.model_validate(
                                                                cast(
                                                                        dict[
                                                                                str,
                                                                                Any,
                                                                        ],
                                                                        item,
                                                                )
                                                        )
                                                )
                                        except ValidationError:
                                                pass
                gr_ver_raw: Any = config_data.get("grade_rules_version")
                grade_rules_version = (
                        str(gr_ver_raw).strip() if gr_ver_raw is not None else ""
                )
                self._grade_rules_config = GradeRulesConfig(
                        version=grade_rules_version,
                        rules=grade_rules_list,
                )

        def rules_for_grade(self, grade_level: int) -> str | None:
                """Return rules text for the first band where start <= grade <= end."""
                if self._grade_rules_config is None:
                        return None
                for band in self._grade_rules_config.rules:
                        if band.start <= grade_level <= band.end:
                                return band.rules.strip()
                return None

        def grade_rules(self) -> GradeRulesConfig:
                if self._grade_rules_config is None:
                        return GradeRulesConfig()
                return self._grade_rules_config

        # ---------------- ACCESSORS ----------------
        def server_config(self) -> ServerConfig:
                if self._server_config is None:
                        raise RuntimeError("Server configuration is not initialized")
                return self._server_config

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

        def cache_config(self) -> CacheConfig:
                if self._cache_config is None:
                        raise RuntimeError("Cache configuration is not initialized")
                return self._cache_config


if __name__ == "__main__":
        config_manager = ConfigManager()
        print(f"Grade rules version: {config_manager.grade_rules().version}")
        print("Grade rules:")
        for rule in config_manager.grade_rules().rules:
                print(f"  - Start: {rule.start}, End: {rule.end}")
                print(f"    Rules: {rule.rules}")
                print()
