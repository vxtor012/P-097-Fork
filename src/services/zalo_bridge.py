"""Private bridge client. Credentials never pass through the browser."""

import httpx
from fastapi import HTTPException

from src.config import get_settings


async def bridge(method, user_id, action="", payload=None):
    settings = get_settings()
    if len(settings.zalo_bridge_token) < 32:
        raise HTTPException(503, "Chưa cấu hình dịch vụ kết nối Zalo")
    try:
        timeout = 60 if action == "/send" and payload and payload.get("attachment") else 12
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.request(
                method,
                f"{settings.zalo_bridge_url.rstrip('/')}/accounts/{user_id}{action}",
                headers={"Authorization": f"Bearer {settings.zalo_bridge_token}"},
                json=payload,
            )
        if response.is_error:
            raise HTTPException(503, "Dịch vụ Zalo chưa sẵn sàng. Vui lòng kiểm tra kết nối.")
        return response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(503, "Không kết nối được dịch vụ Zalo") from exc
