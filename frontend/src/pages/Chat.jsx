import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useFarmStore } from '../store/farmStore'
import FarmLayout from '../components/FarmLayout'

import { BACKEND_URL } from '../config'

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'हिन्दी (Hindi)' },
  { code: 'mr', name: 'मराठी (Marathi)' },
  { code: 'pa', name: 'ਪੰਜਾਬੀ (Punjabi)' },
  { code: 'gu', name: 'ગુજરાતી (Gujarati)' },
  { code: 'te', name: 'తెలుగు (Telugu)' },
  { code: 'ta', name: 'தமிழ் (Tamil)' },
  { code: 'kn', name: 'ಕನ್ನಡ (Kannada)' },
  { code: 'bn', name: 'বাংলা (Bengali)' },
  { code: 'or', name: 'ଓଡ଼ିଆ (Odia)' },
  { code: 'ml', name: 'മലയാളം (Malayalam)' }
]

const QUICK_CHIPS = [
  { text: 'What is wrong with my crop?', label: '🔍 Diagnostics' },
  { text: 'Recommend fertilizer dosage', label: '🌱 Fertilizer' },
  { text: 'When is the best time to harvest?', label: '🌾 Harvesting' },
  { text: 'Check my government schemes eligibility', label: '🏛️ Schemes' }
]

