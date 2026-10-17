"""Conversation ownership and server-side eligibility loading."""

import hashlib
import hmac
import re
from uuid import UUID

from fastapi import Depends, HTTPException, Request
from sqlalchemy import select, text

from src.db import get_db
from src.orm_models import ConversationThread, EligibilityVerification
from src.services.auth import get_current_session, get_current_user, oauth2_scheme


async def optional_customer(token=Depends(oauth2_scheme), db=Depends(get_db, scope="function")):
    if token is None:
        return None
    session = await get_current_session(token, db)
    return await get_current_user(session, db)


async def owned_thread(session_id, request: Request, db, user=None, *, create=False):
    try:
        session_id = str(UUID(str(session_id)))
    except ValueError:
        raise HTTPException(422, "Ma phien khong hop le") from None
    secret = request.headers.get("x-chat-secret", "")
    digest = hashlib.sha256(secret.encode()).hexdigest() if re.fullmatch(r"[a-f0-9]{64}", secret) else None
    await db.execute(text("SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))"), {"key": "chat:" + session_id})
    thread = (await db.execute(select(ConversationThread).where(ConversationThread.id == session_id))).scalar_one_or_none()
    if thread is None:
        if not user and not digest:
            raise HTTPException(403, "Can secret cua phien hoi thoai")
        if not create:
            raise HTTPException(404, "Khong tim thay phien hoi thoai")
        thread = ConversationThread(id=session_id, user_id=user.id if user else None,
                                    guest_secret_hash=None if user else digest, messages=[], profile={})
        db.add(thread)
        await db.flush()
        return thread
    if thread.user_id:
        allowed = user and thread.user_id == user.id
    else:
        # Null/null legacy threads are deliberately not claimable by UUID holders.
        allowed = digest and thread.guest_secret_hash and hmac.compare_digest(digest, thread.guest_secret_hash)
    if not allowed:
        raise HTTPException(403, "Ban khong co quyen truy cap phien hoi thoai nay")
    return thread


async def eligibility_tables(thread, db):
    rows = (await db.execute(select(EligibilityVerification).where(
        EligibilityVerification.session_id == thread.id))).scalars().all()
    return {"subject_id": thread.id, "eligibility_verifications": [
        {c.name: getattr(row, c.name) for c in EligibilityVerification.__table__.columns}
        for row in rows if row.session_id == thread.id
    ]}
