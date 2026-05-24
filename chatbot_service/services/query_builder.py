import httpx
from typing import Optional, Dict, Any, List
from chatbot_service import config

async def resolve_company_name(name: str, token: str) -> Optional[Dict[str, Any]]:
    """
    Fuzzy resolves a company name to a company object by fetching the list of companies.
    """
    if not name:
        return None
        
    headers = {"Authorization": token} if token else {}
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.get(f"{config.INTERNAL_API_URL}/api/companies/", headers=headers)
            if resp.status_code != 200:
                print(f"Error fetching companies: {resp.status_code}")
                return None
                
            companies = resp.json()
            # Try exact match and aliases
            aliases = {
                "alphabet": "google",
                "google": "alphabet",
                "meta": "facebook",
                "facebook": "meta"
            }
            query_lower = name.lower()
            query_lower = aliases.get(query_lower, query_lower)
            
            for c in companies:
                if c["name"].lower() == query_lower:
                    return c
            # Try substring match
            for c in companies:
                if query_lower in c["name"].lower() or c["name"].lower() in query_lower:
                    return c
                    
            return None
        except Exception as e:
            print(f"Exception resolving company name: {e}")
            return None

async def enrich_triggers_with_company_names(client: httpx.AsyncClient, triggers: List[Dict[str, Any]], headers: Dict[str, str]) -> List[Dict[str, Any]]:
    try:
        comp_resp = await client.get(f"{config.INTERNAL_API_URL}/api/companies/?limit=1000", headers=headers)
        if comp_resp.status_code == 200:
            companies = comp_resp.json()
            company_map = {c["id"]: c["name"] for c in companies}
            for t in triggers:
                t["company_name"] = company_map.get(t.get("company_id"), f"Company ID {t.get('company_id')}")
    except Exception as e:
        print(f"Failed to enrich triggers with company names: {e}")
    return triggers

