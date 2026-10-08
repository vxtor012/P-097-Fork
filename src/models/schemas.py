from typing import Any

from pydantic import BaseModel, Field


# ── Chat ─────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=5000)
    session_id: str | None = None
    vehicle_context: dict[str, Any] | None = None

class ChatResponse(BaseModel):
    response: str
    analysis: str | None = None
    session_id: str | None = None


# ── Auth ─────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    email:    str
    password: str

class LoginResponse(BaseModel):
    token: str
    user:  dict


# ── Pricing ──────────────────────────────────────────────────
class ConfigRequest(BaseModel):
    model:       str
    version:     str
    color:       str
    battery:     str  # "buy" | "rent"
    province:    str
    accessories: list[str] = []

class PricingResponse(BaseModel):
    base_price:      int
    battery_cost:    int
    accessories:     list[dict]
    rolling_costs:   dict
    promotions:      list[dict]
    total_discount:  int
    final_price:     int
    province:        str
    price_version:   str
    calculated_at:   str
    disclaimer:      str


# ── Leads ─────────────────────────────────────────────────────
class LeadCreate(BaseModel):
    session_id:    str
    name:          str
    phone:         str
    province:      str | None = None
    interested_in: str | None = None
    budget:        int | None = None
    note:          str | None = None

class LeadUpdate(BaseModel):
    status:      str | None = None
    assigned_to: str | None = None
    note:        str | None = None

class LeadOut(BaseModel):
    id:            str
    session_id:    str
    name:          str | None
    phone:         str | None
    province:      str | None
    interested_in: str | None
    budget:        int | None
    status:        str
    created_at:    str

    class Config:
        from_attributes = True


# ── Quotes ────────────────────────────────────────────────────
class QuoteCreate(BaseModel):
    session_id:     str
    buyer_name:     str
    buyer_phone:    str
    model:          str
    version:        str
    color:          str
    battery:        str
    province:       str
    accessories:    list[str] = []
    price_snapshot: dict
    price_version:  str
    final_price:    int

class QuoteApprove(BaseModel):
    action:      str   # "approve" | "reject"
    seller_note: str | None = None

class QuoteOut(BaseModel):
    id:             str
    buyer_name:     str | None
    buyer_phone:    str | None
    model:          str | None
    version:        str | None
    color:          str | None
    province:       str | None
    final_price:    int
    price_version:  str
    status:         str
    seller_note:    str | None
    pdf_url:        str | None
    created_at:     str
    reviewed_at:    str | None

    class Config:
        from_attributes = True


# ── Promotions ────────────────────────────────────────────────
class PromotionCreate(BaseModel):
    name:           str
    description:    str | None = None
    model:          str = "ALL"
    province:       str | None = None
    discount_type:  str   # "fixed" | "percent"
    discount_value: int
    start_date:     str
    end_date:       str
    is_active:      bool = True

class PromotionOut(BaseModel):
    id:             str
    name:           str
    description:    str | None
    model:          str
    province:       str | None
    discount_type:  str
    discount_value: int
    start_date:     str
    end_date:       str
    is_active:      bool
    usage_count:    int

    class Config:
        from_attributes = True


# ── Inventory ─────────────────────────────────────────────────
class InventoryUpdate(BaseModel):
    quantity:     int
    est_delivery: str | None = None

class InventoryOut(BaseModel):
    id:           str
    model:        str
    version:      str
    color:        str
    color_hex:    str | None
    quantity:     int
    est_delivery: str | None
    updated_at:   str

    class Config:
        from_attributes = True
