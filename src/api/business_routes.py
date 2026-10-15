"""Protected dealer workflows and public customer submissions."""

import hashlib
import json
from collections import Counter
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import ValidationError
from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from src.db import get_db
from src.models.schemas import (
    ConfigRequest,
    InstallmentRequest,
    InventoryUpdate,
    LeadCreate,
    LeadUpdate,
    NewsletterCreate,
    PromotionCreate,
    PromotionUpdate,
    QuoteApprove,
    QuoteCreate,
)
from src.orm_models import (
    Dealer,
    Inventory,
    Lead,
    LeadStatus,
    NewsletterSubscription,
    Promotion,
    Quote,
    QuoteRequest,
    QuoteStatus,
    Store,
    User,
)
from src.services.access import check_dealer, dealer_scope, inventory_user, permitted_stores, sales_user
from src.services.auth import utcnow
from src.services.installment import estimate_installment
from src.services.pdf_generator import generate_quote_pdf
from src.services.pricing import price_configuration

router = APIRouter()


@router.post("/installment")
async def installment(body: InstallmentRequest, db: AsyncSession = Depends(get_db, scope="function")):
    if body.dealer_id:
        await active_dealer(body.dealer_id, db)
    price = await price_configuration(body, db)
    return estimate_installment(price["final_price"], body.down_payment_pct, body.annual_rate_pct, body.term_months)


async def active_dealer(dealer_id, db):
    dealer = (
        await db.execute(select(Dealer).where(Dealer.id == dealer_id, Dealer.is_active.is_(True)))
    ).scalar_one_or_none()
    if not dealer:
        raise HTTPException(422, "Đại lý không tồn tại hoặc đã ngừng nhận yêu cầu")
    return dealer


@router.post("/newsletter", status_code=201)
async def subscribe(body: NewsletterCreate, db: AsyncSession = Depends(get_db, scope="function")):
    await db.execute(
        insert(NewsletterSubscription)
        .values(email=body.email, consent_at=utcnow())
        .on_conflict_do_nothing(index_elements=["email"])
    )
    return {"message": "Đã ghi nhận đăng ký nhận thông tin"}


@router.post("/leads", status_code=201)
async def create_lead(body: LeadCreate, db: AsyncSession = Depends(get_db, scope="function")):
    await active_dealer(body.dealer_id, db)
    lead = Lead(**body.model_dump())
    db.add(lead)
    await db.flush()
    return {"id": str(lead.id), "message": "Đã gửi thông tin tới đại lý"}


@router.get("/leads")
async def list_leads(
    status: LeadStatus | None = None,
    dealer_id: UUID | None = None,
    db: AsyncSession = Depends(get_db, scope="function"),
    user: User = Depends(sales_user),
):
    query = select(Lead).order_by(Lead.created_at.desc())
    scope = dealer_scope(user, dealer_id)
    if scope:
        query = query.where(Lead.dealer_id == scope)
    if status:
        query = query.where(Lead.status == status)
    rows = (await db.execute(query)).scalars().all()
    return {
        "leads": [
            {
                "id": str(lead.id),
                "session_id": lead.session_id,
                "name": lead.name,
                "phone": lead.phone,
                "province": lead.province,
                "interested_in": lead.interested_in,
                "budget": lead.budget,
                "status": lead.status.value,
                "note": lead.note,
                "assigned_to": str(lead.assigned_to) if lead.assigned_to else None,
                "dealer_id": str(lead.dealer_id) if lead.dealer_id else None,
                "created_at": lead.created_at.isoformat(),
            }
            for lead in rows
        ]
    }


async def find_lead(lead_id, user, db):
    lead = (await db.execute(select(Lead).where(Lead.id == lead_id).with_for_update())).scalar_one_or_none()
    if not lead:
        raise HTTPException(404, "Không tìm thấy khách hàng")
    check_dealer(user, lead.dealer_id)
    return lead


@router.patch("/leads/{lead_id}")
async def update_lead(
    lead_id: UUID,
    body: LeadUpdate,
    db: AsyncSession = Depends(get_db, scope="function"),
    user: User = Depends(sales_user),
):
    lead = await find_lead(lead_id, user, db)
    data = body.model_dump(exclude_unset=True)
    if data.get("assigned_to"):
        staff = (await db.execute(select(User).where(User.id == data["assigned_to"]))).scalar_one_or_none()
        if not staff or not staff.is_active or staff.role.value != "seller" or staff.dealer_id != lead.dealer_id:
            raise HTTPException(422, "Nhân viên được giao phải thuộc cùng đại lý")
    if data.get("status"):
        lead.status = LeadStatus(data.pop("status"))
    for key, value in data.items():
        setattr(lead, key, value)
    return {"message": "Đã cập nhật khách hàng"}


