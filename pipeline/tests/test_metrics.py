import pytest

from shor.metrics import cer, wer


def test_wer_one_substitution():
    assert wer("a b c d", "a x c d") == 0.25


def test_wer_empty_hypothesis():
    assert wer("a b", "") == 1.0


def test_wer_both_empty():
    assert wer("", "") == 0.0


def test_wer_empty_reference_with_hypothesis():
    assert wer("", "a b") == 1.0


def test_wer_identical_and_normalised():
    assert wer("मेरा नंबर है।", "मेरा नंबर है") == 0.0
    assert wer("I live in Raipur", "i live in raipur!") == 0.0


def test_wer_deletion_and_insertion():
    assert wer("a b c d", "a b c") == 0.25
    assert wer("a b", "a b c") == 0.5


def test_wer_not_clipped_at_one():
    assert wer("a", "a b c") == 2.0


def test_wer_hindi_substitution():
    assert wer("मेरा घर है", "मेरा गर है") == pytest.approx(1 / 3)


def test_cer_one_substitution():
    assert cer("abcd", "abxd") == 0.25


def test_cer_empty_cases():
    assert cer("", "") == 0.0
    assert cer("", "x") == 1.0
    assert cer("ab", "") == 1.0


def test_cer_counts_spaces_after_normalising():
    assert cer("a b", "a  b,") == 0.0
    assert cer("ab", "a b") == 0.5


def test_cer_hindi_identical():
    assert cer("पाँच सौ रुपये।", "पाँच सौ रुपये") == 0.0
