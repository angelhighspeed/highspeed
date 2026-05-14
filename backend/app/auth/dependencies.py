from fastapi import Header, HTTPException, Depends
from jose import jwt, JWTError

from app.services.auth_service import SECRET_KEY, ALGORITHM


def get_current_user(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Token requerido")

    try:
        scheme, token = authorization.split()

        if scheme.lower() != "bearer":
            raise HTTPException(status_code=401, detail="Formato de token inválido")

        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

        username = payload.get("sub")
        role = payload.get("role")

        if not username or not role:
            raise HTTPException(status_code=401, detail="Token inválido")

        return {
            "username": username,
            "role": role
        }

    except (ValueError, JWTError):
        raise HTTPException(status_code=401, detail="Token inválido")


def require_roles(allowed_roles: list[str]):
    def role_checker(current_user: dict = Depends(get_current_user)):
        if current_user["role"] not in allowed_roles:
            raise HTTPException(status_code=403, detail="No tenés permiso")

        return current_user

    return role_checker