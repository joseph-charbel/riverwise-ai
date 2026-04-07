import asyncio
from typing import Dict
from app.ai.model import Model
from app.config.base_config import ConfigManager
from app.logging_config import get_logger
from langchain_core.messages import AIMessage

logger = get_logger(__name__)

_TEST_INFORMATION_CARD = """
In Nepal, the intensification of agriculture to meet the needs of a growing population has led to a significant increase in the use of chemical fertilizers, particularly Urea and DAP. During the monsoon season, heavy rainfall causes significant agricultural runoff, where excess nitrogen and phosphorus are washed from hillside farms and the Terai plains into major river systems like the Bagmati and Koshi. This influx of nutrients triggers eutrophication, a process that depletes dissolved oxygen in the water, leading to "biological deserts" where fish and aquatic plants cannot survive. Furthermore, recent 2026 data shows that only about 30% of farmers are using the correct nutrient management practices, resulting in high levels of nitrate contamination in both surface water and shallow groundwater, which poses severe health risks to local communities.
"""


async def dummy_invoke(prompt: str):
        content = f"DUMMY LOGIC\n{prompt}\nDUMMY LOGIC"
        return AIMessage(content=content)


async def dummy_invokes(prompts: Dict[str, str]):
        keys = list(prompts.keys())
        results = await asyncio.gather(*[dummy_invoke(prompts[key]) for key in keys])
        return dict(zip(keys, results))


async def ai_invoke(prompt: str, *, grade_level: str, interest: str) -> AIMessage:
        model = Model()
        return await model.invoke(
                prompt=prompt,
                grade_level=grade_level,
                student_interest=interest,
        )


async def ai_invokes(
        prompts: Dict[str, str], *, grade_level: str, interest: str
) -> Dict[str, AIMessage]:
        keys = list(prompts.keys())
        results = await asyncio.gather(
                *[
                        ai_invoke(
                                prompts[key], grade_level=grade_level, interest=interest
                        )
                        for key in keys
                ]
        )
        return dict(zip(keys, results))


async def invoke(
        prompt: str, *, grade_level: str = "8", interest: str = "General"
) -> AIMessage:
        if ConfigManager().server_config().use_dummy:
                logger.info("Mode: dummy")
                return await dummy_invoke(prompt)
        logger.info("Mode: AI (grade=%s interest=%s)", grade_level, interest)
        return await ai_invoke(prompt, grade_level=grade_level, interest=interest)


async def invokes(
        prompts: Dict[str, str], *, grade_level: str = "8", interest: str = "General"
) -> Dict[str, AIMessage]:
        if ConfigManager().server_config().use_dummy:
                logger.info("Mode: dummy (batch %d)", len(prompts))
                return await dummy_invokes(prompts)
        logger.info(
                "Mode: AI (batch %d grade=%s interest=%s)",
                len(prompts),
                grade_level,
                interest,
        )
        return await ai_invokes(prompts, grade_level=grade_level, interest=interest)


async def test() -> None:
        logger.info("Initializing model")
        model = Model()
        logger.info("Invoking model")
        response = await model.invoke(
                prompt=_TEST_INFORMATION_CARD,
                grade_level="2",
                student_interest="Dance",
        )
        logger.info(f"Model response received:\n{response}")
        print(f"\n\n{response.content}")


if __name__ == "__main__":
        asyncio.run(test())
