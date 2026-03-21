import logging
import os


def setup_logging() -> None:
        """Configure application-wide logging once."""
        root = logging.getLogger()
        if root.handlers:
                return

        level_name = os.getenv("LOG_LEVEL", "INFO").upper()
        level = getattr(logging, level_name, logging.INFO)

        logging.basicConfig(
                level=level,
                format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
        )


def get_logger(name: str) -> logging.Logger:
        setup_logging()
        return logging.getLogger(name)
