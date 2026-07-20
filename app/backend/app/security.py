"""Password hashing (subject chap. II: storing a plain-text password is an
automatic fail).

Kept in its own module so both ``database.Storage`` and
``repositories.user_repository`` can use it without an import cycle.
"""
from __future__ import annotations

import secrets

from passlib.context import CryptContext

# bcrypt: salted, slow by design, and what the project already depends on.
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Prefixes produced by bcrypt. Used to tell an already-hashed value apart from a
# legacy plain-text one during the migration.
_BCRYPT_PREFIXES = ("$2a$", "$2b$", "$2y$")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def is_hashed(value: str | None) -> bool:
    return bool(value) and value.startswith(_BCRYPT_PREFIXES)


def verify_password(plain: str, stored: str | None) -> bool:
    """Check a candidate password against the stored hash.

    Returns False for anything that is not a bcrypt hash: after the startup
    migration no plain-text value can remain, so a non-hash means a broken row
    and must never authenticate.
    """
    if not plain or not is_hashed(stored):
        return False
    try:
        return pwd_context.verify(plain, stored)
    except Exception:
        return False


def unusable_password() -> str:
    """A hashed random secret for accounts that must never log in with a
    password (OAuth users). Storing the provider's user id there would turn a
    public identifier into a valid credential.
    """
    return hash_password(secrets.token_urlsafe(48))
