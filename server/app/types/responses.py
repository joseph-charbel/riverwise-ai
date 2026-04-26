from typing import Dict

from pydantic import BaseModel


class DummyInvokeResponse(BaseModel):
    content: str


class DummyInvokesResponse(BaseModel):
    results: Dict[str, str]


class AiDebugMessage(BaseModel):
    role: str
    content: str


class AiDebugPreviewResponse(BaseModel):
    system_prompt: str
    messages: list[AiDebugMessage]
    translate_to_nepali: bool
    translation_system_prompt: str = ""
    translation_messages: list[AiDebugMessage] = []


class AiDebugInvokeResponse(AiDebugPreviewResponse):
    output: str
