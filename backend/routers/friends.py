from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from auth import verify_token, get_user_id
from database import supabase

router = APIRouter()


class FriendRequest(BaseModel):
    friend_id: str


@router.post("/request")
def send_friend_request(req: FriendRequest, payload: dict = Depends(verify_token)):
    user_id = get_user_id(payload)

    if user_id == req.friend_id:
        raise HTTPException(status_code=400, detail="Cannot add yourself")

    # Check if friendship already exists
    existing = supabase.table("friendships")\
        .select("id, status")\
        .eq("user_id", user_id)\
        .eq("friend_id", req.friend_id)\
        .execute()

    if existing.data:
        raise HTTPException(status_code=400, detail=f"Friendship already exists: {existing.data[0]['status']}")

    result = supabase.table("friendships").insert({
        "user_id": user_id,
        "friend_id": req.friend_id,
        "status": "pending",
    }).execute()

    # Notify the friend
    supabase.table("notifications").insert({
        "user_id": req.friend_id,
        "type": "friend_request",
        "message": "You have a new friend request on PathForge",
    }).execute()

    return result.data[0] if result.data else {}


@router.post("/accept")
def accept_friend_request(req: FriendRequest, payload: dict = Depends(verify_token)):
    user_id = get_user_id(payload)

    # Update: friend_id sent request TO user_id
    result = supabase.table("friendships")\
        .update({"status": "accepted"})\
        .eq("user_id", req.friend_id)\
        .eq("friend_id", user_id)\
        .eq("status", "pending")\
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Pending request not found")

    # Also create reverse row for easy querying
    supabase.table("friendships").insert({
        "user_id": user_id,
        "friend_id": req.friend_id,
        "status": "accepted",
    }).execute()

    return {"accepted": True}


@router.get("/list")
def get_friends(payload: dict = Depends(verify_token)):
    user_id = get_user_id(payload)
    result = supabase.table("friendships")\
        .select("friend_id, status, users!friendships_friend_id_fkey(name, college, xp, streak)")\
        .eq("user_id", user_id)\
        .eq("status", "accepted")\
        .execute()
    return result.data


@router.get("/pending")
def get_pending_requests(payload: dict = Depends(verify_token)):
    user_id = get_user_id(payload)
    # Requests sent TO this user
    result = supabase.table("friendships")\
        .select("user_id, users!friendships_user_id_fkey(name, college)")\
        .eq("friend_id", user_id)\
        .eq("status", "pending")\
        .execute()
    return result.data


@router.get("/search")
def search_users(q: str, payload: dict = Depends(verify_token)):
    """Search users by name or college."""
    if len(q) < 2:
        raise HTTPException(status_code=400, detail="Query too short")
    result = supabase.table("users")\
        .select("id, name, college, xp, streak")\
        .ilike("name", f"%{q}%")\
        .limit(10)\
        .execute()
    return result.data
