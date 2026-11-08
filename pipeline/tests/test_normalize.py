import unicodedata

import pytest

from shor.normalize import (
    HINDI_0_99,
    Entity,
    entity_match,
    extract_numbers,
    normalize_text,
    parse_spoken_numbers,
)


def nfc(s: str) -> str:
    return unicodedata.normalize("NFC", s)


# normalize_text


def test_normalize_drops_punctuation_and_danda():
    assert normalize_text("मेरा नंबर, है।") == "मेरा नंबर है"


def test_normalize_devanagari_digits():
    assert normalize_text("२५०००") == "25000"


def test_normalize_keeps_vowel_signs_and_virama():
    for word in ["पाँच", "हिन्दी", "में", "नंबर", "रुपये", "छह"]:
        assert normalize_text(word) == nfc(word)


def test_normalize_drops_symbols():
    assert normalize_text("₹५०० रुपये।") == "500 रुपये"


def test_normalize_lowercases_and_collapses_spaces():
    assert normalize_text("  I live   in  Raipur! ") == "i live in raipur"


def test_normalize_hyphen_splits_words():
    assert normalize_text("twenty-five") == "twenty five"


def test_normalize_nfc_nukta_forms_agree():
    assert normalize_text("\u095c") == normalize_text("\u0921\u093c")


def test_normalize_empty():
    assert normalize_text("") == ""
    assert normalize_text(" ।, ") == ""


# extract_numbers


def test_extract_numbers_indian_commas():
    assert extract_numbers("2,50,000 रुपये और 9876543210") == ["250000", "9876543210"]


def test_extract_numbers_western_commas():
    assert extract_numbers("1,234,567") == ["1234567"]


def test_extract_numbers_devanagari_digits():
    assert extract_numbers("२,५०,००० रुपये") == ["250000"]


def test_extract_numbers_keeps_different_grouping_distinct():
    assert extract_numbers("2,05,000") == ["205000"]


def test_extract_numbers_list_commas_are_not_grouping():
    assert extract_numbers("1, 2") == ["1", "2"]


def test_extract_numbers_none():
    assert extract_numbers("कोई नंबर नहीं") == []
    assert extract_numbers("") == []


# parse_spoken_numbers


def test_parse_headline_example():
    assert parse_spoken_numbers("दो लाख पचास हज़ार") == [250000]


def test_parse_english_headline_example():
    assert parse_spoken_numbers("two lakh fifty thousand") == [250000]


@pytest.mark.parametrize(
    "text, value",
    [
        ("शून्य", 0),
        ("एक", 1),
        ("ग्यारह", 11),
        ("इक्कीस", 21),
        ("पच्चीस", 25),
        ("तैंतीस", 33),
        ("अड़तालीस", 48),
        ("पचास", 50),
        ("चौंसठ", 64),
        ("पचहत्तर", 75),
        ("नवासी", 89),
        ("निन्यानवे", 99),
        ("पाँच", 5),
        ("पांच", 5),
        ("छह", 6),
        ("पंद्रह", 15),
        ("सौ", 100),
        ("हज़ार", 1000),
        ("हजार", 1000),
        ("एक लाख", 100000),
        ("एक करोड़", 10000000),
        ("एक सौ एक", 101),
        ("तीन सौ पचहत्तर", 375),
        ("दो हज़ार पच्चीस", 2025),
        ("पचास हज़ार", 50000),
        ("दो करोड़ पचास लाख पच्चीस हज़ार", 25025000),
        ("twenty five", 25),
        ("twenty-five", 25),
        ("eleven", 11),
        ("ninety nine", 99),
        ("one hundred and fifty", 150),
        ("two million five hundred thousand", 2500000),
        ("five crore", 50000000),
    ],
)
def test_parse_values(text, value):
    assert parse_spoken_numbers(text) == [value]


def test_parse_every_hindi_value_0_to_99():
    assert len(HINDI_0_99) == 100
    for value, spellings in enumerate(HINDI_0_99):
        assert spellings, value
        for word in spellings:
            assert parse_spoken_numbers(word) == [value], (value, word)


def test_parse_mixed_digits_and_words():
    assert parse_spoken_numbers("2 लाख 50 हज़ार") == [250000]


