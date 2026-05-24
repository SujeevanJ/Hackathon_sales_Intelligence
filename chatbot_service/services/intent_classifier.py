import os
import json
from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List
from groq import Groq
import openai
from chatbot_service import config

@dataclass
class ClassifiedIntent:
    intent_type: str
    entities: Dict[str, Any] = field(default_factory=dict)
    time_range: Optional[str] = None
    filters: Dict[str, Any] = field(default_factory=dict)
    needs_clarification: bool = False
    clarification_question: Optional[str] = None

def get_intent_prompt_template() -> str:
    prompt_path = os.path.join(os.path.dirname(__file__), "..", "prompts", "intent_prompt.txt")
    if os.path.exists(prompt_path):
        with open(prompt_path, "r", encoding="utf-8") as f:
            return f.read()
    return ""

def classify_intent(message: str, history: List[Dict[str, str]]) -> ClassifiedIntent:
    # 1. Format the history into a readable string for the model
    formatted_history = ""
    for h in history:
        formatted_history += f"{h['role'].capitalize()}: {h['content']}\n"
    if not formatted_history:
        formatted_history = "No previous context. This is the start of the session."

    template = get_intent_prompt_template()
    prompt = template.replace("{history}", formatted_history).replace("{message}", message)

    # Call LLM
    raw_response = ""
    try:
        if config.LLM_PROVIDER == "groq" and config.GROQ_API_KEY:
            client = Groq(api_key=config.GROQ_API_KEY)
            chat_completion = client.chat.completions.create(
                messages=[
                    {"role": "user", "content": prompt}
                ],
                model="llama-3.1-8b-instant",
                max_tokens=500,
                temperature=0.0,
                response_format={"type": "json_object"}
            )
            raw_response = chat_completion.choices[0].message.content.strip()
        elif config.OPENAI_API_KEY:
            openai.api_key = config.OPENAI_API_KEY
            resp = openai.ChatCompletion.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "user", "content": prompt}
                ],
                max_tokens=500,
                temperature=0.0,
                response_format={"type": "json_object"}
            )
            raw_response = resp.choices[0].message.content.strip()

        # Parse JSON response
        data = json.loads(raw_response)
        
        return ClassifiedIntent(
            intent_type=data.get("intent_type", "unknown"),
            entities=data.get("entities", {}),
            time_range=data.get("time_range"),
            filters=data.get("filters", {}),
            needs_clarification=data.get("needs_clarification", False),
            clarification_question=data.get("clarification_question")
        )

    except Exception as e:
        print(f"Error classifying intent: {e}. Raw response: {raw_response}")
        # Default fallback
        return ClassifiedIntent(
            intent_type="unknown",
            needs_clarification=True,
            clarification_question="I'm sorry, I couldn't process your query. Could you please rephrase what you'd like to search for?"
        )
