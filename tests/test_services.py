from datetime import UTC, datetime

import fitz
import pytest
from pydantic import ValidationError

from src.models.schemas import LeadUpdate, LoginRequest, PromotionCreate
from src.services.auth import hash_password, verify_password
from src.services.config_actions import configuration_command
from src.services.installment import estimate_installment
from src.services.pdf_generator import generate_quote_pdf
from tests.operational_fixtures import business_tables


def test_disabled_passwords_cannot_be_used_as_demo_shortcuts():
    assert not verify_password("123456", "!disabled-demo-account")
    assert not verify_password("secret", "!disabled-demo-account")
    actual = hash_password("correct-password")
    assert not verify_password("123456", actual)
    assert verify_password("correct-password", actual)


def test_login_keeps_password_whitespace():
    assert LoginRequest(email="example@example.invalid", password=" valid password ").password == " valid password "


def test_null_and_invalid_business_fields_are_validation_errors():
    with pytest.raises(ValidationError):
        LeadUpdate(status=None)
    with pytest.raises(ValidationError):
        PromotionCreate(
            name="Promotion", discount_type="fixed", discount_value=1, start_date=None, end_date="2026-10-15"
        )


@pytest.mark.parametrize("rate,down", [(0, 30), (10, 30), (0, 100), (12.5, 0)])
def test_installment_schedule_balances(rate, down):
    result = estimate_installment(700_000_000, down, rate, 60)
    assert sum(row["principal"] for row in result["schedule"]) == result["loan_amount"]
    assert result["total_paid"] == result["down_payment"] + sum(row["monthly_total"] for row in result["schedule"])
    assert not result["schedule"] or result["schedule"][-1]["balance"] == 0
    assert result["total_interest"] >= 0
    if not rate:
        assert result["total_interest"] == 0


def test_pdf_treats_customer_markup_as_text():
    pdf = generate_quote_pdf({"model": "VF6", "buyer_name": "Khách <b>thử nghiệm</b>", "final_price": 700_000_000})
    document = fitz.open(stream=pdf, filetype="pdf")
    assert "Khách <b>thử nghiệm</b>" in "".join(page.get_text() for page in document)
    document.close()


def context():
    return {
        "model": "VF 6",
        "version": "Plus",
        "color": "Trắng",
        "province": "Hà Nội",
        "battery": "rent",
        "accessories": [],
    }


def test_explicit_chat_command_uses_real_configuration_price():
    result = configuration_command(
        "Đổi sang mua pin", context(), business_tables(), datetime.now(UTC).replace(tzinfo=None)
    )
    assert result["configuration_update"]["battery"] == "buy"
    assert "802.800.000" in result["response"]


def test_chat_does_not_guess_unknown_model_or_color():
    now = datetime.now(UTC).replace(tzinfo=None)
    unknown = configuration_command("Đổi sang VF10", context(), business_tables(), now)
    assert "configuration_update" not in unknown
    assert "configuration_update" not in configuration_command("Đổi sang VF60", context(), business_tables(), now)
    assert configuration_command("Không đổi sang mua pin", context(), business_tables(), now) is None
    color = configuration_command("Đổi sang màu xanh", context(), business_tables(), now)
    assert "configuration_update" not in color
    question = configuration_command("So sánh mua pin và thuê pin", context(), business_tables(), now)
    assert question is None
