# Drug Supply Chain Tracking System - AI Intelligence Layer

The AI Intelligence Layer is an independent microservice responsible for reasoning over operational drug supply chain data, identifying inventory stockouts/expiry risks, analyzing vendor delays, and generating structured multi-agent recommendations.

## Multi-Agent Architecture
- **Demand Agent:** Trend analysis & consumption forecasting
- **Inventory Agent:** Stock status & batch expiry risk assessment
- **Distribution Agent:** Inter-hospital redistribution & surplus matching
- **Procurement Agent:** Purchase order & reorder point recommendations
- **Vendor Agent:** Supplier lead-time & delay analysis
- **Compliance Agent:** Drug quality & shelf-life regulatory validation
- **Coordinator Agent:** Multi-agent output synthesis & conflict resolution

## Setup & Running Locally

1. **Create & Activate Virtual Environment:**
   ```bash
   cd ai_service
   python -m venv venv
   # Windows:
   venv\Scripts\activate
   # Linux/macOS:
   source venv/bin/activate
   ```

2. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure Environment Variables (Optional):**
   ```bash
   set SLM_MODEL_NAME=llama3.2:3b
   set OLLAMA_BASE_URL=http://localhost:11434
   ```

4. **Run FastAPI Service:**
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
