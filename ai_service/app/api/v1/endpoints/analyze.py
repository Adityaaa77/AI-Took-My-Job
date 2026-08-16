import logging
from fastapi import APIRouter, HTTPException, status
from app.core import OllamaProvider
from app.pipeline import MultiAgentOrchestrator
from app.schemas import (
    SupplyChainSnapshotPayload,
    CoordinatorRecommendationResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("", response_model=CoordinatorRecommendationResponse)
@router.post("/", response_model=CoordinatorRecommendationResponse, include_in_schema=False)
async def analyze_snapshot(
    snapshot: SupplyChainSnapshotPayload,
) -> CoordinatorRecommendationResponse:
    """
    Execute full 6-Agent + Coordinator SLM Multi-Agent pipeline analysis
    over the supplied operational SupplyChainSnapshotPayload from MERN backend.
    """
    try:
        slm_provider = OllamaProvider()

        # Verify Ollama service availability
        if not await slm_provider.health_check():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Ollama SLM inference service is unreachable or offline.",
            )

        orchestrator = MultiAgentOrchestrator(slm_provider=slm_provider, max_concurrency=2)
        final_state = await orchestrator.run(snapshot)

        recommendation = final_state.get("coordinator_recommendation")

        if not recommendation:
            error_msg = (
                final_state.get("agent_errors", {}).get("CoordinatorAgent")
                or "CoordinatorAgent synthesis failed to return a recommendation."
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"AI pipeline analysis failed: {error_msg}",
            )

        return recommendation

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in /analyze endpoint: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal AI processing error: {str(e)}",
        )
