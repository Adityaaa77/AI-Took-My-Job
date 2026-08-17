# ai_service/app/traceability/schemas.py
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field

class TraceabilityEventType(str, Enum):
    MANUFACTURED = "MANUFACTURED"
    QUALITY_CHECKED = "QUALITY_CHECKED"
    SHIPPED = "SHIPPED"
    RECEIVED_WAREHOUSE = "RECEIVED_WAREHOUSE"
    DISPATCHED = "DISPATCHED"
    RECEIVED_HOSPITAL = "RECEIVED_HOSPITAL"
    CONSUMED = "CONSUMED"

class ProductIdentityStatus(str, Enum):
    PRODUCT_IDENTITY_VALID = "PRODUCT_IDENTITY_VALID"
    PRODUCT_IDENTITY_MISMATCH = "PRODUCT_IDENTITY_MISMATCH"
    UNVERIFIED_PRODUCT = "UNVERIFIED_PRODUCT"

class ProvenanceStatus(str, Enum):
    PROVENANCE_VERIFIED = "PROVENANCE_VERIFIED"
    PROVENANCE_INTEGRITY_FAILURE = "PROVENANCE_INTEGRITY_FAILURE"
    PROVENANCE_EMPTY = "PROVENANCE_EMPTY"

class ConditionStatus(str, Enum):
    CONDITION_SAFE = "CONDITION_SAFE"
    CONDITION_BREACH = "CONDITION_BREACH"
    CONDITION_UNKNOWN = "CONDITION_UNKNOWN"

class ExpiryStatus(str, Enum):
    EXPIRY_VALID = "EXPIRY_VALID"
    EXPIRY_EXPIRED = "EXPIRY_EXPIRED"
    EXPIRY_UNKNOWN = "EXPIRY_UNKNOWN"

class OverallTrustStatus(str, Enum):
    TRUSTED_PRODUCT = "TRUSTED_PRODUCT"
    UNVERIFIED_PRODUCT = "UNVERIFIED_PRODUCT"
    HUMAN_VERIFICATION_REQUIRED = "HUMAN_VERIFICATION_REQUIRED"
    COUNTERFEIT_SUSPECTED = "COUNTERFEIT_SUSPECTED"
    CONDITION_BREACH = "CONDITION_BREACH"
    EXPIRED = "EXPIRED"

class TraceabilityEventSchema(BaseModel):
    event_id: str = Field(..., description="Unique event identifier e.g. EVT-1001")
    batch_id: str = Field(..., description="Target batch or order identifier e.g. BATCH-001")
    drug_id: str = Field(..., description="Target drug identifier e.g. DRUG-101")
    gtin: Optional[str] = Field(default="8901234567890", description="GS1 GTIN code")
    serial_number: Optional[str] = Field(default=None, description="Package serial identifier")
    event_type: TraceabilityEventType = Field(..., description="Lifecycle stage")
    actor_id: str = Field(..., description="Actor user or node ID")
    actor_role: str = Field(..., description="Actor role e.g. MANUFACTURER_MANAGER")
    location_id: str = Field(..., description="Facility or route ID")
    timestamp: str = Field(..., description="ISO 8601 timestamp string")
    temperature_c: Optional[float] = Field(default=None, description="Storage/Transit temperature in Celsius")
    humidity_percent: Optional[float] = Field(default=None, description="Storage/Transit humidity %")
    notes: Optional[str] = Field(default=None, description="Operational notes")
    attached_image: Optional[str] = Field(default=None, description="Packaging photo URL or base64 data string")
    image_hash: Optional[str] = Field(default=None, description="SHA-256 hash of packaging photo bytes")
    payload_hash: Optional[str] = Field(default=None, description="SHA-256 hash of event payload")
    previous_event_hash: Optional[str] = Field(default=None, description="SHA-256 hash of previous block")
    event_hash: Optional[str] = Field(default=None, description="Leaf SHA-256 hash of this block")

class BatchVerificationRequestSchema(BaseModel):
    batch_id: str = Field(..., description="Batch or order identifier to verify")
    gtin: Optional[str] = Field(default=None, description="Optional GTIN to verify")
    serial_number: Optional[str] = Field(default=None, description="Optional serial number to verify")
    drug_id: Optional[str] = Field(default=None, description="Optional drug ID to verify")

class BatchVerificationResponseSchema(BaseModel):
    batch_id: str
    drug_id: str
    drug_name: Optional[str] = "Essential Medicine"
    manufacturer: Optional[str] = "Pharma Global Corp"
    gtin: Optional[str] = "8901234567890"
    serial_number: Optional[str] = "SN-2026-10089"
    expiry_date: Optional[str] = "2027-12-31"
    attached_image: Optional[str] = None
    image_hash: Optional[str] = None
    verification_status: OverallTrustStatus
    right_product_status: ProductIdentityStatus
    provenance_status: ProvenanceStatus
    condition_status: ConditionStatus
    expiry_status: ExpiryStatus
    compliance_status: str = "PASSED"
    reason_codes: List[str] = Field(default_factory=list)
    requires_human_review: bool = False
    total_ledger_events: int = 0
    timeline: List[TraceabilityEventSchema] = Field(default_factory=list)
