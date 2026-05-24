import os
import json
from typing import List, Dict, Any, AsyncGenerator
from groq import Groq
import openai
from chatbot_service import config

def get_system_prompt_template() -> str:
    prompt_path = os.path.join(os.path.dirname(__file__), "..", "prompts", "system_prompt.txt")
    if os.path.exists(prompt_path):
        with open(prompt_path, "r", encoding="utf-8") as f:
            return f.read()
    return ""

async def format_response_stream(
    user_message: str,
    history: List[Dict[str, str]],
    api_response: Dict[str, Any]
) -> AsyncGenerator[str, None]:
    """
    Asynchronously streams the formatted response back to the client using a generative LLM.
    """
    formatted_history = ""
    for h in history:
        formatted_history += f"{h['role'].capitalize()}: {h['content']}\n"
    if not formatted_history:
        formatted_history = "No previous context. This is the start of the session."

    # Convert API response to readable JSON string
    api_str = json.dumps(api_response, indent=2)

    template = get_system_prompt_template()
    system_prompt = template.format(
        history=formatted_history,
        api_response=api_str,
        user_message=user_message
    )

    try:
        if config.LLM_PROVIDER == "groq" and config.GROQ_API_KEY:
            client = Groq(api_key=config.GROQ_API_KEY)
            # Use Llama 3.1 70b as primary choice for versatile/smart completions
            # fallback to standard llama3-70b-8192 if versatile is deprecated
            model_name = "llama-3.3-70b-specdec" # Llama 3.3 70B is currently standard on Groq
            # We'll use llama-3.3-70b-specdec or llama-3.1-70b-versatile or llama3-70b-8192
            
            # Let's try llama-3.3-70b-versatile
            model_name = "llama-3.3-70b-versatile"
            
            stream = client.chat.completions.create(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message}
                ],
                model=model_name,
                max_tokens=500,
                temperature=0.3,
                stream=True
            )
            for chunk in stream:
                content = chunk.choices[0].delta.content
                if content:
                    yield content

        elif config.OPENAI_API_KEY:
            openai.api_key = config.OPENAI_API_KEY
            # Async stream for OpenAI
            response = await openai.ChatCompletion.acreate(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message}
                ],
                max_tokens=500,
                temperature=0.3,
                stream=True
            )
            async for chunk in response:
                content = chunk.choices[0].delta.get("content")
                if content:
                    yield content
        else:
            yield "LLM API Key not configured. Please set GROQ_API_KEY or OPENAI_API_KEY in the environment."

    except Exception as e:
        print(f"Error streaming response from LLM: {e}")
        # If llama-3.3 fails, try a fallback model
        try:
            if config.LLM_PROVIDER == "groq" and config.GROQ_API_KEY:
                client = Groq(api_key=config.GROQ_API_KEY)
                stream = client.chat.completions.create(
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_message}
                    ],
                    model="llama-3.3-70b-versatile",
                    max_tokens=500,
                    temperature=0.3,
                    stream=True
                )
                for chunk in stream:
                    content = chunk.choices[0].delta.content
                    if content:
                        yield content
        except Exception as inner_e:
            yield f"I'm sorry, I encountered an issue formatting the data: {str(inner_e)}"
