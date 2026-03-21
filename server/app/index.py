import asyncio
from typing import Dict
from app.ai.model import Model
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


def test() -> None:
        logger.info("Initializing model")
        model = Model()
        logger.info("Invoking model")
        response = model.invoke(
                prompt=_TEST_INFORMATION_CARD,
                grade_level="3",
                student_interest="Space",
        )
        logger.info("Model response received")
        print(f"\n\n{response.content}")


if __name__ == "__main__":
        test()
