import asyncio
from textwrap import dedent
from typing import Dict, List
from app.ai.model import Model
from app.config.base_config import ConfigManager
from app.logging_config import get_logger
from app.types.requests import DummyInvokeBatchItem
from langchain_core.messages import AIMessage

logger = get_logger(__name__)

# Shared model instance — keeps cache alive across requests
_model: Model | None = None


def _get_model() -> Model:
        global _model
        if _model is None:
                _model = Model()
        return _model


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


async def ai_invoke(
        prompt: str,
        *,
        grade_level: str,
        interest: str,
        target_mechanic: str,
        include_example: bool = True,
) -> AIMessage:
        return await _get_model().invoke(
                prompt=prompt,
                grade_level=grade_level,
                student_interest=interest,
                target_mechanic=target_mechanic,
                include_example=include_example,
        )


async def ai_invokes(
        items: List[DummyInvokeBatchItem],
        *,
        grade_level: str,
        interest: str,
) -> Dict[str, AIMessage]:
        results = await asyncio.gather(
                *[
                        ai_invoke(
                                item.prompt,
                                grade_level=grade_level,
                                interest=interest,
                                target_mechanic=item.target_mechanic,
                                include_example=item.include_example,
                        )
                        for item in items
                ]
        )
        return {item.id: result for item, result in zip(items, results)}


async def invoke(
        prompt: str,
        *,
        grade_level: str = "8",
        interest: str = "General",
        target_mechanic: str = "",
        include_example: bool = True,
) -> AIMessage:
        if ConfigManager().server_config().use_dummy:
                logger.info("Mode: dummy")
                return await dummy_invoke(prompt)
        logger.info(
                "Mode: AI (grade=%s interest=%s target_mechanic=%s include_example=%s)",
                grade_level,
                interest,
                target_mechanic,
                include_example,
        )
        return await ai_invoke(
                prompt,
                grade_level=grade_level,
                interest=interest,
                target_mechanic=target_mechanic,
                include_example=include_example,
        )


async def invokes(
        items: List[DummyInvokeBatchItem],
        *,
        grade_level: str = "8",
        interest: str = "General",
) -> Dict[str, AIMessage]:
        if ConfigManager().server_config().use_dummy:
                logger.info("Mode: dummy (batch %d)", len(items))
                return await dummy_invokes(items)
        logger.info(
                "Mode: AI (batch %d grade=%s interest=%s)",
                len(items),
                grade_level,
                interest,
        )
        return await ai_invokes(items, grade_level=grade_level, interest=interest)


async def test() -> None:
        logger.info("Initializing model")
        logger.info("Invoking model")
        response = await _get_model().invoke(
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
