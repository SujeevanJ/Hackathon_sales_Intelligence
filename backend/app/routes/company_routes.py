from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import Company, TriggerEvent
from app.schemas import Company as CompanySchema, TriggerEvent as TriggerEventSchema

router = APIRouter()

@router.get("/", response_model=List[CompanySchema], summary="Get all target companies")
def get_companies(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    companies = db.query(Company).offset(skip).limit(limit).all()
    return companies

@router.get("/{company_id}", response_model=CompanySchema)
def get_company(company_id: int, db: Session = Depends(get_db)):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company

@router.get("/{company_id}/triggers", response_model=List[TriggerEventSchema], summary="Get trigger history for a specific company")
def get_company_triggers(company_id: int, db: Session = Depends(get_db)):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    triggers = db.query(TriggerEvent).filter(TriggerEvent.company_id == company_id).order_by(TriggerEvent.created_at.desc()).all()
    return triggers
