from __future__ import annotations

from pathlib import Path
from typing import Any, cast

from langchain_core.messages import AIMessage

from app.ai.model import build_information_card_messages, build_translate_messages
from app.cache.service import CacheService
from app.config.base_config import ConfigManager
from app.config.config_loader import load_yaml
from app.logging_config import get_logger

logger = get_logger(__name__)

_SERVER_ROOT = Path(__file__).resolve().parents[2]


def _as_vars(raw: Any) -> dict[str, Any]:
        if raw is None:
                return {}
        if isinstance(raw, dict):
                return cast(dict[str, Any], dict(raw))
        return {}


def _format_template(template: str, ctx: dict[str, Any], *, label: str) -> str:
        try:
                return template.format(**ctx)
        except KeyError as e:
                logger.warning("Preload %s: missing placeholder key %s", label, e)
                return template


def _normalize_target_mechanic(raw: Any) -> str | None:
        if raw is None:
                return None
        s = str(raw).strip()
        return s if s else None


async def _store_preload(cache: CacheService, key: str, msg: AIMessage) -> None:
        existing = await cache.get(key)
        if existing is not None:
                logger.warning(
                        "Preload overwrites existing cache key=%s",
                        key[:12],
                )
        await cache.set(key, msg, ttl_override=0)


async def _seed_information_card_group(
        cache: CacheService,
        raw: dict[str, Any],
        *,
        group_index: int,
) -> int:
        prompt_raw = raw.get("prompt")
        if prompt_raw is None:
                logger.warning(
                        "Preload entries[%s]: information_card missing prompt",
                        group_index,
                )
                return 0
        prompt_template = str(prompt_raw)

        variants_raw = raw.get("variants")
        if not isinstance(variants_raw, list) or len(variants_raw) == 0:
                logger.warning(
                        "Preload entries[%s]: information_card requires non-empty variants",
                        group_index,
                )
                return 0

        group_vars = _as_vars(raw.get("vars"))
        include_example = bool(raw.get("include_example", True))
        target_mechanic = _normalize_target_mechanic(raw.get("target_mechanic"))

        stored = 0
        for vidx, vr in enumerate(variants_raw):
                if not isinstance(vr, dict):
                        logger.warning(
                                "Preload entries[%s] variants[%s] skipped: not a mapping",
                                group_index,
                                vidx,
                        )
                        continue
                variant = cast(dict[str, Any], vr)
                grade_level = str(variant.get("grade_level", "")).strip()
                interest_raw = variant.get("student_interest")
                if interest_raw is None:
                        interest_raw = variant.get("interest")
                if interest_raw is None:
                        logger.warning(
                                "Preload entries[%s] variants[%s]: missing student_interest/interest",
                                group_index,
                                vidx,
                        )
                        continue
                student_interest = str(interest_raw).strip()

                resp_raw = variant.get("response")
                if resp_raw is None:
                        logger.warning(
                                "Preload entries[%s] variants[%s]: missing response",
                                group_index,
                                vidx,
                        )
                        continue

                merged = dict(group_vars)
                merged.update(_as_vars(variant.get("vars")))

                formatted_prompt = _format_template(
                        prompt_template,
                        merged,
                        label=f"entries[{group_index}] variants[{vidx}] prompt",
                )
                english = _format_template(
                        str(resp_raw),
                        merged,
                        label=f"entries[{group_index}] variants[{vidx}] response",
                )

                # Keys must match production: explain_information_card uses per-grade rules only
                # (no grade_rules_range). YAML may still list grade_rules_range for humans.
                _, _, messages = build_information_card_messages(
                        formatted_prompt,
                        grade_level=grade_level,
                        student_interest=student_interest,
                        target_mechanic=target_mechanic,
                        include_example=include_example,
                )
                key = cache.make_key(messages)
                await _store_preload(cache, key, AIMessage(content=english))
                stored += 1

                nep_raw = variant.get("nepali_response")
                if nep_raw is None:
                        continue
                nepali = _format_template(
                        str(nep_raw),
                        merged,
                        label=f"entries[{group_index}] variants[{vidx}] nepali_response",
                )
                tr_messages = build_translate_messages(english)
                tr_key = cache.make_key(tr_messages)
                await _store_preload(cache, tr_key, AIMessage(content=nepali))
                stored += 1

        return stored


async def _seed_translate_entry(
        cache: CacheService,
        raw: dict[str, Any],
        *,
        entry_index: int,
) -> int:
        text_raw = raw.get("text")
        resp_raw = raw.get("response")
        if text_raw is None or resp_raw is None:
                logger.warning(
                        "Preload entries[%s]: translate requires text and response",
                        entry_index,
                )
                return 0
        vars_ctx = _as_vars(raw.get("vars"))
        text = _format_template(
                str(text_raw),
                vars_ctx,
                label=f"entries[{entry_index}] translate text",
        )
        response = _format_template(
                str(resp_raw),
                vars_ctx,
                label=f"entries[{entry_index}] translate response",
        )
        messages = build_translate_messages(text)
        key = cache.make_key(messages)
        await _store_preload(cache, key, AIMessage(content=response))
        return 1


async def seed_preload_cache(cache: CacheService) -> None:
        cfg = ConfigManager().cache_config()
        if not cfg.enabled:
                logger.debug("Cache disabled; skipping preload")
                return
        if not cfg.preload_enabled:
                logger.debug("Preload disabled in config; skipping preload")
                return
        rel = cfg.preload_file
        if not rel:
                logger.debug("No preload_file configured; skipping preload")
                return

        path = _SERVER_ROOT / str(rel).strip()
        if not path.is_file():
                logger.warning("Preload file not found: %s", path)
                return

        try:
                data = load_yaml(str(path))
        except Exception:
                logger.exception("Failed to load preload YAML from %s", path)
                return

        if not isinstance(data, dict):
                logger.warning("Preload YAML root must be a mapping")
                return

        entries_raw = data.get("entries")
        if not isinstance(entries_raw, list):
                logger.warning("Preload YAML missing entries list")
                return

        total = 0
        for idx, item in enumerate(entries_raw):
                if not isinstance(item, dict):
                        logger.warning("Preload entries[%s] skipped: not a mapping", idx)
                        continue
                raw_entry = cast(dict[str, Any], item)
                task = str(raw_entry.get("task") or "information_card").strip().lower()
                if task == "information_card":
                        total += await _seed_information_card_group(
                                cache,
                                raw_entry,
                                group_index=idx,
                        )
                elif task == "translate":
                        total += await _seed_translate_entry(
                                cache,
                                raw_entry,
                                entry_index=idx,
                        )
                else:
                        logger.warning(
                                "Preload entries[%s]: unknown task %r",
                                idx,
                                task,
                        )

        logger.info(
                "Preload seeded %s cache entries from %s",
                total,
                path,
        )