def test_parse_separate_numbers():
    assert parse_spoken_numbers("पच्चीस पचास") == [25, 50]
    assert parse_spoken_numbers("दो लाख तीन लाख") == [200000, 300000]
    assert parse_spoken_numbers("कुल दो लाख पचास हज़ार रुपये") == [250000]


def test_parse_ignores_plain_digits_and_other_words():
    assert parse_spoken_numbers("250000") == []
    assert parse_spoken_numbers("9876 543 210") == []
    assert parse_spoken_numbers("मैं रायपुर में रहता हूँ") == []
    assert parse_spoken_numbers("") == []


# entity_match: amount


def test_amount_matches_indian_grouping():
    assert entity_match(Entity("amount", "250000"), "कुल 2,50,000 रुपये")


def test_amount_rejects_transposed_grouping():
    assert not entity_match(Entity("amount", "250000"), "कुल 2,05,000 रुपये")


def test_amount_matches_spoken_words():
    assert entity_match(Entity("amount", "250000"), "दो लाख पचास हज़ार")


def test_amount_matches_devanagari_digits():
    assert entity_match(Entity("amount", "25000"), "२५००० रुपये")


def test_amount_matches_plain_and_english_words():
    assert entity_match(Entity("amount", "250000"), "250000 rupees")
    assert entity_match(Entity("amount", "250000"), "two lakh fifty thousand rupees")


def test_amount_is_not_a_substring_match():
    assert not entity_match(Entity("amount", "250000"), "2500000")
    assert not entity_match(Entity("amount", "250000"), "12500000")
    assert not entity_match(Entity("amount", "25"), "250")


def test_amount_empty_transcript():
    assert not entity_match(Entity("amount", "250000"), "")


# entity_match: digits


def test_digits_spaced_groups():
    assert entity_match(Entity("digits", "9876543210"), "9876 543 210")


def test_digits_wrong_digit():
    assert not entity_match(Entity("digits", "9876543210"), "9876 543 211")


def test_digits_empty_transcript():
    assert not entity_match(Entity("digits", "9876543210"), "")


def test_digits_hyphens_and_plain():
    assert entity_match(Entity("digits", "9876543210"), "9876-543-210")
    assert entity_match(Entity("digits", "9876543210"), "9876543210")


def test_digits_devanagari():
    assert entity_match(Entity("digits", "9876543210"), "९८७६ ५४३ २१०")


def test_digits_spoken_hindi_and_english():
    assert entity_match(
        Entity("digits", "9876543210"),
        "नौ आठ सात छह पाँच चार तीन दो एक शून्य",
    )
    assert entity_match(
        Entity("digits", "9876543210"),
        "nine eight seven six five four three two one zero",
    )


def test_digits_mixed_spoken_and_written():
    assert entity_match(Entity("digits", "9876543210"), "98765 चार तीन दो एक शून्य")


def test_digits_inside_a_sentence():
    assert entity_match(Entity("digits", "9876543210"), "मेरा नंबर 9876 543 210 है")


def test_digits_extra_or_missing_digit_fails():
    assert not entity_match(Entity("digits", "9876543210"), "98765432101")
    assert not entity_match(Entity("digits", "9876543210"), "987654321")


def test_digits_broken_by_a_word_fails():
    assert not entity_match(Entity("digits", "9876543210"), "9876 और 543 210")


# entity_match: name


def test_name_alias_match():
    assert entity_match(Entity("name", "रायपुर", ["raipur"]), "I live in Raipur")


def test_name_value_match():
    assert entity_match(Entity("name", "रायपुर", ["raipur"]), "मैं रायपुर में रहता हूँ")


def test_name_miss():
    assert not entity_match(Entity("name", "रायपुर", ["raipur"]), "I live in Delhi")
    assert not entity_match(Entity("name", "रायपुर", ["raipur"]), "")


def test_name_empty_value_never_matches():
    assert not entity_match(Entity("name", ""), "anything")
    assert not entity_match(Entity("name", "x", [""]), "anything")


def test_entity_defaults():
    e = Entity("name", "रायपुर")
    assert e.aliases == []
    assert Entity("name", "a").aliases is not Entity("name", "b").aliases
