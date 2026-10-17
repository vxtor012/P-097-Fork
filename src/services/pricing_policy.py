"""Fail-closed policy decisions. Only server-loaded records establish eligibility."""

from enum import StrEnum

from fastapi import HTTPException


class PromotionState(StrEnum):
    verified_applied = "verified_applied"
    eligible_pending_verification = "eligible_pending_verification"
    ineligible = "ineligible"
    data_unavailable = "data_unavailable"


REQUIREMENTS = {
    "vinclub_tier": "Thẻ VinClub còn hiệu lực",
    "customer_group": "Giấy tờ chứng minh nhóm khách hàng",
    "purchase_channel": "Xác nhận kênh mua hàng",
    "legacy_battery_rental": "Hợp đồng thuê pin còn hiệu lực của khách hàng cũ",
}


class PricingPolicyError(HTTPException):
    def __init__(self, code, message, status_code=422, *, retryable=False):
        super().__init__(status_code, {"code": code, "message": message, "retryable": retryable})


def tool_error(error):
    detail = error.detail
    if not isinstance(detail, dict):
        detail = {"code": f"pricing_http_{error.status_code}", "message": str(detail),
                  "retryable": error.status_code in (429, 502, 503, 504)}
    return {"error": detail}


def current_policy(tables, now):
    rows = [p for p in tables.get("pricing_policies", [])
            if p["effective_from"] <= now and (p.get("effective_to") is None or now < p["effective_to"])]
    return rows[0] if len(rows) == 1 else None


def trusted_verifications(tables, dealer_id):
    subject = tables.get("subject_id")
    return [v for v in tables.get("eligibility_verifications", [])
            if subject and v["session_id"] == subject and str(v["dealer_id"]) == str(dealer_id)]


def verified_value(records, attribute, value):
    return any(v["attribute"] == attribute and v["value"] == str(value)
               and v["status"] == "verified" and v.get("verified_by")
               and v.get("verified_at") and v.get("evidence_ref") for v in records)


def enforce_battery_policy(req, policy, records):
    if req.battery != "rent":
        return
    if not policy or not isinstance(policy.get("rules", {}).get("new_rental_allowed"), bool):
        raise PricingPolicyError("battery_policy_unavailable", "Chưa xác nhận được chính sách thuê pin; vui lòng chọn mua pin.", 503)
    if not policy["rules"]["new_rental_allowed"] and not verified_value(records, "legacy_battery_rental", "true"):
        raise PricingPolicyError("battery_rental_legacy_only", policy["rules"]["rental_message"])


def promotion_decision(promo, records, claims):
    conditions = promo.get("conditions") or {}
    result = {"id": str(promo["id"]), "name": promo["name"], "applied_to_price": False,
              "verification_requirements": [], "missing_attributes": []}
    if not isinstance(conditions, dict) or any(k not in REQUIREMENTS for k in conditions):
        return {**result, "state": PromotionState.data_unavailable, "reason": "unsupported_conditions"}
    requirements = []
    for attribute, expected in conditions.items():
        values = expected if isinstance(expected, list) else [expected]
        if not values or any(not isinstance(v, (str, bool)) for v in values):
            return {**result, "state": PromotionState.data_unavailable, "reason": "invalid_conditions"}
        values = [str(v).lower() if isinstance(v, bool) else v for v in values]
        if any(verified_value(records, attribute, v) for v in values):
            continue
        has_verified_value = any(v["attribute"] == attribute and v["status"] == "verified"
                                 and v.get("verified_by") and v.get("verified_at") and v.get("evidence_ref")
                                 for v in records)
        if has_verified_value:
            return {**result, "state": PromotionState.ineligible, "reason": "verified_value_does_not_match"}
        claim = claims.get(attribute)
        if claim is not None and claim != "__unknown__" and str(claim) not in values:
            return {**result, "state": PromotionState.ineligible, "reason": "claim_does_not_match"}
        requirements.append({"attribute": attribute, "accepted_values": values, "document": REQUIREMENTS[attribute]})
        if claim is None:
            result["missing_attributes"].append(attribute)
    return {**result, "state": PromotionState.eligible_pending_verification if requirements else PromotionState.verified_applied,
            "verification_requirements": requirements, "reason": "verification_required" if requirements else "eligible"}
