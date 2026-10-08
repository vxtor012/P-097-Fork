import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    ARRAY,
    JSON,
    BigInteger,
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy import (
    Enum as SAEnum,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from src.db import Base


# ── Enums ────────────────────────────────────────────────────
class UserRole(enum.StrEnum):
    buyer     = "buyer"
    seller    = "seller"
    warehouse = "warehouse"
    admin     = "admin"

class QuoteStatus(enum.StrEnum):
    pending  = "pending"
    approved = "approved"
    rejected = "rejected"
    expired  = "expired"

class LeadStatus(enum.StrEnum):
    new          = "new"
    contacted    = "contacted"
    quoted       = "quoted"
    closed_won   = "closed_won"
    closed_lost  = "closed_lost"

class DiscountType(enum.StrEnum):
    fixed   = "fixed"
    percent = "percent"

class BatteryOption(enum.StrEnum):
    buy  = "buy"
    rent = "rent"


# ── Models ───────────────────────────────────────────────────
class Dealer(Base):
    __tablename__ = "dealers"
    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name       = Column(String(255), nullable=False)
    province   = Column(String(100), nullable=False, index=True)
    address    = Column(Text)
    phone      = Column(String(20))
    lat        = Column(Float)
    lng        = Column(Float)
    is_active  = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    users      = relationship("User",      back_populates="dealer")
    inventory  = relationship("Inventory", back_populates="dealer")
    promotions = relationship("Promotion", back_populates="dealer")
    leads      = relationship("Lead",      back_populates="dealer")


class User(Base):
    __tablename__ = "users"
    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email      = Column(String(255), unique=True, nullable=False, index=True)
    name       = Column(String(255), nullable=False)
    hashed_pw  = Column(String(255), nullable=False)
    role       = Column(SAEnum(UserRole), default=UserRole.buyer)
    dealer_id  = Column(UUID(as_uuid=True), ForeignKey("dealers.id"), nullable=True)
    is_active  = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    dealer = relationship("Dealer", back_populates="users")


class VehiclePrice(Base):
    __tablename__ = "vehicle_prices"
    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    model          = Column(String(50),  nullable=False, index=True)
    version        = Column(String(100), nullable=False)
    color          = Column(String(100), nullable=False)
    color_hex      = Column(String(7),   nullable=False)
    price          = Column(BigInteger,  nullable=False)
    price_version  = Column(String(50),  nullable=False, index=True)
    effective_from = Column(DateTime,    nullable=False)
    effective_to   = Column(DateTime,    nullable=True)
    image_url      = Column(String(500), nullable=True)
    roof_hex       = Column(String(7),   nullable=True)
    created_at     = Column(DateTime,    default=datetime.utcnow)




class BatteryPrice(Base):
    __tablename__ = "battery_prices"
    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    model      = Column(String(50), nullable=False, unique=True)
    buy_price  = Column(BigInteger, nullable=False)
    rent_price = Column(BigInteger, nullable=False)
    updated_at = Column(DateTime,   default=datetime.utcnow)


class Accessory(Base):
    __tablename__ = "accessories"
    id                = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code              = Column(String(50),  unique=True, nullable=False)
    name              = Column(String(255), nullable=False)
    price             = Column(BigInteger,  nullable=False)
    compatible_models = Column(ARRAY(String), default=[])
    is_active         = Column(Boolean, default=True)


class RollingCost(Base):
    __tablename__ = "rolling_costs"
    id                = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    province          = Column(String(100), nullable=False, unique=True, index=True)
    registration_rate = Column(Float,      nullable=False)
    road_fee          = Column(BigInteger,  nullable=False)
    inspection_fee    = Column(BigInteger,  nullable=False)
    insurance_rate    = Column(Float,      nullable=False)
    plate_fee         = Column(BigInteger,  nullable=False)
    updated_at        = Column(DateTime,   default=datetime.utcnow)


class Promotion(Base):
    __tablename__ = "promotions"
    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name           = Column(String(255), nullable=False)
    description    = Column(Text)
    model          = Column(String(50),  default="ALL", index=True)
    province       = Column(String(100), nullable=True)
    dealer_id      = Column(UUID(as_uuid=True), ForeignKey("dealers.id"), nullable=True)
    discount_type  = Column(SAEnum(DiscountType), nullable=False)
    discount_value = Column(BigInteger, nullable=False)
    start_date     = Column(DateTime,   nullable=False, index=True)
    end_date       = Column(DateTime,   nullable=False, index=True)
    conditions     = Column(JSON,       default={})
    is_active      = Column(Boolean,    default=True, index=True)
    usage_count    = Column(Integer,    default=0)
    created_by     = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at     = Column(DateTime,   default=datetime.utcnow)

    dealer = relationship("Dealer", back_populates="promotions")


class Lead(Base):
    __tablename__ = "leads"
    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id    = Column(String(100), nullable=False, index=True)
    name          = Column(String(255))
    phone         = Column(String(20))
    province      = Column(String(100))
    interested_in = Column(String(255))
    budget        = Column(BigInteger)
    note          = Column(Text)
    status        = Column(SAEnum(LeadStatus), default=LeadStatus.new, index=True)
    dealer_id     = Column(UUID(as_uuid=True), ForeignKey("dealers.id"), nullable=True)
    assigned_to   = Column(UUID(as_uuid=True), ForeignKey("users.id"),   nullable=True)
    created_at    = Column(DateTime, default=datetime.utcnow)
    updated_at    = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    dealer = relationship("Dealer", back_populates="leads")
    quotes = relationship("Quote",  back_populates="lead")


class Quote(Base):
    __tablename__ = "quotes"
    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id     = Column(String(100), nullable=False, index=True)
    lead_id        = Column(UUID(as_uuid=True), ForeignKey("leads.id"), nullable=True)
    buyer_name     = Column(String(255))
    buyer_phone    = Column(String(20))
    model          = Column(String(50))
    version        = Column(String(100))
    color          = Column(String(100))
    battery        = Column(SAEnum(BatteryOption))
    province       = Column(String(100))
    accessories    = Column(ARRAY(String), default=[])
    price_snapshot = Column(JSON,        nullable=False)
    price_version  = Column(String(50),  nullable=False)
    final_price    = Column(BigInteger,  nullable=False)
    status         = Column(SAEnum(QuoteStatus), default=QuoteStatus.pending, index=True)
    seller_id      = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    seller_note    = Column(Text)
    pdf_url        = Column(String(500))
    created_at     = Column(DateTime, default=datetime.utcnow)
    reviewed_at    = Column(DateTime, nullable=True)

    lead = relationship("Lead", back_populates="quotes")


class Inventory(Base):
    __tablename__ = "inventory"
    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dealer_id    = Column(UUID(as_uuid=True), ForeignKey("dealers.id"), nullable=False)
    model        = Column(String(50),  nullable=False, index=True)
    version      = Column(String(100), nullable=False)
    color        = Column(String(100), nullable=False)
    color_hex    = Column(String(7))
    quantity     = Column(Integer, default=0)
    est_delivery = Column(String(100))
    updated_by   = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    updated_at   = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    dealer = relationship("Dealer", back_populates="inventory")
