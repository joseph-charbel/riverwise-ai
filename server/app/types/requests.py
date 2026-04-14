from typing import Dict

from pydantic import BaseModel


class DummyInvokeRequest(BaseModel):
    prompt: str
    grade_level: str = "8"
    interest: str = "General"
    target_mechanic: str = ""


class DummyInvokesRequest(BaseModel):
    prompts: Dict[str, str]
    grade_level: str = "8"
    interest: str = "General"
    target_mechanic: str = ""
