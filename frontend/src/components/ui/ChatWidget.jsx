import { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, Bot, User, Loader2, Sparkles } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { sendChatMessage } from '../../services/api'

const SUGGESTIONS = [
  'Which companies should I prioritize today?',
  'What are the latest trigger events?',
  'Draft an outreach email for a funding trigger',
  'Which Relanto service fits a cloud migration signal?',
]

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 mb-3">
      <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
        <Bot size={12} className="text-emerald-400" />
      </div>
      <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-bl-sm px-4 py-3">
        <div className="flex gap-1 items-center h-4">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  )
}

function ChatBubble({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex items-end gap-2 mb-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
        isUser
          ? 'bg-blue-500/20 border border-blue-500/30'
          : 'bg-emerald-500/20 border border-emerald-500/30'
      }`}>
        {isUser
          ? <User size={12} className="text-blue-400" />
          : <Bot size={12} className="text-emerald-400" />
        }
      </div>
      <div className={`max-w-[78%] px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap rounded-2xl ${
        isUser
          ? 'bg-blue-600 text-white rounded-br-sm'
          : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-bl-sm'
      }`}>
        {msg.content}
      </div>
    </div>
  )
}

export default function ChatWidget() {
  const { token, user } = useAuth()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [hasGreeted, setHasGreeted] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  // Auto-scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Focus input when panel opens; show greeting on first open
  useEffect(() => {
    if (open) {
      inputRef.current?.focus()
      if (!hasGreeted) {
        setHasGreeted(true)
        setMessages([{
          role: 'assistant',
          content: `Hi ${user?.username || 'there'}! I'm your Sales Intelligence Assistant.\n\nI have live access to your triggers, companies, and outreach data. Ask me anything — or pick a suggestion below.`,
        }])
      }
    }
  }, [open])

  async function send(text) {
    const content = (text || input).trim()
    if (!content || loading) return
    setInput('')

    const next = [...messages, { role: 'user', content }]
    setMessages(next)
    setLoading(true)

    try {
      const data = await sendChatMessage(token, next)
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I ran into an error. Please check the backend connection and try again.',
      }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const showSuggestions = messages.length <= 1 && !loading

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => setOpen(v => !v)}
        aria-label={open ? 'Close chat' : 'Open sales assistant'}
        className="fixed bottom-6 right-6 z-50 w-13 h-13 rounded-full bg-emerald-500 hover:bg-emerald-400 shadow-lg shadow-emerald-500/30 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
        style={{ width: 52, height: 52 }}
      >
        {open
          ? <X size={20} className="text-white" />
          : <MessageCircle size={20} className="text-white" />
        }
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-[76px] right-6 z-50 w-[380px] h-[520px] bg-[#0d1117] border border-slate-700 rounded-2xl shadow-2xl shadow-black/50 flex flex-col overflow-hidden">

          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-slate-900 border-b border-slate-800 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <Sparkles size={15} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-100">Sales Assistant</p>
              <p className="text-xs text-emerald-400">Powered by Groq · Live data</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="ml-auto p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <X size={15} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-0">
            {messages.map((msg, i) => (
              <ChatBubble key={i} msg={msg} />
            ))}
            {loading && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions */}
          {showSuggestions && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5 flex-shrink-0">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-xs px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 hover:border-emerald-500/50 hover:text-emerald-300 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="px-3 pb-3 pt-1 flex-shrink-0 border-t border-slate-800">
            <div className="flex gap-2 items-end bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 focus-within:border-emerald-500/50 transition-colors">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask about triggers, companies, outreach…"
                rows={1}
                disabled={loading}
                className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-500 resize-none outline-none max-h-28 leading-relaxed disabled:opacity-50"
                style={{ lineHeight: '1.5rem' }}
              />
              <button
                onClick={() => send()}
                disabled={!input.trim() || loading}
                className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0"
              >
                {loading
                  ? <Loader2 size={16} className="animate-spin" />
                  : <Send size={16} />
                }
              </button>
            </div>
            <p className="text-center text-[10px] text-slate-600 mt-1.5">
              Press Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>
      )}
    </>
  )
}
