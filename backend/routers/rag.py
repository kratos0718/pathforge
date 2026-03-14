from fastapi import APIRouter, Depends
from auth import verify_token

router = APIRouter()


@router.get("/recommend")
async def recommend_resource(role: str, topic: str, payload: dict = Depends(verify_token)):
    """
    RAG-powered course/resource recommender.
    Queries Qdrant vector DB for top 2 resources matching role + topic.
    Full implementation in Phase 4 — requires OpenAI embeddings + Qdrant setup.
    """
    return {
        "status": "coming_in_phase4",
        "message": "RAG recommender will be live in Phase 4",
        "query": {"role": role, "topic": topic}
    }
