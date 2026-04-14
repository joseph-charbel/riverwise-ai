from typing import List

from pydantic import BaseModel


class DummyInvokeRequest(BaseModel):
    prompt: str
    grade_level: str = "8"
    interest: str = "General"
    target_mechanic: str = ""


class DummyInvokeBatchItem(BaseModel):
    id: str
    prompt: str
    target_mechanic: str = ""


class DummyInvokesRequest(BaseModel):
    items: List[DummyInvokeBatchItem]
    grade_level: str = "8"
    interest: str = "General"
