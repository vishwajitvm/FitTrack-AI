"""Encrypts API keys at rest with a Fernet key derived from SECRET_KEY."""
import base64
import hashlib
import logging

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings

log = logging.getLogger(__name__)

_fernet = Fernet(base64.urlsafe_b64encode(hashlib.sha256(settings.secret_key.encode()).digest()))


def encrypt(value: str) -> str:
    return _fernet.encrypt(value.encode()).decode()


def decrypt(token: str | None) -> str | None:
    if not token:
        return None
    try:
        return _fernet.decrypt(token.encode()).decode()
    except InvalidToken:
        log.warning("Could not decrypt a stored key (SECRET_KEY changed?). Re-enter it in the UI.")
        return None


def preview(value: str | None) -> str | None:
    """Masked preview such as `gsk_…a1b2`."""
    if not value:
        return None
    if len(value) <= 8:
        return "•" * len(value)
    return f"{value[:4]}…{value[-4:]}"
