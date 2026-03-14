from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from auth import verify_token, get_user_id
from database import supabase
from datetime import datetime, timezone

router = APIRouter()


class CourseCreate(BaseModel):
    name: str
    url: Optional[str] = None
    platform: Optional[str] = None
    total_sections: int


class CourseProgressUpdate(BaseModel):
    completed_sections: int


@router.get("/")
def get_courses(payload: dict = Depends(verify_token)):
    user_id = get_user_id(payload)
    return supabase.table("courses").select("*").eq("user_id", user_id).order("created_at", desc=True).execute().data


@router.post("/")
def add_course(course: CourseCreate, payload: dict = Depends(verify_token)):
    user_id = get_user_id(payload)
    result = supabase.table("courses").insert({
        "user_id": user_id,
        "name": course.name,
        "url": course.url,
        "platform": course.platform,
        "total_sections": course.total_sections,
        "completed_sections": 0,
    }).execute()
    return result.data[0] if result.data else {}


@router.patch("/{course_id}/progress")
def update_course_progress(course_id: str, update: CourseProgressUpdate, payload: dict = Depends(verify_token)):
    user_id = get_user_id(payload)

    # Verify ownership
    existing = supabase.table("courses").select("total_sections").eq("id", course_id).eq("user_id", user_id).single().execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Course not found")

    completed = min(update.completed_sections, existing.data["total_sections"])
    result = supabase.table("courses").update({
        "completed_sections": completed,
        "last_updated": datetime.now(timezone.utc).isoformat(),
    }).eq("id", course_id).eq("user_id", user_id).execute()

    # Award XP for progress (25 XP per section completed)
    if completed > 0:
        supabase.table("activity_feed").insert({
            "actor_id": user_id,
            "action_type": "course_progress",
            "metadata_json": {"course_id": course_id, "completed_sections": completed}
        }).execute()

    return result.data[0] if result.data else {}


@router.delete("/{course_id}")
def delete_course(course_id: str, payload: dict = Depends(verify_token)):
    user_id = get_user_id(payload)
    supabase.table("courses").delete().eq("id", course_id).eq("user_id", user_id).execute()
    return {"deleted": True}
