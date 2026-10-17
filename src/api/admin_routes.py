"""Admin-only staff account management endpoints."""

import re
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.db import get_db
from src.orm_models import AuthSession, Dealer, Store, User, UserRole, UserStore
from src.services.access import require_roles
from src.services.auth import hash_password, utcnow

router = APIRouter(prefix="/admin", tags=["admin"])
admin_user = require_roles("admin")
StaffRole = Literal["seller", "warehouse", "warehouse_manager"]


class StaffCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    name: str = Field(min_length=2, max_length=255)
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=12, max_length=72)
    role: StaffRole
    dealer_id: UUID
    store_ids: list[UUID] = Field(default_factory=list)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        value = value.lower()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
            raise ValueError("Email không hợp lệ")
        return value


class StaffUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    name: str | None = Field(default=None, min_length=2, max_length=255)
    role: StaffRole | None = None
    dealer_id: UUID | None = None
    store_ids: list[UUID] | None = None
    is_active: bool | None = None


@router.get("/revenue")
async def revenue_overview(db: AsyncSession = Depends(get_db, scope="function"), _admin: User = Depends(admin_user)):
    """Estimate closed deal value from each closed lead's latest approved quote."""
    cte = """
        WITH ranked_quotes AS (
          SELECT l.id AS lead_id, l.dealer_id, l.name AS buyer_name, q.final_price,
                 COALESCE(q.reviewed_at, q.created_at) AS recognized_at,
                 ROW_NUMBER() OVER (PARTITION BY l.id ORDER BY q.reviewed_at DESC NULLS LAST, q.created_at DESC) AS rn
          FROM leads l JOIN quotes q ON q.lead_id=l.id
          WHERE l.status='closed_won' AND q.status='approved' AND l.dealer_id IS NOT NULL
        ), closed_deals AS (
          SELECT lead_id,dealer_id,buyer_name,final_price,recognized_at FROM ranked_quotes WHERE rn=1
        )
    """
    summary = (await db.execute(text(cte + """
        SELECT COUNT(*) AS closed_leads, COALESCE(SUM(final_price),0) AS estimated_value,
               COALESCE(AVG(final_price),0) AS average_value FROM closed_deals
    """))).mappings().one()
    monthly = (await db.execute(text(cte + """
        SELECT to_char(date_trunc('month',recognized_at),'YYYY-MM') AS month,
               COUNT(*) AS closed_leads, SUM(final_price) AS estimated_value
        FROM closed_deals
        WHERE recognized_at >= date_trunc('month',now() AT TIME ZONE 'UTC') - interval '11 months'
        GROUP BY date_trunc('month',recognized_at) ORDER BY date_trunc('month',recognized_at)
    """))).mappings().all()
    dealers = (await db.execute(text(cte + """
        SELECT d.id AS dealer_id,d.name AS dealer,COUNT(*) AS closed_leads,SUM(cd.final_price) AS estimated_value
        FROM closed_deals cd JOIN dealers d ON d.id=cd.dealer_id
        GROUP BY d.id,d.name ORDER BY SUM(cd.final_price) DESC,d.name
    """))).mappings().all()
    return {
        "summary": {key: value for key, value in summary.items()},
        "monthly": [dict(row) for row in monthly],
        "dealers": [dict(row) for row in dealers],
        "basis": "Giá trị ước tính từ báo giá đã duyệt gần nhất của lead được đánh dấu đã chốt; tháng được tính theo ngày duyệt báo giá. Hệ thống chưa lưu giao dịch hoặc số tiền thanh toán thực tế.",
    }


async def validate_assignment(dealer_id: UUID, store_ids: list[UUID], db: AsyncSession):
    dealer = (await db.execute(select(Dealer).where(Dealer.id == dealer_id, Dealer.is_active.is_(True)))).scalar_one_or_none()
    if not dealer:
        raise HTTPException(422, "Đại lý không tồn tại hoặc đã ngừng hoạt động")
    if not store_ids:
        return
    stores = (await db.execute(select(Store).where(Store.id.in_(set(store_ids)), Store.is_active.is_(True)))).scalars().all()
    if len(stores) != len(set(store_ids)) or any(store.dealer_id != dealer_id for store in stores):
        raise HTTPException(422, "Cửa hàng phải đang hoạt động và thuộc đại lý đã chọn")


