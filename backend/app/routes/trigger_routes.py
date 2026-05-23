from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import TriggerEvent, User
from app.schemas import TriggerEvent as TriggerEventSchema
from app.auth import get_current_user

router = APIRouter()

@router.get("/", response_model=List[TriggerEventSchema], summary="Get all detected trigger events")
def get_triggers(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(TriggerEvent)
    
    # RBAC: If sales rep, only show triggers assigned to them
    if current_user.role == "sales_rep":
        query = query.filter(TriggerEvent.assigned_to_id == current_user.id)
        
    triggers = query.order_by(TriggerEvent.created_at.desc()).offset(skip).limit(limit).all()
    return triggers
