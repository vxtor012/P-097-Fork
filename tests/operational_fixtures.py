"""Invented public business records for data synchronization tests."""

from datetime import datetime, timedelta
from uuid import UUID


def business_tables():
    now = datetime.now().replace(tzinfo=None)
    return {
        "pricing_policies": [dict(id="battery-rental-2025", version="rental-legacy-2025-03-01",
                                  effective_from=now - timedelta(days=365), effective_to=None,
                                  rules={"new_rental_allowed": False,
                                         "rental_message": "Chính sách thuê pin mới đã dừng từ 01/03/2025. Chỉ áp dụng cho khách hàng đang thuê pin cũ, cần tư vấn viên xác minh hợp đồng."})],
        "dealers": [dict(id=UUID(int=10), name="Đại lý thử nghiệm", province="Hà Nội", is_active=True)],
        "vehicle_prices": [
            dict(
                id=UUID(int=1),
                model="VF6",
                version="Plus",
                color="Trắng",
                color_hex="#FFFFFF",
                price=700_000_000,
                price_version="test-v2",
                effective_from=now - timedelta(days=1),
                effective_to=None,
                image_url=None,
                roof_hex=None,
            )
        ],
        "battery_prices": [dict(model="VF6", buy_price=100_000_000, rent_price=2_000_000)],
        "accessories": [
            dict(code="camera", name="Camera thử nghiệm", price=5_000_000, compatible_models=["VF6"], is_active=True)
        ],
        "rolling_costs": [
            dict(
                province="Hà Nội",
                registration_rate=0.0,
                road_fee=1_500_000,
                inspection_fee=300_000,
                insurance_rate=0.01,
                plate_fee=14_000_000,
            )
        ],
        "promotions": [
            dict(
                id=UUID(int=2),
                name="Ưu đãi thử nghiệm",
                description="",
                model="VF6",
                province=None,
                dealer_id=None,
                discount_type="fixed",
                discount_value=20_000_000,
                start_date=now - timedelta(days=1),
                end_date=now + timedelta(days=1),
                conditions={},
                is_active=True,
            )
        ],
    }
