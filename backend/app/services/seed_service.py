from sqlalchemy.orm import Session
from app.models import Company, RelantoProfile, RelantoService, User
from app.auth import get_password_hash
from app.data.target_companies import TARGET_COMPANIES
from app.data.relanto_mock import RELANTO_PROFILE, RELANTO_SERVICES

def seed_database(db: Session):
    # Seed Users
    users_data = [
        {"username": "admin", "password_hash": get_password_hash("Hackathon2026!"), "role": "admin"},
        {"username": "sales_rep1", "password_hash": get_password_hash("Hackathon2026!"), "role": "sales_rep"},
        {"username": "sales_rep2", "password_hash": get_password_hash("Hackathon2026!"), "role": "sales_rep"},
        {"username": "sales_rep3", "password_hash": get_password_hash("Hackathon2026!"), "role": "sales_rep"}
    ]
    for user_data in users_data:
        existing_user = db.query(User).filter(User.username == user_data["username"]).first()
        if not existing_user:
            new_user = User(**user_data)
            db.add(new_user)

    # Seed Relanto Profile
    profile = db.query(RelantoProfile).first()
    if not profile:
        profile = RelantoProfile(**RELANTO_PROFILE)
        db.add(profile)
    
    # Seed Relanto Services
    for svc in RELANTO_SERVICES:
        existing_svc = db.query(RelantoService).filter(RelantoService.name == svc["name"]).first()
        if not existing_svc:
            new_svc = RelantoService(**svc)
            db.add(new_svc)
            
    # Seed Target Companies
    for comp in TARGET_COMPANIES:
        existing_comp = db.query(Company).filter(Company.name == comp["name"]).first()
        if not existing_comp:
            new_comp = Company(**comp)
            db.add(new_comp)
            
    db.commit()
    return {"message": "Database seeded successfully with Relanto data and 50 target companies."}
