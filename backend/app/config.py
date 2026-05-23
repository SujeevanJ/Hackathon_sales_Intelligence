from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str = "postgresql://postgres:password@localhost:5432/postgres"
    groq_api_key: str = ""
    openai_api_key: str = ""
    llm_provider: str = "groq"

    class Config:
        env_file = ".env"

settings = Settings()
