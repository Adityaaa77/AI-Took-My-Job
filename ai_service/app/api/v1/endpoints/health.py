from fastapi import APIRouter
from config import settings
from app.core import OllamaProvider

router = APIRouter()

@router.get("/")
async def get_health_status():
    """
    Service health check endpoint reporting FastAPI readiness & local SLM server connectivity.
    """
    provider = OllamaProvider()
    slm_online = await provider.health_check()
    
    return {
        "status": "healthy" if slm_online else "degraded",
        "service": settings.APP_NAME,
        "configured_model": settings.SLM_MODEL_NAME,
        "ollama_base_url": settings.OLLAMA_BASE_URL,
        "slm_server_connected": slm_online
    }
