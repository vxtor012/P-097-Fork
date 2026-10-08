"""Unit tests for Gold Filter and Car Purchasing Classification."""

from src.pipeline.filters.gold_filter import GoldConsultationFilter
from src.pipeline.models.schemas import SilverChunk


def test_traffic_penalties_filtered_out():
    gold_filter = GoldConsultationFilter()
    chunk = SilverChunk(
        chunk_id="test_penalties",
        doc_id="doc_1",
        chunk_index=0,
        heading_path=["Nghi Dinh 100 2019 Nd Cp Xu Phat Vi Pham Giao Thong Duong Bo", "Chương II", "Điều 5"],
        heading_context="Nghi Dinh 100 2019 > Chương II > Điều 5",
        content="Xử phạt người điều khiển xe ô tô chạy quá tốc độ từ 10 km/h đến 20 km/h phạt tiền từ 4.000.000 đến 6.000.000 đồng.",
        raw_chunk_text="Xử phạt người điều khiển xe ô tô...",
        token_estimate=50,
        char_count=200,
        category="thu_tuc_phap_ly",
        source_type="pdf",
    )
    admitted, topic, score, reason = gold_filter.evaluate_chunk(chunk)
    assert admitted is False
    assert "Excluded legal document" in reason


def test_driving_rules_filtered_out():
    gold_filter = GoldConsultationFilter()
    chunk = SilverChunk(
        chunk_id="test_headlights",
        doc_id="doc_2",
        chunk_index=0,
        heading_path=["Luat 36 2024 Qh15", "Chương II", "Điều 20. Sử dụng đèn"],
        heading_context="Luat 36 2024 Qh15 > Chương II > Điều 20. Sử dụng đèn",
        content="Người lái xe phải bật đèn chiếu sáng phía trước trong thời gian từ 18 giờ ngày hôm trước đến 06 giờ ngày hôm sau.",
        raw_chunk_text="Người lái xe phải bật đèn...",
        token_estimate=40,
        char_count=180,
        category="thu_tuc_phap_ly",
        source_type="pdf",
    )
    admitted, topic, score, reason = gold_filter.evaluate_chunk(chunk)
    assert admitted is False


def test_car_pricing_and_promotions_admitted():
    gold_filter = GoldConsultationFilter()
    chunk = SilverChunk(
        chunk_id="test_pricing",
        doc_id="doc_3",
        chunk_index=0,
        heading_path=["Chính sách ưu đãi", "VinFast VF 8"],
        heading_context="Chính sách ưu đãi > VinFast VF 8",
        content="Giá xe VinFast VF 8 Eco niêm yết từ 1.019.000.000 VNĐ kèm ưu đãi tặng gói pin và hỗ trợ lệ phí trước bạ.",
        raw_chunk_text="Giá xe VinFast VF 8 Eco...",
        token_estimate=35,
        char_count=160,
        category="chinh_sach_uu_dai",
        source_type="html_article",
    )
    admitted, topic, score, reason = gold_filter.evaluate_chunk(chunk)
    assert admitted is True
    assert topic in ["bao_gia_chi_phi", "chinh_sach_uu_dai"]
    assert score >= 0.8


def test_non_automotive_assets_filtered_out():
    gold_filter = GoldConsultationFilter()
    # Aircraft / aviation chunk
    chunk_aircraft = SilverChunk(
        chunk_id="test_aircraft",
        doc_id="doc_4",
        chunk_index=0,
        heading_path=["Thong Tu 13 2022 Tt Btc Huong Dan Le Phi Truoc Ba", "Điều 5. Miễn lệ phí trước bạ"],
        heading_context="Thong Tu 13 2022 Tt Btc > Điều 5. Miễn lệ phí trước bạ",
        content="Tàu bay sử dụng cho mục đích kinh doanh vận chuyển hàng hóa, hành khách được miễn nộp lệ phí trước bạ của tổ chức được cấp giấy phép kinh doanh vận chuyển hàng không.",
        raw_chunk_text="Tàu bay sử dụng cho mục đích kinh doanh...",
        token_estimate=45,
        char_count=210,
        category="thu_tuc_phap_ly",
        source_type="pdf",
    )
    admitted_air, _, _, reason_air = gold_filter.evaluate_chunk(chunk_aircraft)
    assert admitted_air is False
    assert "Non-automotive asset" in reason_air

    # Inland waterway / ship chunk
    chunk_ship = SilverChunk(
        chunk_id="test_ship",
        doc_id="doc_5",
        chunk_index=0,
        heading_path=["Nghi Dinh 10 2022 Nd Cp Le Phi Truoc Ba", "Điều 10. Miễn lệ phí trước bạ"],
        heading_context="Nghi Dinh 10 2022 > Điều 10. Miễn lệ phí trước bạ",
        content="Tàu thủy, thuyền không có động cơ, trọng tải toàn phần đến 15 tấn hoạt động trong lĩnh vực giao thông đường thủy nội địa được miễn nộp lệ phí trước bạ.",
        raw_chunk_text="Tàu thủy, thuyền không có động cơ...",
        token_estimate=40,
        char_count=190,
        category="thu_tuc_phap_ly",
        source_type="pdf",
    )
    admitted_ship, _, _, reason_ship = gold_filter.evaluate_chunk(chunk_ship)
    assert admitted_ship is False
    assert "Non-automotive asset" in reason_ship

