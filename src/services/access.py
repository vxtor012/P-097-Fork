"""Database-backed role and organization access, shared by internal routes."""

from fastapi import Depends, HTTPException
from sqlalchemy import select

from src.orm_models import Store, User, UserStore
from src.services.auth import get_current_user


def require_roles(*roles):
    async def dependency(user: User = Depends(get_current_user)):
        if user.role.value not in roles:
            raise HTTPException(403, "Tài khoản không có quyền thực hiện thao tác này")
        if user.role.value != "admin" and not user.dealer_id:
            raise HTTPException(403, "Tài khoản chưa được gán đại lý")
        return user

    return dependency


sales_user = require_roles("seller", "admin")
inventory_user = require_roles("seller", "warehouse", "warehouse_manager", "admin")


def dealer_scope(user, requested=None):
    if user.role.value == "admin":
        return requested
    if requested is not None and str(requested) != str(user.dealer_id):
        raise HTTPException(403, "Không có quyền truy cập đại lý khác")
    return user.dealer_id


def check_dealer(user, dealer_id):
    if user.role.value != "admin" and (not dealer_id or dealer_id != user.dealer_id):
        raise HTTPException(403, "Không có quyền truy cập dữ liệu đại lý này")


async def permitted_stores(user, db):
    query = select(Store.id).where(Store.is_active.is_(True))
    if user.role.value != "admin":
        query = query.where(Store.dealer_id == user.dealer_id)
    if user.role.value == "warehouse":
        query = query.join(UserStore, UserStore.store_id == Store.id).where(UserStore.user_id == user.id)
    return list((await db.execute(query)).scalars().all())
