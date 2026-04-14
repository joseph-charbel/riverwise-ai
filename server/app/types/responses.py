from typing import Dict

from pydantic import BaseModel


class DummyInvokeResponse(BaseModel):
    content: str


class DummyInvokesResponse(BaseModel):
    results: Dict[str, str]
