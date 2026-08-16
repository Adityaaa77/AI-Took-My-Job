from datetime import date, datetime
from typing import List, Optional, Literal
from pydantic import BaseModel, Field, ConfigDict

class DrugSchema(BaseModel):
    """
    Represents a pharmaceutical drug or medical supply item.
    Required by Demand, Inventory, Procurement, and Compliance agents.
    """
    drug_id: str = Field(..., description="Unique drug identifier e.g. DRUG-101")
    name: str = Field(..., description="Generic/Trade name e.g. Paracetamol 500mg")
    category: str = Field(..., description="Therapeutic category e.g. Antibiotic, Analgesic")
    unit: str = Field(..., description="Unit of measurement e.g. tablets, vials, bottles")
    is_critical: bool = Field(default=False, description="Flag indicating emergency/essential drug status")
    min_safety_stock: int = Field(default=100, ge=0, description="Minimum stock threshold before stockout alert")

    model_config = ConfigDict(json_schema_extra={
        "example": {
            "drug_id": "DRUG-101",
            "name": "Paracetamol 500mg",
            "category": "Analgesic",
            "unit": "tablets",
            "is_critical": True,
            "min_safety_stock": 500
        }
    })


class BatchSchema(BaseModel):
    """
    Represents a specific manufactured batch of a drug.
    Required by Compliance & Inventory agents for expiry and quality checking.
    """
    batch_id: str = Field(..., description="Unique batch number e.g. BATCH-2026-A")
    drug_id: str = Field(..., description="Associated drug ID")
    manufacturer: str = Field(..., description="Vendor or manufacturer name")
    quantity: int = Field(..., ge=0, description="Number of units in this batch")
    expiry_date: date = Field(..., description="Expiration date of batch")
    quality_status: Literal["passed", "quarantine", "failed"] = Field(
        default="passed", description="Quality compliance state"
    )


class HospitalSchema(BaseModel):
    """
    Represents a healthcare facility or medical institution.
    Required by Demand and Distribution agents.
    """
    hospital_id: str = Field(..., description="Unique institution ID e.g. HOSP-A")
    name: str = Field(..., description="Name of hospital e.g. City General Hospital")
    tier: str = Field(..., description="Facility tier e.g. Primary, District, Tertiary")
    location_zone: str = Field(..., description="Geographic zone e.g. Zone-North")


class InventoryItemSchema(BaseModel):
    """
    Represents current stock state at a specific warehouse or hospital.
    Required by Inventory, Distribution, and Procurement agents.
    """
    location_id: str = Field(..., description="Hospital or Warehouse ID holding stock")
    location_type: Literal["hospital", "warehouse"] = Field(..., description="Type of facility")
    drug_id: str = Field(..., description="Associated drug ID")
    available_stock: int = Field(..., ge=0, description="Stock available for immediate use")
    reserved_stock: int = Field(default=0, ge=0, description="Stock allocated to active orders/patients")
    incoming_stock: int = Field(default=0, ge=0, description="Stock currently in transit via shipments")
    batches: List[BatchSchema] = Field(default_factory=list, description="List of drug batches present")


class ConsumptionRecordSchema(BaseModel):
    """
    Represents historical drug consumption data at a hospital.
    Required by Demand Agent for trend analysis and forecasting.
    """
    hospital_id: str = Field(..., description="Hospital ID")
    drug_id: str = Field(..., description="Drug ID")
    period_start: date = Field(..., description="Start date of consumption window")
    period_end: date = Field(..., description="End date of consumption window")
    quantity_consumed: int = Field(..., ge=0, description="Total units consumed during window")
    daily_avg_consumption: float = Field(..., ge=0.0, description="Average units consumed per day")
    is_anomaly: bool = Field(default=False, description="Flag for unusual consumption spike/drop")


class VendorSchema(BaseModel):
    """
    Represents a drug supplier or vendor.
    Required by Vendor and Procurement agents.
    """
    vendor_id: str = Field(..., description="Unique vendor ID e.g. VEND-501")
    name: str = Field(..., description="Vendor company name")
    avg_lead_time_days: int = Field(..., ge=0, description="Average fulfillment delivery time in days")
    reliability_score: float = Field(..., ge=0.0, le=1.0, description="Historical on-time delivery score 0.0 to 1.0")
    active_orders_count: int = Field(default=0, ge=0, description="Current pending orders with vendor")


class PurchaseOrderSchema(BaseModel):
    """
    Represents a formal order placed with a vendor.
    Required by Procurement & Vendor agents.
    """
    order_id: str = Field(..., description="Unique order ID e.g. PO-9001")
    vendor_id: str = Field(..., description="Vendor ID")
    drug_id: str = Field(..., description="Drug ID ordered")
    quantity: int = Field(..., gt=0, description="Quantity ordered")
    status: Literal["pending", "approved", "shipped", "delivered", "cancelled"] = Field(
        default="pending", description="Order fulfillment state"
    )
    created_at: datetime = Field(..., description="Order placement timestamp")
    expected_delivery: datetime = Field(..., description="Estimated delivery date")


class ShipmentSchema(BaseModel):
    """
    Represents physical shipment in transit.
    Required by Inventory, Vendor, and Distribution agents.
    """
    shipment_id: str = Field(..., description="Unique shipment ID e.g. SHIP-88")
    order_id: str = Field(..., description="Associated Purchase Order ID")
    origin_id: str = Field(..., description="Warehouse or Vendor ID origin")
    destination_id: str = Field(..., description="Hospital or Warehouse destination")
    drug_id: str = Field(..., description="Drug ID being shipped")
    quantity: int = Field(..., gt=0, description="Quantity in shipment")
    status: Literal["preparing", "dispatched", "in_transit", "delayed", "delivered", "received"] = Field(
        default="preparing", description="Current transit status"
    )
    estimated_arrival: datetime = Field(..., description="Estimated arrival timestamp")


class SupplyChainSnapshotPayload(BaseModel):
    """
    Master input snapshot payload passed from MERN backend to AI endpoint POST /api/v1/analyze.
    Contains complete operational state for reasoning over.
    """
    snapshot_id: str = Field(..., description="Unique snapshot identifier")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Snapshot generation timestamp")
    drugs: List[DrugSchema] = Field(default_factory=list, description="Drugs catalog in scope")
    hospitals: List[HospitalSchema] = Field(default_factory=list, description="Hospitals in scope")
    inventories: List[InventoryItemSchema] = Field(default_factory=list, description="Current inventory items")
    consumption_records: List[ConsumptionRecordSchema] = Field(default_factory=list, description="Recent consumption history")
    vendors: List[VendorSchema] = Field(default_factory=list, description="Vendor performance profiles")
    purchase_orders: List[PurchaseOrderSchema] = Field(default_factory=list, description="Active purchase orders")
    shipments: List[ShipmentSchema] = Field(default_factory=list, description="Active shipments")
