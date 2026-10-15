"""Signed tokens backed by revocable PostgreSQL sessions."""

import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID

import bcrypt
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.hash import pbkdf2_sha256
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import get_settings
from src.db import get_db
from src.orm_models import AuthSession, User

settings = get_settings()
if settings.app_env == "production" and len(settings.jwt_secret) < 32:
    raise RuntimeError("Production requires JWT_SECRET with at least 32 characters")
SECRET_KEY = settings.jwt_secret or secrets.token_urlsafe(48)
ALGORITHM = "HS256"
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


def utcnow():
    return datetime.now(UTC).replace(tzinfo=None)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if hashed_password.startswith("$pbkdf2-sha256$"):
        try:
            return pbkdf2_sha256.verify(plain_password, hashed_password)
        except (ValueError, TypeError):
            return False
    if not hashed_password.startswith(("$2b$", "$2a$", "$2y$")):
        return False
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def hash_password(plain_password: str) -> str:
    return bcrypt.hashpw(plain_password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    now = datetime.now(UTC)
    return jwt.encode(
        {**data, "exp": now + (expires_delta or timedelta(days=settings.session_days)), "iat": now},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


def decode_access_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None


async def get_current_session(
    token: str | None = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db, scope="function")
):
    payload = decode_access_token(token) if token else None
    try:
        session_id = UUID(payload["jti"])
        user_id = UUID(payload["sub"])
    except (KeyError, TypeError, ValueError):
        raise HTTPException(
            401, "Phiên đăng nhập không hợp lệ hoặc đã hết hạn", headers={"WWW-Authenticate": "Bearer"}
        ) from None
    session = (await db.execute(select(AuthSession).where(AuthSession.id == session_id))).scalar_one_or_none()
    if not session or session.user_id != user_id or session.revoked_at or session.expires_at <= utcnow():
        raise HTTPException(401, "Phiên đăng nhập không hợp lệ hoặc đã hết hạn")
    return session


async def get_current_user(
    session: AuthSession = Depends(get_current_session), db: AsyncSession = Depends(get_db, scope="function")
) -> User:
    user = (await db.execute(select(User).where(User.id == session.user_id))).scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(401, "Tài khoản không tồn tại hoặc đã bị khóa")
    return user
