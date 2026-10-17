import asyncio
import json
import re
import unicodedata
import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import Response
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage, messages_from_dict, messages_to_dict
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.agents.graph import agent, _authoritative_reply
from src.api.business_routes import active_dealer
from src.api.business_routes import router as business_router
from src.config import get_settings
from src.db import get_db
from src.models.schemas import (
    ChatRequest,
    ChatResponse,
    ConfigRequest,
    LoginRequest,
    LoginResponse,
    PricingResponse,
    QuotePreview,
)
from src.operational_data import dataset_scope
from src.orm_models import (
    Accessory,
    AuthSession,
    BatteryPrice,
    ConversationThread,
    Dealer,
    RollingCost,
    User,
    UserStore,
    VehiclePrice,
    Quote,
)
from src.services.auth import (
    create_access_token,
    get_current_session,
    get_current_user,
    utcnow,
    verify_password,
)
from src.services.config_actions import configuration_command
from src.services.pdf_generator import generate_quote_pdf
from src.services.pricing import calculate_price, load_pricing_tables, price_configuration
from src.services.customer_sessions import optional_customer, owned_thread, eligibility_tables
from src.services.pricing_policy import PricingPolicyError

router = APIRouter()


# ════════════════════════════════════════════════════════════
# AUTHENTICATION
# ════════════════════════════════════════════════════════════
@router.post("/auth/login", response_model=LoginResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db, scope="function")):
    email = body.email.strip().lower()
    if get_settings().app_env == "production" and email.endswith("@example.invalid"):
        raise HTTPException(401, "Tài khoản demo chỉ dùng trong môi trường local")
    result = await db.execute(select(User).where(User.email.ilike(email)))
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.hashed_pw):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email hoặc mật khẩu không chính xác",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản đã bị tạm khóa. Vui lòng liên hệ quản trị viên.",
        )

    dealer_name = None
    if user.dealer_id:
        d_res = await db.execute(select(Dealer).where(Dealer.id == user.dealer_id))
        dealer = d_res.scalar_one_or_none()
        if dealer:
            dealer_name = dealer.name

    role_str = user.role.value if hasattr(user.role, "value") else str(user.role)

    session = AuthSession(user_id=user.id, expires_at=utcnow() + timedelta(days=get_settings().session_days))
    db.add(session)
    await db.flush()
    token = create_access_token(
        {
            "jti": str(session.id),
            "sub": str(user.id),
            "email": user.email,
            "role": role_str,
        }
    )

    return LoginResponse(
        token=token,
        user={
            "id": str(user.id),
            "name": user.name,
            "email": user.email,
            "role": role_str,
            "dealerId": str(user.dealer_id) if user.dealer_id else None,
            "dealer": dealer_name,
            "branchId": None,
            "storeIds": [
                str(i)
                for i in (await db.execute(select(UserStore.store_id).where(UserStore.user_id == user.id)))
                .scalars()
                .all()
            ],
        },
    )


@router.get("/auth/me")
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    dealer_name = None
    if current_user.dealer_id:
        d_res = await db.execute(select(Dealer).where(Dealer.id == current_user.dealer_id))
        dealer = d_res.scalar_one_or_none()
        if dealer:
            dealer_name = dealer.name

    role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)

    return {
        "user": {
            "id": str(current_user.id),
            "name": current_user.name,
            "email": current_user.email,
            "role": role_str,
            "dealerId": str(current_user.dealer_id) if current_user.dealer_id else None,
            "dealer": dealer_name,
            "branchId": None,
            "storeIds": [
                str(i)
                for i in (await db.execute(select(UserStore.store_id).where(UserStore.user_id == current_user.id)))
                .scalars()
                .all()
            ],
        }
    }


# ════════════════════════════════════════════════════════════
# CHAT
# ════════════════════════════════════════════════════════════
def _invoke_agent(*args, tables=None):
    with dataset_scope(tables):
        return agent.invoke(*args)


