from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, Field


class DrugMarketContextSchema(BaseModel):
    """
    Pydantic schema representing authoritative real-world drug market price context.
    Ingested from verified external pricing sources (e.g. NPPA India).
    """

    drug_id: str = Field(..., description="Unique drug identifier e.g. DRUG-505")
    drug_name: str = Field(..., description="Drug name e.g. Paracetamol 500mg")
    generic_name: Optional[str] = Field(default=None, description="Active pharmaceutical ingredient (API)")
    strength: Optional[str] = Field(default=None, description="Dosage strength e.g. 500mg, 1g")
    dosage_form: Optional[str] = Field(default=None, description="Dosage form e.g. tablet, vial, emulsion")
    pack_size: Optional[str] = Field(default=None, description="Standard pack size e.g. 10 tablets, 1 vial")
    reference_price: Optional[float] = Field(default=None, ge=0.0, description="Authoritative reference / ceiling price")
    reference_price_unit: Optional[str] = Field(default=None, description="Unit for reference price e.g. INR per tablet")
    currency: str = Field(default="INR", description="Currency ISO code")
    price_type: Optional[str] = Field(
        default=None,
        description="Type of price e.g. NPPA_Ceiling_Price, DPCO_Regulated_Price, Market_Reference_Price",
    )
    source: str = Field(default="NPPA Reference Database", description="Authoritative source name")
    source_url: Optional[str] = Field(default=None, description="Official source URL")
    source_timestamp: Optional[datetime] = Field(default=None, description="Timestamp of price publication/order")
    price_confidence: float = Field(default=0.0, ge=0.0, le=1.0, description="Verification confidence score")
    price_available: bool = Field(default=False, description="Flag indicating whether verified market price is available")
    regulatory_price_available: bool = Field(
        default=False, description="Flag indicating if drug is under price regulation (DPCO/NPPA)"
    )
    notes: Optional[str] = Field(default=None, description="Contextual notes or unavailability explanation")
    data_status: Literal["LIVE", "CACHED", "UNAVAILABLE"] = Field(
        default="UNAVAILABLE", description="Data retrieval freshness indicator"
    )


class PriceComparisonSchema(BaseModel):
    """
    Pydantic schema representing empirical Python-calculated price comparison
    between vendor quote and authoritative reference price.
    """

    drug_id: str = Field(..., description="Drug ID compared")
    reference_price: Optional[float] = Field(default=None, description="Authoritative reference price per unit")
    vendor_price: Optional[float] = Field(default=None, description="Vendor quoted price per unit")
    price_difference: Optional[float] = Field(default=None, description="Raw price delta (vendor_price - reference_price)")
    price_difference_percentage: Optional[float] = Field(
        default=None, description="Percentage delta relative to reference price"
    )
    is_above_reference: Optional[bool] = Field(default=None, description="Flag if vendor price exceeds reference price")
    is_within_reference: Optional[bool] = Field(default=None, description="Flag if vendor price is within reference price")
    cost_reasonableness: Literal["COST_OPTIMAL", "COST_ACCEPTABLE", "ABOVE_REFERENCE_PRICE", "UNAVAILABLE"] = Field(
        default="UNAVAILABLE", description="Authoritative economic evaluation result"
    )
