import time
from typing import List, Dict, Any

SESSION_TTL = 3600  # 1 hour
_sessions: Dict[str, Dict[str, Any]] = {}

class SessionManager:
    def _cleanup_expired(self):
        now = time.time()
        expired = [sid for sid, sdata in _sessions.items() if now - sdata["last_activity"] > SESSION_TTL]
        for sid in expired:
            del _sessions[sid]

    def _get_session(self, session_id: str) -> Dict[str, Any]:
        self._cleanup_expired()
        if session_id not in _sessions:
            _sessions[session_id] = {
                "history": [],
                "last_activity": time.time()
            }
        else:
            _sessions[session_id]["last_activity"] = time.time()
        return _sessions[session_id]

    def get_history(self, session_id: str) -> List[Dict[str, str]]:
        """
        Returns list of {role: "user"|"assistant", content: str}
        """
        session = self._get_session(session_id)
        return session["history"]

    def append(self, session_id: str, role: str, content: str):
        """
        Appends to history, trims to last 10 turns (20 messages since each turn has user+assistant)
        to control token usage.
        """
        session = self._get_session(session_id)
        session["history"].append({
            "role": role,
            "content": content,
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
        })
        # 10 turns = 20 messages
        if len(session["history"]) > 20:
            session["history"] = session["history"][-20:]

    def clear(self, session_id: str):
        """
        Explicit reset
        """
        if session_id in _sessions:
            del _sessions[session_id]

    def get_context_window(self, session_id: str) -> List[Dict[str, str]]:
        """
        Returns last 6 messages (3 turns) only for LLM context to keep it cheap.
        """
        history = self.get_history(session_id)
        # Keep last 6 messages (e.g. 3 back-and-forths)
        return history[-6:]
