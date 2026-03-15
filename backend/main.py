from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from routers import profile, roadmap, dsa, courses, challenges, friends, rag, score, cgpa, agent, payments
from auth import verify_token
import os
import uvicorn

app = FastAPI(
    title="PathForge API",
    description="AI-powered career OS backend for CSE students",
    version="1.0.0"
)

# CORS — allow Next.js frontend in dev and prod
# FRONTEND_URL can be set to your exact Vercel URL (e.g. https://pathforge.vercel.app)
_frontend_url = os.getenv("FRONTEND_URL", "")
_origins = ["http://localhost:3000"]
if _frontend_url:
    _origins.append(_frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
app.include_router(profile.router,    prefix="/profile",    tags=["Profile"])
app.include_router(roadmap.router,    prefix="/roadmap",    tags=["Roadmap"])
app.include_router(dsa.router,        prefix="/dsa",        tags=["DSA"])
app.include_router(courses.router,    prefix="/courses",    tags=["Courses"])
app.include_router(challenges.router, prefix="/challenges", tags=["Challenges"])
app.include_router(friends.router,    prefix="/friends",    tags=["Friends"])
app.include_router(rag.router,        prefix="/rag",        tags=["RAG"])
app.include_router(score.router,      prefix="/score",      tags=["Score"])
app.include_router(cgpa.router,       prefix="/cgpa",       tags=["CGPA"])
app.include_router(agent.router,      prefix="/agent",      tags=["Agent"])
app.include_router(payments.router,   prefix="/payments",   tags=["Payments"])


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "PathForge API"}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
