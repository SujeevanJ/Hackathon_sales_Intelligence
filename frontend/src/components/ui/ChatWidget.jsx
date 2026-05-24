import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { MessageSquare, X, Send, Trash2, Bot, Sparkles, AlertCircle } from "lucide-react";

export function ChatWidget() {
  const { token, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [suggestedActions, setSuggestedActions] = useState([
    "Show this week's triggers",
    "Who to contact at Infosys?",
    "Best time to reach Freshworks CTO",
    "Companies with no recent signals"
  ]);
  const [currentMetadata, setCurrentMetadata] = useState(null);

  const messagesEndRef = useRef(null);

  // Generate or retrieve persistent Session ID
  const [sessionId] = useState(() => {
    let sid = sessionStorage.getItem("chat_session_id");
    if (!sid) {
      sid = crypto.randomUUID();
      sessionStorage.setItem("chat_session_id", sid);
    }
    return sid;
  });

  // Load history from session storage on mount
  useEffect(() => {
    const cached = sessionStorage.getItem(`chat_history_${sessionId}`);
    if (cached) {
      try {
        setMessages(JSON.parse(cached));
      } catch (e) {
        console.error("Error loading chat history", e);
      }
    } else {
      // Fetch from API history endpoint if exists
      fetchHistory();
    }
  }, [sessionId]);

  // Sync to session storage when messages update
  useEffect(() => {
    if (messages.length > 0) {
      sessionStorage.setItem(`chat_history_${sessionId}`, JSON.stringify(messages));
    }
  }, [messages, sessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingMessage]);

  const fetchHistory = async () => {
    try {
      const response = await fetch(`/api/chat/history/${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages);
        }
      }
    } catch (e) {
      console.error("Error fetching history from backend", e);
    }
  };

  const handleClearChat = async () => {
    if (window.confirm("Are you sure you want to clear this chat history?")) {
      try {
        await fetch(`/api/chat/session/${sessionId}`, {
          method: "DELETE",
        });
      } catch (e) {
        console.error("Error clearing chat session", e);
      }
      setMessages([]);
      setSuggestedActions([
        "Show this week's triggers",
        "Who to contact at Infosys?",
        "Best time to reach Freshworks CTO",
        "Companies with no recent signals"
      ]);
      sessionStorage.removeItem(`chat_history_${sessionId}`);
    }
  };

  const sendMessage = async (textToSend) => {
    const text = textToSend || input;
    if (!text.trim()) return;

    if (!textToSend) setInput("");
    setIsLoading(true);
    setStreamingMessage("");
    setCurrentMetadata(null);

    // 1. Add User Message to UI
    const newMsg = { role: "user", content: text, timestamp: new Date().toLocaleTimeString() };
    setMessages((prev) => [...prev, newMsg]);

    try {
      // 2. Make SSE POST request to microservice
      const response = await fetch("/api/chat/message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          session_id: sessionId,
          message: text,
          user_id: user?.id ? String(user.id) : null
        })
      });

      if (!response.ok) {
        throw new Error(`Chat API error: ${response.status}`);
      }

      // 3. Read stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop(); // keep last partial line

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed.startsWith("data: ")) {
            const dataStr = trimmed.slice(6);
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.token !== undefined) {
                fullContent += parsed.token;
                setStreamingMessage(fullContent);
              } else {
                // Metadata packet arrived at the end
                setCurrentMetadata(parsed);
                if (parsed.suggested_actions) {
                  setSuggestedActions(parsed.suggested_actions);
                }
              }
            } catch (e) {
              // Wait for next buffer
            }
          }
        }
      }

      // 4. Save Final Message to State
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: fullContent,
          timestamp: new Date().toLocaleTimeString(),
          metadata: currentMetadata || undefined
        }
      ]);
      setStreamingMessage("");

    } catch (e) {
      console.error(e);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I ran into an error connecting to the Chatbot service. Make sure the microservice is running on port 8000.",
          timestamp: new Date().toLocaleTimeString(),
          isError: true
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Convert raw assistant output into markdown-like list layout
  const renderMessageContent = (msg) => {
    const text = msg.content;
    const lines = text.split("\n");

    return (
      <div className="space-y-1.5 text-[13.5px] leading-relaxed">
        {lines.map((line, idx) => {
          // If line starts with a list marker (e.g. 1. or -)
          if (line.match(/^\d+\.\s/)) {
            return (
              <div key={idx} className="pl-4 -indent-4 text-slate-200">
                <span className="font-semibold text-emerald-400">{line.split(".")[0]}.</span>
                {line.slice(line.indexOf(".") + 1)}
              </div>
            );
          } else if (line.trim().startsWith("-") || line.trim().startsWith("*")) {
            return (
              <div key={idx} className="pl-5 -indent-3 text-slate-300">
                <span className="text-emerald-400 mr-2.5">•</span>
                {line.trim().slice(1).trim()}
              </div>
            );
          }
          return <p key={idx} className="text-slate-300">{line}</p>;
        })}
      </div>
    );
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999] font-sans">
      {/* Collapsed Chat Icon */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="relative flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 shadow-lg hover:shadow-emerald-500/20 text-white cursor-pointer transform hover:scale-105 active:scale-95 transition-all duration-300 border border-emerald-400/20"
        >
          <MessageSquare className="w-6 h-6 animate-pulse" />
          <span className="absolute top-1 right-1 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border border-[#0d1117]"></span>
          </span>
        </button>
      )}

      {/* Expanded Chat Panel */}
      {isOpen && (
        <div className="flex flex-col w-[390px] h-[540px] bg-[#161b22]/95 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl overflow-hidden transform animate-in fade-in slide-in-from-bottom-8 duration-300">
          
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 bg-slate-900 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="p-1 bg-emerald-950/80 rounded-lg border border-emerald-500/30">
                <Sparkles className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h3 className="font-semibold text-[14px] text-white">Relanto Co-Pilot</h3>
                <p className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Active B2B Sales Agent
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2.5">
              <button
                onClick={handleClearChat}
                title="Clear conversation"
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/20 transition-all duration-200"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all duration-200"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto px-4 py-4.5 space-y-4 bg-gradient-to-b from-slate-950/20 to-[#0d1117]/80 scrollbar-thin scrollbar-thumb-slate-800">
            
            {/* Seeded Greetings */}
            {messages.length === 0 && (
              <div className="space-y-4 text-center my-6">
                <div className="mx-auto w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Bot className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-medium text-[14px] text-white">How can I assist your pipeline today?</h4>
                  <p className="text-[11.5px] text-slate-400 max-w-[280px] mx-auto">
                    Ask me about recent triggers, company updates, contact timeframes, or outreach briefs.
                  </p>
                </div>
              </div>
            )}

            {/* Render Cached / Historical Messages */}
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-2.5 max-w-[85%] ${
                  msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                }`}
              >
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 rounded-lg bg-emerald-950/80 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                )}
                
                <div className="space-y-1">
                  <div
                    className={`px-3.5 py-2.5 rounded-2xl shadow-sm border ${
                      msg.role === "user"
                        ? "bg-emerald-600 border-emerald-500 text-white rounded-tr-none"
                        : msg.isError
                        ? "bg-rose-950/30 border-rose-900/50 text-rose-200 rounded-tl-none"
                        : "bg-[#1f2937]/90 border-slate-800 text-slate-200 rounded-tl-none"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <p className="text-[13.5px] leading-relaxed font-medium">{msg.content}</p>
                    ) : (
                      renderMessageContent(msg)
                    )}
                  </div>
                  
                  {/* Sources tag if present */}
                  {msg.metadata?.data_source && (
                    <div className="text-[10px] text-slate-500 font-semibold pl-1">
                      Source: <span className="text-slate-400 font-medium">{msg.metadata.data_source}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Streamed Message (Only if actively streaming) */}
            {streamingMessage && (
              <div className="flex gap-2.5 max-w-[85%] mr-auto">
                <div className="w-7 h-7 rounded-lg bg-emerald-950/80 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="px-3.5 py-2.5 rounded-2xl bg-[#1f2937]/90 border border-slate-800 text-slate-200 rounded-tl-none shadow-sm">
                  {renderMessageContent({ content: streamingMessage })}
                </div>
              </div>
            )}

            {/* Typing Indicator */}
            {isLoading && !streamingMessage && (
              <div className="flex gap-2.5 mr-auto">
                <div className="w-7 h-7 rounded-lg bg-emerald-950/80 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0 animate-bounce">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="px-4 py-3 rounded-2xl bg-[#1f2937]/60 border border-slate-800/80 rounded-tl-none">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce delay-75"></span>
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce delay-150"></span>
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce delay-300"></span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Action Suggestion Prompts */}
          {suggestedActions.length > 0 && (
            <div className="px-4 py-2 border-t border-slate-800 bg-[#0d1117]/80 flex gap-2 overflow-x-auto scrollbar-none flex-shrink-0 whitespace-nowrap">
              {suggestedActions.map((action, idx) => (
                <button
                  key={idx}
                  onClick={() => sendMessage(action)}
                  className="px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300 hover:text-emerald-400 hover:border-emerald-500/40 text-[11px] font-semibold transition-all duration-200 cursor-pointer"
                >
                  {action}
                </button>
              ))}
            </div>
          )}

          {/* Input Area */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="flex items-center gap-2 p-3 bg-slate-900 border-t border-slate-800 flex-shrink-0"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
              placeholder="Ask sales co-pilot..."
              className="flex-1 px-4 py-2 bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-emerald-500 rounded-xl text-[13px] text-slate-200 placeholder-slate-500 focus:outline-none transition-all duration-200"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="flex items-center justify-center p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white cursor-pointer transition-all duration-200"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

        </div>
      )}
    </div>
  );
}