@router.post("/chat/session")
async def customer_session(body: ChatRequest, request: Request,
                           db: AsyncSession = Depends(get_db, scope="function"), user=Depends(optional_customer)):
    thread = await owned_thread(body.session_id or uuid.uuid4(), request, db, user, create=True)
    return {"session_id": thread.id}


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, http_request: Request,
               db: AsyncSession = Depends(get_db, scope="function"), user=Depends(optional_customer)) -> ChatResponse:
    session_id = request.session_id or str(uuid.uuid4())
    try:
        thread = await owned_thread(session_id, http_request, db, user, create=True)
        tables = await load_pricing_tables(db)
        tables.update(await eligibility_tables(thread, db))
        profile = thread.profile or {}
        tables["customer_claims"] = {
            **(profile.get("customer_claims", {}) or {}),
            **{key: profile[key] for key in ("vinclub_tier", "customer_group", "purchase_channel")
               if profile.get(key) is not None},
        }
        quotes = (await db.execute(select(Quote).where(Quote.session_id == thread.id))).scalars().all()
        tables["quote_statuses"] = [{"id": str(q.id), "status": q.status.value,
                                   "reviewed_at": q.reviewed_at.isoformat() if q.reviewed_at else None}
                                  for q in quotes if q.session_id == thread.id]
        history = messages_from_dict(thread.messages) if thread else []
        context = request.vehicle_context or (thread.profile or {}).get("configuration_draft", {})
        slot = (thread.profile or {}).get("eligibility_slot")
        slot_action = None
        if slot and context:
            answer = request.message.strip().casefold()
            matched = next((v for v in slot["accepted_values"] if v.casefold() == answer), None)
            if matched or answer in {"không biết", "bỏ qua", "khong biet", "bo qua", "không", "khong"}:
                claims = {**(thread.profile or {}).get("customer_claims", {}),
                          slot["attribute"]: matched or "__unknown__"}
                context = {**context, "customer_claims": claims}
                price = calculate_price(ConfigRequest(**context), tables)
                price["configuration"] = context
                reply, profile_update = _authoritative_reply([ToolMessage(content=json.dumps(price), tool_call_id="slot")])
                thread.profile = {**(thread.profile or {}), **profile_update, "customer_claims": claims}
                slot_action = {"response": reply}
        action = (
            slot_action or configuration_command(request.message, context, tables, utcnow())
            if context
            else None
        )
        if action:
            result = {
                "answer": action["response"],
                "messages": history + [HumanMessage(content=request.message), AIMessage(content=action["response"])],
            }
        else:
            result = await asyncio.wait_for(
                asyncio.to_thread(
                    _invoke_agent,
                    {
                        "question": request.message,
                        "messages": history + [HumanMessage(content=request.message)],
                        "profile": thread.profile if thread else {},
                        "vehicle_context": context,
                    },
                    {"configurable": {"thread_id": session_id}},
                    tables=tables,
                ),
                timeout=55,
            )
        if result.get("error") == "llm_unavailable":
            raise HTTPException(503, "Trợ lý AI chưa được cấu hình hoặc nhà cung cấp đang lỗi.")
        if thread is None:
            thread = ConversationThread(id=session_id)
            db.add(thread)
        stored = result.get("messages", history + [HumanMessage(content=request.message)])
        first = next((i for i in range(max(0, len(stored) - 100), len(stored)) if stored[i].type == "human"), 0)
        thread.messages = messages_to_dict(stored[first:])
        thread.profile = result.get("profile", thread.profile or {})
        if context:
            thread.profile = {**thread.profile, "configuration_draft":
                              action.get("configuration_update", context) if action else
                              thread.profile.get("configuration_draft") or context}
        thread.updated_at = utcnow()
        return ChatResponse(
            response=result.get("answer") or result.get("response", ""),
            configuration_update=action.get("configuration_update") if action else None,
            session_id=session_id,
        )
    except PricingPolicyError as error:
        return ChatResponse(response=error.detail["message"], session_id=session_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=503, detail="Trợ lý AI tạm thời chưa sẵn sàng. Vui lòng thử lại.") from e


