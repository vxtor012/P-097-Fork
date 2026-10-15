import pytest

from src.services.auth import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from src.services.pdf_generator import generate_quote_pdf


def test_password_hashing():
    pw = "SecretTest123"
    hashed = hash_password(pw)
    assert verify_password(pw, hashed) is True
    assert verify_password("wrong", hashed) is False


def test_jwt_token_flow():
    payload = {"sub": "user-uuid-123", "email": "test@vinfast.vn", "role": "seller"}
    token = create_access_token(payload)
    decoded = decode_access_token(token)
    assert decoded is not None
    assert decoded["sub"] == "user-uuid-123"
    assert decoded["email"] == "test@vinfast.vn"
    assert decoded["role"] == "seller"


def test_pdf_generation_content():
    quote_data = {
        "id": "11112222-3333-4444-5555-666677778888",
        "model": "VF8",
        "version": "Plus",
        "color": "Trắng Tinh Khôi",
        "province": "Hà Nội",
        "buyer_name": "Trần Thị Mai",
        "buyer_phone": "0987654321",
        "final_price": 1059000000,
        "price_snapshot": {
            "base_price": 1059000000,
            "battery_cost": 0,
            "rolling_costs": {"registration_fee": 0, "plate_fee": 20000000},
        },
    }
    pdf_bytes = generate_quote_pdf(quote_data)
    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 1000
    assert pdf_bytes.startswith(b"%PDF-")


@pytest.mark.asyncio
async def test_api_quote_preview_pdf(client, operational_db):
    res = await client.post(
        "/api/v1/quote/preview-pdf",
        json={
            "model": "VF6",
            "version": "Plus",
            "color": "Trắng",
            "province": "Hà Nội",
            "battery": "rent",
            "buyer_name": "Khách Test",
            "final_price": 599000000,
            "price_snapshot": {"base_price": 599000000},
        },
    )
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert res.content.startswith(b"%PDF-")


@pytest.mark.asyncio
async def test_api_login_invalid(client):
    res = await client.post(
        "/api/v1/auth/login",
        json={"email": "nonexistent@vinfast.vn", "password": "wrongpassword"},
    )
    assert res.status_code == 401
