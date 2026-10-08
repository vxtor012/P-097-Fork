"""Unit tests for Vietnamese Normalizer."""

import unicodedata

from src.pipeline.nlp.vietnamese_normalizer import VietnameseNormalizer


def test_unicode_nfc():
    normalizer = VietnameseNormalizer()
    # Decomposed NFD string
    nfd_text = unicodedata.normalize("NFD", "Việt Nam đất nước tuyệt vời")
    # Must normalize to NFC
    nfc_text = normalizer.normalize_unicode(nfd_text)
    assert unicodedata.is_normalized("NFC", nfc_text)
    assert nfc_text == "Việt Nam đất nước tuyệt vời"


def test_tone_standardization():
    normalizer = VietnameseNormalizer()
    # Old style: hoà, thuỷ, oà
    old_style = "hoà bình, thuỷ điện, oà khóc"
    # Modern style: hòa, thủy, òa
    new_style = normalizer.standardize_vietnamese_tones(old_style)
    assert new_style == "hòa bình, thủy điện, òa khóc"


def test_spacing_and_typography():
    normalizer = VietnameseNormalizer()
    text = "Xin chào , đây là xe   VF 8 . “Giá xe” rất tốt !"
    cleaned = normalizer.clean_typography_and_spacing(text)
    assert cleaned == 'Xin chào, đây là xe VF 8. "Giá xe" rất tốt!'


def test_numbers_preservation():
    normalizer = VietnameseNormalizer()
    text = "Giá: 1.059.000.000 đ, giảm 10%, pin 87.7 kWh, tỉ lệ 1:1."
    cleaned = normalizer.clean_typography_and_spacing(text)
    assert cleaned == "Giá: 1.059.000.000 đ, giảm 10%, pin 87.7 kWh, tỉ lệ 1:1."
