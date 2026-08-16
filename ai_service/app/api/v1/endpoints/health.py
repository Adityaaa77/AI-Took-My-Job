from fastapi import APIRouter
from config import settings

router = APIRouter()

@router.get("/")
async def get_health_status():
    """
    Basic service health check endpoint.
    """
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "configured_model": settings.SLM_MODEL_NAME,
        "ollama_base_url": settings.OLLAMA_BASE_URL
    }
