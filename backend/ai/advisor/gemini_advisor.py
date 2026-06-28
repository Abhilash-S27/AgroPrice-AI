"""
Google Gemini API advisor integration.
Alternative to Claude — useful for comparison experiments.
"""
from tenacity import retry, stop_after_attempt, wait_exponential

from backend.ai.advisor.base import BaseAdvisor
from backend.ai.prompts.templates import build_advisor_prompt


class GeminiAdvisor(BaseAdvisor):

    def __init__(self):
        # TODO Phase 5:
        # import google.generativeai as genai
        # genai.configure(api_key=settings.GEMINI_API_KEY)
        # self._model = genai.GenerativeModel("gemini-1.5-pro")
        self._model_name = "gemini-1.5-pro"

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
    async def ask(self, question: str, context: str = "") -> str:
        # TODO Phase 5:
        # prompt = build_advisor_prompt(question, context)
        # response = self._model.generate_content(prompt)
        # return response.text
        raise NotImplementedError("Implement Gemini advisor in Phase 5")

    def get_provider_name(self) -> str:
        return "gemini"
