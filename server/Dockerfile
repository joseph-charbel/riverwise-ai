FROM python:3.12-slim

WORKDIR /app

# Install uv
RUN pip install --no-cache-dir uv

# Install dependencies (build context should be repo root; see docker-compose server service)
COPY server/pyproject.toml server/uv.lock ./
RUN uv sync --frozen --no-dev

# Copy application + authoring YAML + preload editor artifact (paths match app.api:_detect_repo_root)
COPY server/app/ ./app/
COPY server/config/ ./config/
COPY server/prompts/ ./prompts/
COPY client/src/config/riverwise.yaml client/src/config/student-options.yaml ./client/src/config/
COPY tools/preload-cache-editor.html ./tools/

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "app.api:app", "--host", "0.0.0.0", "--port", "8000"]
