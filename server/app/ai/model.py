from typing import Any, Awaitable

from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langchain_groq import ChatGroq
from langchain_core.language_models.chat_models import BaseChatModel

from app.config.base_config import ConfigManager
from app.logging_config import get_logger

logger = get_logger(__name__)


def _render_system_prompt(template: str, variables: dict[str, Any]) -> str:
        """Replace {{variable}} placeholders in the template with provided values."""
        result = template
        for key, value in variables.items():
                result = result.replace("{{" + key + "}}", str(value))
        return result


class Model:
        def __init__(self):
                self.config = ConfigManager()
                chat_config = self.config.chat_model_config()
                api_key = chat_config.api_key.get_secret_value()
                llm_kwargs = dict(chat_config.kwargs)
                if api_key:
                        llm_kwargs.setdefault("api_key", api_key)

                self.llm: BaseChatModel = ChatGroq(
                        model=chat_config.model,
                        **llm_kwargs,
                )
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

        async def invoke(
                self,
                prompt: str,
                *,
                grade_level: str | None = None,
                student_interest: str | None = None,
                **variables: Any,
        ) -> Awaitable[BaseMessage]:
                """
                Invoke the LLM with the given prompt.

                Dynamic variables (e.g. grade_level, student_interest) are substituted
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
                messages = [
                        SystemMessage(content=system_prompt),
                        HumanMessage(content=prompt),
                ]
                logger.debug("Sending %d messages to chat model", len(messages))
                return self.llm.invoke(messages)
