from shor.lexicon import canonical_tokens
from shor.metrics import cer, wer


def test_loanword_script_is_not_an_error():
    assert (
        wer("बैंक से 2,50,000 रुपये का लोन मिला है", "bank से। 2,50,000 रुपये का loan मिला है।")
        == 0.0
    )


def test_nukta_and_rupee_spellings_merge():
    assert wer("शाम को बाज़ार चलेंगे", "शाम को बाजार चलेंगे?") == 0.0
    assert wer("850 रुपये", "850 रुपए") == 0.0
    assert wer("850 रुपये", "850 रूपए") == 0.0


def test_real_errors_still_count():
    assert wer("मेरा नंबर 9876543210 है", "मेरा number 987254121 है") == 0.25
    assert wer("जमा करनी है", "जमा कर") == 2 / 3


def test_canonical_tokens_and_cer():
    assert canonical_tokens("दोबारा फोन कीजिए") == ["दोबारा", "phone", "कीजिए"]
    assert cer("फोन", "phone") == 0.0
    assert cer("", "") == 0.0
