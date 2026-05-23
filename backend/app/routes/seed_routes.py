from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.seed_service import seed_database

router = APIRouter()

@router.post("/seed", summary="Seed the database with Relanto mock data and 50 target companies")
def seed_db(db: Session = Depends(get_db)):
    return seed_database(db)
