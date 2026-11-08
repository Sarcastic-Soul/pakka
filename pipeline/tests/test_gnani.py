import json
from pathlib import Path

import pytest
import requests

from shor.gnani import GnaniClient, GnaniError, OutOfCredit, Transcription

KEY = "KEY-SECRET-123"
URL = "https://api.vachana.ai/stt/v3"


class StubResponse:
    def __init__(self, status_code=200, body=None, text=None):
        self.status_code = status_code
        self._body = body
        self.text = text if text is not None else json.dumps(body)

    def json(self):
        if self._body is None:
            raise ValueError("no json")
        return self._body


class StubSession:
    def __init__(self, *responses):
        self.responses = list(responses)
        self.calls = []

    def post(self, url, **kwargs):
        self.calls.append((url, kwargs))
        item = self.responses.pop(0)
        if isinstance(item, Exception):
            raise item
        return item


def ok(transcript="नमस्ते", **extra):
    body = {
        "success": True,
        "request_id": "req-1",
        "transcript": transcript,
        "model": "prisma-v3.0",
        "detected_language_code": "hi-IN",
    }
    body.update(extra)
    return StubResponse(200, body)


@pytest.fixture
def audio(tmp_path):
    path = tmp_path / "clip.wav"
    path.write_bytes(b"RIFF-fake-audio-bytes")
    return path


def make_client(tmp_path, session, sleeps=None, model="prisma-v3.0"):
    sleeps = sleeps if sleeps is not None else []
    return GnaniClient(
        api_key=KEY,
        cache_dir=tmp_path / "cache",
        model=model,
        session=session,
        sleep=sleeps.append,
    )


def test_sends_expected_request(tmp_path, audio):
    session = StubSession(ok())
    client = make_client(tmp_path, session)
    result = client.transcribe(audio)
    assert len(session.calls) == 1
    url, kwargs = session.calls[0]
    assert url == URL
    assert kwargs["headers"]["X-API-Key-ID"] == KEY
    assert kwargs["data"] == {
        "model": "prisma-v3.0",
        "language_code": "hi-IN",
        "format": "transcribe",
    }
    name, content = kwargs["files"]["audio_file"][:2]
    assert name == "clip.wav"
    assert content == b"RIFF-fake-audio-bytes"
    assert kwargs["timeout"] == 60
    assert result == Transcription(
        transcript="नमस्ते",
        model="prisma-v3.0",
        detected_language_code="hi-IN",
        cached=False,
        request_id="req-1",
    )


def test_cache_hit_skips_network(tmp_path, audio):
    session = StubSession(ok())
    client = make_client(tmp_path, session)
    first = client.transcribe(audio)
    second = client.transcribe(audio)
    assert len(session.calls) == 1
    assert first.cached is False
    assert second.cached is True
    assert second.transcript == first.transcript
    assert second.request_id == "req-1"


def test_cache_key_depends_on_model_language_format_and_bytes(tmp_path, audio):
    session = StubSession(ok(), ok(), ok(), ok())
    cache = tmp_path / "cache"
    GnaniClient(
        KEY, cache, "prisma-v3.0", session=session, sleep=lambda s: None
    ).transcribe(audio)
    GnaniClient(
        KEY, cache, "prisma-v2.5", session=session, sleep=lambda s: None
    ).transcribe(audio)
    c = GnaniClient(KEY, cache, "prisma-v3.0", session=session, sleep=lambda s: None)
    c.transcribe(audio, language_code="en-IN")
    c.transcribe(audio, fmt="verbatim")
    assert len(session.calls) == 4
    assert len(list(cache.glob("*.json"))) == 4
    audio.write_bytes(b"different")
    session.responses.append(ok())
    c.transcribe(audio)
    assert len(session.calls) == 5


