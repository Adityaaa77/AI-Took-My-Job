from unittest.mock import patch
import pytest
import httpx
from app.core import OllamaProvider

@pytest.mark.asyncio
async def test_ollama_404_model_not_found():
    provider = OllamaProvider(model_name="non-existent-model")
    req = httpx.Request("POST", "http://localhost:11434/api/generate")
    res = httpx.Response(404, json={"error": "model 'non-existent-model' not found"}, request=req)

    with patch("httpx.AsyncClient.post") as mock_post:
        mock_post.return_value = res
        with pytest.raises(RuntimeError) as exc_info:
            await provider.generate("Test prompt")
        
        assert "was not found on local Ollama server" in str(exc_info.value)
        assert "ollama pull non-existent-model" in str(exc_info.value)

@pytest.mark.asyncio
async def test_ollama_connection_error():
    provider = OllamaProvider(base_url="http://localhost:9999") # Unreachable port

    with patch("httpx.AsyncClient.post") as mock_post:
        mock_post.side_effect = httpx.ConnectError("Connection refused")
        with pytest.raises(RuntimeError) as exc_info:
            await provider.generate("Test prompt")
        
        assert "Could not connect to Ollama server" in str(exc_info.value)

@pytest.mark.asyncio
async def test_ollama_timeout_error():
    provider = OllamaProvider()

    with patch("httpx.AsyncClient.post") as mock_post:
        mock_post.side_effect = httpx.TimeoutException("Timed out")
        with pytest.raises(RuntimeError) as exc_info:
            await provider.generate("Test prompt")
        
        assert "timed out" in str(exc_info.value)
