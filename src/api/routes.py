import asyncio
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from langchain_core.messages import HumanMessage
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.agents.graph import agent
from src.db import get_db
from src.models.schemas import (
    ChatRequest,
    ChatResponse,
    ConfigRequest,
    InventoryUpdate,
    LeadCreate,
    LeadUpdate,
    PricingResponse,
    PromotionCreate,
    QuoteApprove,
    QuoteCreate,
)
from src.orm_models import (
    Accessory,
    BatteryPrice,
    Inventory,
    Lead,
    Promotion,
    Quote,
    QuoteStatus,
    RollingCost,
    VehiclePrice,
)

router = APIRouter()

PRICE_VERSION = "2025-Q4-v1"


# ════════════════════════════════════════════════════════════
# CHAT
# ════════════════════════════════════════════════════════════
@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    session_id = request.session_id or str(uuid.uuid4())
    try:
        result = await asyncio.to_thread(
            agent.invoke,
            {
                "question": request.message,
                "messages": [HumanMessage(content=request.message)],
                "vehicle_context": request.vehicle_context or {},
            },
            {"configurable": {"thread_id": session_id}},
        )
        return ChatResponse(
            response=result.get("answer") or result.get("response", ""),
            session_id=session_id,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ════════════════════════════════════════════════════════════
# VEHICLES CATALOG (Sync with DB)
# ════════════════════════════════════════════════════════════
@router.get("/vehicles")
async def list_vehicles(db: AsyncSession = Depends(get_db)):
    """Lấy danh mục các dòng xe, phiên bản, màu sắc và giá từ database."""
    stmt = (
        select(VehiclePrice)
        .where(VehiclePrice.effective_to.is_(None))
        .order_by(VehiclePrice.model, VehiclePrice.version, VehiclePrice.price)
    )
    res = await db.execute(stmt)
    rows = res.scalars().all()

    bat_res = await db.execute(select(BatteryPrice))
    bat_rows = bat_res.scalars().all()
    battery_map = {b.model: {"buy": b.buy_price, "rent": b.rent_price} for b in bat_rows}

    known_metadata = {
        "VF3": {"label": "VF 3", "model3d": "/cars/models/vinfast-vf3.glb", "image": "https://shop.vinfastauto.com/on/demandware.static/-/Sites-app_vinfast_vn-Library/default/dwb882e2eb/images/vf3/vf3-white.png"},
        "VF5": {"label": "VF 5", "model3d": "/cars/models/vinfast-vf5.glb", "image": "https://shop.vinfastauto.com/on/demandware.static/-/Sites-app_vinfast_vn-Library/default/images/vf5/vf5-white.png"},
        "VF6": {"label": "VF 6", "model3d": "/cars/models/vinfast-vf6.glb", "image": "https://shop.vinfastauto.com/on/demandware.static/-/Sites-app_vinfast_vn-Library/default/images/vf6/vf6-white.png"},
        "VF7": {"label": "VF 7", "model3d": "/cars/models/vinfast-vf7.glb", "image": "https://shop.vinfastauto.com/on/demandware.static/-/Sites-app_vinfast_vn-Library/default/images/vf7/vf7-white.png"},
        "VF8": {"label": "VF 8", "model3d": "/cars/models/vinfast-vf8.glb", "image": "https://shop.vinfastauto.com/on/demandware.static/-/Sites-app_vinfast_vn-Library/default/images/vf8/vf8-white.png"},
        "VF9": {"label": "VF 9", "model3d": "/cars/models/vinfast-vf9.glb", "image": "https://shop.vinfastauto.com/on/demandware.static/-/Sites-app_vinfast_vn-Library/default/images/vf9/vf9-white.png"},
    }

    color_slugs = {
        "Trắng Tinh Khôi": "white",
        "Đen Huyền Bí": "black",
        "Đỏ Năng Lượng": "red",
        "Xanh Bạc Hà": "mint",
        "Xanh Lá Nhạt": "mint",
        "Xám Tinh Tế": "grey",
        "Bạc Ánh Kim": "silver",
        "Xanh Cổng Trời": "blue",
        "Xanh Cổng Trời nóc Trắng": "blue_white",
        "Vàng nóc Trắng": "yellow_white",
        "Vàng nóc Đen": "yellow_black",
        "Hồng nóc Trắng": "pink_white",
        "Đỏ Thẫm Quý Phái": "crimson",
        "Xanh Rêu Đậm": "green",
        "Xám nóc Bạc": "grey_silver",
        "Trắng nóc Xám": "white_grey",
        "Đỏ Đậm nóc Đồng": "ruby_bronze",
        "Đen nóc Đồng": "black_bronze",
        "Xanh Rêu": "green",
        "Đỏ Rực Rỡ": "red",
    }

    vehicles: dict[str, dict] = {}
    for r in rows:
        m = r.model
        if m not in vehicles:
            meta = known_metadata.get(m, {"label": m, "model3d": None, "image": ""})
            vehicles[m] = {
                "label": meta["label"],
                "model3d": meta["model3d"],
                "image": meta["image"],
                "versions": [],
                "colors": [],
                "battery": battery_map.get(m, {"buy": 0, "rent": 0}),
            }

        # Deduplicate versions
        ver_id = f"{m.lower()}_{'base' if r.version == 'Tiêu chuẩn' else 'plus'}"
        if not any(v["label"] == r.version for v in vehicles[m]["versions"]):
            vehicles[m]["versions"].append({
                "id": ver_id,
                "label": r.version,
                "price": r.price,
            })

        # Deduplicate colors
        if not any(c["label"] == r.color for c in vehicles[m]["colors"]):
            cid = color_slugs.get(r.color, f"col_{len(vehicles[m]['colors'])}")
            vehicles[m]["colors"].append({
                "id": cid,
                "label": r.color,
                "hex": r.color_hex,
                "roof_hex": getattr(r, "roof_hex", None) or r.color_hex,
                "roofHex": getattr(r, "roof_hex", None) or r.color_hex,
                "image_url": r.image_url or "",
                "imageUrl": r.image_url or "",
            })



    return {"vehicles": vehicles}


# ════════════════════════════════════════════════════════════
# STATUS
# ════════════════════════════════════════════════════════════
@router.get("/status")
async def agent_status():
    return {"status": "ready", "agent": "LangGraph Agent v1.0"}


# ════════════════════════════════════════════════════════════
# PRICING — Tính giá lăn bánh (DETERMINISTIC)
# ════════════════════════════════════════════════════════════
@router.post("/configurate", response_model=PricingResponse)
async def configurate(
    req: ConfigRequest,
    db: AsyncSession = Depends(get_db),
):
    # 1. Giá xe
    result = await db.execute(
        select(VehiclePrice).where(
            and_(
                VehiclePrice.model   == req.model,
                VehiclePrice.version == req.version,
                VehiclePrice.color   == req.color,
                VehiclePrice.effective_to.is_(None),
            )
        )
    )
    vehicle = result.scalar_one_or_none()
    if not vehicle:
        raise HTTPException(404, f"Không tìm thấy giá cho {req.model} {req.version} {req.color}")

    base_price = vehicle.price

    # 2. Pin
    bat_result = await db.execute(
        select(BatteryPrice).where(BatteryPrice.model == req.model)
    )
    bat = bat_result.scalar_one_or_none()
    battery_cost = (bat.buy_price if bat else 0) if req.battery == "buy" else 0

    # 3. Phụ kiện
    acc_list = []
    acc_total = 0
    for code in req.accessories:
        acc_result = await db.execute(
            select(Accessory).where(Accessory.code == code)
        )
        acc = acc_result.scalar_one_or_none()
        if acc:
            acc_list.append({"name": acc.name, "price": acc.price})
            acc_total += acc.price

    # 4. Phí lăn bánh
    rc_result = await db.execute(
        select(RollingCost).where(RollingCost.province == req.province)
    )
    rc = rc_result.scalar_one_or_none()
    if not rc:
        # Fallback về "Tỉnh khác"
        rc_result = await db.execute(
            select(RollingCost).where(RollingCost.province == "Tỉnh khác")
        )
        rc = rc_result.scalar_one_or_none()

    rolling = {
        "registration_fee": int(base_price * rc.registration_rate),
        "road_fee":         rc.road_fee,
        "inspection_fee":   rc.inspection_fee,
        "insurance":        int(base_price * rc.insurance_rate),
        "plate_fee":        rc.plate_fee,
    } if rc else {}
    rolling_total = sum(rolling.values())

    # 5. Khuyến mãi
    now = datetime.utcnow()
    promo_result = await db.execute(
        select(Promotion).where(
            and_(
                Promotion.is_active.is_(True),
                Promotion.start_date <= now,
                Promotion.end_date   >= now,
            )
        )
    )
    promos_raw = promo_result.scalars().all()

    promos = []
    total_discount = 0
    for p in promos_raw:
        if p.model != "ALL" and p.model != req.model:
            continue
        if p.province and p.province != req.province:
            continue
        disc = p.discount_value if p.discount_type.value == "fixed" \
               else int(base_price * p.discount_value / 100)
        total_discount += disc
        promos.append({
            "name":   p.name,
            "value":  disc,
            "source": "dealer" if p.dealer_id else "vinfast_national",
        })

    # 6. Tổng
    subtotal    = base_price + battery_cost + acc_total
    final_price = subtotal + rolling_total - total_discount

    return PricingResponse(
        base_price=base_price,
        battery_cost=battery_cost,
        accessories=acc_list,
        rolling_costs=rolling,
        promotions=promos,
        total_discount=total_discount,
        final_price=final_price,
        province=req.province,
        price_version=PRICE_VERSION,
        calculated_at=datetime.now().isoformat(),
        disclaimer="Giá chỉ mang tính tham khảo. Liên hệ đại lý để xác nhận.",
    )


# ════════════════════════════════════════════════════════════
# LEADS
# ════════════════════════════════════════════════════════════
@router.post("/leads", status_code=201)
async def create_lead(
    body: LeadCreate,
    db:   AsyncSession = Depends(get_db),
):
    lead = Lead(**body.model_dump())
    db.add(lead)
    await db.flush()
    return {"id": str(lead.id), "message": "Đã tạo lead"}


@router.get("/leads")
async def list_leads(
    status:    str | None = None,
    dealer_id: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    q = select(Lead).order_by(Lead.created_at.desc())
    if status:
        q = q.where(Lead.status == status)
    if dealer_id:
        q = q.where(Lead.dealer_id == dealer_id)

    result = await db.execute(q)
    leads  = result.scalars().all()

    return {
        "leads": [
            {
                "id":            str(lead.id),
                "session_id":    lead.session_id,
                "name":          lead.name,
                "phone":         lead.phone,
                "province":      lead.province,
                "interested_in": lead.interested_in,
                "budget":        lead.budget,
                "status":        lead.status.value if lead.status else "new",
                "created_at":    lead.created_at.isoformat(),
            }
            for lead in leads
        ]
    }


@router.patch("/leads/{lead_id}")
async def update_lead(
    lead_id: str,
    body:    LeadUpdate,
    db:      AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Lead).where(Lead.id == lead_id))
    lead   = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(404, "Không tìm thấy lead")

    if body.status:
        lead.status = body.status
    if body.note:
        lead.note = body.note
    return {"message": "Đã cập nhật"}


# ════════════════════════════════════════════════════════════
# QUOTES (HITL)
# ════════════════════════════════════════════════════════════
@router.post("/quotes", status_code=201)
async def create_quote(
    body: QuoteCreate,
    db:   AsyncSession = Depends(get_db),
):
    quote = Quote(**body.model_dump())
    db.add(quote)
    await db.flush()
    return {"id": str(quote.id), "message": "Đã tạo báo giá, chờ tư vấn viên duyệt"}


@router.get("/quotes")
async def list_quotes(
    status: str | None = None,
    db:     AsyncSession = Depends(get_db),
):
    q = select(Quote).order_by(Quote.created_at.desc())
    if status:
        q = q.where(Quote.status == status)

    result = await db.execute(q)
    quotes = result.scalars().all()

    return {
        "quotes": [
            {
                "id":            str(qt.id),
                "buyer_name":    qt.buyer_name,
                "buyer_phone":   qt.buyer_phone,
                "model":         qt.model,
                "version":       qt.version,
                "color":         qt.color,
                "province":      qt.province,
                "final_price":   qt.final_price,
                "price_version": qt.price_version,
                "status":        qt.status.value if qt.status else "pending",
                "seller_note":   qt.seller_note,
                "price_snapshot": qt.price_snapshot,
                "created_at":    qt.created_at.isoformat(),
                "reviewed_at":   qt.reviewed_at.isoformat() if qt.reviewed_at else None,
            }
            for qt in quotes
        ]
    }


@router.post("/quote/approve")
async def approve_quote(
    body:     QuoteApprove,
    quote_id: str,
    db:       AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Quote).where(Quote.id == quote_id))
    quote  = result.scalar_one_or_none()
    if not quote:
        raise HTTPException(404, "Không tìm thấy báo giá")

    if body.action == "approve":
        quote.status = QuoteStatus.approved
    elif body.action == "reject":
        quote.status = QuoteStatus.rejected
    else:
        raise HTTPException(400, "action phải là 'approve' hoặc 'reject'")

    quote.seller_note  = body.seller_note
    quote.reviewed_at  = datetime.utcnow()
    return {"message": f"Đã {'duyệt' if body.action == 'approve' else 'từ chối'} báo giá"}


