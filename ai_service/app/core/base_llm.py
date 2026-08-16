from abc import ABC, abstractmethod
from typing import Any, Dict, Optional

class BaseSLMProvider(ABC):
    """
    Abstract Base Class for local SLM Providers.
    Decouples agent logic from specific inference backends (Ollama, llama.cpp, vLLM, etc.).
    """

    @abstractmethod
    async def generate(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        """
        Generate raw text response from the configured local SLM.
        """
        pass

    @abstractmethod
    async def generate_structured(self, prompt: str, schema: Any, system_prompt: Optional[str] = None) -> Dict[str, Any]:
        """
        Generate structured JSON response conforming to a given schema.
        """
        pass
