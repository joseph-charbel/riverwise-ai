from typing import List, Optional

from pydantic import BaseModel


class DummyInvokeRequest(BaseModel):
    id: str = ""
    prompt: str
    grade_level: str = "8"
    interest: str = "General"
    target_mechanic: str = ""
    include_example: bool = True
    translate_to_nepali: Optional[bool] = None


class DummyInvokeBatchItem(BaseModel):
    id: str
    prompt: str
    target_mechanic: str = ""
    include_example: bool = True


class DummyInvokesRequest(BaseModel):
    items: List[DummyInvokeBatchItem]
    grade_level: str = "8"
    interest: str = "General"
    translate_to_nepali: Optional[bool] = None
