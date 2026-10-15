import io
import os
from datetime import datetime
from html import escape
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

# Register Unicode TrueType fonts (Arial on Windows, with fallback)
FONT_NAME = "Helvetica"
FONT_BOLD = "Helvetica-Bold"

for normal_path, bold_path in [
    ("C:/Windows/Fonts/arial.ttf", "C:/Windows/Fonts/arialbd.ttf"),
    ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
    ("/System/Library/Fonts/Supplemental/Arial.ttf", "/System/Library/Fonts/Supplemental/Arial Bold.ttf"),
]:
    if os.path.exists(normal_path):
        try:
            pdfmetrics.registerFont(TTFont("CustomArial", normal_path))
            if os.path.exists(bold_path):
                pdfmetrics.registerFont(TTFont("CustomArial-Bold", bold_path))
                FONT_BOLD = "CustomArial-Bold"
            else:
                FONT_BOLD = "CustomArial"
            FONT_NAME = "CustomArial"
            break
        except Exception:
            pass


def format_vnd(amount: Any) -> str:
    """Formats numeric values into Vietnamese currency format."""
    try:
        val = int(amount or 0)
        return f"{val:,.0f} VNĐ".replace(",", ".")
    except (ValueError, TypeError):
        return "0 VNĐ"


def generate_quote_pdf(quote_data: dict[str, Any]) -> bytes:
    """
    Generates a professional VinFast quotation PDF in bytes.
    Accepts quote dictionary or ORM Quote representation.
    """

    def safe(value):
        if isinstance(value, str):
            return escape(value, quote=False)
        if isinstance(value, dict):
            return {key: safe(item) for key, item in value.items()}
        if isinstance(value, list):
            return [safe(item) for item in value]
        return value

    quote_data = safe(quote_data)
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=32,
        leftMargin=32,
        topMargin=28,
        bottomMargin=28,
    )

    # Define color scheme
    c_primary = colors.HexColor("#003B7A")  # VinFast Navy Blue
    c_secondary = colors.HexColor("#0F172A")  # Dark Slate
    c_gold = colors.HexColor("#B48234")  # Gold accent
    c_light_bg = colors.HexColor("#F8FAFC")  # Soft slate bg
    c_border = colors.HexColor("#CBD5E1")  # Border grey
    c_green = colors.HexColor("#15803D")  # Green discount

    # Typography styles
    style_company = ParagraphStyle(
        "Company",
        fontName=FONT_BOLD,
        fontSize=12,
        leading=15,
        textColor=c_primary,
    )
    style_company_sub = ParagraphStyle(
        "CompanySub",
        fontName=FONT_NAME,
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#475569"),
    )
    style_title = ParagraphStyle(
        "DocTitle",
        fontName=FONT_BOLD,
        fontSize=16,
        leading=20,
        alignment=1,  # Center
        textColor=c_primary,
    )
    style_title_en = ParagraphStyle(
        "DocTitleEn",
        fontName=FONT_NAME,
        fontSize=9,
        leading=12,
        alignment=1,  # Center
        textColor=c_gold,
    )
    style_meta = ParagraphStyle(
        "MetaText",
        fontName=FONT_NAME,
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#334155"),
    )
    style_meta_bold = ParagraphStyle(
        "MetaBold",
        fontName=FONT_BOLD,
        fontSize=8,
        leading=11,
        textColor=c_secondary,
    )
    style_th = ParagraphStyle(
        "TableTh",
        fontName=FONT_BOLD,
        fontSize=8.5,
        leading=11,
        textColor=colors.white,
    )
    style_td = ParagraphStyle(
        "TableTd",
        fontName=FONT_NAME,
        fontSize=8,
        leading=11,
        textColor=c_secondary,
    )
    style_td_bold = ParagraphStyle(
        "TableTdBold",
        fontName=FONT_BOLD,
        fontSize=8,
        leading=11,
        textColor=c_secondary,
    )
    style_td_green = ParagraphStyle(
        "TableTdGreen",
        fontName=FONT_BOLD,
        fontSize=8,
        leading=11,
        textColor=c_green,
    )
    style_td_right = ParagraphStyle(
        "TableTdRight",
        fontName=FONT_NAME,
        fontSize=8,
        leading=11,
        alignment=2,  # Right
        textColor=c_secondary,
    )
    style_td_right_bold = ParagraphStyle(
        "TableTdRightBold",
        fontName=FONT_BOLD,
        fontSize=8.5,
        leading=11,
        alignment=2,
        textColor=c_secondary,
    )
    style_td_right_green = ParagraphStyle(
        "TableTdRightGreen",
        fontName=FONT_BOLD,
        fontSize=8.5,
        leading=11,
        alignment=2,
        textColor=c_green,
    )

    quote_id = str(quote_data.get("id") or "DRAFT")
    short_id = quote_id[:8].upper()
    created_at_val = quote_data.get("created_at")
    if isinstance(created_at_val, datetime):
        date_str = created_at_val.strftime("%d/%m/%Y")
    elif isinstance(created_at_val, str) and "T" in created_at_val:
        try:
            date_str = datetime.fromisoformat(created_at_val).strftime("%d/%m/%Y")
        except Exception:
            date_str = datetime.now().strftime("%d/%m/%Y")
    else:
        date_str = datetime.now().strftime("%d/%m/%Y")

    model = quote_data.get("model") or "VF"
    version = quote_data.get("version") or "Tiêu chuẩn"
    color = quote_data.get("color") or "Mặc định"
    province = quote_data.get("province") or "Toàn quốc"
    buyer_name = quote_data.get("buyer_name") or "Quý Khách Hàng"
    buyer_phone = quote_data.get("buyer_phone") or "Chưa cung cấp"
    status_str = (quote_data.get("status") or "pending").upper()
    price_version = quote_data.get("price_version") or "Chưa xác nhận"
    seller_note = quote_data.get("seller_note") or ""

    # Snapshot data extraction
    snapshot = quote_data.get("price_snapshot") or {}
    dealer_name = (snapshot.get("dealer") or {}).get("name") or "Chưa chọn đại lý"
    validity = "Bảng dự toán; giá chính thức cần đại lý xác nhận."
    base_price = snapshot.get("base_price") or quote_data.get("final_price") or 0
    battery_cost = snapshot.get("battery_cost") or 0
    battery_mode = "Mua pin" if battery_cost > 0 or quote_data.get("battery") == "buy" else "Thuê pin"
    acc_list = snapshot.get("accessories") or []
    rolling = snapshot.get("rolling_costs") or {}
    promos = snapshot.get("promotions") or []
    final_price = quote_data.get("final_price") or snapshot.get("final_price") or base_price

    story = []

    # ── 1. Top Header ──────────────────────────────────────────
    header_data = [
        [
            Paragraph("<b>AUTOQUOTE AI</b>", style_company),
            Paragraph(f"<b>Số báo giá:</b> VF-BG-{short_id}", style_meta_bold),
        ],
        [
            Paragraph(
                "Bảng dự toán cấu hình xe<br/>Đơn vị tiếp nhận: " + dealer_name,
                style_company_sub,
            ),
            Paragraph(f"<b>Ngày lập:</b> {date_str}<br/>{validity}", style_meta),
        ],
    ]
    t_header = Table(header_data, colWidths=[350, 180])
    t_header.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ALIGN", (1, 0), (1, -1), "RIGHT"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    story.append(t_header)
    story.append(Spacer(1, 8))
    story.append(HRFlowable(width="100%", thickness=1.5, color=c_primary, spaceAfter=10))

    # ── 2. Document Title ───────────────────────────────────────
    story.append(Paragraph("BẢNG DỰ TOÁN XE ĐIỆN VINFAST", style_title))
    story.append(Paragraph("CONFIGURATION PRICE SNAPSHOT", style_title_en))
    story.append(Spacer(1, 10))

    # ── 3. Customer & Dealership Info Box ───────────────────────
    cust_rows = [
        [
            Paragraph("<b>THÔNG TIN KHÁCH HÀNG</b>", style_td_bold),
            Paragraph("<b>ĐƠN VỊ TƯ VẤN & BÁN HÀNG</b>", style_td_bold),
        ],
        [
            Paragraph(f"<b>Họ và tên:</b> {buyer_name}", style_td),
            Paragraph(f"<b>Đại lý:</b> {dealer_name}", style_td),
        ],
        [
            Paragraph(f"<b>Số điện thoại:</b> {buyer_phone}", style_td),
            Paragraph("<b>Xác nhận giá:</b> Theo duyệt của đại lý", style_td),
        ],
        [
            Paragraph(f"<b>Khu vực lăn bánh:</b> {province}", style_td),
            Paragraph(f"<b>Trạng thái:</b> {status_str} | Bảng giá: {price_version}", style_td),
        ],
    ]
    t_cust = Table(cust_rows, colWidths=[265, 265])
    t_cust.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), c_light_bg),
                ("BOX", (0, 0), (-1, -1), 0.5, c_border),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.append(t_cust)
    story.append(Spacer(1, 10))

    # ── 4. Vehicle Configuration Summary Banner ─────────────────
    veh_banner = [
        [
            Paragraph(f"<b>Dòng xe:</b> VinFast {model} {version}", style_td_bold),
            Paragraph(f"<b>Màu ngoại thất:</b> {color}", style_td),
            Paragraph(f"<b>Gói Pin:</b> {battery_mode}", style_td_bold),
        ]
    ]
    t_veh = Table(veh_banner, colWidths=[210, 160, 160])
    t_veh.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#EFF6FF")),
                ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#93C5FD")),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.append(t_veh)
    story.append(Spacer(1, 10))

    # ── 5. Detailed Quotation Table ─────────────────────────────
    cost_data = [
        [
            Paragraph("STT", style_th),
            Paragraph("DANH MỤC CHI PHÍ", style_th),
            Paragraph("CHI TIẾT / DIỄN GIẢI", style_th),
            Paragraph("THÀNH TIỀN (VNĐ)", style_th),
        ]
    ]

    idx = 1
    # 5.1 Base Vehicle Price
    cost_data.append(
        [
            Paragraph(str(idx), style_td),
            Paragraph(f"<b>Giá xe VinFast {model} {version}</b>", style_td),
            Paragraph("Theo bảng giá cấu hình được lưu", style_td),
            Paragraph(format_vnd(base_price), style_td_right_bold),
        ]
    )
    idx += 1

    # 5.2 Battery
    if battery_cost > 0:
        cost_data.append(
            [
                Paragraph(str(idx), style_td),
                Paragraph("<b>Chi phí mua đứt Pin</b>", style_td),
                Paragraph("Theo phương án mua pin đã chọn", style_td),
                Paragraph(format_vnd(battery_cost), style_td_right_bold),
            ]
        )
        idx += 1
    elif battery_mode == "Thuê pin":
        cost_data.append(
            [
                Paragraph(str(idx), style_td),
                Paragraph("<b>Gói thuê Pin chính hãng</b>", style_td),
                Paragraph("Phí thuê hàng tháng không cộng vào tổng mua xe", style_td),
                Paragraph(format_vnd(snapshot.get("battery_rent", 0)) + "/tháng", style_td_right),
            ]
        )
        idx += 1

    # 5.3 Accessories
    if acc_list:
        acc_names = ", ".join([a.get("name") if isinstance(a, dict) else str(a) for a in acc_list])
        acc_total = sum([a.get("price", 0) if isinstance(a, dict) else 0 for a in acc_list])
        cost_data.append(
            [
                Paragraph(str(idx), style_td),
                Paragraph("<b>Phụ kiện chính hãng chọn thêm</b>", style_td),
                Paragraph(acc_names, style_td),
                Paragraph(format_vnd(acc_total), style_td_right_bold),
            ]
        )
        idx += 1

    # 5.4 Rolling Fees Breakdown
    reg_fee = rolling.get("registration_fee", 0)
    plate_fee = rolling.get("plate_fee", 0)
    road_fee = rolling.get("road_fee", 0)
    insp_fee = rolling.get("inspection_fee", 0)
    ins_fee = rolling.get("insurance", 0)
    total_rolling = reg_fee + plate_fee + road_fee + insp_fee + ins_fee

    rolling_details = (
        f"Lệ phí trước bạ: {format_vnd(reg_fee)} | "
        f"Biển số: {format_vnd(plate_fee)} | "
        f"Đường bộ (1 năm): {format_vnd(road_fee)} | "
        f"Đăng kiểm: {format_vnd(insp_fee)} | "
        f"BH TNDS: {format_vnd(ins_fee)}"
    )
    cost_data.append(
        [
            Paragraph(str(idx), style_td),
            Paragraph("<b>Chi phí lăn bánh dự tính</b>", style_td),
            Paragraph(rolling_details, style_td),
            Paragraph(format_vnd(total_rolling), style_td_right_bold),
        ]
    )
    idx += 1

    # 5.5 Promotions & Discounts
    if promos:
        for p in promos:
            p_name = p.get("name", "Khuyến mại chính hãng")
            p_val = p.get("value", 0)
            cost_data.append(
                [
                    Paragraph(str(idx), style_td),
                    Paragraph(f"<b>Ưu đãi: {p_name}</b>", style_td_green),
                    Paragraph("Khấu trừ trực tiếp vào giá lăn bánh", style_td),
                    Paragraph(f"-{format_vnd(p_val)}", style_td_right_green),
                ]
            )
            idx += 1

    # 5.6 Total Row
    cost_data.append(
        [
            Paragraph("", style_td),
            Paragraph("<b>TỔNG GIÁ TRỊ LĂN BÁNH DỰ KIẾN</b>", style_td_bold),
            Paragraph("<b>Xe, mua pin nếu chọn, phụ kiện, phí và ưu đãi</b>", style_td),
            Paragraph(f"<b>{format_vnd(final_price)}</b>", style_td_right_bold),
        ]
    )

    t_cost = Table(cost_data, colWidths=[30, 175, 205, 120])
    t_cost.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), c_primary),
                ("ALIGN", (0, 0), (0, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("GRID", (0, 0), (-1, -2), 0.5, c_border),
                ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#FEF3C7")),
                ("BOX", (0, -1), (-1, -1), 1.5, c_gold),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(t_cost)
    story.append(Spacer(1, 10))

    # ── 6. Warranty & Commitment Notes ──────────────────────────
    notes = [
        "<b>LƯU Ý VỀ BẢNG DỰ TOÁN:</b>",
        "• Giá và ưu đãi phản ánh dữ liệu tại thời điểm lập; đại lý xác nhận điều kiện trước khi giao dịch.",
        "• Phí thuê pin định kỳ không nằm trong tổng chi phí mua xe.",
        "• Chính sách bảo hành, giao xe và các khoản phí khác cần được đại lý xác nhận riêng.",
    ]
    if seller_note:
        notes.append(f"• <b>Ghi chú từ tư vấn viên:</b> {seller_note}")

    notes_p = Paragraph("<br/>".join(notes), style_meta)
    t_notes = Table([[notes_p]], colWidths=[530])
    t_notes.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), c_light_bg),
                ("BOX", (0, 0), (-1, -1), 0.5, c_border),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.append(t_notes)
    story.append(Spacer(1, 15))

    # ── 7. Signatures ───────────────────────────────────────────
    sig_data = [
        [
            Paragraph(
                "<b>ĐẠI DIỆN ĐƠN VỊ TƯ VẤN</b><br/><i>(Ký, ghi rõ họ tên)</i>",
                ParagraphStyle("Sig1", fontName=FONT_NAME, fontSize=8.5, alignment=1),
            ),
            Paragraph(
                "<b>XÁC NHẬN CỦA KHÁCH HÀNG</b><br/><i>(Ký và ghi rõ họ tên)</i>",
                ParagraphStyle("Sig2", fontName=FONT_NAME, fontSize=8.5, alignment=1),
            ),
        ],
        [
            Spacer(1, 45),
            Spacer(1, 45),
        ],
        [
            Paragraph(
                f"<b>{dealer_name}</b>",
                ParagraphStyle("Sig1B", fontName=FONT_BOLD, fontSize=8.5, alignment=1, textColor=c_primary),
            ),
            Paragraph(
                f"<b>{buyer_name}</b>",
                ParagraphStyle("Sig2B", fontName=FONT_BOLD, fontSize=8.5, alignment=1, textColor=c_secondary),
            ),
        ],
    ]
    t_sig = Table(sig_data, colWidths=[265, 265])
    t_sig.setStyle(
        TableStyle(
            [
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ]
        )
    )
    story.append(t_sig)

    doc.build(story)
    return buffer.getvalue()
