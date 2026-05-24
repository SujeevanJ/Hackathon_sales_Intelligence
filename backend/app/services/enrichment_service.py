import logging
import httpx
from sqlalchemy.orm import Session
from app.models import Company, RelantoService
from app.services.trigger_service import call_llm
import json
import asyncio

logger = logging.getLogger(__name__)

async def geocode_location(location_str: str) -> dict:
    if not location_str:
        return None
    url = f"https://nominatim.openstreetmap.org/search?q={location_str}&format=json&limit=1"
    headers = {"User-Agent": "RelantoSalesIntelApp/1.0"}
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers, timeout=10.0)
            if response.status_code == 200:
                data = response.json()
                if data and len(data) > 0:
                    result = data[0]
                    return {
                        "lat": float(result.get("lat")),
                        "lon": float(result.get("lon")),
                        "country": result.get("display_name").split(",")[-1].strip(),
                    }
    except Exception as e:
        logger.error(f"Geocoding error for {location_str}: {e}")
    return None

def generate_slm_score(company: Company, services: list[RelantoService]) -> int:
    service_descriptions = "\n".join([f"- {s.name}: {s.description}" for s in services])
    prompt = f"""
    You are an expert B2B Sales Analyst for "Relanto".
    
    Evaluate the following target company and generate a "Relanto Fit Score" from 0 to 100.
    The score represents how easily Relanto can offer its services to this company based on their industry and profile.
    
    Target Company: {company.name}
    Industry: {company.industry}
    Website: {company.website}
    HQ Location: {company.hq_location}
    
    Relanto Services Available:
    {service_descriptions}
    
    Output strictly a JSON object with the following schema:
    {{
      "slm_score": <integer 0-100>,
      "reasoning": "<brief 1 sentence reason>"
    }}
    """
    
    response = call_llm(prompt)
    if not response:
        return 50 # Default score
        
    try:
        data = json.loads(response)
        return int(data.get("slm_score", 50))
    except Exception as e:
        logger.error(f"Error parsing SLM score: {e}")
        return 50

async def enrich_company(db: Session, company: Company, services: list[RelantoService]):
    # Geocode
    if company.hq_location and (company.latitude is None or company.longitude is None):
        geo_data = await geocode_location(company.hq_location)
        if geo_data:
            company.latitude = geo_data["lat"]
            company.longitude = geo_data["lon"]
            company.country = geo_data["country"]
            company.region = "Global" # Simplified
            
    # Score
    if company.slm_score is None:
        company.slm_score = generate_slm_score(company, services)
        
    db.commit()
    return company

async def bulk_enrich_companies(db: Session):
    companies = db.query(Company).filter(Company.is_active == True).all()
    services = db.query(RelantoService).all()
    
    # Process sequentially to avoid rate limits on Geocoding/LLM
    for company in companies:
        if company.latitude is None or company.slm_score is None:
            await enrich_company(db, company, services)
            await asyncio.sleep(1) # Be nice to nominatim API
            
    return {"message": f"Enriched {len(companies)} companies"}
