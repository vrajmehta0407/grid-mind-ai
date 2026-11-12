"""Agent run audit logger (agents.md Shared Rule 3)."""

import hashlib
import json
import time
from dataclasses import dataclass, field
from typing import Any


@dataclass
class AgentRunRecord:
    agent_name: str
    input_hash: str
    tool_calls: list[str] = field(default_factory=list)
    latency_ms: int = 0
    cost_usd: float = 0.0
    status: str = "ok"
    user_id: str | None = None
    created_at: float = field(default_factory=time.time)


class AgentRunLogger:
    """In-memory ring buffer + optional DB sink for agent execution audits."""

    def __init__(self, max_entries: int = 500) -> None:
        self._records: list[AgentRunRecord] = []
        self._max_entries = max_entries

    @staticmethod
    def hash_payload(payload: Any) -> str:
        serialized = json.dumps(payload, sort_keys=True, default=str)
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()[:16]

    def log(
        self,
        agent_name: str,
        payload: Any,
        tool_calls: list[str],
        latency_ms: int,
        cost_usd: float = 0.0,
        status: str = "ok",
        user_id: str | None = None,
    ) -> AgentRunRecord:
        record = AgentRunRecord(
            agent_name=agent_name,
            input_hash=self.hash_payload(payload),
            tool_calls=tool_calls,
            latency_ms=latency_ms,
            cost_usd=cost_usd,
            status=status,
            user_id=user_id,
        )
        self._records.append(record)
        if len(self._records) > self._max_entries:
            self._records.pop(0)
        return record

    def recent(self, limit: int = 50) -> list[dict[str, Any]]:
        return [
            {
                "agent_name": r.agent_name,
                "input_hash": r.input_hash,
                "tool_calls": r.tool_calls,
                "latency_ms": r.latency_ms,
                "cost_usd": r.cost_usd,
                "status": r.status,
                "user_id": r.user_id,
                "created_at": r.created_at,
            }
            for r in self._records[-limit:]
        ]


agent_logger = AgentRunLogger()