@router.post("/leads/{lead_id}/claim")
async def claim_lead(
    lead_id: UUID, db: AsyncSession = Depends(get_db, scope="function"), user: User = Depends(sales_user)
):
    lead = await find_lead(lead_id, user, db)
    if lead.assigned_to and lead.assigned_to != user.id:
        raise HTTPException(409, "Khách hàng đã được nhân viên khác tiếp nhận")
    lead.assigned_to = user.id
    if lead.status == LeadStatus.new:
        lead.status = LeadStatus.contacted
    return {"message": "Đã tiếp nhận khách hàng", "assigned_to": str(user.id)}


@router.post("/quotes", status_code=201)
async def create_quote(body: QuoteCreate, db: AsyncSession = Depends(get_db, scope="function")):
    payload_hash = hashlib.sha256(
        json.dumps(
            body.model_dump(mode="json", exclude={"price_snapshot"}), sort_keys=True, ensure_ascii=False
        ).encode()
    ).hexdigest()
    # Serialize retries across backend instances, without depending on process memory.
    await db.execute(text("SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))"), {"key": str(body.request_id)})
    existing = (await db.execute(select(QuoteRequest).where(QuoteRequest.id == body.request_id))).scalar_one_or_none()
    if existing:
        if existing.payload_hash != payload_hash:
            raise HTTPException(409, "Mã yêu cầu đã được dùng cho nội dung khác. Vui lòng gửi yêu cầu mới.")
        quote = (await db.execute(select(Quote).where(Quote.id == existing.quote_id))).scalar_one_or_none()
        return {
            "id": str(quote.id),
            "lead_id": str(quote.lead_id),
            "pricing": quote.price_snapshot,
            "message": "Yêu cầu này đã được ghi nhận",
        }
    await active_dealer(body.dealer_id, db)
    pricing = await price_configuration(ConfigRequest(**body.model_dump()), db)
    if body.price_version is not None and (
        body.price_version != pricing["price_version"] or body.final_price != pricing["final_price"]
    ):
        raise HTTPException(409, "Giá đã thay đổi. Vui lòng tải lại báo giá trước khi gửi.")
    lead = Lead(
        session_id=body.session_id,
        name=body.buyer_name,
        phone=body.buyer_phone,
        dealer_id=body.dealer_id,
        province=body.province,
        interested_in=f"{body.model} {body.version}",
        budget=pricing["final_price"],
        note=body.note,
        status=LeadStatus.quoted,
    )
    db.add(lead)
    await db.flush()
    fields = body.model_dump(
        exclude={"note", "price_snapshot", "price_version", "final_price", "dealer_id", "request_id"}
    )
    quote = Quote(
        **fields,
        lead_id=lead.id,
        price_snapshot=pricing,
        price_version=pricing["price_version"],
        final_price=pricing["final_price"],
    )
    db.add(quote)
    await db.flush()
    db.add(QuoteRequest(id=body.request_id, payload_hash=payload_hash, quote_id=quote.id))
    await db.flush()
    return {"id": str(quote.id), "lead_id": str(lead.id), "pricing": pricing, "message": "Đã gửi báo giá tới đại lý"}


@router.get("/quotes")
async def list_quotes(
    status: QuoteStatus | None = None,
    dealer_id: UUID | None = None,
    db: AsyncSession = Depends(get_db, scope="function"),
    user: User = Depends(sales_user),
):
    query = select(Quote).outerjoin(Lead, Quote.lead_id == Lead.id).order_by(Quote.created_at.desc())
    scope = dealer_scope(user, dealer_id)
    if scope:
        query = query.where(Lead.dealer_id == scope)
    if status:
        query = query.where(Quote.status == status)
    rows = (await db.execute(query)).scalars().all()
    return {"quotes": [quote_payload(q) for q in rows]}


def quote_payload(quote):
    fields = (
        "buyer_name",
        "buyer_phone",
        "model",
        "version",
        "color",
        "province",
        "final_price",
        "price_version",
        "seller_note",
        "price_snapshot",
    )
    return {
        **{key: getattr(quote, key) for key in fields},
        "id": str(quote.id),
        "battery": quote.battery.value if quote.battery else None,
        "status": quote.status.value,
        "created_at": quote.created_at.isoformat(),
        "reviewed_at": quote.reviewed_at.isoformat() if quote.reviewed_at else None,
    }


