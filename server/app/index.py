import asyncio
from typing import Dict
from app.ai.model import Model
from app.config.base_config import ConfigManager
from app.logging_config import get_logger
from langchain_core.messages import AIMessage

logger = get_logger(__name__)

_TEST_INFORMATION_CARD = """
When pollutants enter rivers, the water can become cloudy, dark, or have a strange smell.
In Nepal, rivers near cities and industrial areas—such as parts of the Bagmati River—have become polluted due to untreated waste. Poor water quality can harm ecosystems and make water unsafe for daily use.

Did you know? Parts of the Bagmati River near Kathmandu are heavily polluted due to untreated sewage and industrial waste.
"""


async def dummy_invoke(prompt: str):
        content = f"DUMMY LOGIC\n{prompt}\nDUMMY LOGIC"
        return AIMessage(content=content)


async def dummy_invokes(prompts: Dict[str, str]):
        keys = list(prompts.keys())
        results = await asyncio.gather(*[dummy_invoke(prompts[key]) for key in keys])
        return dict(zip(keys, results))


async def ai_invoke(prompt: str, *, grade_level: str, interest: str, target_mechanic: str) -> AIMessage:
        model = Model()
        return await model.invoke(
                prompt=prompt,
                grade_level=grade_level,
                student_interest=interest,
                target_mechanic=target_mechanic,
        )


async def ai_invokes(
        prompts: Dict[str, str], *, grade_level: str, interest: str, target_mechanic: str
) -> Dict[str, AIMessage]:
        keys = list(prompts.keys())
        results = await asyncio.gather(
                *[
                        ai_invoke(
                                prompts[key], grade_level=grade_level, interest=interest, target_mechanic=target_mechanic
                        )
                        for key in keys
                ]
        )
        return dict(zip(keys, results))


async def invoke(
        prompt: str, *, grade_level: str = "8", interest: str = "General", target_mechanic: str = ""
) -> AIMessage:
        if ConfigManager().server_config().use_dummy:
                logger.info("Mode: dummy")
                return await dummy_invoke(prompt)
        logger.info("Mode: AI (grade=%s interest=%s target_mechanic=%s)", grade_level, interest, target_mechanic)
        return await ai_invoke(prompt, grade_level=grade_level, interest=interest, target_mechanic=target_mechanic)


async def invokes(
        prompts: Dict[str, str], *, grade_level: str = "8", interest: str = "General", target_mechanic: str = ""
) -> Dict[str, AIMessage]:
        if ConfigManager().server_config().use_dummy:
                logger.info("Mode: dummy (batch %d)", len(prompts))
                return await dummy_invokes(prompts)
        logger.info(
                "Mode: AI (batch %d grade=%s interest=%s target_mechanic=%s)",
                len(prompts),
                grade_level,
                interest,
                target_mechanic,
        )
        return await ai_invokes(prompts, grade_level=grade_level, interest=interest, target_mechanic=target_mechanic)


async def test() -> None:
        logger.info("Initializing model")
        model = Model()
        logger.info("Invoking model")
        response = await model.invoke(
                prompt=_TEST_INFORMATION_CARD,
                grade_level="2",
                student_interest="Dance",
                target_mechanic="Pollution dilution",
        )
        logger.info(f"Model response received:\n{response}")
        print(f"\n\n{response.content}")


if __name__ == "__main__":
        asyncio.run(test())
