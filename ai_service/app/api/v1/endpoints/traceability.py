# ai_service/app/api/v1/endpoints/traceability.py
from typing import List
from fastapi import APIRouter, HTTPException, Query, status
from app.traceability.schemas import (
    TraceabilityEventSchema,
    BatchVerificationRequestSchema,
    BatchVerificationResponseSchema,
)
from app.traceability.service import default_traceability_service

router = APIRouter()

@router.post(
    "/verify",
    response_model=BatchVerificationResponseSchema,
    summary="Verify batch authenticity, provenance hash-chain, and cold-chain condition"
)
async def verify_batch(request: BatchVerificationRequestSchema):
    try:
        return default_traceability_service.verify_batch(request)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Verification engine error: {str(e)}"
        )

@router.get(
    "/verify/{batch_id}",
    response_model=BatchVerificationResponseSchema,
    summary="GET shorthand for verifying a batch by ID"
)
async def verify_batch_by_id(batch_id: str):
    request = BatchVerificationRequestSchema(batch_id=batch_id)
    return default_traceability_service.verify_batch(request)

@router.post(
    "/events",
    response_model=TraceabilityEventSchema,
    status_code=status.HTTP_201_CREATED,
    summary="Record a new lifecycle event into the permissioned SHA-256 ledger"
)
async def record_event(event: TraceabilityEventSchema):
    try:
        return default_traceability_service.record_event(event)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to record event to ledger: {str(e)}"
        )

@router.get(
    "/batch/{batch_id}",
    response_model=BatchVerificationResponseSchema,
    summary="Retrieve batch ledger status and provenance timeline"
)
async def get_batch_ledger(batch_id: str):
    request = BatchVerificationRequestSchema(batch_id=batch_id)
    return default_traceability_service.verify_batch(request)

@router.get(
    "/batch/{batch_id}/timeline",
    response_model=List[TraceabilityEventSchema],
    summary="Retrieve full block timeline for batch"
)
async def get_batch_timeline(batch_id: str):
    return default_traceability_service.get_timeline(batch_id)
