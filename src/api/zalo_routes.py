"""Personal staff Zalo connections with dealer- and owner-scoped campaigns."""

import asyncio
import re
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.business_routes import pdf_response
from src.db import get_db
from src.orm_models import Lead, Quote, QuoteStatus, User
from src.services.access import dealer_scope, sales_user
from src.services.auth import utcnow
from src.services.zalo_bridge import bridge

router = APIRouter(prefix="/zalo", tags=["Zalo"])
DEFAULT_TEMPLATE = "Chào {name}, em gửi báo giá {model} {version}: {price} VNĐ (dự toán lăn bánh). Anh/chị phản hồi để em hỗ trợ thêm nhé."
TOKENS = {"name", "model", "version", "price"}
MAX_PDF_BYTES = 1024 * 1024


class QuoteReviewBatch(BaseModel):
    quote_ids: list[UUID] = Field(min_length=1)

    @field_validator("quote_ids")
    @classmethod
    def unique_quote_ids(cls, value):
        if len(value) != len(set(value)):
            raise ValueError("Danh sách báo giá bị trùng")
        return value


async def quote_review_batch(body, user, db, lock=False):
    dealer = scope(user, None)
    query = select(Quote, Lead).join(Lead, Lead.id == Quote.lead_id).where(Quote.id.in_(body.quote_ids))
    if dealer is not None:
        query = query.where(Lead.dealer_id == dealer)
    if lock:
        query = query.with_for_update(of=Quote)
    rows = (await db.execute(query)).all()
    by_id = {str(quote.id): (quote, lead) for quote, lead in rows}
    account = await bridge("GET", user.id)
    account_uid = account.get("uid") if account.get("status") == "connected" else None
    contacts = (await db.execute(
        text("SELECT * FROM zalo_contacts WHERE user_id=:user"), {"user": user.id}
    )).mappings().all()
    contact_map = {str(contact["lead_id"]): contact for contact in contacts}
    ready, blocked, seen = [], [], set()
    for quote_id in body.quote_ids:
        quote, lead = by_id.get(str(quote_id), (None, None))
        reason = None
        if quote is None:
            reason = "Không tìm thấy báo giá trong phạm vi tài khoản của bạn."
        elif quote.status != QuoteStatus.pending:
            reason = "Báo giá này không còn ở trạng thái chờ duyệt."
        elif staff_filter(user) is not None and lead.assigned_to != user.id:
            reason = "Khách hàng chưa được giao cho bạn."
        elif not account_uid:
            reason = "Tài khoản Zalo của bạn chưa kết nối."
        else:
            contact = contact_map.get(str(lead.id))
            if not contact:
                reason = "Chưa liên kết khách hàng với người nhận Zalo."
            elif not contact["consent_at"] or contact["opted_out"]:
                reason = "Khách hàng chưa đồng ý nhận tin Zalo hoặc đã từ chối nhận tin."
            elif contact["account_uid"] != account_uid:
                reason = "Người nhận đang liên kết với tài khoản Zalo khác."
            elif contact["zalo_uid"] in seen:
                reason = "Một khách hàng chỉ nhận một báo giá trong mỗi lần gửi."
        if reason:
            blocked.append({"id": str(quote_id), "buyer_name": quote.buyer_name if quote else None,
                            "model": quote.model if quote else None, "reason": reason})
        else:
            seen.add(contact["zalo_uid"])
            ready.append({"quote": quote, "lead": lead, "contact": contact})
    return ready, blocked, account_uid


