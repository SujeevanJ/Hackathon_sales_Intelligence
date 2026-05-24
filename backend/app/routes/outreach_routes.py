from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from app.database import get_db
from app.models import OutreachBrief, TriggerEvent, Company, User
from app.schemas import OutreachBrief as OutreachBriefSchema
from app.auth import get_current_user

router = APIRouter()

@router.get("/", response_model=List[OutreachBriefSchema], summary="Get all generated outreaches")
def get_outreaches(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(OutreachBrief)
    outreaches = query.order_by(OutreachBrief.created_at.desc()).offset(skip).limit(limit).all()
    return outreaches

@router.get("/trigger/{trigger_id}", response_model=OutreachBriefSchema, summary="Get outreach brief by trigger ID")
def get_outreach_by_trigger(trigger_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    outreach = db.query(OutreachBrief).filter(OutreachBrief.trigger_id == trigger_id).first()
    if not outreach:
        from app.services.outreach_service import process_outreach_pipeline
        try:
            outreach = process_outreach_pipeline(db, trigger_id)
            if not outreach:
                raise HTTPException(status_code=404, detail="Failed to generate outreach brief")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error generating outreach brief: {str(e)}")
    return outreach

@router.get("/stats", summary="Get outreach analytics")
def get_outreach_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    total = db.query(OutreachBrief).count()
    
    # By persona
    personas = db.query(OutreachBrief.persona, func.count(OutreachBrief.id)).group_by(OutreachBrief.persona).all()
    persona_stats = [{"name": p[0], "value": p[1]} for p in personas if p[0]]
    
    # By company
    companies = db.query(Company.name, func.count(OutreachBrief.id))\
        .join(OutreachBrief, Company.id == OutreachBrief.company_id)\
        .group_by(Company.name).all()
    company_stats = [{"name": c[0], "value": c[1]} for c in companies if c[0]]
    
    return {
        "total_outreaches": total,
        "by_persona": persona_stats,
        "by_company": company_stats
    }
