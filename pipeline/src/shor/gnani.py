import hashlib
import json
import os
import time
from collections.abc import Callable
from dataclasses import asdict, dataclass
from pathlib import Path

import requests

URL = "https://api.vachana.ai/stt/v3"
TIMEOUT_SECONDS = 60
MAX_ATTEMPTS = 3
RETRY_DELAYS = (0.5, 1.0)
RETRY_STATUSES = {429, 500, 503, 504}


class GnaniError(Exception):
    pass


class OutOfCredit(GnaniError):
    pass


@dataclass
class Transcription:
    transcript: str
    model: str
    detected_language_code: str | None
    cached: bool
    request_id: str | None


class GnaniClient:
    """Strictly sequential: the account may allow only one active request."""

    def __init__(
        self,
        api_key: str,
        cache_dir: Path,
        model: str,
        session: requests.Session | None = None,
        sleep: Callable[[float], None] = time.sleep,
    ):
        self._api_key = api_key
        self.cache_dir = Path(cache_dir)
        self.model = model
        self._session = session if session is not None else requests.Session()
        self._sleep = sleep

    def __repr__(self) -> str:
        return f"GnaniClient(model={self.model!r}, cache_dir={str(self.cache_dir)!r})"

    def transcribe(
        self, audio: Path, language_code: str = "hi-IN", fmt: str = "transcribe"
    ) -> Transcription:
        audio = Path(audio)
        audio_bytes = audio.read_bytes()
        cache_file = (
            self.cache_dir / f"{self._key(audio_bytes, language_code, fmt)}.json"
        )

        cached = self._read_cache(cache_file)
        if cached is not None:
            return cached

        body = self._post_with_retries(audio.name, audio_bytes, language_code, fmt)
        transcript = body.get("transcript")
        if not isinstance(transcript, str):
            raise GnaniError("Gnani response had no transcript field")
        result = Transcription(
            transcript=transcript,
            model=body.get("model") or self.model,
            detected_language_code=body.get("detected_language_code"),
            cached=False,
            request_id=body.get("request_id"),
        )
        self._write_cache(cache_file, result)
        return result

    def _key(self, audio_bytes: bytes, language_code: str, fmt: str) -> str:
        digest = hashlib.sha256(audio_bytes)
        for part in (self.model, language_code, fmt):
            digest.update(b"\0" + part.encode("utf-8"))
        return digest.hexdigest()

    def _read_cache(self, cache_file: Path) -> Transcription | None:
        try:
            data = json.loads(cache_file.read_text(encoding="utf-8"))
            return Transcription(
                transcript=data["transcript"],
                model=data["model"],
                detected_language_code=data["detected_language_code"],
                cached=True,
                request_id=data["request_id"],
            )
        except (OSError, ValueError, KeyError):
            return None

    def _write_cache(self, cache_file: Path, result: Transcription) -> None:
        data = asdict(result)
        del data["cached"]
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        tmp = cache_file.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        os.replace(tmp, cache_file)

    def _post_with_retries(
        self, filename: str, audio_bytes: bytes, language_code: str, fmt: str
    ) -> dict:
        last_problem = ""
        for attempt in range(MAX_ATTEMPTS):
            if attempt:
                self._sleep(RETRY_DELAYS[attempt - 1])
            try:
                response = self._session.post(
                    URL,
                    headers={"X-API-Key-ID": self._api_key},
                    files={"audio_file": (filename, audio_bytes)},
                    data={
                        "model": self.model,
                        "language_code": language_code,
                        "format": fmt,
                    },
                    timeout=TIMEOUT_SECONDS,
                )
            except (requests.ConnectionError, requests.Timeout) as exc:
                last_problem = f"network error ({type(exc).__name__})"
                continue

            status = response.status_code
            if status == 200:
                return self._parse_success(response)
            message = self._redact(self._error_message(response))
            if status == 402:
                raise OutOfCredit(f"Gnani out of credit (402): {message}")
            if status in RETRY_STATUSES:
                last_problem = f"HTTP {status}: {message}"
                continue
            raise GnaniError(f"Gnani request failed (HTTP {status}): {message}")

        raise GnaniError(
            f"Gnani request failed after {MAX_ATTEMPTS} attempts: {last_problem}"
        )

    def _parse_success(self, response) -> dict:
        try:
            body = response.json()
        except ValueError:
            raise GnaniError("Gnani returned a non-JSON success response") from None
        if not isinstance(body, dict):
            raise GnaniError("Gnani returned an unexpected response shape")
        if body.get("success") is False:
            raise GnaniError(
                f"Gnani reported failure: {self._redact(self._message_from(body))}"
            )
        return body

    def _error_message(self, response) -> str:
        try:
            body = response.json()
        except ValueError:
            return "non-JSON error body"
        return self._message_from(body)

    @staticmethod
    def _message_from(body) -> str:
        if isinstance(body, dict):
            error = body.get("error")
            detail = body.get("detail")
            if isinstance(error, dict):
                return str(error.get("message") or error.get("type") or "unknown error")
            if isinstance(detail, dict):
                return str(
                    detail.get("message") or detail.get("error_code") or "unknown error"
                )
            if isinstance(detail, list):
                return (
                    "; ".join(
                        str(item.get("msg", item))
                        if isinstance(item, dict)
                        else str(item)
                        for item in detail
                    )
                    or "validation error"
                )
            if body.get("message"):
                return str(body["message"])
            if isinstance(error, str):
                return error
        return "unknown error"

    def _redact(self, text: str) -> str:
        if self._api_key:
            return text.replace(self._api_key, "[redacted]")
        return text