@router.post("/quote/export-pdf")
async def export_pdf(quote_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Quote).where(Quote.id == quote_id))
    quote  = result.scalar_one_or_none()
    if not quote:
        raise HTTPException(404, "Không tìm thấy báo giá")
    # TODO: tích hợp ReportLab/WeasyPrint
    return {"pdf_url": f"/static/quotes/{quote_id}.pdf", "message": "PDF đang được tạo"}


# ════════════════════════════════════════════════════════════
# PROMOTIONS
# ════════════════════════════════════════════════════════════
@router.get("/promotions")
async def list_promotions(
    model:    str | None = None,
    province: str | None = None,
    db:       AsyncSession = Depends(get_db),
):
    q = select(Promotion).order_by(Promotion.created_at.desc())
    if model:
        q = q.where((Promotion.model == model) | (Promotion.model == "ALL"))
    if province:
        q = q.where((Promotion.province == province) | (Promotion.province.is_(None)))

    result = await db.execute(q)
    promos = result.scalars().all()

    return {
        "promotions": [
            {
                "id":             str(p.id),
                "name":           p.name,
                "description":    p.description,
                "model":          p.model,
                "province":       p.province,
                "discount_type":  p.discount_type.value,
                "discount_value": p.discount_value,
                "start_date":     p.start_date.isoformat(),
                "end_date":       p.end_date.isoformat(),
                "is_active":      p.is_active,
                "usage_count":    p.usage_count,
            }
            for p in promos
        ]
    }


