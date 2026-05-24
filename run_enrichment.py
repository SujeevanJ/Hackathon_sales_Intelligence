import os
import sys
import asyncio

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from app.database import SessionLocal
from app.services.enrichment_service import bulk_enrich_companies

async def run_enrichment():
    db = SessionLocal()
    try:
        print("Starting enrichment process...")
        result = await bulk_enrich_companies(db)
        print(result)
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(run_enrichment())