def test_cache_file_holds_only_transcript_and_metadata(tmp_path, audio):
    session = StubSession(ok(output={"literal": "x"}, processing_time=0.2))
    make_client(tmp_path, session).transcribe(audio)
    files = list((tmp_path / "cache").glob("*.json"))
    assert len(files) == 1
    data = json.loads(files[0].read_text(encoding="utf-8"))
    assert set(data) == {"transcript", "model", "detected_language_code", "request_id"}


def test_retries_429_then_succeeds(tmp_path, audio):
    rate_limited = StubResponse(
        429,
        {
            "detail": {
                "error_code": "RATE_LIMITED",
                "message": "slow down",
                "status_code": 429,
            }
        },
    )
    session = StubSession(rate_limited, rate_limited, ok())
    sleeps = []
    result = make_client(tmp_path, session, sleeps).transcribe(audio)
    assert result.transcript == "नमस्ते"
    assert len(session.calls) == 3
    assert sleeps == [0.5, 1.0]


@pytest.mark.parametrize("status", [500, 503, 504])
def test_retries_server_errors(tmp_path, audio, status):
    body = {"error": "Gateway Timeout", "code": "UPSTREAM_TIMEOUT", "message": "late"}
    session = StubSession(StubResponse(status, body), ok())
    sleeps = []
    result = make_client(tmp_path, session, sleeps).transcribe(audio)
    assert result.cached is False
    assert sleeps == [0.5]


@pytest.mark.parametrize(
    "exc", [requests.ConnectionError("down"), requests.Timeout("slow")]
)
def test_retries_network_errors(tmp_path, audio, exc):
    session = StubSession(exc, ok())
    sleeps = []
    result = make_client(tmp_path, session, sleeps).transcribe(audio)
    assert result.transcript == "नमस्ते"
    assert sleeps == [0.5]


def test_gives_up_after_three_attempts(tmp_path, audio):
    bad = StubResponse(
        503, {"success": False, "error": {"type": "unavailable", "message": "busy"}}
    )
    session = StubSession(bad, bad, bad, ok())
    sleeps = []
    with pytest.raises(GnaniError) as info:
        make_client(tmp_path, session, sleeps).transcribe(audio)
    assert not isinstance(info.value, OutOfCredit)
    assert len(session.calls) == 3
    assert sleeps == [0.5, 1.0]
    assert "busy" in str(info.value)


def test_gives_up_after_three_network_failures(tmp_path, audio):
    session = StubSession(
        requests.Timeout("a"), requests.Timeout("b"), requests.ConnectionError("c")
    )
    with pytest.raises(GnaniError):
        make_client(tmp_path, session).transcribe(audio)
    assert len(session.calls) == 3


def test_402_raises_out_of_credit_without_retry(tmp_path, audio):
    body = {
        "detail": {
            "error_code": "INSUFFICIENT_CREDITS",
            "message": "no credit",
            "status_code": 402,
        }
    }
    session = StubSession(StubResponse(402, body), ok())
    sleeps = []
    with pytest.raises(OutOfCredit):
        make_client(tmp_path, session, sleeps).transcribe(audio)
    assert len(session.calls) == 1
    assert sleeps == []


def test_out_of_credit_is_a_gnani_error():
    assert issubclass(OutOfCredit, GnaniError)


@pytest.mark.parametrize("status", [401, 403])
def test_auth_errors_are_not_retried(tmp_path, audio, status):
    body = {
        "detail": {
            "error_code": "UNAUTHORIZED",
            "message": "bad key",
            "status_code": status,
        }
    }
    session = StubSession(StubResponse(status, body), ok())
    sleeps = []
    with pytest.raises(GnaniError) as info:
        make_client(tmp_path, session, sleeps).transcribe(audio)
    assert not isinstance(info.value, OutOfCredit)
    assert len(session.calls) == 1
    assert sleeps == []


def test_400_is_not_retried(tmp_path, audio):
    body = {
        "success": False,
        "error": {"type": "invalid_audio", "message": "bad audio"},
    }
    session = StubSession(StubResponse(400, body), ok())
    sleeps = []
    with pytest.raises(GnaniError) as info:
        make_client(tmp_path, session, sleeps).transcribe(audio)
    assert len(session.calls) == 1
    assert sleeps == []
    assert "bad audio" in str(info.value)


