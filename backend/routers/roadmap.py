import os, json, re
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from groq import Groq
from auth import verify_token, get_user_id
from database import supabase
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
MODEL = "llama-3.3-70b-versatile"

# ─── Helpers ──────────────────────────────────────────────────────────────────

def extract_json(text: str) -> Any:
    """Extract JSON from LLM response even if wrapped in markdown."""
    match = re.search(r"```(?:json)?\s*([\s\S]+?)```", text)
    if match:
        return json.loads(match.group(1))
    return json.loads(text)


# ─── Role Compass ─────────────────────────────────────────────────────────────

COMPASS_SYSTEM = """You are PathForge's AI Role Compass. Your job is to ask exactly 10 targeted questions to determine the best-fit tech career role for a CSE student in India.

Roles to choose from: SDE, ML Engineer, Data Analyst, DevOps, Product Manager

Rules:
- Ask ONE question at a time
- Make each question build on previous answers
- Questions should probe: interests, strengths, preferred work style, enjoyment of math/data/building/people/systems
- After exactly 10 user answers, output ONLY a JSON object in this exact format:
{
  "done": true,
  "role": "SDE",
  "confidence": 87,
  "reasoning": "2-3 sentences explaining why",
  "alternatives": [{"role": "DevOps", "fit": 65}],
  "traits": ["problem solver", "loves algorithms", "prefers backend"]
}

Before the 10th answer, only ask the next question as plain text. No JSON until after 10 answers."""


class CompassMessage(BaseModel):
    role: str   # 'user' | 'assistant'
    content: str

class CompassRequest(BaseModel):
    messages: List[CompassMessage]
    profile: Dict[str, Any]


@router.post("/compass")
async def role_compass(request: CompassRequest, payload: dict = Depends(verify_token)):
    user_id = get_user_id(payload)

    # Count user turns to know where we are
    user_turns = [m for m in request.messages if m.role == "user"]

    system = COMPASS_SYSTEM
    if request.profile:
        system += f"\n\nStudent profile: {json.dumps(request.profile)}"

    messages = [{"role": m.role, "content": m.content} for m in request.messages]

    response = groq_client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "system", "content": system}] + messages,
        temperature=0.7,
        max_tokens=512,
    )

    reply = response.choices[0].message.content.strip()

    # Check if LLM returned the final JSON result
    if '"done": true' in reply or '"done":true' in reply:
        try:
            result = extract_json(reply)
            # Save recommended role to user profile
            supabase.table("users").update({
                "target_role": result["role"]
            }).eq("id", user_id).execute()
            return {"done": True, "result": result, "message": reply}
        except Exception:
            pass

    return {
        "done": False,
        "message": reply,
        "turn": len(user_turns),
    }


# ─── Roadmap Generator ────────────────────────────────────────────────────────

ROADMAP_SYSTEM = """You are PathForge's roadmap AI. Generate a personalised 16-week placement preparation plan for a CSE student in India.

Output ONLY valid JSON in this exact structure (no markdown, no explanation):
{
  "weeks": [
    {
      "week": 1,
      "theme": "Theme name",
      "focus": "One sentence focus",
      "tasks": [
        {
          "title": "Task title",
          "type": "dsa|course|project|aptitude|revision|mock",
          "resource_link": "https://... or null",
          "estimated_hours": 2.5,
          "description": "Brief description"
        }
      ]
    }
  ]
}

Rules:
- Exactly 16 weeks
- 3-5 tasks per week
- Calibrate to the student's semester, tier, and target role
- Early weeks = foundations, middle = depth, later weeks = mock interviews + projects
- For SDE: weight DSA heavily. For ML: weight courses + projects. For DA: weight SQL + stats + visualisation.
- Include real resource links where possible (LeetCode, YouTube, GeeksForGeeks, etc.)"""


class RoadmapGenerateRequest(BaseModel):
    role: str
    profile: Dict[str, Any]


@router.post("/generate")
async def generate_roadmap(request: RoadmapGenerateRequest, payload: dict = Depends(verify_token)):
    user_id = get_user_id(payload)

    profile_summary = f"""
Role: {request.role}
Semester: {request.profile.get('semester', 'unknown')}
College tier: {request.profile.get('college_tier', 'unknown')}
Current skills: {', '.join(request.profile.get('current_skills', []))}
Target companies: {', '.join(request.profile.get('target_companies', []))}
"""

    response = groq_client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": ROADMAP_SYSTEM},
            {"role": "user", "content": f"Generate a 16-week plan for this student:\n{profile_summary}"},
        ],
        temperature=0.5,
        max_tokens=4096,
    )

    raw = response.choices[0].message.content.strip()

    try:
        data = extract_json(raw)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI returned invalid JSON: {str(e)}")

    # Save plan to DB
    plan_result = supabase.table("roadmap_plans").insert({
        "user_id": user_id,
        "weeks_json": data,
        "version": 1,
    }).execute()

    if not plan_result.data:
        raise HTTPException(status_code=500, detail="Failed to save roadmap")

    plan_id = plan_result.data[0]["id"]

    # Flatten tasks into roadmap_tasks table
    tasks_to_insert = []
    for week in data.get("weeks", []):
        for task in week.get("tasks", []):
            tasks_to_insert.append({
                "plan_id": plan_id,
                "user_id": user_id,
                "week_number": week["week"],
                "title": task["title"],
                "type": task.get("type", "general"),
                "resource_link": task.get("resource_link"),
                "estimated_hours": task.get("estimated_hours", 1),
                "status": "pending",
            })

    if tasks_to_insert:
        supabase.table("roadmap_tasks").insert(tasks_to_insert).execute()

    return {"plan_id": plan_id, "plan": data}


