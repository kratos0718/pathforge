from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from auth import verify_token, get_user_id
from database import supabase

router = APIRouter()


class ChallengeCreate(BaseModel):
    title: str
    type: str  # 'dsa_count' | 'course_percent' | 'readiness_score' | 'streak'
    goal_value: float
    deadline: str  # ISO date string
    invite_user_ids: Optional[List[str]] = []


@router.post("/create")
def create_challenge(challenge: ChallengeCreate, payload: dict = Depends(verify_token)):
    user_id = get_user_id(payload)

    # Create challenge
    ch_result = supabase.table("challenges").insert({
        "creator_id": user_id,
        "title": challenge.title,
        "type": challenge.type,
        "goal_value": challenge.goal_value,
        "deadline": challenge.deadline,
        "status": "active",
    }).execute()

    if not ch_result.data:
        raise HTTPException(status_code=500, detail="Failed to create challenge")

    challenge_id = ch_result.data[0]["id"]

    # Add creator as participant
    participants = [{"challenge_id": challenge_id, "user_id": user_id}]
    # Add invited users
    for invited_id in (challenge.invite_user_ids or []):
        participants.append({"challenge_id": challenge_id, "user_id": invited_id})

    supabase.table("challenge_participants").insert(participants).execute()

    # Notify invited users
    for invited_id in (challenge.invite_user_ids or []):
        supabase.table("notifications").insert({
            "user_id": invited_id,
            "type": "challenge",
            "message": f"You've been invited to a challenge: {challenge.title}",
        }).execute()

    return ch_result.data[0]


@router.get("/active")
def get_active_challenges(payload: dict = Depends(verify_token)):
    user_id = get_user_id(payload)

    # Get challenges where user is a participant
    result = supabase.table("challenge_participants")\
        .select("challenges(*, challenge_participants(user_id, progress, completed, users(name)))")\
        .eq("user_id", user_id)\
        .execute()

    return result.data


@router.patch("/{challenge_id}/progress")
def update_challenge_progress(challenge_id: str, progress: float, payload: dict = Depends(verify_token)):
    user_id = get_user_id(payload)
    result = supabase.table("challenge_participants")\
        .update({"progress": progress})\
        .eq("challenge_id", challenge_id)\
        .eq("user_id", user_id)\
        .execute()
    return result.data[0] if result.data else {}