# ════════════════════════════════════════════════════════════
# VEHICLES CATALOG (Sync with DB)
# ════════════════════════════════════════════════════════════
@router.get("/dealers")
async def list_dealers(db: AsyncSession = Depends(get_db, scope="function")):
    rows = (await db.execute(select(Dealer).where(Dealer.is_active.is_(True)).order_by(Dealer.name))).scalars().all()
    return {
        "dealers": [
            {"id": str(d.id), "name": d.name, "province": d.province, "address": d.address, "phone": d.phone}
            for d in rows
        ]
    }


@router.get("/vehicles")
async def list_vehicles(db: AsyncSession = Depends(get_db, scope="function")):
    """Lấy danh mục các dòng xe, phiên bản, màu sắc và giá từ database."""
    stmt = (
        select(VehiclePrice)
        .where(
            VehiclePrice.effective_from <= utcnow(),
            (VehiclePrice.effective_to.is_(None) | (VehiclePrice.effective_to > utcnow())),
        )
        .order_by(VehiclePrice.model, VehiclePrice.version, VehiclePrice.price)
    )
    res = await db.execute(stmt)
    rows = res.scalars().all()

    bat_res = await db.execute(select(BatteryPrice))
    bat_rows = bat_res.scalars().all()
    battery_map = {b.model: {"buy": b.buy_price, "rent": b.rent_price} for b in bat_rows}

    known_metadata = {
        "VF3": {
            "label": "VF 3",
            "model3d": "/cars/models/vinfast-vf3.glb",
            "image": "https://shop.vinfastauto.com/on/demandware.static/-/Sites-app_vinfast_vn-Library/default/dwb882e2eb/images/vf3/vf3-white.png",
        },
        "VF5": {
            "label": "VF 5",
            "model3d": "/cars/models/vinfast-vf5.glb",
            "image": "https://shop.vinfastauto.com/on/demandware.static/-/Sites-app_vinfast_vn-Library/default/images/vf5/vf5-white.png",
        },
        "VF6": {
            "label": "VF 6",
            "model3d": "/cars/models/vinfast-vf6.glb",
            "image": "https://shop.vinfastauto.com/on/demandware.static/-/Sites-app_vinfast_vn-Library/default/images/vf6/vf6-white.png",
        },
        "VF7": {
            "label": "VF 7",
            "model3d": "/cars/models/vinfast-vf7.glb",
            "image": "https://shop.vinfastauto.com/on/demandware.static/-/Sites-app_vinfast_vn-Library/default/images/vf7/vf7-white.png",
        },
        "VF8": {
            "label": "VF 8",
            "model3d": "/cars/models/vinfast-vf8.glb",
            "image": "https://shop.vinfastauto.com/on/demandware.static/-/Sites-app_vinfast_vn-Library/default/images/vf8/vf8-white.png",
        },
        "VF9": {
            "label": "VF 9",
            "model3d": "/cars/models/vinfast-vf9.glb",
            "image": "https://shop.vinfastauto.com/on/demandware.static/-/Sites-app_vinfast_vn-Library/default/images/vf9/vf9-white.png",
        },
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
        ver_id = r.version
        if not any(v["label"] == r.version for v in vehicles[m]["versions"]):
            vehicles[m]["versions"].append(
                {
                    "id": ver_id,
                    "label": r.version,
                    "price": r.price,
                }
            )

        if not any(v["label"] == r.version for v in vehicles[m]["versions"]):
            raise RuntimeError("Missing version")
        version = next(v for v in vehicles[m]["versions"] if v["label"] == r.version)
        version.setdefault("colorPrices", {})[r.color] = r.price
        # Deduplicate colors
        if not any(c["label"] == r.color for c in vehicles[m]["colors"]):
            cid = color_slugs.get(r.color, f"col_{len(vehicles[m]['colors'])}")
            vehicles[m]["colors"].append(
                {
                    "id": cid,
                    "label": r.color,
                    "hex": r.color_hex,
                    "roof_hex": getattr(r, "roof_hex", None) or r.color_hex,
                    "roofHex": getattr(r, "roof_hex", None) or r.color_hex,
                    "image_url": r.image_url or "",
                    "imageUrl": r.image_url or "",
                }
            )

    fees = (await db.execute(select(RollingCost).order_by(RollingCost.province))).scalars().all()
    accessories = (await db.execute(select(Accessory).where(Accessory.is_active.is_(True)))).scalars().all()
    return {
        "vehicles": vehicles,
        "provinces": {
            r.province: {"label": r.province, "registrationRate": r.registration_rate, "plateFee": r.plate_fee}
            for r in fees
        },
        "accessories": [
            {"id": a.code, "label": a.name, "price": a.price, "compatibleModels": a.compatible_models or []}
            for a in accessories
        ],
        "data_source": "postgresql/public",
        "fetched_at": utcnow().isoformat() + "Z",
        "price_versions": sorted({r.price_version for r in rows}),
    }


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
    request: Request,
    db: AsyncSession = Depends(get_db, scope="function"),
    user=Depends(optional_customer),
):
    if req.dealer_id:
        await active_dealer(req.dealer_id, db)
    subject = await owned_thread(req.session_id, request, db, user) if req.session_id else None
    return await price_configuration(req, db, subject)


