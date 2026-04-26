import asyncio
from textwrap import dedent
from typing import Dict, List
from app.ai.model import explain_information_card, translate
from app.config.base_config import ConfigManager
from app.logging_config import get_logger
from app.types.requests import DummyInvokeBatchItem
from langchain_core.messages import AIMessage

logger = get_logger(__name__)


_TEST_INFORMATION_CARD = {
        "prompt": dedent("""
                When pollutants enter rivers, the water can become cloudy, dark, or have a strange smell.
                In Nepal, rivers near cities and industrial areas—such as parts of the Bagmati River—have become polluted due to untreated waste. Poor water quality can harm ecosystems and make water unsafe for daily use.
        """),
        "target_mechanic": "Pollution dilution",
}


async def dummy_invoke(prompt: str):
        content = f"DUMMY LOGIC\n{prompt}\nDUMMY LOGIC"
        return AIMessage(content=content)


async def dummy_invokes(items: List[DummyInvokeBatchItem]):
        results = await asyncio.gather(*[dummy_invoke(item.prompt) for item in items])
        return {item.id: result for item, result in zip(items, results)}


async def explain_information_cards(
        items: List[DummyInvokeBatchItem],
        *,
        grade_level: str,
        interest: str,
        translate_to_nepali: bool,
) -> Dict[str, AIMessage]:
        results = await asyncio.gather(
                *[
                        explain_information_card_with_optional_translation(
                                item.prompt,
                                grade_level=grade_level,
                                interest=interest,
                                target_mechanic=item.target_mechanic,
                                include_example=item.include_example,
                                translate_to_nepali=translate_to_nepali,
                        )
                        for item in items
                ]
        )
        return {item.id: result for item, result in zip(items, results)}


async def explain_information_card_with_optional_translation(
        prompt: str,
        *,
        grade_level: str,
        interest: str,
        target_mechanic: str,
        include_example: bool,
        translate_to_nepali: bool,
) -> AIMessage:
        response = await explain_information_card(
                prompt=prompt,
                grade_level=grade_level,
                student_interest=interest,
                target_mechanic=target_mechanic,
                include_example=include_example,
        )
        if not translate_to_nepali:
                return response

        logger.info("Translating AI response to Nepali")
        return await translate(response.content, grade_level=grade_level)


def _should_translate_to_nepali(override: bool | None) -> bool:
        if override is not None:
                return override
        return ConfigManager().server_config().translate_to_nepali


async def invoke(
        prompt: str,
        *,
        grade_level: str = "8",
        interest: str = "General",
        target_mechanic: str = "",
        include_example: bool = True,
        translate_to_nepali: bool | None = None,
) -> AIMessage:
        server_config = ConfigManager().server_config()
        if server_config.use_dummy:
                logger.info("Mode: dummy")
                return await dummy_invoke(prompt)
        should_translate = _should_translate_to_nepali(translate_to_nepali)
        logger.info(
                "Mode: AI (grade=%s interest=%s target_mechanic=%s "
                "include_example=%s translate_to_nepali=%s)",
                grade_level,
                interest,
                target_mechanic,
                include_example,
                should_translate,
        )
        return await explain_information_card_with_optional_translation(
                prompt,
                grade_level=grade_level,
                interest=interest,
                target_mechanic=target_mechanic,
                include_example=include_example,
                translate_to_nepali=should_translate,
        )


async def invokes(
        items: List[DummyInvokeBatchItem],
        *,
        grade_level: str = "8",
        interest: str = "General",
        translate_to_nepali: bool | None = None,
) -> Dict[str, AIMessage]:
        server_config = ConfigManager().server_config()
        if server_config.use_dummy:
                logger.info("Mode: dummy (batch %d)", len(items))
                return await dummy_invokes(items)
        should_translate = _should_translate_to_nepali(translate_to_nepali)
        logger.info(
                "Mode: AI (batch %d grade=%s interest=%s translate_to_nepali=%s)",
                len(items),
                grade_level,
                interest,
                should_translate,
        )
        return await explain_information_cards(
                items,
                grade_level=grade_level,
                interest=interest,
                translate_to_nepali=should_translate,
        )


async def test() -> None:
        logger.info("Initializing model")
        logger.info("Invoking model")
        response = await explain_information_card(
                prompt=_TEST_INFORMATION_CARD["prompt"],
                grade_level="4",
                student_interest="Dance",
                target_mechanic=_TEST_INFORMATION_CARD["target_mechanic"],
                include_example=True,
        )
        logger.info(f"Model response received:\n{response}")
        print(f"\n\n{response.content}")


if __name__ == "__main__":
        asyncio.run(test())
