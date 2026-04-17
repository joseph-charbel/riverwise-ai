from __future__ import annotations

import hashlib

from langchain_core.messages import AIMessage, BaseMessage

from app.config.base_config import CacheConfig
from app.cache.provider import CacheProvider
from app.logging_config import get_logger

logger = get_logger(__name__)


class CacheService:
        """Thin orchestration layer between Model and a CacheProvider.

        When enabled=False, get() always returns None and set() is a no-op so
        Model code requires no branching.
        """

        def __init__(
                self,
                config: CacheConfig,
                *,
                provider: CacheProvider,
        ) -> None:
                self._config = config
                self._provider = provider

        def make_key(self, messages: list[BaseMessage]) -> str:
                """SHA-256 of concatenated message contents."""
                raw = "".join(str(m.content) for m in messages)
                return hashlib.sha256(raw.encode()).hexdigest()

        async def get(self, key: str) -> AIMessage | None:
                if not self._config.enabled:
                        return None
                result = await self._provider.get(key)
                if result is not None:
                        logger.debug("Cache hit key=%s", key[:12])
                return result

        async def set(self, key: str, value: AIMessage) -> None:
                if not self._config.enabled:
                        return
                await self._provider.set(key, value, ttl=self._config.ttl)
                logger.debug("Cache stored key=%s", key[:12])

        async def clear(self) -> None:
                await self._provider.clear()