async def find_quote(quote_id, user, db):
    quote = (await db.execute(select(Quote).where(Quote.id == quote_id).with_for_update())).scalar_one_or_none()
    if not quote:
        raise HTTPException(404, "Không tìm thấy báo giá")
    lead = (
        (await db.execute(select(Lead).where(Lead.id == quote.lead_id))).scalar_one_or_none() if quote.lead_id else None
    )
    check_dealer(user, lead.dealer_id if lead else None)
    return quote


@router.post("/quote/approve")
async def approve_quote(
    body: QuoteApprove,
    quote_id: UUID,
    db: AsyncSession = Depends(get_db, scope="function"),
    user: User = Depends(sales_user),
):
    quote = await find_quote(quote_id, user, db)
    if quote.status != QuoteStatus.pending:
        raise HTTPException(409, "Báo giá đã được xử lý hoặc hết hạn. Hãy tải lại danh sách.")
    quote.status = QuoteStatus.approved if body.action == "approve" else QuoteStatus.rejected
    quote.seller_note = body.seller_note
    quote.seller_id = user.id
    quote.reviewed_at = utcnow()
    # Approval is not a completed sale; the lead is not marked closed_won.
    return {"message": "Đã xử lý báo giá", "status": quote.status.value}


def pdf_response(quote):
    payload = {**quote_payload(quote), "battery": quote.battery.value if quote.battery else None}
    return Response(
        generate_quote_pdf(payload),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="P97_BaoGia_{str(quote.id)[:8]}.pdf"',
            "Cache-Control": "private, no-store",
        },
    )


@router.get("/quotes/{quote_id}/pdf")
async def get_quote_pdf(
    quote_id: UUID, db: AsyncSession = Depends(get_db, scope="function"), user: User = Depends(sales_user)
):
    return pdf_response(await find_quote(quote_id, user, db))


@router.post("/quote/export-pdf")
async def export_pdf(
    quote_id: UUID, db: AsyncSession = Depends(get_db, scope="function"), user: User = Depends(sales_user)
):
    quote = await find_quote(quote_id, user, db)
    pdf_response(quote)
    return {"download_url": f"/api/quotes/{quote.id}/pdf", "status": "ready"}


@router.get("/promotions")
async def list_promotions(db: AsyncSession = Depends(get_db, scope="function"), user: User = Depends(sales_user)):
    query = select(Promotion).order_by(Promotion.created_at.desc())
    if user.role.value != "admin":
        query = query.where(Promotion.dealer_id.is_(None) | (Promotion.dealer_id == user.dealer_id))
    rows = (await db.execute(query)).scalars().all()
    quotes = select(Quote.price_snapshot).join(Lead, Quote.lead_id == Lead.id)
    if user.role.value != "admin":
        quotes = quotes.where(Lead.dealer_id == user.dealer_id)
    snapshots = (await db.execute(quotes)).scalars().all()
    counts = Counter(
        promo_id
        for snapshot in snapshots
        for promo_id in {str(p["id"]) for p in (snapshot or {}).get("promotions", []) if p.get("id")}
    )
    return {
        "promotions": [
            {
                "id": str(p.id),
                "name": p.name,
                "description": p.description,
                "model": p.model,
                "province": p.province,
                "discount_type": p.discount_type.value,
                "discount_value": p.discount_value,
                "start_date": p.start_date.isoformat(),
                "end_date": p.end_date.isoformat(),
                "is_active": p.is_active,
                "currently_valid": p.is_active and p.start_date <= utcnow() <= p.end_date,
                "usage_count": counts[str(p.id)],
                "dealer_id": str(p.dealer_id) if p.dealer_id else None,
                "editable": user.role.value == "admin" or p.dealer_id == user.dealer_id,
            }
            for p in rows
        ]
    }


@router.post("/promotions", status_code=201)
async def create_promotion(
    body: PromotionCreate, db: AsyncSession = Depends(get_db, scope="function"), user: User = Depends(sales_user)
):
    scope = dealer_scope(user, body.dealer_id)
    if scope:
        await active_dealer(scope, db)
    promo = Promotion(**{**body.model_dump(), "dealer_id": scope}, created_by=user.id)
    db.add(promo)
    await db.flush()
    return {"id": str(promo.id), "message": "Đã tạo khuyến mãi"}


