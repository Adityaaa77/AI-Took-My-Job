import asyncio
import sys
import os

# Add root ai_service path to sys.path so script can be run directly from any CWD
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from config import settings
from app.core import BaseSLMProvider, OllamaProvider
from app.schemas import AgentFindingSchema

async def run_real_inference_test():
    print("=" * 70)
    print("STAGE 4: REAL LOCAL SLM INFERENCE VERIFICATION")
    print("=" * 70)
    print(f"Target Runtime  : Ollama ({settings.OLLAMA_BASE_URL})")
    print(f"Configured Model: {settings.SLM_MODEL_NAME}")
    print("-" * 70)

    # Instantiate provider via BaseSLMProvider abstraction interface
    slm_provider: BaseSLMProvider = OllamaProvider()

    # Step 1: Health Check
    print("\n[Step 1] Checking Ollama server availability...")
    is_healthy = await slm_provider.health_check()

    if not is_healthy:
        print("\n" + "!" * 70)
        print(f"[ERROR] Cannot connect to local Ollama server at {settings.OLLAMA_BASE_URL}")
        print("!" * 70)
        print("\nPlease complete the following setup steps:")
        print("1. Ensure Ollama is installed (https://ollama.com).")
        print("2. Start the local Ollama service in your terminal:")
        print("     ollama serve")
        print(f"3. Download the configured candidate model:")
        print(f"     ollama pull {settings.SLM_MODEL_NAME}")
        print("!" * 70)
        sys.exit(1)

    print(f"[SUCCESS] Ollama service is ACTIVE at {settings.OLLAMA_BASE_URL}")

    # Step 2: Raw Text Generation
    print("\n[Step 2] Testing raw text completion from local SLM...")
    raw_prompt = (
        "Hospital-A currently holds 500 units of Paracetamol 500mg. "
        "The daily consumption rate is 80 units/day. "
        "There is an incoming shipment of 100 units expected in 2 days. "
        "Analyze the stock depletion timeline in 2-3 concise sentences."
    )
    print(f"Prompt Sent:\n\"{raw_prompt}\"\n")

    try:
        raw_response = await slm_provider.generate(
            prompt=raw_prompt,
            system_prompt="You are a clinical supply chain analyst. Be concise and precise."
        )
        print("Raw SLM Output:")
        print("-" * 40)
        print(raw_response)
        print("-" * 40)
    except Exception as exc:
        print(f"\n[ERROR] Raw generation failed: {exc}")
        print("\nDiagnostic Checklist:")
        print(f"1. Has the model '{settings.SLM_MODEL_NAME}' been downloaded?")
        print(f"   Run: ollama pull {settings.SLM_MODEL_NAME}")
        sys.exit(1)

    # Step 3: Structured Output Validation
    print("\n[Step 3] Testing structured output (Pydantic schema validation)...")
    structured_prompt = (
        "Analyze the following situation and return findings:\n"
        "Drug: Paracetamol 500mg (DRUG-101)\n"
        "Location: Hospital-A (HOSP-A)\n"
        "Stock: 500 units\n"
        "Daily Usage: 80 units/day\n"
        "Evaluate stockout risk and report findings."
    )

    try:
        finding: AgentFindingSchema = await slm_provider.generate_structured(
            prompt=structured_prompt,
            response_schema=AgentFindingSchema,
            system_prompt="Analyze supply chain risk and output valid JSON matching the schema."
        )

        print("\n[SUCCESS] Structured Output parsed and validated successfully by Pydantic!")
        print("\nValidated Pydantic Object:")
        print(f"  Agent Name : {finding.agent_name}")
        print(f"  Finding Type: {finding.finding_type}")
        print(f"  Severity    : {finding.severity}")
        print(f"  Target Drug : {finding.target_drug_id}")
        print(f"  Location    : {finding.target_location_id}")
        print(f"  Description : {finding.description}")
        print(f"  Metrics     : {finding.metrics}")
        print("-" * 70)
        print("STAGE 4 REAL INFERENCE VERIFICATION PASSED SUCCESSFULLY! ✅")
        print("=" * 70)

    except Exception as exc:
        print(f"\n[ERROR] Structured output validation failed: {exc}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(run_real_inference_test())
