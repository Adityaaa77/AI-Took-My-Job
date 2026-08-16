from abc import ABC, abstractmethod
from typing import Any, Dict, Optional, Type
from pydantic import BaseModel

class BaseSLMProvider(ABC):
    """
    Abstract Base Class for local SLM Providers.
    Decouples agent logic from specific inference backends (Ollama, llama.cpp, vLLM, etc.).
    """

    @abstractmethod
    async def generate(self, prompt: str, system_prompt: Optional[str] = None, format_json: bool = False) -> str:
        """
        Generate raw text response from the configured local SLM.
        
        :param prompt: User or agent prompt string.
        :param system_prompt: System prompt setting role and context constraints.
        :param format_json: If True, requests native JSON decoding format from backend.
        :return: String output from SLM model.
        """
        pass

    @abstractmethod
    async def generate_structured(
        self, 
        prompt: str, 
        response_schema: Type[BaseModel], 
        system_prompt: Optional[str] = None,
        example_instance: Optional[Dict[str, Any]] = None
    ) -> BaseModel:
        """
        Generate structured response validated against a given Pydantic model schema.
        
        :param prompt: User or agent prompt string.
        :param response_schema: Pydantic model class to validate output against.
        :param system_prompt: System prompt setting context/formatting rules.
        :param example_instance: Optional agent-specific example dict guiding template shape.
        :return: Instantiated & validated Pydantic model object.
        """
        pass

    @abstractmethod
    async def health_check(self) -> bool:
        """
        Verify connection to the local SLM inference server.
        
        :return: True if inference server is active and reachable, False otherwise.
        """
        pass
