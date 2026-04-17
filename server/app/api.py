import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.index import invoke, invokes
from app.types import (
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



@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/dummy-invoke", response_model=DummyInvokeResponse)
async def api_dummy_invoke(request: DummyInvokeRequest):
    response = await invoke(
        request.prompt,
        grade_level=request.grade_level,
        interest=request.interest,
        target_mechanic=request.target_mechanic,
        include_example=request.include_example,
    )
    return DummyInvokeResponse(content=response.content)


@app.post("/api/dummy-invokes", response_model=DummyInvokesResponse)
async def api_dummy_invokes(request: DummyInvokesRequest):
    responses = await invokes(
        request.items,
        grade_level=request.grade_level,
        interest=request.interest,
    )
    return DummyInvokesResponse(results={key: msg.content for key, msg in responses.items()})


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.api:app", host="0.0.0.0", port=8000, reload=True)
