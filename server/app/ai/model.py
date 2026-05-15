import asyncio
import time
from pathlib import Path
from typing import Any

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, BaseMessage
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.prompts import PromptTemplate

from app.cache import CacheService, InMemoryCacheProvider
from app.config.base_config import ConfigManager, ChatConfig
from app.logging_config import get_logger

logger = get_logger(__name__)

_SERVER_ROOT = Path(__file__).resolve().parents[2]

_llm: BaseChatModel | None = None
_cache: CacheService | None = None
_system_prompt_template: str | None = None
_example_prompt_template: str | None = None
_translate_prompt_template: str | None = None

_preload_lock = asyncio.Lock()
_cache_preloaded = False

_LOG_PREVIEW_MAX = 260


def message_content_to_text(content: Any) -> str:
        if content is None:
                return ""
        if isinstance(content, str):
                return content
        if isinstance(content, list):
                parts: list[str] = []
                for block in content:
                        if isinstance(block, str):
                                parts.append(block)
                        elif isinstance(block, dict) and isinstance(
                                block.get("text"), str
                        ):
                                parts.append(block["text"])
                        else:
                                parts.append(str(block))
                return "".join(parts)
        return str(content)


def _log_preview(text: str, limit: int = _LOG_PREVIEW_MAX) -> str:
        one_line = " ".join(text.split())
        if len(one_line) <= limit:
                return one_line
        return f"{one_line[: limit - 1]}…"


def _human_text_from_messages(messages: list[BaseMessage]) -> str:
        chunks: list[str] = []
        for m in messages:
                if isinstance(m, HumanMessage):
                        chunks.append(message_content_to_text(m.content))
        return "\n".join(chunks)


async def _ensure_preload_cache() -> None:
        """Load YAML preloads into cache once (first LLM/cache use)."""
        global _cache_preloaded
        if _cache_preloaded:
                return
        async with _preload_lock:
                if _cache_preloaded:
                        return
                from app.cache.preload import seed_preload_cache

                await seed_preload_cache(_get_cache())
                _cache_preloaded = True


def _render_system_prompt(template: str, variables: dict[str, Any]) -> str:
        """Substitute template vars into the core prompt. Does not append grade rules."""
        prompt = PromptTemplate.from_template(template=template)
        assert variables.keys() == {"grade_level", "student_interest"}
        rendered = prompt.format(
                grade_level=variables["grade_level"],
                student_interest=variables["student_interest"],
        )
        return rendered


def _format_grade_prompt_target(
        grade_level: str,
        grade_rules_range: tuple[int, int] | None,
) -> str:
        """Return the grade label injected into the system prompt."""
        if grade_rules_range is None:
                return grade_level

        lo, hi = grade_rules_range
        if lo == hi:
                return f"Grade {lo}"
        return f"Grades {lo}-{hi}"


def _append_grade_rules(rendered: str, grade_raw: Any) -> str:
        """Append grade-band rules to a rendered prompt. Returns rendered unchanged on miss."""
        try:
                grade_num = int(str(grade_raw).strip())
        except (ValueError, TypeError):
                logger.warning(
                        "Invalid grade_level %r; skipping grade rules append",
                        grade_raw,
                )
                return rendered
        rules = ConfigManager().rules_for_grade(grade_num)
        if rules is None:
                logger.warning(
                        "No grade_rules band for grade %s; skipping append",
                        grade_num,
                )
                return rendered
        return f"{rendered}\n\n### Grade-Specific Rules\n{rules}"


def _append_grade_rules_span(rendered: str, span_start: int, span_end: int) -> str:
        """Append collapsed grade-band rules covering each integer grade in [span_start, span_end]."""
        cm = ConfigManager()
        out = rendered
        g = span_start
        while g <= span_end:
                rules = cm.rules_for_grade(g)
                if rules is None:
                        logger.warning(
                                "No grade_rules band for grade %s in range append; skipping",
                                g,
                        )
                        g += 1
                        continue
                ga = g
                gb = g
                while gb + 1 <= span_end and cm.rules_for_grade(gb + 1) == rules:
                        gb += 1
                if ga == gb:
                        header = f"### Grade-Specific Rules (Grade {ga})"
                else:
                        header = f"### Grade-Specific Rules (Grades {ga}–{gb})"
                out = f"{out}\n\n{header}\n{rules}"
                g = gb + 1
        return out


def _make_llm(chat_config: ChatConfig) -> BaseChatModel:
        provider = chat_config.provider
        if provider == "groq":
                from langchain_groq import ChatGroq

                return ChatGroq(
                        model=chat_config.model,
                        **chat_config.kwargs,
                )
        elif provider == "google":
                from langchain_google_genai import ChatGoogleGenerativeAI

                return ChatGoogleGenerativeAI(
                        model=chat_config.model,
                        **chat_config.kwargs,
                )
        else:
                raise ValueError(f"Unsupported provider: {provider}")


def _get_llm() -> BaseChatModel:
        global _llm
        if _llm is None:
                chat_config = ConfigManager().chat_model_config()
                _llm = _make_llm(chat_config)
                logger.info(
                        "Chat model initialized with provider=%s model=%s",
                        chat_config.provider,
                        chat_config.model,
                )
        return _llm


def _get_prompt_templates() -> tuple[str, str]:
        global _system_prompt_template, _example_prompt_template
        if _system_prompt_template is None or _example_prompt_template is None:
                prompt_config = ConfigManager().prompt_config()
                _system_prompt_template = prompt_config.system_prompt
                _example_prompt_template = prompt_config.example_prompt
                logger.info(
                        "System prompt template loaded with length %d characters",
                        len(_system_prompt_template),
                )
                logger.info(
                        "Example prompt template loaded with length %d characters",
                        len(_example_prompt_template),
                )
        return _system_prompt_template, _example_prompt_template