def test_422_list_body_is_not_retried(tmp_path, audio):
    session = StubSession(
        StubResponse(422, {"detail": [{"loc": ["body", "model"], "msg": "bad"}]}), ok()
    )
    with pytest.raises(GnaniError):
        make_client(tmp_path, session).transcribe(audio)
    assert len(session.calls) == 1


def test_non_json_error_body_still_raises_gnani_error(tmp_path, audio):
    session = StubSession(StubResponse(400, None, text="<html>nope</html>"))
    with pytest.raises(GnaniError):
        make_client(tmp_path, session).transcribe(audio)


def test_empty_transcript_is_returned(tmp_path, audio):
    session = StubSession(
        StubResponse(200, {"success": True, "request_id": "r9", "transcript": ""})
    )
    client = make_client(tmp_path, session)
    result = client.transcribe(audio)
    assert result == Transcription(
        transcript="",
        model="prisma-v3.0",
        detected_language_code=None,
        cached=False,
        request_id="r9",
    )
    again = client.transcribe(audio)
    assert again.cached is True
    assert again.transcript == ""
    assert len(session.calls) == 1


def test_v25_response_without_language_code(tmp_path, audio):
    body = {
        "success": True,
        "request_id": "r2",
        "transcript": "hello",
        "model": "prisma-v2.5",
        "output": {"literal": "hello"},
    }
    session = StubSession(StubResponse(200, body))
    result = make_client(tmp_path, session, model="prisma-v2.5").transcribe(audio)
    assert result.detected_language_code is None
    assert result.model == "prisma-v2.5"


def test_failures_are_not_cached(tmp_path, audio):
    session = StubSession(
        StubResponse(400, {"success": False, "error": {"type": "x", "message": "y"}}),
        ok(),
    )
    client = make_client(tmp_path, session)
    with pytest.raises(GnaniError):
        client.transcribe(audio)
    cache = tmp_path / "cache"
    assert not cache.exists() or list(cache.glob("*.json")) == []
    assert client.transcribe(audio).cached is False


def test_success_false_with_200_is_an_error(tmp_path, audio):
    body = {"success": False, "error": {"type": "internal", "message": "oops"}}
    session = StubSession(StubResponse(200, body))
    with pytest.raises(GnaniError):
        make_client(tmp_path, session).transcribe(audio)


def test_api_key_never_leaks(tmp_path, audio):
    echo = StubResponse(
        401,
        {
            "detail": {
                "error_code": "UNAUTHORIZED",
                "message": f"invalid key {KEY}",
                "status_code": 401,
            }
        },
    )
    session = StubSession(ok(), echo, requests.ConnectionError(f"proxy saw {KEY}"))
    client = make_client(tmp_path, session)
    client.transcribe(audio)

    other = tmp_path / "other.wav"
    other.write_bytes(b"other bytes")
    with pytest.raises(GnaniError) as auth_exc:
        client.transcribe(other)

    third = tmp_path / "third.wav"
    third.write_bytes(b"third bytes")
    session.responses = [requests.ConnectionError(f"proxy saw {KEY}")] * 3
    with pytest.raises(GnaniError) as net_exc:
        client.transcribe(third)

    for exc in (auth_exc.value, net_exc.value):
        assert KEY not in str(exc)
        assert KEY not in repr(exc)
    assert KEY not in repr(client)
    for path in (tmp_path / "cache").rglob("*"):
        if path.is_file():
            assert KEY not in path.read_text(encoding="utf-8")
            assert KEY not in path.name


def test_creates_cache_dir(tmp_path, audio):
    nested = tmp_path / "a" / "b"
    client = GnaniClient(
        KEY, nested, "prisma-v3.0", session=StubSession(ok()), sleep=lambda s: None
    )
    client.transcribe(audio)
    assert nested.is_dir()
