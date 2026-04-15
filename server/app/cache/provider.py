from __future__ import annotations

import time
from abc import ABC, abstractmethod

from langchain_core.messages import AIMessage


class CacheProvider(ABC):
        @abstractmethod
        async def get(self, key: str) -> AIMessage | None:
                """Return cached AIMessage, or None on miss."""
                ...

        @abstractmethod
        async def set(self, key: str, value: AIMessage, ttl: int | None = None) -> None:
                """Store value under key with optional TTL in seconds."""
                ...

        @abstractmethod
        async def clear(self) -> None:
                """Evict all entries."""
                ...


class InMemoryCacheProvider(CacheProvider):
        """Dict-backed cache with optional per-entry TTL."""

        def __init__(self) -> None:
                # key -> (AIMessage, expiry_ts | None)
                self._store: dict[str, tuple[AIMessage, float | None]] = {}

        async def get(self, key: str) -> AIMessage | None:
                entry = self._store.get(key)
                if entry is None:
                        return None
                value, expiry = entry
                if expiry is not None and time.monotonic() > expiry:
                        del self._store[key]
                        return None
                return value

        async def set(self, key: str, value: AIMessage, ttl: int | None = None) -> None:
                expiry = time.monotonic() + ttl if ttl and ttl > 0 else None
                self._store[key] = (value, expiry)

        async def clear(self) -> None:
                self._store.clear()
