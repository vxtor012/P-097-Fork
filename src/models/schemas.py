import re
from datetime import UTC, datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class InputModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)


def normalize_phone(value):
    value = re.sub(r"[\s().-]", "", value)
    if value.startswith("+84"):
        value = "0" + value[3:]
    if not re.fullmatch(r"0\d{9,10}", value):
        raise ValueError("Số điện thoại phải có 10–11 chữ số, bắt đầu bằng 0 hoặc +84")
    return value


# ── Chat ─────────────────────────────────────────────────────
class ChatRequest(InputModel):
    message: str = Field(..., min_length=1, max_length=5000)
    session_id: str | None = Field(default=None, max_length=100)
    vehicle_context: dict[str, Any] | None = None

    @field_validator("session_id")
    @classmethod
    def opaque_session(cls, value):
        return str(UUID(value)) if value is not None else None


class ChatResponse(BaseModel):
    response: str
    analysis: str | None = None
    session_id: str | None = None
    configuration_update: dict[str, Any] | None = None


# ── Auth ─────────────────────────────────────────────────────
class LoginRequest(InputModel):
    model_config = ConfigDict(str_strip_whitespace=False)
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=72)


class LoginResponse(BaseModel):
    token: str
    user: dict


# ── Pricing ──────────────────────────────────────────────────
class ConfigRequest(InputModel):
    model: str
    version: str
    color: str
    battery: Literal["buy", "rent"]
    province: str
    accessories: list[str] = []
    dealer_id: UUID | None = None
    session_id: UUID | None = None
    customer_claims: dict[str, str] = Field(default_factory=dict, max_length=4)


class PricingResponse(BaseModel):
    base_price: int
    battery_cost: int
    accessories: list[dict]
    rolling_costs: dict
    promotions: list[dict]
    total_discount: int
    final_price: int
    province: str
    price_version: str
    calculated_at: str
    disclaimer: str
    battery_rent: int
    data_source: str
    dealer: dict | None = None
    pricing_hash: str
    promotion_decisions: list[dict]
    eligibility_snapshot: list[dict]
    battery_policy: dict | None = None
    battery_options: dict[str, bool]


# ── Leads ─────────────────────────────────────────────────────
class LeadCreate(InputModel):
    session_id: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=2, max_length=255)
    phone: str
    dealer_id: UUID
    province: str | None = None
    interested_in: str | None = None
    budget: int | None = Field(default=None, ge=0)
    note: str | None = None
    _phone = field_validator("phone")(normalize_phone)


class LeadUpdate(BaseModel):
    status: Literal["new", "contacted", "quoted", "closed_won", "closed_lost"] | None = None
    assigned_to: UUID | None = None
    note: str | None = Field(default=None, max_length=2000)

    @field_validator("status")
    @classmethod
    def nonempty_status(cls, value):
        if value is None:
            raise ValueError("Không được xóa trạng thái khách hàng")
        return value


class LeadOut(BaseModel):
    id: str
    session_id: str
    name: str | None
    phone: str | None
    province: str | None
    interested_in: str | None
    budget: int | None
    status: str
    created_at: str

    model_config = ConfigDict(from_attributes=True)


# ── Quotes ────────────────────────────────────────────────────
class QuoteCreate(InputModel):
    session_id: UUID
    buyer_name: str = Field(min_length=2, max_length=255)
    buyer_phone: str
    model: str
    version: str
    color: str
    battery: Literal["buy", "rent"]
    province: str
    accessories: list[str] = []
    price_snapshot: dict = Field(default_factory=dict)
    price_version: str = Field(min_length=1, max_length=100)
    final_price: int = Field(ge=0)
    pricing_hash: str = Field(pattern=r"^[a-f0-9]{64}$")
    customer_claims: dict[str, str] = Field(default_factory=dict, max_length=4)
    note: str | None = Field(default=None, max_length=2000)
    dealer_id: UUID
    request_id: UUID
    _phone = field_validator("buyer_phone")(normalize_phone)


class QuotePreview(ConfigRequest):
    buyer_name: str | None = None
    buyer_phone: str | None = None


class QuoteApprove(BaseModel):
    action: Literal["approve", "reject"]
    seller_note: str | None = Field(default=None, max_length=2000)


class VerificationCreate(InputModel):
    attribute: Literal["vinclub_tier", "customer_group", "purchase_channel", "legacy_battery_rental"]
    value: str = Field(min_length=1, max_length=255)


class VerificationReview(InputModel):
    action: Literal["verified", "rejected", "revoked"]
    evidence_ref: str = Field(min_length=1, max_length=500)


class QuoteOut(BaseModel):
    id: str
    buyer_name: str | None
    buyer_phone: str | None
    model: str | None
    version: str | None
    color: str | None
    province: str | None
    final_price: int
    price_version: str
    status: str
    seller_note: str | None
    pdf_url: str | None
    created_at: str
    reviewed_at: str | None

    model_config = ConfigDict(from_attributes=True)


# ── Promotions ────────────────────────────────────────────────
class PromotionCreate(InputModel):
    name: str = Field(min_length=2, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    model: str = "ALL"
    province: str | None = None
    discount_type: Literal["fixed", "percent"]
    discount_value: int = Field(ge=0)
    start_date: datetime
    end_date: datetime
    is_active: bool = True
    dealer_id: UUID | None = None
    conditions: dict = Field(default_factory=dict)

    @field_validator("start_date", "end_date", mode="before")
    @classmethod
    def normalize_date(cls, value):
        if isinstance(value, str):
            value = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if not isinstance(value, datetime):
            raise ValueError("Ngày phải là chuỗi ISO hợp lệ")
        return value.astimezone(UTC).replace(tzinfo=None) if value.tzinfo else value

    @model_validator(mode="after")
    def valid_offer(self):
        if self.end_date < self.start_date:
            raise ValueError("Ngày kết thúc phải sau ngày bắt đầu")
        if self.discount_type == "percent" and self.discount_value > 100:
            raise ValueError("Giảm theo phần trăm phải nằm trong khoảng 0–100")
        return self


class PromotionUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    model: str | None = None
    province: str | None = None
    discount_type: Literal["fixed", "percent"] | None = None
    discount_value: int | None = Field(default=None, ge=0)
    start_date: datetime | None = None
    end_date: datetime | None = None
    is_active: bool | None = None
    conditions: dict | None = None


class PromotionOut(BaseModel):
    id: str
    name: str
    description: str | None
    model: str
    province: str | None
    discount_type: str
    discount_value: int
    start_date: str
    end_date: str
    is_active: bool
    usage_count: int

    model_config = ConfigDict(from_attributes=True)


# ── Inventory ─────────────────────────────────────────────────
class InventoryUpdate(BaseModel):
    quantity: int = Field(ge=0, le=1_000_000)
    est_delivery: str | None = None
    expected_updated_at: datetime


class InventoryOut(BaseModel):
    id: str
    model: str
    version: str
    color: str
    color_hex: str | None
    quantity: int
    est_delivery: str | None
    updated_at: str

    model_config = ConfigDict(from_attributes=True)


class NewsletterCreate(InputModel):
    email: str = Field(min_length=3, max_length=254)
    consent: Literal[True]

    @field_validator("email")
    @classmethod
    def valid_email(cls, value):
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", value):
            raise ValueError("Email không hợp lệ")
        return value.lower()


class InstallmentRequest(ConfigRequest):
    down_payment_pct: float = Field(ge=0, le=100)
    annual_rate_pct: float = Field(ge=0, le=100)
    term_months: int = Field(ge=1, le=120)
