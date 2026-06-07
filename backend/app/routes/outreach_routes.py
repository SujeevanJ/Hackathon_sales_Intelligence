from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from app.database import get_db
from app.models import OutreachBrief, TriggerEvent, Company, User
from app.schemas import OutreachBrief as OutreachBriefSchema, OutreachBriefUpdate, RejectRequest
from app.auth import get_current_user, get_current_admin

router = APIRouter()

# ── Read ──────────────────────────────────────────────────────────────────────

@router.get("/", response_model=List[OutreachBriefSchema], summary="Get all generated outreaches")
def get_outreaches(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(OutreachBrief)
    outreaches = query.order_by(OutreachBrief.created_at.desc()).offset(skip).limit(limit).all()
    return outreaches

@router.get("/pending", response_model=List[OutreachBriefSchema], summary="Get all briefs pending approval (admin only)")
def get_pending_approvals(db: Session = Depends(get_db), current_user: User = Depends(get_current_admin)):
    """Returns all outreach briefs in 'Pending Approval' status for manager review."""
    pending = db.query(OutreachBrief)\
        .filter(OutreachBrief.approval_status == "Pending Approval")\
        .order_by(OutreachBrief.created_at.desc())\
        .all()
    return pending

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

    # By approval status
    statuses = db.query(OutreachBrief.approval_status, func.count(OutreachBrief.id))\
        .group_by(OutreachBrief.approval_status).all()
    status_stats = {s[0]: s[1] for s in statuses if s[0]}

    return {
        "total_outreaches": total,
        "by_persona": persona_stats,
        "by_company": company_stats,
        "by_approval_status": status_stats,
    }

# ── Workflow actions ───────────────────────────────────────────────────────────

@router.put("/{brief_id}", response_model=OutreachBriefSchema, summary="Edit outreach brief content (sales rep)")
def update_outreach_brief(
    brief_id: int,
    payload: OutreachBriefUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Sales rep edits the AI-generated content before submitting for approval.
    Only allowed when approval_status is 'Draft' or 'Rejected'."""
    brief = db.query(OutreachBrief).filter(OutreachBrief.id == brief_id).first()
    if not brief:
        raise HTTPException(status_code=404, detail="Outreach brief not found")
    if brief.approval_status not in ("Draft", "Rejected"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot edit a brief with status '{brief.approval_status}'. Only Draft or Rejected briefs can be edited."
        )
    if payload.subject is not None:
        brief.subject = payload.subject
    if payload.body is not None:
        brief.body = payload.body
    if payload.linkedin_draft is not None:
        brief.linkedin_draft = payload.linkedin_draft
    if payload.whatsapp_draft is not None:
        brief.whatsapp_draft = payload.whatsapp_draft
    brief.edited_by = current_user.id
    db.commit()
    db.refresh(brief)
    return brief

@router.post("/{brief_id}/submit", response_model=OutreachBriefSchema, summary="Submit brief for manager approval (sales rep)")
def submit_for_approval(
    brief_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Sales rep submits the reviewed/edited brief for manager approval.
    Moves status from 'Draft' or 'Rejected' → 'Pending Approval'."""
    brief = db.query(OutreachBrief).filter(OutreachBrief.id == brief_id).first()
    if not brief:
        raise HTTPException(status_code=404, detail="Outreach brief not found")
    if brief.approval_status not in ("Draft", "Rejected"):
        raise HTTPException(
            status_code=400,
            detail=f"Brief is already in '{brief.approval_status}' status."
        )
    brief.approval_status = "Pending Approval"
    brief.rejected_reason = None  # clear any previous rejection reason
    brief.edited_by = current_user.id
    db.commit()
    db.refresh(brief)
    return brief

@router.post("/{brief_id}/approve", response_model=OutreachBriefSchema, summary="Approve outreach brief (admin only)")
def approve_outreach_brief(
    brief_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Manager/admin approves the brief. Moves status → 'Approved'.
    Only 'Approved' briefs can be sent via email."""
    brief = db.query(OutreachBrief).filter(OutreachBrief.id == brief_id).first()
    if not brief:
        raise HTTPException(status_code=404, detail="Outreach brief not found")
    if brief.approval_status != "Pending Approval":
        raise HTTPException(
            status_code=400,
            detail=f"Only 'Pending Approval' briefs can be approved. Current status: '{brief.approval_status}'"
        )
    if not brief.passed_threshold:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot approve — outreach score {brief.outreach_score or 0:.0f}/100 is below the required threshold of 60. "
                   "Improve contact data or wait for a fresher signal before approving."
        )

    brief.approval_status = "Approved"
    brief.approved_by = current_user.id

    # Update parent trigger status
    trigger = db.query(TriggerEvent).filter(TriggerEvent.id == brief.trigger_id).first()
    if trigger:
        trigger.status = "Outreach Sent"

    db.commit()
    db.refresh(brief)
    return brief

@router.post("/{brief_id}/reject", response_model=OutreachBriefSchema, summary="Reject outreach brief (admin only)")
def reject_outreach_brief(
    brief_id: int,
    payload: RejectRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Manager/admin rejects the brief with a reason.
    Moves status → 'Rejected' so the sales rep can revise and resubmit."""
    brief = db.query(OutreachBrief).filter(OutreachBrief.id == brief_id).first()
    if not brief:
        raise HTTPException(status_code=404, detail="Outreach brief not found")
    if brief.approval_status != "Pending Approval":
        raise HTTPException(
            status_code=400,
            detail=f"Only 'Pending Approval' briefs can be rejected. Current status: '{brief.approval_status}'"
        )
    brief.approval_status = "Rejected"
    brief.rejected_reason = payload.reason
    db.commit()
    db.refresh(brief)
    return brief
