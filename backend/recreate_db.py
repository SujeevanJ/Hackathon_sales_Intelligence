from app.database import engine, Base
import app.models

Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)
print("Database recreated successfully.")
