import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.index import dummy_invoke

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


class DummyInvokeRequest(BaseModel):
    prompt: str


class DummyInvokeResponse(BaseModel):
    content: str


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/dummy-invoke", response_model=DummyInvokeResponse)
def api_dummy_invoke(request: DummyInvokeRequest):
    response = dummy_invoke(request.prompt)
    return DummyInvokeResponse(content=response.content)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.api:app", host="0.0.0.0", port=8000, reload=True)
