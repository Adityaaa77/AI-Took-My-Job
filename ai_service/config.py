import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    """
    Application Settings & Configuration.
    Model name and inference runtime settings are strictly configurable via environment variables
    to allow benchmarking of different local SLMs (e.g., Llama 3.2, Phi-3, Mistral, Qwen).
    """
    APP_NAME: str = "SIH Drug Inventory AI Intelligence Service"
    API_V1_STR: str = "/api/v1"
    
    # Local SLM & Inference Provider Settings
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    # Configurable candidate model - set via SLM_MODEL_NAME env var during benchmarking
    SLM_MODEL_NAME: str = os.getenv("SLM_MODEL_NAME", "phi3:mini")
    SLM_TIMEOUT_SECONDS: float = float(os.getenv("SLM_TIMEOUT_SECONDS", "600.0"))
    SLM_TEMPERATURE: float = float(os.getenv("SLM_TEMPERATURE", "0.2"))
    
    # Retry & Validation Settings
    MAX_RETRY_ATTEMPTS: int = 3
    
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
