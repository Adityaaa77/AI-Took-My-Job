# 🛡️ DrugTrace AI — Intelligent Closed-Loop Pharmaceutical Supply Chain Command Center

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-blue.svg)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-v3.11-3776AB.svg)](https://www.python.org/)
[![React](https://img.shields.io/badge/React-v18-61DAFB.svg)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-v0.100%2B-009688.svg)](https://fastapi.tiangolo.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-v6.0-47A248.svg)](https://www.mongodb.com/)
[![Framework](https://img.shields.io/badge/Architecture-7--Rights--Framework-purple.svg)](#-the-7-rights-operational-framework)

---

## 📌 Executive Summary

**DrugTrace AI** is an enterprise-grade, closed-loop, multi-agent AI and immutable Distributed Ledger Technology (DLT) supply chain command center designed for national health ministries (MoHFW), regional hospital networks, central medical store depots (CMSS), and pharmaceutical manufacturers.

The platform eliminates vulnerabilities in critical healthcare logistics—including cold-chain denaturation, counterfeit drug infiltration, hospital stockouts, procurement price gouging, and unauthorized route diversions—by enforcing the **7 Rights of Healthcare Supply Chain Management**.

---

## 🎯 The 7 Rights Operational Framework

```
  ┌────────────────────────────────────────────────────────────────────────────────────────┐
  │                           THE 7 RIGHTS OPERATIONAL NORTH STAR                          │
  ├──────────────┬─────────────────────────────────────────────────────────────────────────┤
  │ 📦 PRODUCT   │ 100% Verified SHA-256 DLT Provenance & Packaging Vision OCR             │
  │ 📊 QUANTITY  │ ML Ward-Level Demand Forecasting & Reorder Buffer Optimization         │
  │ 📍 PLACE     │ GPS Geofence Highway Corridor Lock & Anti-Tamper Route Auditing          │
  │ ⏱️ TIME      │ Predictive Stockout Horizon Warnings (Days-to-Exhaustion)               │
  │ 🌡️ CONDITION │ Thermal Inertia OLS Predictive Risk Engine (LinearRegression-v1)         │
  │ 💰 COST      │ NPPA Ceiling Price Guarantees & Live External Web Market Audits          │
  │ 👤 PEOPLE    │ Role-Gated Cryptographic Sign-Off & Chain-of-Custody Verification        │
  └──────────────┴─────────────────────────────────────────────────────────────────────────┘
```

---

## 🏗️ System Architecture & Technology Stack

DrugTrace AI is built as a resilient 3-tier microservice architecture:

```
                            ┌─────────────────────────────────────────┐
                            │       React 18 + Vite Frontend (TS)     │
                            │   TailwindCSS • Lucide • SVG Charts     │
                            └────────────────────┬────────────────────┘
                                                 │
                                        REST API (HTTP / JSON)
                                                 │
                            ┌────────────────────▼────────────────────┐
                            │    Node.js + Express Backend Proxy API  │
                            │   TypeScript • Mongoose (MongoDB ORM)   │
                            └────────────────────┬────────────────────┘
                                                 │
                                        Proxy & FastAPI Endpoints
                                                 │
                            ┌────────────────────▼────────────────────┐
                            │  Python FastAPI AI & Microservice Engine│
                            │ SLM Agents • RiskEngine • OCR • Ledger  │
                            └─────────────────────────────────────────┘
```

### 🛠️ Core Stack Technologies:
- **Frontend Layer:** React 18, TypeScript, Vite, TailwindCSS (Vanilla CSS Design System), Lucide Icons, SVG Time-Series Charts, Supabase Storage CDN integration.
- **Backend Layer:** Node.js, Express, TypeScript, Mongoose ORM, MongoDB Atlas/Local, JWT Authentication, Role-Based Access Control (RBAC).
- **AI & Analytics Layer:** Python 3.11, FastAPI, Pydantic, Native Python Mathematical Engine (`LinearRegression+ThermalInertia-v1`), LangChain SLM Agent Architecture, Pytest Test Suite.
- **Cloud & Media:** Supabase Public Storage CDN (`drug-AI` bucket) for Packaging OCR photo persistence.

---

## 🤖 AI Multi-Agent Architecture (7 Specialized Agents)

The platform deploys 7 specialized AI agents working synchronously under a **Closed-Loop Reasoning Architecture** (`SENSE ➔ UNDERSTAND ➔ REASON ➔ DECIDE ➔ VALIDATE ➔ RECORD ➔ MONITOR`):

```
                                  ┌───────────────────────────┐
                                  │     CoordinatorAgent      │
                                  │   (Master Orchestrator)   │
                                  └─────────────┬─────────────┘
                                                │
         ┌──────────────────┬───────────────────┼───────────────────┬──────────────────┐
         │                  │                   │                   │                  │
┌────────▼─────────┐┌───────▼────────┐┌─────────▼────────┐┌──────────▼────────┐┌────────▼─────────┐
│   DemandAgent    ││ InventoryAgent ││ ProcurementAgent ││   VendorAgent    ││DistributionAgent │
│ Ward Consumption ││ Safety Stock   ││ EOQ Calculator   ││ Supplier Rating  ││ Reefer Transit   │
└──────────────────┘└────────────────┘└──────────────────┘└──────────────────┘└──────────────────┘
         │                                                                             │
         └──────────────────────────────────────┬──────────────────────────────────────┘
                                                │
                                     ┌──────────▼──────────┐
                                     │   ComplianceAgent   │
                                     │ DLT & QA Clearance  │
                                     └─────────────────────┘
```

1. **`CoordinatorAgent` (Master Orchestrator):** Routes systemic alerts, resolves inter-agent conflicts, and triggers multi-agent interlocks.
2. **`DemandAgent` (Burn-Rate & Anomaly Monitor):** Analyzes daily hospital ward consumption patterns and detects surge anomalies (`IS_ANOMALY = True`).
3. **`InventoryAgent` (Stock & Reorder Point Optimizer):** Compares live hospital and warehouse holdings against minimum safety thresholds.
4. **`ProcurementAgent` (Economic Order Quantity Calculator):** Calculates optimal institutional reorder quantities and sanctions purchase requisitions.
5. **`VendorAgent` (Supplier Reliability Scorer):** Rates certified pharmaceutical manufacturers based on lead-time days and historical reliability scores (%).
6. **`DistributionAgent` (Reefer Logistics & Route Defender):** Monitors GPS highway corridors, truck geofences, and continuous cold-chain container telemetry.
7. **`ComplianceAgent` (DLT Block Verifier & QA Auditor):** Verifies SHA-256 manufacturer genesis blocks, executes QA inspections, and enforces deterministic quarantine overrides.

> 🔒 **Critical Safety Rule:** Python deterministic mathematical rules remain authoritative over SLM outputs. AI agents provide natural language explanations and recommendations, but cannot override deterministic safety bounds.

---

## 🌡️ Machine Learning Thermal Inertia Risk Engine

Located in `ai_service/app/telemetry/risk_engine.py`, the risk engine evaluates 30-second interval IoT reefer truck telemetry ($T$, $\text{RH}\%$, $g$, $\text{Lux}$) across 5 realistic transit scenarios:
- **`Scenario 1: Normal Refrigerated Transit`** (2.0°C – 8.0°C stable)
- **`Scenario 2: Gradual Thermal Drift`** (Insulation degradation)
- **`Scenario 3: Compressor Failure`** (Rapid thermal spike to +14.5°C)
- **`Scenario 4: Cargo Door Open / Light Spike`** (Lux spike & temp breach)
- **`Scenario 5: Thermal Recovery`** (Active cooling re-engagement)

### 📐 Mathematical Formulation:
- **Ordinary Least Squares (OLS) Thermal Slope ($\frac{dT}{dt}$):**
  $$\text{Slope } (m) = \frac{n \sum (t_i T_i) - \sum t_i \sum T_i}{n \sum t_i^2 - (\sum t_i)^2}$$
- **Estimated Time-to-Breach ($T_{\text{breach}}$):**
  $$T_{\text{breach}} = \frac{T_{\text{max\_allowed}} - T_{\text{current}}}{\frac{dT}{dt}}$$
- **Composite Condition Risk Index ($R \in [0.0, 1.0]$):**
  $$R = w_1 \cdot \Delta T_{\text{boundary}} + w_2 \cdot \max(0, \frac{dT}{dt}) + w_3 \cdot \text{InertiaFactor}$$

---

## 🔐 Blockchain DLT Cryptographic Provenance

Every drug batch, purchase order, and shipment movement generates an immutable **SHA-256 Hash Chain**:

$$\text{Block}_n = \text{SHA256}(\text{Block}_{n-1}.\text{Hash} + \text{Payload} + \text{Timestamp})$$

- **Genesis Block Creation:** Executed at factory synthesis with manufacturer credentials.
- **Custody Handover Blocks:** Recorded at every logistics checkpoint (Reefer Truck ➔ Warehouse Depot ➔ Hospital Pharmacy ➔ Surgical Ward).
- **1-Click Ledger Verification:** Interactive modal on `/tracking` and `/batches` verifies hash continuity from genesis to leaf.

---

## 👥 Role-Based Access Control (RBAC)

The platform adapts dynamically across 6 operational perspectives:

| Role Name | Access Scope & Responsibilities |
| :--- | :--- |
| **`Admin / Central Authority`** | Full system visibility, AI decision overrides, national allocation sanctions, system audit logs. |
| **`Hospital Staff / Pharmacist`** | Ward consumption logging, emergency replenishment requisitions, packaging OCR scanning. |
| **`Warehouse Manager`** | Depot stock management, reefer truck loading sign-off, inter-facility stock transfers. |
| **`Procurement Officer`** | Purchase order sanctions, vendor contract reviews, NPPA ceiling price compliance checks. |
| **`Certified Manufacturer`** | Batch creation, SHA-256 DLT genesis block anchoring, factory QA certification. |
| **`Logistics Carrier`** | Reefer container dispatch, tracking updates, continuous IoT telemetry transmission. |

---

## 🔗 End-to-End Visual 6-Stage Supply Chain Pipeline

```
  ┌──────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌───────────┐    ┌───────────┐    ┌─────────────┐
  │1. VENDOR ├─►  │2. PURCHASE ORDER├─►  │3. REEFER TRANSIT├─►  │4.WAREHOUSE├─►  │5. HOSPITAL├─►  │6.CONSUMPTION│
  └──────────┘    └─────────────────┘    └─────────────────┘    └───────────┘    └───────────┘    └─────────────┘
  Synthesis &     Sanction & NPPA        GPS & Cold-Chain       Depot Stock      Ward Receipt &   Bedside Ward
  DLT Genesis     Ceiling Audited        Telemetry Monitor      Buffering        OCR Audit        Dispensation
```

---

## 📁 Repository Directory Structure

```text
Drug_supply/
├── ai_service/                     # Python FastAPI AI & Risk Prediction Microservice
│   ├── app/
│   │   ├── api/v1/endpoints/       # FastAPI endpoints (/telemetry, /forecast, /ocr, /ai)
│   │   ├── telemetry/              # ML Risk Engine (risk_engine.py, simulator.py, profiles.py)
│   │   ├── agents/                 # LangChain SLM Multi-Agent System (7 Agents)
│   │   ├── ledger/                 # SHA-256 Blockchain DLT Engine
│   │   └── ocr/                    # Computer Vision Packaging OCR Parser
│   ├── tests/                      # Pytest Test Suite (test_telemetry.py)
│   └── scripts/                    # Inference & Demonstration Scripts
├── backend/                        # Node.js + Express + TypeScript Backend API
│   ├── src/
│   │   ├── controllers/            # Mongoose MongoDB Controllers (drug, batch, shipment, PO, etc.)
│   │   ├── models/                 # Mongoose Database Schemas
│   │   ├── routes/                 # Express API Router Definitions
│   │   └── server.ts               # Server Entry Point (Port 5000)
├── frontend/                       # React 18 + Vite + TypeScript Frontend Application
│   ├── src/
│   │   ├── components/             # Reusable UI Components (Cards, Tables, Modals, Banners)
│   │   ├── pages/                  # Page Views (Dashboard, Telemetry, Procurement, Shipments, etc.)
│   │   ├── services/               # API Integration Services (api.ts, mockData.ts)
│   │   └── types/                  # TypeScript Interfaces & Types
│   └── vite.config.ts              # Vite Bundler Configuration
└── README.md                       # Master Documentation
```

---

## ⚡ Quick Start & Installation Guide

### Prerequisites:
- **Node.js:** v18.0.0 or higher
- **Python:** v3.11.0 or higher
- **MongoDB:** Local instance running at `mongodb://localhost:27017` or MongoDB Atlas URI.

---

### Step 1: Clone Repository
```bash
git clone https://github.com/Adityaaa77/AI-Took-My-Job.git
cd AI-Took-My-Job
```

---

### Step 2: Launch Node.js Express Backend
Open **Terminal 1**:
```powershell
cd backend
npm install
npm run dev
```
- **Backend API:** `http://localhost:5000`

---

### Step 3: Launch React + Vite Frontend
Open **Terminal 2**:
```powershell
cd frontend
npm install
npm run dev
```
- **Frontend App:** `http://localhost:5173`

---

### Step 4: Launch Python FastAPI AI Service
Open **Terminal 3**:
```powershell
cd ai_service
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
- **AI Microservice API:** `http://localhost:8000`

---

## 🧪 Running Automated Tests

To execute the Pytest suite for the IoT Telemetry Simulation & Risk Engine:

```powershell
cd ai_service
python -m pytest tests/test_telemetry.py -v
```

---

## 👥 Contributors & Team Members

We are proud to present **DrugTrace AI**, developed by a dedicated team of engineers:

| Contributor Name | GitHub Handle | Project Role |
| :--- | :--- | :--- |
| **Omkar Raut** | [`@omkar454`](https://github.com/omkar454) | Full-Stack Architect, AI Microservices & ML Risk Engine |
| **Aditya Rajpal** | [`@Adityaaa777`](https://github.com/Adityaaa777) | System Architecture & Backend Services |
| **Gunjan Shambwani** | [`@gunjan555`](https://github.com/gunjan555) | Frontend Engineering & UX Design |
| **Arpita Singh** | [`@ArpitaSingh257`](https://github.com/ArpitaSingh257) | Blockchain DLT & Security Audit |
| **Mihir Chotrani** | [`@Mihir28163`](https://github.com/Mihir28163) | Data Modeling & AI Agent Development |
| **Richa Rawani** | [`@richarawani`](https://github.com/richarawani) | Quality Assurance & Testing Framework |

---

## 📜 License

Distributed under the **MIT License**. See `LICENSE` for more information.

---

<p align="center">
  <b>DrugTrace AI</b> • <i>Guaranteeing the 7 Rights of Healthcare Supply Chain Management</i> 🛡️
</p>