export default function Chat() {
  const { activeFarm } = useFarmStore()
  const [messages, setMessages] = useState([
    {
      sender: 'ai',
      text: 'Namaste! I am KrishiMitra, your intelligent agricultural assistant. How can I help you manage your farm today?',
      timestamp: new Date()
    }
  ])
  const [inputText, setInputText] = useState('')
  const [selectedLang, setSelectedLang] = useState('en')
  const [isLoading, setIsLoading] = useState(false)
  const [typingText, setTypingText] = useState('')
  const messagesEndRef = useRef(null)

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typingText])

  const typeMessage = (fullText, callback) => {
    let index = 0
    setTypingText('')
    const interval = setInterval(() => {
      setTypingText((prev) => prev + fullText.charAt(index))
      index++
      if (index >= fullText.length) {
        clearInterval(interval)
        if (callback) callback()
      }
    }, 12) // fast typewriter speed
  }

  const fallbackToHttp = async (text) => {
    try {
      const farmId = activeFarm?.id || 0
      const response = await fetch(`${BACKEND_URL}/api/v1/chat/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          farm_id: farmId,
          message: text,
          language: selectedLang
        })
      })

      if (!response.ok) {
        throw new Error(`Chat API error: ${response.status}`)
      }

      const data = await response.json()
      setIsLoading(false)
      const replyText = data.reply || 'Namaste! KrishiMitra received your question.'

      typeMessage(replyText, () => {
        setMessages((prev) => [...prev, {
          sender: 'ai',
          text: replyText,
          timestamp: new Date()
        }])
        setTypingText('')
      })

    } catch (e) {
      console.error('Chat HTTP error:', e)
      setIsLoading(false)
      const errorMsg = 'Namaste! I encountered a connection issue reaching the AI engine. Please verify your connection or try again.'
      setMessages((prev) => [...prev, {
        sender: 'ai',
        text: errorMsg,
        timestamp: new Date()
      }])
    }
  }

  const handleSendMessage = async (textToSend) => {
    const trimmed = textToSend.trim()
    if (!trimmed || isLoading) return

    // Append user message
    const userMsg = { sender: 'user', text: trimmed, timestamp: new Date() }
    setMessages((prev) => [...prev, userMsg])
    setInputText('')
    setIsLoading(true)
    setTypingText('')

    // Safely construct WebSocket URL
    const farmId = activeFarm?.id || 0
    let wsUrl = ''
    try {
      if (BACKEND_URL && BACKEND_URL.startsWith('http')) {
        wsUrl = BACKEND_URL.replace(/^http/, 'ws') + `/api/v1/chat/ws/stream/${farmId}`
      } else {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const host = window.location.host
        const pathPrefix = BACKEND_URL ? (BACKEND_URL.startsWith('/') ? BACKEND_URL : `/${BACKEND_URL}`) : ''
        wsUrl = `${protocol}//${host}${pathPrefix}/api/v1/chat/ws/stream/${farmId}`
      }
      // Resolve localhost to 127.0.0.1 to avoid IPv6 loopback [::1] connection issues
      wsUrl = wsUrl.replace('://localhost', '://127.0.0.1')
    } catch (err) {
      console.warn('Could not construct wsUrl, falling back to HTTP:', err)
      fallbackToHttp(trimmed)
      return
    }

    let wsConnected = false
    let currentReply = ''
    let fallbackTriggered = false

    const doFallback = () => {
      if (!fallbackTriggered) {
        fallbackTriggered = true
        fallbackToHttp(trimmed)
      }
    }

    try {
      const socket = new WebSocket(wsUrl)

      // Timeout if WS doesn't connect in 3.5 seconds
      const timeoutId = setTimeout(() => {
        if (!wsConnected) {
          try { socket.close() } catch (e) {}
          doFallback()
        }
      }, 3500)

      socket.onopen = () => {
        wsConnected = true
        clearTimeout(timeoutId)
        socket.send(JSON.stringify({
          message: trimmed,
          language: selectedLang
        }))
      }

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.token) {
            currentReply += data.token
            setTypingText(currentReply)
          }
          if (data.done) {
            socket.close()
          }
        } catch (e) {
          console.error("WS parsing error", e)
        }
      }

      socket.onclose = () => {
        clearTimeout(timeoutId)
        setIsLoading(false)
        if (currentReply) {
          setMessages((prev) => [...prev, {
            sender: 'ai',
            text: currentReply,
            timestamp: new Date()
          }])
          setTypingText('')
        } else if (!fallbackTriggered) {
          // If WS closed without emitting any reply, fall back to HTTP
          doFallback()
        }
      }

      socket.onerror = () => {
        clearTimeout(timeoutId)
        if (!wsConnected || !currentReply) {
          doFallback()
        }
      }

    } catch (err) {
      console.warn('WebSocket init failed, using HTTP POST:', err)
      doFallback()
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage(inputText)
    }
  }

  return (
    <FarmLayout>
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 130px)', gap: '1rem' }}>
        
        {/* Chat Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800 }}>AI Chat Assistant</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '4px' }}>
              <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Consulting on agricultural analytics</span>
              {activeFarm ? (
                <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700 }}>
                  🟢 Farm: {activeFarm.farm_name}
                </span>
              ) : (
                <span style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700 }}>
                  🌾 General Agricultural Advisor
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Response Language:</span>
            <select
              style={{
                padding: '0.5rem 1rem',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '10px',
                color: '#fff',
                fontSize: '0.9rem',
                outline: 'none',
                cursor: 'pointer'
              }}
              value={selectedLang}
              onChange={(e) => setSelectedLang(e.target.value)}
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code} style={{ background: '#0a1a0a' }}>{l.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Message Panel */}
        <div
          className="glass-card"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            padding: '1.5rem',
            position: 'relative'
          }}
        >
          {/* Messages container */}
          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }}>
            <AnimatePresence initial={false}>
              {messages.map((m, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{
                    display: 'flex',
                    justifyContent: m.sender === 'user' ? 'flex-end' : 'flex-start',
                    width: '100%'
                  }}
                >
                  <div
                    style={{
                      maxWidth: '75%',
                      background: m.sender === 'user' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'rgba(255, 255, 255, 0.03)',
                      border: m.sender === 'user' ? 'none' : '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: m.sender === 'user' ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                      padding: '1rem',
                      boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
                    }}
                  >
                    <div style={{ fontSize: '0.95rem', lineHeight: 1.6, color: '#e2e8f0', whiteSpace: 'pre-line' }}>
                      {m.text}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: m.sender === 'user' ? '#a7f3d0' : '#64748b', textAlign: 'right', marginTop: '6px', fontWeight: 600 }}>
                      {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </motion.div>
              ))}

              {/* Typewriter feedback */}
              {typingText && (
                <div style={{ display: 'flex', justifyContent: 'flex-start', width: '100%' }}>
                  <div
                    style={{
                      maxWidth: '75%',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '20px 20px 20px 4px',
                      padding: '1rem',
                      boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
                    }}
                  >
                    <div style={{ fontSize: '0.95rem', lineHeight: 1.6, color: '#e2e8f0', whiteSpace: 'pre-line' }}>
                      {typingText}
                      <span style={{ display: 'inline-block', width: '2px', height: '15px', background: '#10b981', marginLeft: '2px', animation: 'blink 0.8s infinite' }}></span>
                    </div>
                  </div>
                </div>
              )}

              {/* Loading indicator */}
              {isLoading && !typingText && (
                <div style={{ display: 'flex', justifyContent: 'flex-start', width: '100%' }}>
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      borderRadius: '16px',
                      padding: '0.8rem 1.2rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    <div className="skeleton-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', animation: 'pulse 1.2s infinite ease-in-out' }}></div>
                    <div className="skeleton-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', animation: 'pulse 1.2s infinite ease-in-out', animationDelay: '0.2s' }}></div>
                    <div className="skeleton-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', animation: 'pulse 1.2s infinite ease-in-out', animationDelay: '0.4s' }}></div>
                    <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>KrishiMitra is thinking...</span>
                  </div>
                </div>
              )}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Action Chips */}
          <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.75rem' }}>
            {QUICK_CHIPS.map((chip, i) => (
              <button
                key={i}
                onClick={() => handleSendMessage(chip.text)}
                disabled={isLoading}
                style={{
                  whiteSpace: 'nowrap',
                  padding: '0.5rem 1rem',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: '20px',
                  color: '#94a3b8',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  outline: 'none'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#10b981'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.color = '#94a3b8'; }}
              >
                <span style={{ color: '#10b981', marginRight: '4px' }}>{chip.label}</span> {chip.text}
              </button>
            ))}
          </div>

          {/* Input Area */}
          <div style={{ display: 'flex', gap: '0.75rem', position: 'relative' }}>
            <input
              type="text"
              placeholder={activeFarm ? `Ask about ${activeFarm.farm_name}: diseases, fertilizer, weather...` : "Ask any farming question (e.g., crop diseases, fertilizer NPK, schemes)..."}
              disabled={isLoading}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyPress}
              style={{
                flex: 1,
                padding: '1rem 1.25rem',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '14px',
                color: '#fff',
                fontSize: '0.95rem',
                outline: 'none',
                fontFamily: "'Inter', sans-serif"
              }}
            />
            <button
              onClick={() => handleSendMessage(inputText)}
              disabled={isLoading || !inputText.trim()}
              className="glow-btn"
              style={{
                width: '54px',
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem',
                color: '#fff',
                cursor: (isLoading || !inputText.trim()) ? 'not-allowed' : 'pointer',
                opacity: (isLoading || !inputText.trim()) ? 0.5 : 1
              }}
            >
              ➔
            </button>
          </div>
        </div>
        
        {/* Style injection for typewriter cursors and skeletons */}
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0; }
          }
          @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 0.4; }
            50% { transform: scale(1.2); opacity: 1; }
          }
        `}} />

      </div>
    </FarmLayout>
  )
}
