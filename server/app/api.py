import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, RedirectResponse
import yaml

from app.ai.model import (
    build_information_card_messages,
    build_translate_messages,
    explain_information_card,
    translate,
)
from app.index import invoke, invokes
from app.types import (
    AiDebugInvokeResponse,
    AiDebugMessage,
    AiDebugPreviewResponse,
    AiDebugRequest,
    DummyInvokeBatchItem,
    DummyInvokeRequest,
    DummyInvokeResponse,
    DummyInvokesRequest,
    DummyInvokesResponse,
)

app = FastAPI(title="Backend API")

_cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173")
origins = [o.strip() for o in _cors_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_DEBUG_PAGE = Path(__file__).resolve().parent / "debug" / "ai.html"
_REPO_ROOT = Path(__file__).resolve().parents[2]
_STUDENT_OPTIONS = _REPO_ROOT / "client" / "src" / "config" / "student-options.yaml"


def _message_role(message_type: str) -> str:
    if message_type == "human":
        return "user"
    if message_type == "ai":
        return "assistant"
    return message_type


def _build_debug_preview(request: AiDebugRequest) -> AiDebugPreviewResponse:
    system_prompt, _, messages = build_information_card_messages(
        request.prompt,
        grade_level=request.grade_level,
        student_interest=request.interest,
        target_mechanic=request.target_mechanic,
        include_example=request.include_example,
    )
    translation_messages = []
    if request.language == "nepali":
        translation_messages = build_translate_messages("<LLM output from adaptation pipeline>")

    debug_translation_messages = [
        AiDebugMessage(role=_message_role(message.type), content=str(message.content))
        for message in translation_messages
    ]
    return AiDebugPreviewResponse(
        system_prompt=system_prompt,
        messages=[
            AiDebugMessage(role=_message_role(message.type), content=str(message.content))
            for message in messages
        ],
        translate_to_nepali=request.language == "nepali",
        translation_system_prompt=(
            debug_translation_messages[0].content if debug_translation_messages else ""
        ),
        translation_messages=debug_translation_messages,
    )



@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/debug/ai")
def ai_debug_page():
    return HTMLResponse(_DEBUG_PAGE.read_text(encoding="utf-8"))


@app.get("/debug/ai/")
def ai_debug_page_slash():
    return RedirectResponse("/debug/ai")


@app.get("/debug/ai/options")
def ai_debug_options():
    data = yaml.safe_load(_STUDENT_OPTIONS.read_text(encoding="utf-8")) or {}
    return data


@app.post("/debug/ai/preview", response_model=AiDebugPreviewResponse)
def ai_debug_preview(request: AiDebugRequest):
    return _build_debug_preview(request)


@app.post("/debug/ai/invoke", response_model=AiDebugInvokeResponse)
async def ai_debug_invoke(request: AiDebugRequest):
    preview = _build_debug_preview(request)
    response = await explain_information_card(
        request.prompt,
        grade_level=request.grade_level,
        student_interest=request.interest,
        target_mechanic=request.target_mechanic,
        include_example=request.include_example,
    )
    output = response.content
    if request.language == "nepali":
        translated = await translate(output)
        output = translated.content

    return AiDebugInvokeResponse(
        system_prompt=preview.system_prompt,
        messages=preview.messages,
        translate_to_nepali=preview.translate_to_nepali,
        translation_system_prompt=preview.translation_system_prompt,
        translation_messages=preview.translation_messages,
        output=output,
    )


@app.post("/api/dummy-invoke", response_model=DummyInvokeResponse)
async def api_dummy_invoke(request: DummyInvokeRequest):
    response = await invoke(
        request.prompt,
        grade_level=request.grade_level,
        interest=request.interest,
        target_mechanic=request.target_mechanic,
        include_example=request.include_example,
        translate_to_nepali=request.translate_to_nepali,
    )
    return DummyInvokeResponse(content=response.content)


@app.post("/api/dummy-invokes", response_model=DummyInvokesResponse)
async def api_dummy_invokes(request: DummyInvokesRequest):
    responses = await invokes(
        request.items,
        grade_level=request.grade_level,
        interest=request.interest,
        translate_to_nepali=request.translate_to_nepali,
    )
    return DummyInvokesResponse(results={key: msg.content for key, msg in responses.items()})


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.api:app", host="0.0.0.0", port=8000, reload=True)
