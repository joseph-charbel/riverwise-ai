from pathlib import Path
from typing import Any, cast

import yaml
from dotenv import load_dotenv
from app.logging_config import get_logger

load_dotenv()

logger = get_logger(__name__)


def load_yaml(file_path: str) -> Any:
        try:
                with open(file_path, "r", encoding="utf-8") as file:
                        return yaml.safe_load(file)
        except FileNotFoundError:
                logger.error('Error: The file "%s" was not found.', file_path)
                raise
        except yaml.YAMLError as e:
                logger.error("Error parsing YAML file: %s", e)
                raise
        except Exception as e:
                logger.exception("Unexpected error occurred: %s", e)
                raise


def render_placeholders(config_data: Any, context: dict[str, Any]) -> Any:
        """
        Recursively formats string values in config_data using the provided context dictionary.
        Logs when placeholders are replaced or missing.
        """
        if isinstance(config_data, dict):
                typed_dict = cast(dict[str, Any], config_data)
                return {
                        k: render_placeholders(v, context)
                        for k, v in typed_dict.items()
                }

        elif isinstance(config_data, list):
                typed_list = cast(list[Any], config_data)
                return [render_placeholders(item, context) for item in typed_list]

        elif isinstance(config_data, str):
                try:
                        rendered = config_data.format(**context)
                        if rendered != config_data:
                                logger.info(
                                        "Replaced placeholders in string: %s → %s",
                                        config_data,
                                        rendered,
                                )
                        return rendered
                except KeyError as e:
                        logger.warning(
                                "Missing placeholder: %s in string: %s", e, config_data
                        )
                        return config_data
        else:
                return config_data


def _merge_grade_rules_file(config_data: dict[str, Any], grade_rules_path: Path) -> None:
        """Overlay ``grade_rules`` and ``grade_rules_version`` (from ``version``) when file present."""
        if not grade_rules_path.exists():
                return
        try:
                gr_data = load_yaml(str(grade_rules_path))
        except Exception as e:
                logger.warning(
                        "Failed to load grade rules file %s: %s", grade_rules_path, e
                )
                return
        if not isinstance(gr_data, dict):
                return
        gr_key = gr_data.get("grade_rules")
        if gr_key is not None:
                config_data["grade_rules"] = gr_key
        ver = gr_data.get("version")
        if ver is not None:
                config_data["grade_rules_version"] = str(ver).strip()


def load_config(context: dict[str, Any] | None = None) -> dict[str, Any]:
        root_path = Path(__file__).resolve().parents[2]
        config_file_path = root_path / "config" / "config.yaml"
        grade_rules_file_path = root_path / "config" / "grade_rules.yaml"

        if config_file_path.exists():
                try:
                        config_data = load_yaml(str(config_file_path))
                        logger.info("Config loaded from %s", config_file_path)

                        if not config_data:
                                logger.warning("Config file is empty.")
                                return {}

                        if isinstance(config_data, dict):
                                _merge_grade_rules_file(
                                        cast(dict[str, Any], config_data),
                                        grade_rules_file_path,
                                )

                        if context:
                                config_data = render_placeholders(config_data, context)

                        if isinstance(config_data, dict):
                                logger.info(
                                        "Loaded full config:\n%s",
                                        yaml.safe_dump(
                                                config_data,
                                                sort_keys=False,
                                                allow_unicode=False,
                                        ).rstrip(),
                                )

                        return (
                                cast(dict[str, Any], config_data)
                                if isinstance(config_data, dict)
                                else {}
                        )
                except Exception as e:
                        logger.error("Failed to load config: %s", e)
                        return {}
        else:
                logger.error("Config file not found at %s", config_file_path)
                return {}


CONFIG = load_config()

if __name__ == "__main__":
        print(CONFIG)
