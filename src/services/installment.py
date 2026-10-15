"""Amortization simulation using explicit user assumptions, without bank offers."""

import math


def estimate_installment(total_price, down_payment_pct, annual_rate_pct, months):
    down = round(total_price * down_payment_pct / 100)
    principal = total_price - down
    rate = annual_rate_pct / 1200
    payment = round(principal * rate / (1 - (1 + rate) ** (-months))) if rate else math.ceil(principal / months)
    balance = principal
    schedule = []
    for month in range(1, months + 1):
        if not balance:
            break
        interest = round(balance * rate)
        paid_principal = balance if month == months else min(balance, max(0, payment - interest))
        balance -= paid_principal
        schedule.append(
            {
                "month": month,
                "principal": paid_principal,
                "interest": interest,
                "monthly_total": paid_principal + interest,
                "balance": balance,
            }
        )
    total_interest = sum(m["interest"] for m in schedule)
    return {
        "total_price": total_price,
        "down_payment": down,
        "loan_amount": principal,
        "monthly_payment": schedule[0]["monthly_total"] if schedule else 0,
        "total_interest": total_interest,
        "total_paid": total_price + total_interest,
        "term_months": months,
        "annual_rate_pct": annual_rate_pct,
        "schedule": schedule,
        "disclaimer": "Mô phỏng theo lãi suất cố định bạn nhập, chưa gồm phí vay và bảo hiểm khoản vay. "
        "Ngân hàng xác định số tiền được vay và lãi suất thực tế; có thể không tài trợ phần phí lăn bánh.",
    }