async def find_promotion(promo_id, user, db):
    promo = (await db.execute(select(Promotion).where(Promotion.id == promo_id).with_for_update())).scalar_one_or_none()
    if not promo:
        raise HTTPException(404, "Không tìm thấy khuyến mãi")
    check_dealer(user, promo.dealer_id)
    return promo


@router.patch("/promotions/{promo_id}")
async def update_promotion(
    promo_id: UUID,
    body: PromotionUpdate,
    db: AsyncSession = Depends(get_db, scope="function"),
    user: User = Depends(sales_user),
):
    promo = await find_promotion(promo_id, user, db)
    updates = body.model_dump(exclude_unset=True)
    values = {field: getattr(promo, field) for field in PromotionCreate.model_fields}
    values["discount_type"] = promo.discount_type.value
    try:
        validated = PromotionCreate(**{**values, **updates})
    except ValidationError:
        raise HTTPException(422, "Thông tin khuyến mãi hoặc khoảng thời gian không hợp lệ") from None
    for key in updates:
        setattr(promo, key, getattr(validated, key))
    return {"message": "Đã cập nhật khuyến mãi"}


@router.delete("/promotions/{promo_id}")
async def delete_promotion(
    promo_id: UUID, db: AsyncSession = Depends(get_db, scope="function"), user: User = Depends(sales_user)
):
    promo = await find_promotion(promo_id, user, db)
    promo.is_active = False
    return {"message": "Đã vô hiệu hóa khuyến mãi"}


@router.get("/stores")
async def list_stores(db: AsyncSession = Depends(get_db, scope="function"), user: User = Depends(inventory_user)):
    ids = await permitted_stores(user, db)
    rows = (await db.execute(select(Store).where(Store.id.in_(ids)).order_by(Store.name))).scalars().all()
    return {
        "stores": [
            {
                "id": str(s.id),
                "dealer_id": str(s.dealer_id),
                "branch_id": str(s.branch_id),
                "name": s.name,
                "address": s.address,
            }
            for s in rows
        ]
    }


@router.get("/inventory")
async def list_inventory(
    model: str | None = None,
    dealer_id: UUID | None = None,
    store_id: UUID | None = None,
    db: AsyncSession = Depends(get_db, scope="function"),
    user: User = Depends(inventory_user),
):
    scope = dealer_scope(user, dealer_id)
    ids = await permitted_stores(user, db)
    if store_id and store_id not in ids:
        raise HTTPException(403, "Không có quyền truy cập cửa hàng này")
    query = select(Inventory).order_by(Inventory.model, Inventory.version, Inventory.color)
    if scope:
        query = query.where(Inventory.dealer_id == scope)
    if user.role.value == "warehouse":
        if not ids:
            raise HTTPException(403, "Tài khoản chưa được gán cửa hàng")
        query = query.where(Inventory.store_id.in_(ids))
    if store_id:
        query = query.where(Inventory.store_id == store_id)
    if model:
        query = query.where(Inventory.model == model)
    rows = (await db.execute(query)).scalars().all()
    return {
        "inventory": [
            {
                "id": str(i.id),
                "dealer_id": str(i.dealer_id),
                "store_id": str(i.store_id) if i.store_id else None,
                "model": i.model,
                "version": i.version,
                "color": i.color,
                "color_hex": i.color_hex,
                "quantity": i.quantity,
                "est_delivery": i.est_delivery,
                "updated_at": i.updated_at.isoformat(),
            }
            for i in rows
        ]
    }


@router.patch("/inventory/{item_id}")
async def update_inventory(
    item_id: UUID,
    body: InventoryUpdate,
    db: AsyncSession = Depends(get_db, scope="function"),
    user: User = Depends(inventory_user),
):
    item = (await db.execute(select(Inventory).where(Inventory.id == item_id).with_for_update())).scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Không tìm thấy tồn kho")
    check_dealer(user, item.dealer_id)
    if user.role.value == "warehouse" and item.store_id not in await permitted_stores(user, db):
        raise HTTPException(403, "Không có quyền sửa kho cửa hàng này")
    expected = body.expected_updated_at
    if expected.tzinfo:
        from datetime import UTC

        expected = expected.astimezone(UTC).replace(tzinfo=None)
    if item.updated_at != expected:
        raise HTTPException(409, "Tồn kho đã được người khác cập nhật. Hãy tải lại trước khi sửa.")
    item.quantity = body.quantity
    item.est_delivery = body.est_delivery
    item.updated_by = user.id
    item.updated_at = utcnow()
    return {"message": "Đã cập nhật tồn kho", "updated_at": item.updated_at.isoformat()}
