from typing import Any

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, BaseMessage
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.prompts import PromptTemplate

from app.cache import CacheService, InMemoryCacheProvider
from app.config.base_config import ConfigManager, ChatConfig
from app.logging_config import get_logger

logger = get_logger(__name__)


def _render_system_prompt(template: str, variables: dict[str, Any]) -> str:
        """Substitute template vars, then append YAML grade band rules if matched."""
        prompt = PromptTemplate.from_template(template=template)
        assert variables.keys() == {"grade_level", "student_interest"}
        rendered = prompt.format(
                grade_level=variables["grade_level"],
                student_interest=variables["student_interest"],
        )
        grade_raw = variables["grade_level"]
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

        system_prompt = f"{rendered}\n\n### Grade-Specific Rules\n{rules}"
        logger.info(f"SYSTEM PROMPT:\n{system_prompt}")
        return system_prompt


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


class Model:
        def __init__(self):
                self.config = ConfigManager()
                chat_config = self.config.chat_model_config()
                api_key = chat_config.api_key.get_secret_value()
                llm_kwargs = dict(chat_config.kwargs)
                if api_key:
                        llm_kwargs.setdefault("api_key", api_key)

                self.llm: BaseChatModel = _make_llm(chat_config)
                logger.info(
                        "Chat model initialized with provider=%s model=%s",
                        chat_config.provider,
                        chat_config.model,
                )

                self._system_prompt_template = self.config.prompt_config().system_prompt
                logger.info(
                        "System prompt template loaded with length %d characters",
                        len(self._system_prompt_template),
                )

                self._cache = CacheService(
                        config=self.config.cache_config(),
                        provider=InMemoryCacheProvider(),
                )
                logger.info(
                        f"Cache initialized with config: {self.config.cache_config()}"
                )

        async def invoke(
                self,
                prompt: str,
                *,
                grade_level: str | None = None,
                student_interest: str | None = None,
                target_mechanic: str | None = None,
                **variables: Any,
        ) -> AIMessage:
                """
                Invoke the LLM with the given prompt.

                Dynamic variables (e.g. grade_level, student_interest, target_mechanic) are substituted
                into the system prompt template. Pass as keyword args or via **variables.
                """
                vars_dict: dict[str, Any] = dict(variables)
                if grade_level is not None:
                        vars_dict["grade_level"] = grade_level
                if student_interest is not None:
                        vars_dict["student_interest"] = student_interest

                system_prompt = _render_system_prompt(
                        self._system_prompt_template, vars_dict
                )

                if target_mechanic:
                        human_content = (
                                f"**Target Mechanic:** {target_mechanic}\n\n{prompt}"
                        )
                else:
                        human_content = prompt

                messages = [
                        SystemMessage(content=system_prompt),
                        HumanMessage(content=human_content),
                ]
                logger.debug("Sending %d messages to chat model", len(messages))
                res = await self._invoke(messages)
                return res

        async def _invoke(self, messages: list[BaseMessage]) -> AIMessage:
                cache_key = self._cache.make_key(messages)
                cached = await self._cache.get(cache_key)
                if cached is not None:
                        logger.info("Cache hit key=%s", cache_key[:12])
                        return cached

                logger.debug("Cache miss key=%s — invoking LLM", cache_key[:12])
                res = await self.llm.ainvoke(messages)
                await self._cache.set(cache_key, res)
                return res


if __name__ == "__main__":
        model = Model()
        system_prompt = _render_system_prompt(
                model._system_prompt_template,
                {
                        "grade_level": "1",
                        "student_interest": "space",
                },
        )

        print(system_prompt)
