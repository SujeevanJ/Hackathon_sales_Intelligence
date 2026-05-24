import os
import sys
from sqlalchemy import text

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from app.database import engine

def run_migration():
    columns_to_add = [
        ("latitude", "DOUBLE PRECISION"),
        ("longitude", "DOUBLE PRECISION"),
        ("country", "VARCHAR"),
        ("region", "VARCHAR"),
        ("slm_score", "INTEGER")
    ]
    
    with engine.connect() as conn:
        for col_name, col_type in columns_to_add:
            try:
                conn.execute(text(f"ALTER TABLE companies ADD COLUMN {col_name} {col_type}"))
                conn.commit()
                print(f"Successfully added {col_name}")
            except Exception as e:
                if "already exists" in str(e).lower() or "duplicate column" in str(e).lower():
                    print(f"Column {col_name} already exists.")
                else:
                    print(f"Error adding {col_name}: {e}")
                conn.rollback()
        
        print("Migration completed.")

if __name__ == "__main__":
    run_migration()
