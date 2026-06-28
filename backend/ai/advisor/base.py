"""Abstract interface for all AI advisor implementations."""
from abc import ABC, abstractmethod


class BaseAdvisor(ABC):

    @abstractmethod
    async def ask(self, question: str, context: str = "") -> str:
        """Send a question with optional price/forecast context; return answer string."""
        ...

    @abstractmethod
    def get_provider_name(self) -> str:
        """Return the provider name: 'claude' or 'gemini'."""
        ...
