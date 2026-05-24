from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str = "postgresql://postgres:password@localhost:5432/postgres"
    groq_api_key: str = ""
    openai_api_key: str = ""
    llm_provider: str = "groq"
    
    apollo_api_key: str = ""
    hunter_api_key: str = ""
    
    smtp_server: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    sender_email: str = ""

    class Config:
        env_file = ".env"

settings = Settings()