async def build_and_execute_query(intent_type: str, entities: Dict[str, Any], filters: Dict[str, Any], token: str) -> Dict[str, Any]:
    """
    Maps intent to existing REST APIs and executes it, returning a JSON response.
    """
    headers = {"Authorization": token} if token else {}
    
    # 20 limit as requested
    limit = min(filters.get("limit", 20), 20)
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            if intent_type == "get_companies_list":
                resp = await client.get(f"{config.INTERNAL_API_URL}/api/companies/?limit={limit}", headers=headers)
                return {"data_source": "GET /api/companies/", "data": resp.json() if resp.status_code == 200 else []}

            elif intent_type in ["get_triggers_by_company", "get_company_summary", "get_contacts_for_company"]:
                company_name = entities.get("company_name")
                if not company_name:
                    return {"error": "Which company are you asking about?"}
                
                company = await resolve_company_name(company_name, token)
                if not company:
                    return {"error": f"I couldn't find a company named '{company_name}' in our target accounts list."}
                
                company_id = company["id"]
                
                if intent_type == "get_company_summary":
                    # Get company details + triggers
                    trig_resp = await client.get(f"{config.INTERNAL_API_URL}/api/companies/{company_id}/triggers", headers=headers)
                    triggers = trig_resp.json() if trig_resp.status_code == 200 else []
                    return {
                        "data_source": f"GET /api/companies/{company_id} + /triggers",
                        "data": {
                            "company": company,
                            "triggers": triggers[:5] # show top 5 triggers in summary
                        }
                    }
                    
                elif intent_type == "get_triggers_by_company":
                    trig_resp = await client.get(f"{config.INTERNAL_API_URL}/api/companies/{company_id}/triggers", headers=headers)
                    triggers = trig_resp.json()[:limit] if trig_resp.status_code == 200 else []
                    triggers = await enrich_triggers_with_company_names(client, triggers, headers)
                    return {
                        "data_source": f"GET /api/companies/{company_id}/triggers",
                        "data": triggers
                    }
                    
                elif intent_type == "get_contacts_for_company":
                    # Contacts are in outreach briefs
                    out_resp = await client.get(f"{config.INTERNAL_API_URL}/api/outreaches/?limit=100", headers=headers)
                    outreaches = out_resp.json() if out_resp.status_code == 200 else []
                    # Filter and extract unique contacts
                    contacts = []
                    seen_emails = set()
                    for o in outreaches:
                        if o["company_id"] == company_id and o.get("contact_email"):
                            email = o["contact_email"]
                            if email not in seen_emails:
                                seen_emails.add(email)
                                contacts.append({
                                    "name": o.get("contact_name"),
                                    "role": o.get("contact_role"),
                                    "email": email,
                                    "phone": o.get("contact_phone"),
                                    "linkedin": o.get("contact_linkedin"),
                                    "timezone": company.get("timezone", "N/A")
                                })
                    return {
                        "data_source": "GET /api/outreaches/ (Filtered for contacts)",
                        "data": {
                            "company_name": company["name"],
                            "contacts": contacts[:limit]
                        }
                    }

            elif intent_type == "get_triggers_by_type":
                event_type = entities.get("event_type", "").lower()
                trig_resp = await client.get(f"{config.INTERNAL_API_URL}/api/triggers/?limit=100", headers=headers)
                if trig_resp.status_code != 200:
                    return {"data_source": "GET /api/triggers/", "data": []}
                
                triggers = trig_resp.json()
                filtered = [t for t in triggers if event_type in t.get("event_type", "").lower()]
                filtered = await enrich_triggers_with_company_names(client, filtered, headers)
                return {
                    "data_source": "GET /api/triggers/ (Filtered by type)",
                    "data": filtered[:limit]
                }

            elif intent_type == "get_triggers_recent":
                trig_resp = await client.get(f"{config.INTERNAL_API_URL}/api/triggers/?limit={limit}", headers=headers)
                triggers = trig_resp.json() if trig_resp.status_code == 200 else []
                triggers = await enrich_triggers_with_company_names(client, triggers, headers)
                return {
                    "data_source": "GET /api/triggers/",
                    "data": triggers
                }

            elif intent_type == "get_outreach_brief":
                # Check if we have a trigger_id, otherwise we resolve company name and find the latest trigger
                trigger_id = entities.get("trigger_id")
                if not trigger_id:
                    company_name = entities.get("company_name")
                    if company_name:
                        company = await resolve_company_name(company_name, token)
                        if company:
                            trig_resp = await client.get(f"{config.INTERNAL_API_URL}/api/companies/{company['id']}/triggers", headers=headers)
                            triggers = trig_resp.json() if trig_resp.status_code == 200 else []
                            if triggers:
                                trigger_id = triggers[0]["id"]
                
                if not trigger_id:
                    return {"error": "I couldn't find a trigger event to pull the outreach brief for. Please specify a company or trigger."}
                
                brief_resp = await client.get(f"{config.INTERNAL_API_URL}/api/outreaches/trigger/{trigger_id}", headers=headers)
                return {
                    "data_source": f"GET /api/outreaches/trigger/{trigger_id}",
                    "data": brief_resp.json() if brief_resp.status_code == 200 else None
                }

            elif intent_type == "get_timing_recommendation":
                company_name = entities.get("company_name")
                if not company_name:
                    return {"error": "Please provide a company name to get timing recommendations."}
                
                company = await resolve_company_name(company_name, token)
                if not company:
                    return {"error": f"Could not find company '{company_name}'."}
                
                # Fetch outreach briefs to find timing recommendations
                out_resp = await client.get(f"{config.INTERNAL_API_URL}/api/outreaches/?limit=50", headers=headers)
                outreaches = out_resp.json() if out_resp.status_code == 200 else []
                company_briefs = [o for o in outreaches if o["company_id"] == company["id"]]
                
                recommendations = []
                for b in company_briefs:
                    if b.get("recommended_send_time") and b.get("contact_name"):
                        recommendations.append({
                            "contact": b["contact_name"],
                            "role": b.get("contact_role", "CTO"),
                            "recommended_time": b["recommended_send_time"],
                            "timezone": company.get("timezone", "N/A")
                        })
                
                return {
                    "data_source": "GET /api/outreaches/ (Filtered for timing)",
                    "data": {
                        "company_name": company["name"],
                        "recommendations": recommendations[:5]
                    }
                }

            elif intent_type == "get_inactive_accounts":
                # Fetch all companies and all triggers, see which companies have NO triggers
                comp_resp = await client.get(f"{config.INTERNAL_API_URL}/api/companies/?limit=100", headers=headers)
                trig_resp = await client.get(f"{config.INTERNAL_API_URL}/api/triggers/?limit=100", headers=headers)
                
                if comp_resp.status_code != 200 or trig_resp.status_code != 200:
                    return {"error": "Failed to fetch platform accounts and signals."}
                
                companies = comp_resp.json()
                triggers = trig_resp.json()
                
                active_company_ids = {t["company_id"] for t in triggers}
                inactive = [c for c in companies if c["id"] not in active_company_ids]
                
                return {
                    "data_source": "GET /api/companies/ + /triggers (Correlation check)",
                    "data": inactive[:limit]
                }

            elif intent_type == "get_analytics_count":
                # Get outreach analytics stats
                stats_resp = await client.get(f"{config.INTERNAL_API_URL}/api/outreaches/stats", headers=headers)
                trig_resp = await client.get(f"{config.INTERNAL_API_URL}/api/triggers/?limit=100", headers=headers)
                
                stats = stats_resp.json() if stats_resp.status_code == 200 else {}
                triggers = trig_resp.json() if trig_resp.status_code == 200 else []
                
                return {
                    "data_source": "GET /api/outreaches/stats + /triggers",
                    "data": {
                        "total_triggers": len(triggers),
                        "total_outreaches": stats.get("total_outreaches", 0),
                        "by_persona": stats.get("by_persona", []),
                        "by_company": stats.get("by_company", [])
                    }
                }
                
            elif intent_type == "faq_general":
                return {
                    "data_source": "Internal KB",
                    "data": "Relanto Sales Intelligence detects trigger events (funding, hiring surges, leadership changes, product launches) and generates hyper-personalized email drafts using Generative AI (Llama 3.1) and matches them to relevant target decision makers."
                }
                
            else:
                return {"data_source": "None", "data": None}

        except Exception as e:
            print(f"Exception building/executing internal query: {e}")
            return {"error": "Internal API call failed."}
