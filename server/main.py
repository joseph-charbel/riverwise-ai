"""
Backend entrypoints:

  CLI (model demo):  python main.py
  API server:        python main.py --api   OR   uvicorn app.api:app --host 0.0.0.0 --port 8000
"""
import sys

from app.index import main as run_cli


def run_api() -> None:
    import uvicorn

    uvicorn.run("app.api:app", host="0.0.0.0", port=8000)


if __name__ == "__main__":
    if "--api" in sys.argv:
        run_api()
    else:
        run_cli()
