from typing import List, Literal, Optional

from pydantic import BaseModel, model_validator


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


class GradeRulesRangeModel(BaseModel):
    start: int
    end: int

    @model_validator(mode="after")
    def start_lte_end(self):
        if self.start > self.end:
            raise ValueError("grade_rules_range.start must be <= end")
        return self


class AiDebugRequest(BaseModel):
    prompt: str
    grade_level: str = "8"
    interest: str = "General"
    target_mechanic: str = ""
    include_example: bool = True
    language: Literal["english", "nepali"] = "english"
    grade_rules_range: Optional[GradeRulesRangeModel] = None


class TranslatePreviewRequest(BaseModel):
    text: str
