import json
import logging
from typing import Any, Dict, Optional, Type
import httpx
from pydantic import BaseModel, ValidationError
from config import settings
from app.core.base_llm import BaseSLMProvider

logger = logging.getLogger(__name__)

class OllamaProvider(BaseSLMProvider):
    """
    Ollama adapter implementing BaseSLMProvider interface.
    Communicates asynchronously with local Ollama REST API server.
    """

    def __init__(
        self, 
        base_url: Optional[str] = None, 
        model_name: Optional[str] = None,
        timeout: Optional[float] = None
    ):
        self.base_url = base_url or settings.OLLAMA_BASE_URL
        self.model_name = model_name or settings.SLM_MODEL_NAME
        self.timeout = timeout or settings.SLM_TIMEOUT_SECONDS

    async def generate(self, prompt: str, system_prompt: Optional[str] = None, format_json: bool = False) -> str:
        """
        Send completion request to Ollama /api/generate REST endpoint.
        """
        url = f"{self.base_url.rstrip('/')}/api/generate"
        payload = {
            "model": self.model_name,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": settings.SLM_TEMPERATURE
            }
        }
        if format_json:
            payload["format"] = "json"
            
        if system_prompt:
            payload["system"] = system_prompt

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.post(url, json=payload)
                response.raise_for_status()
                data = response.json()
                return data.get("response", "").strip()
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code == 404:
                    msg = (
                        f"Model '{self.model_name}' was not found on local Ollama server at {self.base_url}. "
                        f"Please run 'ollama pull {self.model_name}' to download it."
                    )
                else:
                    msg = f"Ollama HTTP {exc.response.status_code} error: {exc.response.text}"
                logger.error(msg)
                raise RuntimeError(msg) from exc
            except httpx.ConnectError as exc:
                msg = f"Could not connect to Ollama server at {self.base_url}. Please ensure Ollama service is running."
                logger.error(msg)
                raise RuntimeError(msg) from exc
            except httpx.TimeoutException as exc:
                msg = f"Request to Ollama server at {self.base_url} timed out after {self.timeout} seconds."
                logger.error(msg)
                raise RuntimeError(msg) from exc
            except httpx.HTTPError as exc:
                msg = f"Failed to communicate with local Ollama SLM: {str(exc)}"
                logger.error(msg)
                raise RuntimeError(msg) from exc

    async def generate_structured(
        self, 
        prompt: str, 
        response_schema: Type[BaseModel], 
        system_prompt: Optional[str] = None
    ) -> BaseModel:
        """
        Request JSON format response from Ollama and validate output against Pydantic schema.
        Uses native Ollama JSON decoding mode for fast, preamble-free generation.
        """
        schema_json = json.dumps(response_schema.model_json_schema())
        formatting_instructions = (
            f"\n\nOutput MUST be valid JSON adhering to schema:\n{schema_json}"
        )
        full_system = f"{system_prompt}\n{formatting_instructions}" if system_prompt else formatting_instructions

        # Enable native JSON format decoding in Ollama API request payload
        raw_response = await self.generate(prompt=prompt, system_prompt=full_system, format_json=True)
        
        # Clean potential markdown wrapping e.g. ```json ... ```
        cleaned_response = raw_response
        if "```" in cleaned_response:
            lines = cleaned_response.splitlines()
            json_lines = [line for line in lines if not line.strip().startswith("```")]
            cleaned_response = "\n".join(json_lines).strip()

        try:
            parsed_data = json.loads(cleaned_response)
            validated_obj = response_schema.model_validate(parsed_data)
            return validated_obj
        except (json.JSONDecodeError, ValidationError) as err:
            logger.error(f"Failed to validate SLM output into schema {response_schema.__name__}: {err}")
            raise ValueError(f"SLM response failed schema validation: {str(err)}") from err

    async def health_check(self) -> bool:
        """
        Ping Ollama /api/tags endpoint to check server availability.
        """
        url = f"{self.base_url.rstrip('/')}/api/tags"
        async with httpx.AsyncClient(timeout=5.0) as client:
            try:
                response = await client.get(url)
                return response.status_code == 200
            except Exception:
                return False
