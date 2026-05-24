"""
Patch existing companies in SQLite with lat/lng, country, region, slm_score.
Run once: python patch_coords.py
"""
import sqlite3, os

DB_PATH = os.path.join(os.path.dirname(__file__), "sales_intel.db")

COORDS = {
    "Relanto Demo Corp":      (37.3382, -121.8863, "USA", "North America", 95),
    "Microsoft":              (47.6740, -122.1215, "USA", "North America", 92),
    "Salesforce":             (37.7749, -122.4194, "USA", "North America", 90),
    "Snowflake":              (45.6770, -111.0429, "USA", "North America", 88),
    "Databricks":             (37.7749, -122.4194, "USA", "North America", 89),
    "Stripe":                 (37.7749, -122.4194, "USA", "North America", 82),
    "Airbnb":                 (37.7749, -122.4194, "USA", "North America", 75),
    "Uber":                   (37.7749, -122.4194, "USA", "North America", 78),
    "Netflix":                (37.2280, -121.9572, "USA", "North America", 80),
    "Palantir":               (39.7392, -104.9903, "USA", "North America", 87),
    "Spotify":                (59.3293,  18.0686,  "Sweden", "Europe", 76),
    "Amazon Web Services":    (47.6062, -122.3321, "USA", "North America", 91),
    "Google":                 (37.4220, -122.0841, "USA", "North America", 93),
    "Oracle":                 (30.2672,  -97.7431, "USA", "North America", 88),
    "SAP":                    (49.2941,   8.6496,  "Germany", "Europe", 85),
    "IBM":                    (41.1228,  -73.7198, "USA", "North America", 84),
    "Apple":                  (37.3349, -122.0090, "USA", "North America", 83),
    "Meta":                   (37.4848, -122.1487, "USA", "North America", 81),
    "Twitter":                (37.7749, -122.4194, "USA", "North America", 74),
    "LinkedIn":               (37.3640, -122.0359, "USA", "North America", 80),
    "Atlassian":              (-33.8688, 151.2093, "Australia", "Asia Pacific", 83),
    "ServiceNow":             (37.3861, -122.0839, "USA", "North America", 86),
    "Workday":                (37.5485, -121.9886, "USA", "North America", 85),
    "Adobe":                  (37.3307, -121.8932, "USA", "North America", 82),
    "Shopify":                (45.4215,  -75.6919, "Canada", "North America", 79),
    "HubSpot":                (42.3601,  -71.0589, "USA", "North America", 78),
    "Twilio":                 (37.7749, -122.4194, "USA", "North America", 80),
    "Cloudflare":             (37.7749, -122.4194, "USA", "North America", 83),
    "HashiCorp":              (37.7749, -122.4194, "USA", "North America", 81),
    "MongoDB":                (40.7128,  -74.0060, "USA", "North America", 82),
    "Elastic":                (37.3861, -122.0839, "USA", "North America", 80),
    "Confluent":              (37.3861, -122.0839, "USA", "North America", 81),
    "Datadog":                (40.7128,  -74.0060, "USA", "North America", 84),
    "New Relic":              (37.7749, -122.4194, "USA", "North America", 79),
    "PagerDuty":              (37.7749, -122.4194, "USA", "North America", 78),
    "Splunk":                 (37.7749, -122.4194, "USA", "North America", 82),
    "Okta":                   (37.7749, -122.4194, "USA", "North America", 80),
    "CrowdStrike":            (32.7767,  -96.7970, "USA", "North America", 83),
    "Palo Alto Networks":     (37.4220, -122.0841, "USA", "North America", 84),
    "Zscaler":                (37.4220, -122.0841, "USA", "North America", 82),
    "Veeva Systems":          (37.3220, -121.9530, "USA", "North America", 78),
    "Toast":                  (42.3601,  -71.0589, "USA", "North America", 72),
    "UiPath":                 (40.7128,  -74.0060, "USA", "North America", 85),
    "Automation Anywhere":    (37.3382, -121.8863, "USA", "North America", 86),
    "C3.ai":                  (37.4220, -122.0841, "USA", "North America", 88),
    "Scale AI":               (37.7749, -122.4194, "USA", "North America", 87),
    "Cohere":                 (43.6532,  -79.3832, "Canada", "North America", 86),
    "Hugging Face":           (40.7128,  -74.0060, "USA", "North America", 85),
    "Anthropic":              (37.7749, -122.4194, "USA", "North America", 88),
    "OpenAI":                 (37.7749, -122.4194, "USA", "North America", 89),
    "Pinterest":              (37.7749, -122.4194, "USA", "North America", 74),
    "Snap":                   (34.0195, -118.4912, "USA", "North America", 73),
    "Reddit":                 (37.7749, -122.4194, "USA", "North America", 72),
    "SpaceX":                 (33.9206, -118.3281, "USA", "North America", 76),
}

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

updated = 0
for name, (lat, lng, country, region, score) in COORDS.items():
    cur.execute("""
        UPDATE companies
        SET latitude=?, longitude=?, country=?, region=?, slm_score=?
        WHERE name=?
    """, (lat, lng, country, region, score, name))
    if cur.rowcount:
        updated += 1
        print(f"  ✓ {name}: ({lat}, {lng}) score={score}")

conn.commit()
conn.close()
print(f"\nDone. Updated {updated} companies.")
