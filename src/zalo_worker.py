"""Run separately: python -m src.zalo_worker. Never send in an HTTP request."""

import asyncio
import base64
import hashlib
import logging
from datetime import UTC, datetime

from fastapi import HTTPException
from sqlalchemy import text

from src.db import AsyncSessionLocal
from src.services.zalo_bridge import bridge

log = logging.getLogger(__name__)


async def tick(campaign_id=None):
    async with AsyncSessionLocal() as db:
        # One dispatcher per transaction; no session locks (compatible with transaction poolers).
        async with db.begin():
            if not (await db.execute(text("SELECT pg_try_advisory_xact_lock(9701601)"))).scalar():
                return
            # Reconcile interrupted sends using the bridge's persistent idempotency journal.
            row = (
                (
                    await db.execute(
                        text("""
                SELECT d.*,c.dealer_id,c.created_by AS user_id,c.account_uid,c.status AS campaign_status,
                       (z.consent_at IS NOT NULL AND NOT z.opted_out AND z.zalo_uid=d.zalo_uid
                        AND z.dealer_id=c.dealer_id AND z.account_uid=c.account_uid AND l.dealer_id=c.dealer_id
                        AND q.status='approved' AND q.lead_id=l.id AND sender.is_active
                        AND (sender.role='admin' OR (sender.role='seller' AND sender.dealer_id=c.dealer_id
                             AND l.assigned_to=sender.id AND q.seller_id=sender.id))) AS eligible
                FROM zalo_deliveries d JOIN zalo_campaigns c ON c.id=d.campaign_id
                JOIN leads l ON l.id=d.lead_id JOIN quotes q ON q.id=d.quote_id
                JOIN users sender ON sender.id=c.created_by
                LEFT JOIN zalo_contacts z ON z.lead_id=d.lead_id AND z.user_id=c.created_by
                WHERE (d.status='sending' OR (d.status='pending' AND c.status='active'))
                  AND (CAST(:campaign_id AS uuid) IS NULL OR c.id=CAST(:campaign_id AS uuid))
                ORDER BY (d.status='sending') DESC,d.updated_at,d.id
                LIMIT 1 FOR UPDATE OF d,c SKIP LOCKED
            """),
                        {"campaign_id": campaign_id},
                    )
                )
                .mappings()
                .first()
            )
            if not row:
                await db.execute(
                    text("""UPDATE zalo_campaigns c SET status='done' WHERE status='active'
                    AND (CAST(:campaign_id AS uuid) IS NULL OR c.id=CAST(:campaign_id AS uuid))
                    AND NOT EXISTS (SELECT FROM zalo_deliveries d WHERE d.campaign_id=c.id
                                    AND d.status IN ('pending','sending'))"""),
                    {"campaign_id": campaign_id},
                )
                return
            # No external call has happened for pending records. Revoked consent stops them.
            if row["status"] == "pending" and not row["eligible"]:
                result = {"status": "skipped", "error": "Quyền nhận tin hoặc báo giá không còn hợp lệ"}
            elif row["status"] == "sending":
                result = await bridge("GET", row["user_id"], f"/jobs/{row['id']}")
                if result["status"] == "missing":
                    if (datetime.now(UTC).replace(tzinfo=None) - row["updated_at"]).total_seconds() < 120:
                        # Another worker may have committed sending but not reached the bridge yet.
                        return
                    # Could have been sent before journal loss. Never automatically repeat.
                    result = {"status": "unknown", "error": "Không tìm thấy nhật ký gửi; cần đối soát"}
            else:
                # Commit sending BEFORE invoking provider. Crash recovery only queries the journal.
                await db.execute(
                    text(
                        "UPDATE zalo_deliveries SET status='sending',updated_at=now() AT TIME ZONE 'UTC' WHERE id=:id"
                    ),
                    {"id": row["id"]},
                )
                # Outbox commit intentionally releases advisory lock; bridge serializes account sends.
                await db.commit()
                payload = {
                    "id": str(row["id"]),
                    "account_uid": row["account_uid"],
                    "uid": row["zalo_uid"],
                    "message": row["message"],
                }
                if row.get("pdf_data") is not None:
                    content = bytes(row["pdf_data"])
                    payload["attachment"] = {
                        "name": row["pdf_name"],
                        "base64": base64.b64encode(content).decode("ascii"),
                        "sha256": hashlib.sha256(content).hexdigest(),
                    }
                try:
                    result = await bridge(
                        "POST",
                        row["user_id"],
                        "/send",
                        payload,
                    )
                except HTTPException:
                    # Retain sending; next tick queries journal, never repeats POST on uncertainty.
                    return
                async with AsyncSessionLocal() as update_db:
                    await store_result(update_db, row["id"], result)
                    await update_db.commit()
                return
            await store_result(db, row["id"], result)


async def store_result(db, delivery_id, result):
    status = result.get("status")
    if status in {"sending"}:
        return
    if status == "deferred":
        status = "pending"  # Bridge guarantees no provider call and no journal entry.
    if status not in {"pending", "sent", "failed", "unknown", "skipped"}:
        status = "unknown"
    await db.execute(
        text("""UPDATE zalo_deliveries SET status=:status,error=:error,provider_id=:provider,
        updated_at=now() AT TIME ZONE 'UTC' WHERE id=:id AND status IN ('pending','sending')"""),
        {"id": delivery_id, "status": status, "error": result.get("error"), "provider": result.get("provider_id")},
    )


async def main():
    logging.basicConfig(level=logging.INFO)
    while True:
        try:
            await tick()
        except Exception:
            log.warning("Zalo dispatcher unavailable; retrying on next tick", exc_info=False)
        await asyncio.sleep(5)


if __name__ == "__main__":
    asyncio.run(main())
