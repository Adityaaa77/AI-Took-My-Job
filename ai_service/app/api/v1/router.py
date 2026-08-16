from fastapi import APIRouter
from app.api.v1.endpoints import health, analyze

api_router = APIRouter()
api_router.include_router(health.router, prefix="/health", tags=["Health & Status"])
api_router.include_router(analyze.router, prefix="/analyze", tags=["Supply Chain Intelligence Analysis"])