def _get_translate_prompt_template() -> str:
        global _translate_prompt_template
        if _translate_prompt_template is None:
                prompt_path = _SERVER_ROOT / "prompts" / "translate.md"
                _translate_prompt_template = prompt_path.read_text(
                        encoding="utf-8"
                ).strip()
                logger.info(
                        "Translate prompt template loaded with length %d characters",
                        len(_translate_prompt_template),
                )
        return _translate_prompt_template


def _get_cache() -> CacheService:
        global _cache
        if _cache is None:
                config = ConfigManager()
                _cache = CacheService(
                        config=config.cache_config(),
                        provider=InMemoryCacheProvider(),
                )
                logger.info("Cache initialized with config: %s", config.cache_config())
        return _cache


async def explain_information_card(
        prompt: str,
        *,
        grade_level: str,
        student_interest: str,
        target_mechanic: str | None = None,
        include_example: bool = True,
        grade_rules_range: tuple[int, int] | None = None,
) -> AIMessage:
        """
        Build the tutor prompt for a hotspot information card, then invoke the LLM.

        Future AI tasks should follow this shape: create a function named for the
        task, build its prompt locally, then call `_invoke(messages, operation='task_name')`.
        """
        system_prompt, _, messages = build_information_card_messages(
                prompt,
                grade_level=grade_level,
                student_interest=student_interest,
                target_mechanic=target_mechanic,
                include_example=include_example,
                grade_rules_range=grade_rules_range,
        )
        logger.debug(
                "Built information_card messages: system_prompt_chars=%d msg_count=%d",
                len(system_prompt),
                len(messages),
        )
        return await _invoke(messages, operation="information_card")


def build_information_card_messages(
        prompt: str,
        *,
        grade_level: str,
        student_interest: str,
        target_mechanic: str | None = None,
        include_example: bool = True,
        grade_rules_range: tuple[int, int] | None = None,
) -> tuple[str, str, list[BaseMessage]]:
        """Build prompt artifacts for debug preview or LLM invocation."""
        system_prompt_template, example_prompt_template = _get_prompt_templates()
        vars_dict = {
                "grade_level": _format_grade_prompt_target(
                        grade_level,
                        grade_rules_range,
                ),
                "student_interest": student_interest,
        }

        system_prompt = _render_system_prompt(system_prompt_template, vars_dict)
        if include_example and example_prompt_template:
                system_prompt = f"{system_prompt}\n\n{example_prompt_template}"
        if grade_rules_range is not None:
                lo, hi = grade_rules_range
                system_prompt = _append_grade_rules_span(system_prompt, lo, hi)
        else:
                system_prompt = _append_grade_rules(system_prompt, grade_level)

        if target_mechanic:
                human_content = f"**Target Mechanic:** {target_mechanic}\n\n{prompt}"
        else:
                human_content = prompt

        messages = [
                SystemMessage(content=system_prompt),
                HumanMessage(content=human_content),
        ]
        return system_prompt, human_content, messages


async def translate(text: str) -> AIMessage:
        """
        Translate English text to Nepali while preserving content, intent.
        """
        messages = build_translate_messages(text)
        return await _invoke(messages, operation="translate")


def build_translate_messages(text: str) -> list[BaseMessage]:
        """Build translation prompt artifacts for debug preview or LLM invocation."""
        human_content = f"**Text to translate:**\n{text}"
        return [
                SystemMessage(content=_get_translate_prompt_template()),
                HumanMessage(content=human_content),
        ]


async def _invoke(messages: list[BaseMessage], *, operation: str) -> AIMessage:
        await _ensure_preload_cache()
        cache = _get_cache()
        cache_key = cache.make_key(messages)
        key_prefix = cache_key[:12]

        human_text = _human_text_from_messages(messages)
        human_chars = len(human_text)

        cached = await cache.get(cache_key)
        if cached is not None:
                out = message_content_to_text(cached.content)
                logger.info(
                        "LLM skipped (cache hit) operation=%s cache_key_prefix=%s "
                        "human_chars=%d human_preview=%s response_chars=%d "
                        "response_preview=%s",
                        operation,
                        key_prefix,
                        human_chars,
                        _log_preview(human_text),
                        len(out),
                        _log_preview(out),
                )
                return cached

        logger.info(
                "LLM request operation=%s cache_key_prefix=%s human_chars=%d "
                "human_preview=%s",
                operation,
                key_prefix,
                human_chars,
                _log_preview(human_text),
        )
        t0 = time.perf_counter()
        res = await _get_llm().ainvoke(messages)
        elapsed_ms = (time.perf_counter() - t0) * 1000
        await cache.set(cache_key, res)
        out = message_content_to_text(res.content)
        logger.info(
                "LLM response operation=%s response_chars=%d response_preview=%s "
                "elapsed_ms=%.0f",
                operation,
                len(out),
                _log_preview(out),
                elapsed_ms,
        )
        return res


async def test():
        from textwrap import dedent

        _TEST_INFORMATION_CARD = {
                "prompt": dedent("""
                        When pollutants enter rivers, the water can become cloudy, dark, or have a strange smell.
                        In Nepal, rivers near cities and industrial areas—such as parts of the Bagmati River—have become polluted due to untreated waste. Poor water quality can harm ecosystems and make water unsafe for daily use.
                """),
                "target_mechanic": "Pollution dilution",
        }
        translated = await translate(_TEST_INFORMATION_CARD["prompt"])
        print(translated.content)


if __name__ == "__main__":
        import asyncio

        asyncio.run(test())
