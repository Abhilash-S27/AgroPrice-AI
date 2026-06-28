"""
Claude API advisor integration.
Uses the Anthropic SDK with tenacity retry logic.
"""
from tenacity import retry, stop_after_attempt, wait_exponential

from backend.ai.advisor.base import BaseAdvisor
from backend.ai.prompts.templates import build_advisor_prompt


class ClaudeAdvisor(BaseAdvisor):
    """
    Anthropic Claude-powered agricultural advisor.
    Recommended model: claude-sonnet-4-6 for balance of speed and quality.
    """

    def __init__(self):
        # TODO Phase 5: initialize Anthropic client
        # import anthropic
        # self._client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        self._model = "claude-sonnet-4-6"
        self._max_tokens = 1024

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
    async def ask(self, question: str, context: str = "") -> str:
        """
        Send a question to Claude with agricultural price context.
        Retries up to 3 times on API errors.
        """
        # TODO Phase 5:
        # prompt = build_advisor_prompt(question, context)
        # response = self._client.messages.create(
        #     model=self._model,
        #     max_tokens=self._max_tokens,
        #     messages=[{"role": "user", "content": prompt}],
        # )
        # return response.content[0].text
        raise NotImplementedError("Implement Claude advisor in Phase 5")

    def get_provider_name(self) -> str:
        return "claude"