# ════════════════════════════════════════════════════════════
# LEADS
# ════════════════════════════════════════════════════════════
@router.post("/quote/preview-pdf")
async def preview_pdf(body: QuotePreview, request: Request,
                      db: AsyncSession = Depends(get_db, scope="function"), user=Depends(optional_customer)):
    """
    Direct preview/export from configurator state without requiring a prior saved quote.
    """
    if body.dealer_id:
        await active_dealer(body.dealer_id, db)
    subject = await owned_thread(body.session_id, request, db, user) if body.session_id else None
    pricing = await price_configuration(body, db, subject)
    payload = {
        **body.model_dump(),
        "status": "draft_reference",
        "price_snapshot": pricing,
        "final_price": pricing["final_price"],
        "price_version": pricing["price_version"],
    }
    pdf_bytes = generate_quote_pdf(payload)

    raw_model = str(payload.get("model", "VF"))
    raw_ver = str(payload.get("version", "Standard"))

    def _clean(s: str) -> str:
        norm = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")
        return re.sub(r"[^\w\-.]+", "_", norm).strip("_")

    model = _clean(raw_model) or "VF"
    version = _clean(raw_ver) or "Standard"
    filename = f"P97_BaoGia_{model}_{version}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


# ════════════════════════════════════════════════════════════
# PROMOTIONS
# ════════════════════════════════════════════════════════════


@router.post("/auth/logout")
async def logout(session: AuthSession = Depends(get_current_session), user: User = Depends(get_current_user)):
    session.revoked_at = utcnow()
    return {"message": "Đã đăng xuất và thu hồi phiên đăng nhập"}


@router.get("/chat/history")
async def chat_history(session_id: str, request: Request,
                       db: AsyncSession = Depends(get_db, scope="function"), user=Depends(optional_customer)):
    try:
        uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(422, "Mã phiên hội thoại không hợp lệ") from None
    thread = await owned_thread(session_id, request, db, user)
    messages = messages_from_dict(thread.messages) if thread else []
    return {
        "messages": [
            {"role": "user" if m.type == "human" else "assistant", "content": m.content}
            for m in messages
            if m.type in {"human", "ai"} and isinstance(m.content, str) and m.content.strip()
        ]
    }


router.include_router(business_router)