@router.post("/quote-review/preview")
async def preview_quote_review(
    body: QuoteReviewBatch,
    user: User = Depends(sales_user),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    ready, blocked, account_uid = await quote_review_batch(body, user, db)
    return {
        "ready": [{"id": str(item["quote"].id), "buyer_name": item["quote"].buyer_name,
                   "model": item["quote"].model, "version": item["quote"].version,
                   "final_price": item["quote"].final_price} for item in ready],
        "blocked": blocked,
        "zalo_connected": bool(account_uid),
    }


@router.post("/quote-review/approve-and-send", status_code=201)
async def approve_and_send_quote_batch(
    body: QuoteReviewBatch,
    user: User = Depends(sales_user),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    ready, blocked, account_uid = await quote_review_batch(body, user, db, lock=True)
    if blocked or len(ready) != len(body.quote_ids):
        raise HTTPException(409, "Một số báo giá không còn đủ điều kiện. Hãy làm mới danh sách và kiểm tra lại.")
    dealers = {item["lead"].dealer_id for item in ready}
    if len(dealers) != 1 or None in dealers:
        raise HTTPException(422, "Mỗi lượt gửi chỉ áp dụng cho báo giá thuộc cùng một đại lý.")
    dealer = next(iter(dealers))
    campaign_id = uuid4()
    deliveries = []
    for item in ready:
        quote, lead, contact = item["quote"], item["lead"], item["contact"]
        try:
            pdf_data = (await asyncio.to_thread(pdf_response, quote)).body
        except Exception as exc:
            raise HTTPException(422, "Không tạo được PDF cho một báo giá. Chưa có báo giá nào được duyệt.") from exc
        if not pdf_data.startswith(b"%PDF-") or len(pdf_data) > MAX_PDF_BYTES:
            raise HTTPException(422, "PDF báo giá không hợp lệ hoặc vượt quá 1 MB. Chưa có báo giá nào được duyệt.")
        deliveries.append({
            "id": uuid4(), "campaign": campaign_id, "lead": lead.id, "quote": quote.id,
            "uid": contact["zalo_uid"], "message": render_message(DEFAULT_TEMPLATE, quote),
            "pdf_data": pdf_data, "pdf_name": f"P97_BaoGia_{quote.id}.pdf",
        })
    for item in ready:
        quote = item["quote"]
        quote.status = QuoteStatus.approved
        quote.seller_id = user.id
        quote.reviewed_at = utcnow()
    await db.execute(text("""INSERT INTO zalo_campaigns
        (id,dealer_id,created_by,name,template,account_uid,status,attach_pdf)
        VALUES (:id,:dealer,:user,:name,:template,:account,'active',TRUE)"""), {
            "id": campaign_id, "dealer": dealer, "user": user.id,
            "name": f"Báo giá duyệt {utcnow():%d/%m/%Y %H:%M}",
            "template": DEFAULT_TEMPLATE, "account": account_uid,
        })
    await db.execute(text("""INSERT INTO zalo_deliveries
        (id,campaign_id,lead_id,quote_id,zalo_uid,message,pdf_data,pdf_name)
        VALUES (:id,:campaign,:lead,:quote,:uid,:message,:pdf_data,:pdf_name)"""), deliveries)
    return {"campaign_id": str(campaign_id), "approved": len(ready), "queued": len(deliveries)}


def scope(user, requested):
    return dealer_scope(user, requested)


def staff_filter(user):
    return None if user.role.value == "admin" else user.id


def render_message(template, quote):
    fields = set(re.findall(r"\{([^{}]*)\}", template))
    if fields - TOKENS or re.search(r"[{}]", re.sub(r"\{[^{}]*\}", "", template)):
        raise HTTPException(422, "Chỉ hỗ trợ {name}, {model}, {version}, {price}")
    values = {
        "name": quote.buyer_name or "anh/chị",
        "model": quote.model or "",
        "version": quote.version or "",
        "price": f"{quote.final_price:,}".replace(",", "."),
    }
    message = re.sub(r"\{([^{}]*)\}", lambda m: values[m[1]], template)
    if len(message) > 2900 or not message.strip():
        raise HTTPException(422, "Nội dung sau khi điền thông tin khách quá dài hoặc trống")
    return message


@router.get("/connection")
async def connection(dealer_id: UUID | None = None, user: User = Depends(sales_user)):
    scope(user, dealer_id)
    return await bridge("GET", user.id)


@router.post("/connection")
async def connect(dealer_id: UUID | None = None, user: User = Depends(sales_user)):
    scope(user, dealer_id)
    return await bridge("POST", user.id, "/connect")


@router.delete("/connection")
async def disconnect(dealer_id: UUID | None = None, user: User = Depends(sales_user)):
    scope(user, dealer_id)
    return await bridge("DELETE", user.id)


@router.get("/friends")
async def friends(dealer_id: UUID | None = None, user: User = Depends(sales_user)):
    scope(user, dealer_id)
    return await bridge("GET", user.id, "/friends")


class ContactBody(BaseModel):
    zalo_uid: str = Field(pattern=r"^\d{1,100}$")
    consent: bool
    consent_note: str = Field(min_length=1, max_length=500)
    opted_out: bool = False


class ResolveBody(BaseModel):
    phone: str = Field(pattern=r"^0\d{9}$")


@router.post("/recipients/resolve")
async def resolve_recipient(body: ResolveBody, dealer_id: UUID | None = None, user: User = Depends(sales_user)):
    scope(user, dealer_id)
    result = await bridge("POST", user.id, "/resolve", {"phone": body.phone})
    if not result.get("uid"):
        raise HTTPException(422, "Không tìm thấy người nhận. Hãy chọn trực tiếp từ danh bạ Zalo.")
    if not result.get("is_friend"):
        raise HTTPException(422, "Người nhận chưa có trong danh bạ Zalo của bạn")
    return result


@router.put("/contacts/{lead_id}")
async def save_contact(
    lead_id: UUID,
    body: ContactBody,
    dealer_id: UUID | None = None,
    user: User = Depends(sales_user),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    dealer = scope(user, dealer_id)
    query = select(Lead).where(Lead.id == lead_id)
    if dealer is not None:
        query = query.where(Lead.dealer_id == dealer)
    if staff_filter(user) is not None:
        query = query.where(Lead.assigned_to == user.id)
    lead = (await db.execute(query)).scalar_one_or_none()
    if not lead:
        raise HTTPException(404, "Không tìm thấy khách hàng trong phạm vi của bạn")
    dealer = lead.dealer_id
    if not body.consent or body.opted_out:
        await db.execute(
            text("""UPDATE zalo_contacts SET consent_at=NULL,opted_out=:out,
            consent_note=:note,updated_by=:user,updated_at=now() AT TIME ZONE 'UTC'
            WHERE lead_id=:lead AND dealer_id=:dealer AND user_id=:user"""),
            {"lead": lead_id, "dealer": dealer, "out": body.opted_out, "note": body.consent_note, "user": user.id},
        )
        return {"message": "Đã ngừng cho phép gửi tin tới khách hàng"}
    contacts = await bridge("GET", user.id, "/friends")
    account = await bridge("GET", user.id)
    if account.get("status") != "connected":
        raise HTTPException(409, "Hãy kết nối Zalo trước khi lưu người nhận")
    if body.zalo_uid not in {str(f["uid"]) for f in contacts["friends"]}:
        raise HTTPException(422, "Hãy chọn người nhận từ danh bạ Zalo đã kết nối")
    try:
        await db.execute(
            text("""
            INSERT INTO zalo_contacts (user_id,lead_id,dealer_id,zalo_uid,account_uid,consent_at,consent_note,opted_out,updated_by)
            VALUES (:user,:lead,:dealer,:uid,:account,CASE WHEN :consent THEN now() AT TIME ZONE 'UTC' END,:note,:out,:user)
            ON CONFLICT (user_id,lead_id) DO UPDATE SET dealer_id=EXCLUDED.dealer_id,zalo_uid=EXCLUDED.zalo_uid,account_uid=EXCLUDED.account_uid,consent_at=EXCLUDED.consent_at,
              consent_note=EXCLUDED.consent_note,opted_out=EXCLUDED.opted_out,updated_by=EXCLUDED.updated_by,
              updated_at=now() AT TIME ZONE 'UTC'
        """),
            {
                "lead": lead_id,
                "dealer": dealer,
                "uid": body.zalo_uid,
                "consent": body.consent,
                "note": body.consent_note,
                "out": body.opted_out,
                "user": user.id,
                "account": account["uid"],
            },
        )
    except IntegrityError as exc:
        raise HTTPException(409, "Người nhận Zalo đã được liên kết với khách hàng khác") from exc
    return {"message": "Đã lưu người nhận và quyền nhận tin"}


@router.get("/candidates")
async def candidates(
    dealer_id: UUID | None = None,
    user: User = Depends(sales_user),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    rows = (
        (
            await db.execute(
                text("""
        SELECT q.id,q.buyer_name,q.model,q.version,q.final_price,l.id AS lead_id,l.phone,l.dealer_id,
               z.zalo_uid,z.account_uid,z.consent_note,z.opted_out,
               (z.consent_at IS NOT NULL AND NOT z.opted_out) AS consent
        FROM quotes q JOIN leads l ON l.id=q.lead_id
        LEFT JOIN zalo_contacts z ON z.lead_id=l.id AND z.dealer_id=l.dealer_id AND z.user_id=:user
        WHERE (CAST(:dealer AS uuid) IS NULL OR l.dealer_id=:dealer) AND q.status='approved'
          AND (CAST(:seller AS uuid) IS NULL OR (l.assigned_to=:seller AND q.seller_id=:seller))
        ORDER BY q.created_at DESC LIMIT 500
    """),
                {"dealer": scope(user, dealer_id), "seller": staff_filter(user), "user": user.id},
            )
        )
        .mappings()
        .all()
    )
    return {"quotes": [dict(r) for r in rows], "template": DEFAULT_TEMPLATE}


class CampaignBody(BaseModel):
    id: UUID
    name: str = Field(min_length=1, max_length=200)
    template: str = Field(min_length=1, max_length=1500)
    quote_ids: list[UUID] = Field(min_length=1, max_length=200)
    attach_pdf: bool = False

    @field_validator("name", "template")
    @classmethod
    def nonblank(cls, value):
        if not value.strip():
            raise ValueError("Không được để trống nội dung")
        return value.strip()


@router.post("/campaigns", status_code=201)
async def create_campaign(
    body: CampaignBody,
    dealer_id: UUID | None = None,
    user: User = Depends(sales_user),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    dealer = scope(user, dealer_id)
    existing = (
        (await db.execute(text("SELECT id,dealer_id,created_by FROM zalo_campaigns WHERE id=:id"), {"id": body.id}))
        .mappings()
        .first()
    )
    if existing:
        if existing["created_by"] != user.id or (dealer is not None and existing["dealer_id"] != dealer):
            raise HTTPException(409, "Mã chiến dịch đã được sử dụng")
        return {"id": body.id}
    account = await bridge("GET", user.id)
    if account.get("status") != "connected":
        raise HTTPException(409, "Hãy kết nối Zalo trước khi tạo chiến dịch")
    query = select(Quote).join(Lead, Lead.id == Quote.lead_id).where(
        Quote.id.in_(body.quote_ids), Quote.status == QuoteStatus.approved
    )
    if dealer is not None:
        query = query.where(Lead.dealer_id == dealer)
    if staff_filter(user) is not None:
        query = query.where(Lead.assigned_to == user.id, Quote.seller_id == user.id)
    quotes = (await db.execute(query)).scalars().all()
    if len(quotes) != len(set(body.quote_ids)):
        raise HTTPException(422, "Chỉ chọn báo giá đã duyệt thuộc phạm vi của bạn")
    if dealer is None:
        dealers = (await db.execute(select(Lead.dealer_id).where(
            Lead.id.in_([q.lead_id for q in quotes])
        ).distinct())).scalars().all()
        if len(dealers) != 1 or dealers[0] is None:
            raise HTTPException(422, "Mỗi chiến dịch chỉ chọn báo giá của một đại lý; hãy dùng bộ lọc đại lý")
        dealer = dealers[0]
    contacts = (
        (await db.execute(text("SELECT * FROM zalo_contacts WHERE dealer_id=:dealer AND user_id=:user"),
                          {"dealer": dealer, "user": user.id}))
        .mappings()
        .all()
    )
    contact_map = {c["lead_id"]: c for c in contacts}
    seen = set()
    deliveries = []
    for quote in quotes:
        contact = contact_map.get(quote.lead_id)
        if not contact or not contact["consent_at"] or contact["opted_out"] or contact["account_uid"] != account["uid"]:
            raise HTTPException(422, "Có khách chưa liên kết Zalo hoặc chưa đồng ý nhận tin")
        if contact["zalo_uid"] in seen:
            raise HTTPException(422, "Mỗi khách chỉ được chọn một báo giá trong chiến dịch")
        seen.add(contact["zalo_uid"])
        pdf_data = None
        pdf_name = None
        if body.attach_pdf:
            try:
                pdf_data = (await asyncio.to_thread(pdf_response, quote)).body
            except Exception as exc:
                raise HTTPException(422, "Không tạo được PDF từ báo giá đã duyệt. Vui lòng kiểm tra lại báo giá.") from exc
            if not pdf_data.startswith(b"%PDF-") or len(pdf_data) > MAX_PDF_BYTES:
                raise HTTPException(422, "PDF báo giá không hợp lệ hoặc vượt quá 1 MB")
            pdf_name = f"P97_BaoGia_{quote.id}.pdf"
        deliveries.append(
            {
                "id": uuid4(),
                "campaign": body.id,
                "lead": quote.lead_id,
                "quote": quote.id,
                "uid": contact["zalo_uid"],
                "message": render_message(body.template, quote),
                "pdf_data": pdf_data,
                "pdf_name": pdf_name,
            }
        )
    inserted = (
        await db.execute(
            text("""INSERT INTO zalo_campaigns (id,dealer_id,created_by,name,template,account_uid,attach_pdf)
        VALUES (:id,:dealer,:user,:name,:template,:account,:pdf) ON CONFLICT (id) DO NOTHING RETURNING id"""),
            {
                "id": body.id,
                "dealer": dealer,
                "user": user.id,
                "name": body.name,
                "template": body.template,
                "account": account["uid"],
                "pdf": body.attach_pdf,
            },
        )
    ).scalar()
    if not inserted:
        existing = (await db.execute(text("SELECT dealer_id,created_by FROM zalo_campaigns WHERE id=:id"),
                                     {"id": body.id})).mappings().first()
        if not existing or existing["dealer_id"] != dealer or existing["created_by"] != user.id:
            raise HTTPException(409, "Mã chiến dịch đã được sử dụng")
        return {"id": body.id}
    await db.execute(
        text("""INSERT INTO zalo_deliveries (id,campaign_id,lead_id,quote_id,zalo_uid,message,pdf_data,pdf_name)
        VALUES (:id,:campaign,:lead,:quote,:uid,:message,:pdf_data,:pdf_name)"""),
        deliveries,
    )
    return {"id": body.id}


@router.get("/campaigns")
async def campaigns(
    dealer_id: UUID | None = None,
    user: User = Depends(sales_user),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    rows = (
        (
            await db.execute(
                text("""
        SELECT c.id,c.name,c.status,c.created_at,c.attach_pdf,COUNT(d.id) AS total,
          COUNT(d.id) FILTER (WHERE d.status='sent') AS sent,
          COUNT(d.id) FILTER (WHERE d.status IN ('failed','unknown','skipped')) AS attention
        FROM zalo_campaigns c LEFT JOIN zalo_deliveries d ON d.campaign_id=c.id
        WHERE c.created_by=:user AND (CAST(:dealer AS uuid) IS NULL OR c.dealer_id=:dealer)
        GROUP BY c.id ORDER BY c.created_at DESC LIMIT 100
    """),
                {"dealer": scope(user, dealer_id), "user": user.id},
            )
        )
        .mappings()
        .all()
    )
    return {"campaigns": [dict(r) for r in rows]}


async def get_campaign(campaign_id, dealer, user_id, db):
    row = (
        (
            await db.execute(
                text("""SELECT * FROM zalo_campaigns WHERE id=:id AND created_by=:user
                    AND (CAST(:dealer AS uuid) IS NULL OR dealer_id=:dealer) FOR UPDATE"""),
                {"id": campaign_id, "dealer": dealer, "user": user_id},
            )
        )
        .mappings()
        .first()
    )
    if not row:
        raise HTTPException(404, "Không tìm thấy chiến dịch")
    return row


@router.get("/campaigns/{campaign_id}")
async def campaign_detail(
    campaign_id: UUID,
    dealer_id: UUID | None = None,
    user: User = Depends(sales_user),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    await get_campaign(campaign_id, scope(user, dealer_id), user.id, db)
    rows = (
        (
            await db.execute(
                text("""SELECT d.id,d.quote_id,d.message,d.status,d.error,d.provider_id,d.pdf_name,l.name
        FROM zalo_deliveries d JOIN leads l ON l.id=d.lead_id WHERE d.campaign_id=:id ORDER BY l.name"""),
                {"id": campaign_id},
            )
        )
        .mappings()
        .all()
    )
    return {"deliveries": [dict(r) for r in rows]}


@router.get("/campaigns/{campaign_id}/deliveries/{delivery_id}/pdf")
async def delivery_pdf(
    campaign_id: UUID,
    delivery_id: UUID,
    dealer_id: UUID | None = None,
    user: User = Depends(sales_user),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    await get_campaign(campaign_id, scope(user, dealer_id), user.id, db)
    row = (await db.execute(text("""SELECT pdf_data,pdf_name FROM zalo_deliveries
        WHERE id=:delivery AND campaign_id=:campaign"""),
        {"delivery": delivery_id, "campaign": campaign_id})).mappings().first()
    if not row or not row["pdf_data"]:
        raise HTTPException(404, "Lượt gửi này không có tệp PDF")
    return Response(bytes(row["pdf_data"]), media_type="application/pdf", headers={
        "Content-Disposition": f'inline; filename="{row["pdf_name"]}"',
        "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    })


class StatusBody(BaseModel):
    status: str = Field(pattern=r"^(active|paused|cancelled)$")


@router.patch("/campaigns/{campaign_id}")
async def campaign_status(
    campaign_id: UUID,
    body: StatusBody,
    dealer_id: UUID | None = None,
    user: User = Depends(sales_user),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    dealer = scope(user, dealer_id)
    campaign = await get_campaign(campaign_id, dealer, user.id, db)
    if campaign["status"] in {"done", "cancelled"}:
        raise HTTPException(409, "Chiến dịch đã kết thúc")
    if body.status == "active":
        account = await bridge("GET", user.id)
        if account.get("status") != "connected" or account.get("uid") != campaign["account_uid"]:
            raise HTTPException(409, "Hãy kết nối đúng tài khoản Zalo đã tạo chiến dịch")
    await db.execute(
        text("UPDATE zalo_campaigns SET status=:status WHERE id=:id"), {"status": body.status, "id": campaign_id}
    )
    return {"message": "Đã cập nhật chiến dịch. Tin đang xử lý có thể vẫn hoàn tất."}