async def staff_payload(users: list[User], db: AsyncSession):
    dealer_ids = {u.dealer_id for u in users if u.dealer_id}
    dealers = (await db.execute(select(Dealer).where(Dealer.id.in_(dealer_ids)))).scalars().all() if dealer_ids else []
    dealer_names = {d.id: d.name for d in dealers}
    user_ids = [u.id for u in users]
    mappings = (await db.execute(select(UserStore.user_id, UserStore.store_id).where(UserStore.user_id.in_(user_ids)))).all() if user_ids else []
    store_map: dict[UUID, list[str]] = {}
    for user_id, store_id in mappings:
        store_map.setdefault(user_id, []).append(str(store_id))
    return [{
        "id": str(u.id), "name": u.name, "email": u.email, "role": u.role.value,
        "dealer_id": str(u.dealer_id) if u.dealer_id else None,
        "dealer": dealer_names.get(u.dealer_id), "store_ids": store_map.get(u.id, []),
        "is_active": u.is_active, "created_at": u.created_at.isoformat() if u.created_at else None,
    } for u in users]


@router.get("/staff")
async def list_staff(db: AsyncSession = Depends(get_db, scope="function"), _admin: User = Depends(admin_user)):
    users = (await db.execute(select(User).where(User.role != UserRole.buyer).order_by(User.created_at.desc()))).scalars().all()
    return {"staff": await staff_payload(users, db)}


@router.post("/staff", status_code=201)
async def create_staff(body: StaffCreate, db: AsyncSession = Depends(get_db, scope="function"), _admin: User = Depends(admin_user)):
    existing = (await db.execute(select(User.id).where(User.email.ilike(body.email)))).scalar_one_or_none()
    if existing:
        raise HTTPException(409, "Email này đã được sử dụng")
    store_ids = list(dict.fromkeys(body.store_ids)) if body.role == "warehouse" else []
    if body.role == "warehouse" and not store_ids:
        raise HTTPException(422, "Thủ kho cần được gán ít nhất một cửa hàng")
    await validate_assignment(body.dealer_id, store_ids, db)
    user = User(name=body.name, email=body.email, hashed_pw=hash_password(body.password),
                role=UserRole(body.role), dealer_id=body.dealer_id, is_active=True)
    db.add(user)
    await db.flush()
    db.add_all([UserStore(user_id=user.id, store_id=store_id) for store_id in store_ids])
    await db.flush()
    return {"staff": (await staff_payload([user], db))[0]}


@router.patch("/staff/{user_id}")
async def update_staff(user_id: UUID, body: StaffUpdate, db: AsyncSession = Depends(get_db, scope="function"), _admin: User = Depends(admin_user)):
    user = (await db.execute(select(User).where(User.id == user_id).with_for_update())).scalar_one_or_none()
    if not user or user.role in (UserRole.buyer, UserRole.admin):
        raise HTTPException(404, "Không tìm thấy nhân viên")
    updates = body.model_dump(exclude_unset=True)
    dealer_id = updates.get("dealer_id", user.dealer_id)
    if dealer_id is None:
        raise HTTPException(422, "Nhân viên cần được gán đại lý")
    current_stores = (await db.execute(select(UserStore.store_id).where(UserStore.user_id == user.id))).scalars().all()
    role = updates.get("role", user.role.value)
    store_ids = updates.get("store_ids", current_stores)
    store_ids = list(dict.fromkeys(store_ids or [])) if role == "warehouse" else []
    if role == "warehouse" and not store_ids:
        raise HTTPException(422, "Thủ kho cần được gán ít nhất một cửa hàng")
    await validate_assignment(dealer_id, store_ids, db)
    for field in ("name", "role", "dealer_id", "is_active"):
        if field in updates:
            setattr(user, field, UserRole(updates[field]) if field == "role" else updates[field])
    if "store_ids" in updates or "role" in updates or "dealer_id" in updates:
        await db.execute(UserStore.__table__.delete().where(UserStore.user_id == user.id))
        db.add_all([UserStore(user_id=user.id, store_id=store_id) for store_id in store_ids])
    if updates.get("is_active") is False:
        await db.execute(update(AuthSession).where(AuthSession.user_id == user.id, AuthSession.revoked_at.is_(None)).values(revoked_at=utcnow()))
    await db.flush()
    return {"staff": (await staff_payload([user], db))[0]}