@router.post("/promotions", status_code=201)
async def create_promotion(
    body: PromotionCreate,
    db:   AsyncSession = Depends(get_db),
):
    promo = Promotion(
        name=body.name, description=body.description,
        model=body.model, province=body.province,
        discount_type=body.discount_type,
        discount_value=body.discount_value,
        start_date=datetime.fromisoformat(body.start_date),
        end_date=datetime.fromisoformat(body.end_date),
        is_active=body.is_active,
    )
    db.add(promo)
    await db.flush()
    return {"id": str(promo.id), "message": "Đã tạo khuyến mãi"}


@router.patch("/promotions/{promo_id}")
async def update_promotion(
    promo_id: str,
    body:     PromotionCreate,
    db:       AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Promotion).where(Promotion.id == promo_id))
    promo  = result.scalar_one_or_none()
    if not promo:
        raise HTTPException(404, "Không tìm thấy khuyến mãi")

    for k, v in body.model_dump(exclude_none=True).items():
        setattr(promo, k, v)
    return {"message": "Đã cập nhật"}


@router.delete("/promotions/{promo_id}")
async def delete_promotion(
    promo_id: str,
    db:       AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Promotion).where(Promotion.id == promo_id))
    promo  = result.scalar_one_or_none()
    if not promo:
        raise HTTPException(404, "Không tìm thấy khuyến mãi")
    promo.is_active = False
    return {"message": "Đã vô hiệu hoá"}