# ─── Get current plan ─────────────────────────────────────────────────────────

@router.get("/my-plan")
def get_my_plan(payload: dict = Depends(verify_token)):
    user_id = get_user_id(payload)
    result = supabase.table("roadmap_plans")\
        .select("*")\
        .eq("user_id", user_id)\
        .order("generated_at", desc=True)\
        .limit(1)\
        .execute()
    if not result.data:
        return None

    plan = result.data[0]
    tasks = supabase.table("roadmap_tasks")\
        .select("*")\
        .eq("plan_id", plan["id"])\
        .order("week_number")\
        .execute()
    plan["tasks"] = tasks.data
    return plan


# ─── Update task status ───────────────────────────────────────────────────────

class TaskStatusUpdate(BaseModel):
    status: str  # pending | completed | skipped

@router.patch("/tasks/{task_id}")
def update_task_status(task_id: str, body: TaskStatusUpdate, payload: dict = Depends(verify_token)):
    user_id = get_user_id(payload)
    if body.status not in ("pending", "completed", "skipped"):
        raise HTTPException(status_code=400, detail="Invalid status")

    update_data: Dict[str, Any] = {"status": body.status}
    if body.status == "completed":
        update_data["completed_at"] = datetime.now(timezone.utc).isoformat()
        # Award XP
        supabase.rpc("increment_xp", {"p_user_id": user_id, "p_amount": 15}).execute()

    result = supabase.table("roadmap_tasks")\
        .update(update_data)\
        .eq("id", task_id)\
        .eq("user_id", user_id)\
        .execute()
    return result.data[0] if result.data else {}


# ─── Replan remaining weeks ───────────────────────────────────────────────────

REPLAN_SYSTEM = """You are PathForge's adaptive replan AI. The student has fallen behind or completed tasks early.
Regenerate ONLY the remaining weeks (not past weeks) based on their current state.
Output ONLY valid JSON with the same structure as the original plan but only containing the remaining weeks."""

class ReplanRequest(BaseModel):
    plan_id: str
    current_week: int
    completed_task_ids: List[str]
    skipped_task_ids: List[str]
    profile: Optional[Dict[str, Any]] = {}

@router.post("/replan")
async def replan(request: ReplanRequest, payload: dict = Depends(verify_token)):
    user_id = get_user_id(payload)

    # Fetch current plan
    plan = supabase.table("roadmap_plans").select("weeks_json")\
        .eq("id", request.plan_id).eq("user_id", user_id).single().execute()
    if not plan.data:
        raise HTTPException(status_code=404, detail="Plan not found")

    weeks_remaining = 16 - request.current_week
    skipped_count = len(request.skipped_task_ids)
    completed_count = len(request.completed_task_ids)

    response = groq_client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": REPLAN_SYSTEM},
            {"role": "user", "content": f"""
Current week: {request.current_week}
Weeks remaining: {weeks_remaining}
Tasks completed so far: {completed_count}
Tasks skipped so far: {skipped_count}
Student profile: {json.dumps(request.profile)}

Regenerate weeks {request.current_week + 1} through 16 to account for any missed topics.
"""},
        ],
        temperature=0.5,
        max_tokens=4096,
    )

    raw = response.choices[0].message.content.strip()
    try:
        new_weeks = extract_json(raw)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Replan AI error: {str(e)}")

    # Merge new weeks into existing plan JSON
    existing_weeks = plan.data["weeks_json"].get("weeks", [])
    past_weeks = [w for w in existing_weeks if w["week"] <= request.current_week]
    merged = {"weeks": past_weeks + new_weeks.get("weeks", [])}

    # Update plan version
    supabase.table("roadmap_plans").update({
        "weeks_json": merged,
        "version": supabase.table("roadmap_plans").select("version").eq("id", request.plan_id).single().execute().data["version"] + 1,
    }).eq("id", request.plan_id).execute()

    # Delete future tasks and reinsert
    supabase.table("roadmap_tasks")\
        .delete()\
        .eq("plan_id", request.plan_id)\
        .gt("week_number", request.current_week)\
        .execute()

    new_tasks = []
    for week in new_weeks.get("weeks", []):
        for task in week.get("tasks", []):
            new_tasks.append({
                "plan_id": request.plan_id,
                "user_id": user_id,
                "week_number": week["week"],
                "title": task["title"],
                "type": task.get("type", "general"),
                "resource_link": task.get("resource_link"),
                "estimated_hours": task.get("estimated_hours", 1),
                "status": "pending",
            })
    if new_tasks:
        supabase.table("roadmap_tasks").insert(new_tasks).execute()

    return {"plan": merged}
