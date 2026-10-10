"""
KrishiMitra WebSocket Connection Manager
Decoupled module to manage farm WebSocket rooms and prevent circular imports between main and routers.
"""
import json
from typing import Dict, Set
from fastapi import WebSocket


class ConnectionManager:
    """Manages WebSocket connections grouped by farm_id rooms."""

    def __init__(self):
        self.rooms: Dict[int, Set[WebSocket]] = {}

    async def connect(self, ws: WebSocket, farm_id: int) -> None:
        await ws.accept()
        if farm_id not in self.rooms:
            self.rooms[farm_id] = set()
        self.rooms[farm_id].add(ws)

    def disconnect(self, ws: WebSocket, farm_id: int) -> None:
        if farm_id in self.rooms:
            self.rooms[farm_id].discard(ws)
            if not self.rooms[farm_id]:
                del self.rooms[farm_id]

    async def broadcast(self, farm_id: int, data: dict) -> None:
        if farm_id not in self.rooms:
            return
        message = json.dumps(data)
        dead: list[WebSocket] = []
        for ws in self.rooms[farm_id]:
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.rooms[farm_id].discard(ws)

    async def broadcast_all(self, data: dict) -> None:
        message = json.dumps(data)
        for farm_id in list(self.rooms.keys()):
            dead: list[WebSocket] = []
            for ws in self.rooms[farm_id]:
                try:
                    await ws.send_text(message)
                except Exception:
                    dead.append(ws)
            for ws in dead:
                self.rooms[farm_id].discard(ws)

    def active_connections_count(self) -> int:
        return sum(len(v) for v in self.rooms.values())


# Singleton manager
ws_manager = ConnectionManager()


def get_ws_manager() -> ConnectionManager:
    return ws_manager
