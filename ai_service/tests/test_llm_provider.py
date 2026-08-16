import json
from unittest.mock import AsyncMock, patch
import pytest
import httpx
from pydantic import BaseModel
from config import settings
from app.core import BaseSLMProvider, OllamaProvider

class SampleSchema(BaseModel):
    summary: str
    risk_level: str

@pytest.mark.asyncio
async def test_config_defaults():
    assert settings.SLM_MODEL_NAME is not None
    assert settings.OLLAMA_BASE_URL.startswith("http")

@pytest.mark.asyncio
async def test_ollama_provider_init():
    provider = OllamaProvider(model_name="test-model", base_url="http://localhost:11434")
    assert provider.model_name == "test-model"
    assert provider.base_url == "http://localhost:11434"
    assert isinstance(provider, BaseSLMProvider)

@pytest.mark.asyncio
async def test_ollama_generate_success():
    provider = OllamaProvider(model_name="test-model")
    mock_response = {"response": "  Generated SLM response  "}
    req = httpx.Request("POST", "http://localhost:11434/api/generate")
    
    with patch("httpx.AsyncClient.post") as mock_post:
        mock_post.return_value = httpx.Response(200, json=mock_response, request=req)
        output = await provider.generate("Analyze drug inventory", system_prompt="You are an AI assistant")
        
        assert output == "Generated SLM response"
        mock_post.assert_called_once()

@pytest.mark.asyncio
async def test_ollama_generate_structured_success():
    provider = OllamaProvider(model_name="test-model")
    mock_json_response = {"response": '{"summary": "Stock is sufficient", "risk_level": "low"}'}
    req = httpx.Request("POST", "http://localhost:11434/api/generate")

    with patch("httpx.AsyncClient.post") as mock_post:
        mock_post.return_value = httpx.Response(200, json=mock_json_response, request=req)
        result = await provider.generate_structured(
            prompt="Evaluate risk", 
            response_schema=SampleSchema
        )

        assert isinstance(result, SampleSchema)
        assert result.summary == "Stock is sufficient"
        assert result.risk_level == "low"

@pytest.mark.asyncio
async def test_ollama_health_check():
    provider = OllamaProvider()
    req = httpx.Request("GET", "http://localhost:11434/api/tags")
    
    with patch("httpx.AsyncClient.get") as mock_get:
        # Healthy server
        mock_get.return_value = httpx.Response(200, json={"models": []}, request=req)
        is_healthy = await provider.health_check()
        assert is_healthy is True

        # Unhealthy server
        mock_get.side_effect = httpx.ConnectError("Connection refused")
        is_healthy = await provider.health_check()
        assert is_healthy is False