# ════════════════════════════════════════════════════════════
# INVENTORY
# ════════════════════════════════════════════════════════════
@router.get("/inventory")
async def list_inventory(
    model:     str | None = None,
    dealer_id: str | None = None,
    db:        AsyncSession = Depends(get_db),
):
    q = select(Inventory).order_by(Inventory.model)
    if model:
        q = q.where(Inventory.model == model)
    if dealer_id:
        q = q.where(Inventory.dealer_id == dealer_id)

    result = await db.execute(q)
    items  = result.scalars().all()

    return {
        "inventory": [
            {
                "id":           str(i.id),
                "dealer_id":    str(i.dealer_id),
                "model":        i.model,
                "version":      i.version,
                "color":        i.color,
                "color_hex":    i.color_hex,
                "quantity":     i.quantity,
                "est_delivery": i.est_delivery,
                "updated_at":   i.updated_at.isoformat(),
            }
            for i in items
        ]
    }


@router.patch("/inventory/{item_id}")
async def update_inventory(
    item_id: str,
    body:    InventoryUpdate,
    db:      AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Inventory).where(Inventory.id == item_id))
    item   = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Không tìm thấy")

    item.quantity     = body.quantity
    item.est_delivery = body.est_delivery
    item.updated_at   = datetime.utcnow()
    return {"message": "Đã cập nhật kho"}
