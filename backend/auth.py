"""
Supabase JWT verification for FastAPI.
Pass the Supabase anon JWT in the Authorization header:
  Authorization: Bearer <supabase_access_token>
"""
import os
import jwt
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv

load_dotenv()

security = HTTPBearer()

SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")  # Found in Supabase: Settings → API → JWT Secret


def verify_token(credentials: HTTPAuthorizationCredentials = Security(security)) -> dict:
    token = credentials.credentials
    try:
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False},  # Supabase JWTs use "authenticated" audience
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")


def get_user_id(payload: dict) -> str:
    """Extract user UUID from Supabase JWT payload."""
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="No user ID in token")
    return user_id
