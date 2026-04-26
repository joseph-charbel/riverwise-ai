from typing import Any

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, BaseMessage
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.prompts import PromptTemplate

from app.cache import CacheService, InMemoryCacheProvider
from app.config.base_config import ConfigManager, ChatConfig
from app.logging_config import get_logger

logger = get_logger(__name__)

_llm: BaseChatModel | None = None
_cache: CacheService | None = None
_system_prompt_template: str | None = None
_example_prompt_template: str | None = None


def _render_system_prompt(template: str, variables: dict[str, Any]) -> str:
        """Substitute template vars into the core prompt. Does not append grade rules."""
        prompt = PromptTemplate.from_template(template=template)
        assert variables.keys() == {"grade_level", "student_interest"}
        rendered = prompt.format(
                grade_level=variables["grade_level"],
                student_interest=variables["student_interest"],
        )
        return rendered


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
) -> AIMessage:
        """
        Build the tutor prompt for a hotspot information card, then invoke the LLM.

        Future AI tasks should follow this shape: create a function named for the
        task, build its prompt locally, then call `_invoke(messages)`.
        """
        system_prompt_template, example_prompt_template = _get_prompt_templates()
        vars_dict = {
                "grade_level": grade_level,
                "student_interest": student_interest,
        }

        system_prompt = _render_system_prompt(system_prompt_template, vars_dict)
        if include_example and example_prompt_template:
                system_prompt = f"{system_prompt}\n\n{example_prompt_template}"
        system_prompt = _append_grade_rules(system_prompt, vars_dict["grade_level"])
        logger.info("SYSTEM PROMPT:\n%s", system_prompt)

        if target_mechanic:
                human_content = f"**Target Mechanic:** {target_mechanic}\n\n{prompt}"
        else:
                human_content = prompt

        messages = [
                SystemMessage(content=system_prompt),
                HumanMessage(content=human_content),
        ]
        logger.debug("Sending %d messages to chat model", len(messages))
        return await _invoke(messages)


async def _invoke(messages: list[BaseMessage]) -> AIMessage:
        cache = _get_cache()
        cache_key = cache.make_key(messages)
        cached = await cache.get(cache_key)
        if cached is not None:
                logger.info("Cache hit key=%s", cache_key[:12])
                return cached

        logger.debug("Cache miss key=%s — invoking LLM", cache_key[:12])
        res = await _get_llm().ainvoke(messages)
        await cache.set(cache_key, res)
        return res


if __name__ == "__main__":
        vars_dict = {"grade_level": "1", "student_interest": "space"}
        system_template, example_template = _get_prompt_templates()
        core = _render_system_prompt(system_template, vars_dict)
        with_example = f"{core}\n\n{example_template}" if example_template else core
        full_prompt = _append_grade_rules(with_example, vars_dict["grade_level"])
        print(full_prompt)
