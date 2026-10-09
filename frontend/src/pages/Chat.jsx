import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useFarmStore } from '../store/farmStore'
import FarmLayout from '../components/FarmLayout'
import { useTranslation } from '../i18n'

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

export default function Chat() {
  const { activeFarm } = useFarmStore()
  const { t, i18n } = useTranslation()
  const [selectedLang, setSelectedLang] = useState(i18n.language || 'en')
  const [messages, setMessages] = useState([
    {
      sender: 'ai',
      text: t('chat.initialGreeting'),
      timestamp: new Date()
    }
  ])
  const [inputText, setInputText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [typingText, setTypingText] = useState('')
  const messagesEndRef = useRef(null)

  // Keep selected response language in sync when global app language changes
  useEffect(() => {
    if (i18n.language) {
      setSelectedLang(i18n.language)
    }
  }, [i18n.language])

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

  const getClientFallback = (text, lang) => {
    const q = text.toLowerCase()
    if (lang === 'mr') {
      if (q.includes('खत') || q.includes('fertilizer') || q.includes('npk') || q.includes('युरिया')) {
        return "नमस्कार शेतकरी बंधू! पिकाच्या संतुलित पोषणासाठी माती परीक्षणानुसार (Soil Health Card) 4:2:1 प्रमाणात NPK खतांचा वापर करा. रासायनिक खतांसोबत एकरी 2-3 ट्रॉली चांगले कुजलेले शेणखत अवश्य द्या."
      }
      if (q.includes('रोग') || q.includes('disease') || q.includes('पान') || q.includes('पिवळे') || q.includes('बुरशी')) {
        return "नमस्कार! रोगग्रस्त पाने तत्काळ शेतातून काढून नष्ट करा. प्रतिबंधात्मक उपायासाठी 5 मिली निंबोळी अर्क (Neem Oil 1500 ppm) किंवा ट्रायकोडर्मा व्हिरिडी प्रति लिटर पाण्यात मिसळून फवारणी करावी. संशयास्पद रोगांसाठी स्थानिक कृषी विज्ञान केंद्राशी (KVK) संपर्क साधा."
      }
      if (q.includes('कीड') || q.includes('pest') || q.includes('अळी') || q.includes('मावा') || q.includes('तुडतुडे')) {
        return "नमस्कार! रसशोषक किडींच्या नियंत्रणासाठी एकरी 10-15 पिवळे व निळे चिकट सापळे (Sticky Traps) लावा आणि जैविक नियंत्रणासाठी 5% निंबोळी अर्काची फवारणी करा."
      }
      if (q.includes('योजना') || q.includes('scheme') || q.includes('अनुदान') || q.includes('पीएम')) {
        return "नमस्कार! शेतकऱ्यांसाठी प्रमुख शासकीय योजना:\n• पीएम-किसान (PM-KISAN): वर्षाला ₹6,000 थेट बँक खात्यात.\n• पीएम पीक विमा योजना (PMFBY): प्रतिकूल हवामानात पीक नुकसान भरपाई.\n• मागेल त्याला शेततळे व ठिबक सिंचनासाठी 80% पर्यंत शासकीय अनुदान."
      }
      return "नमस्कार! मी कृषीमित्र (KrishiMitra) - आपला AI शेती सल्लागार आहे.\nमी खालील विषयांवर संपूर्ण मार्गदर्शन करतो:\n• पिकांवरील रोग व कीड नियंत्रण\n• माती परीक्षण व रासायनिक खतांचे प्रमाण (NPK)\n• पाणी व्यवस्थापन व दुष्काळ संरक्षण\n• शासकीय कृषी योजना (PM-KISAN, PMFBY)\n\nआपल्या पिकाबद्दल कोणताही प्रश्न निःसंकोच विचारा!"
    }

    if (lang === 'hi') {
      if (q.includes('खाद') || q.includes('fertilizer') || q.includes('npk')) {
        return "नमस्ते किसान भाई! फसल के संतुलित पोषण के लिए मृदा स्वास्थ्य कार्ड (Soil Health Card) के अनुसार 4:2:1 अनुपात में NPK दें। रासायनिक खाद के साथ 2-3 ट्रॉली देशी गोबर खाद अवश्य मिलाएं।"
      }
      if (q.includes('रोग') || q.includes('disease') || q.includes('पत्ते') || q.includes('पीला')) {
        return "नमस्ते! रोगग्रस्त पत्तियों को तुरंत खेत से हटाएं। रोकथाम के लिए 5 मि.ली. नीम का तेल (Neem Oil 1500 ppm) प्रति लीटर पानी में मिलाकर छिड़काव करें। गंभीर समस्या में KVK केंद्र से संपर्क करें।"
      }
      if (q.includes('कीट') || q.includes('pest') || q.includes('इल्ली')) {
        return "नमस्ते! रसचूसक कीटों के लिए पीले चिपचिपे कार्ड (Yellow Sticky Traps - 10-15 प्रति एकड़) लगाएं और जैविक नियंत्रण हेतु नीम अर्क (5%) का छिड़काव करें।"
      }
      if (q.includes('योजना') || q.includes('scheme') || q.includes('सब्सिडी') || q.includes('सरकारी')) {
        return "नमस्ते! भारतीय किसानों के लिए मुख्य सरकारी योजनाएं:\n• PM-KISAN: ₹6,000 प्रति वर्ष 3 किस्तों में प्रत्यक्ष आय सहायता।\n• PMFBY: मौसम जोखिम के विरुद्ध कम प्रीमियम पर फसल बीमा।\n• किसान क्रेडिट कार्ड (KCC): 4% रियायती ब्याज दर पर कृषि ऋण।"
      }
      return "नमस्ते किसान भाई! मैं कृषि मित्र (KrishiMitra) हूँ। मैं फसल सुरक्षा, खाद प्रबंधन, मौसम सलाह, कीट-रोग निदान और सरकारी योजनाओं (PM-KISAN, PMFBY) में सहायता कर सकता हूँ।"
    }

    if (q.includes('fertilizer') || q.includes('npk') || q.includes('urea') || q.includes('dosage')) {
      return "Namaste! For optimal crop nutrition:\n1. Follow your Soil Health Card recommendation (Standard cereal NPK ratio is ~4:2:1).\n2. Incorporate 2-3 tonnes of farmyard manure or vermicompost per acre.\n3. Split Urea applications into 2-3 top-dressings rather than applying all at once."
    }
    if (q.includes('disease') || q.includes('fungus') || q.includes('blight') || q.includes('yellow') || q.includes('leaf')) {
      return "Namaste! For safe crop disease management:\n1. Prune and dispose of heavily infected leaves to stop spore spread.\n2. Apply organic Neem Oil (1500 ppm at 5ml/L water) or Trichoderma viride.\n3. Never spray unverified chemicals on uncertain diagnoses; visit your local KVK with a leaf sample."
    }
    if (q.includes('pest') || q.includes('insect') || q.includes('aphid') || q.includes('worm')) {
      return "Namaste! For Integrated Pest Management (IPM):\n1. Erect Yellow Sticky Traps (10-15 per acre) for whiteflies and aphids.\n2. Apply 5% Neem Seed Kernel Extract (NSKE) as an organic deterrent.\n3. Spray in calm, windless conditions wearing protective masks and gloves."
    }
    if (q.includes('scheme') || q.includes('pmkisan') || q.includes('subsidy') || q.includes('government')) {
      return "Namaste! Key welfare schemes for Indian growers:\n• PM-KISAN: Direct income support of ₹6,000/year in 3 tranches.\n• PMFBY: Low-cost crop insurance against weather hazards.\n• Kisan Credit Card (KCC): Concessional 4% crop loan."
    }
    return "Namaste! I am KrishiMitra, your AI agricultural assistant.\nI provide instant guidance on:\n• Crop disease remedies & organic prevention\n• Fertilizer dosages (NPK) & soil wellness\n• Integrated Pest Management (IPM)\n• Government welfare schemes (PM-KISAN, PMFBY)\n\nFeel free to ask any specific question about your crop!"
  }

  const fallbackToHttp = async (text) => {
    const farmId = activeFarm?.id || 0
    // Try multiple possible paths to guarantee connection even behind proxies
    const candidateEndpoints = [
      `${BACKEND_URL}/api/v1/chat/message`,
      `${BACKEND_URL}/api/chat/message`,
      `${BACKEND_URL}/api/v1/chat`,
      `${BACKEND_URL}/api/chat`,
      '/api/v1/chat/message',
      '/api/chat/message',
      '/api/v1/chat',
      '/api/chat'
    ].filter((v, i, a) => Boolean(v) && a.indexOf(v) === i)

    let replyText = null

    for (const ep of candidateEndpoints) {
      try {
        const response = await fetch(ep, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            farm_id: farmId,
            message: text,
            language: selectedLang
          })
        })
        if (response.ok) {
          const data = await response.json()
          if (data && data.reply) {
            replyText = data.reply
            break
          }
        }
      } catch (err) {
        // try next endpoint
      }
    }

    if (!replyText) {
      // Offline expert knowledge base
      replyText = getClientFallback(text, selectedLang)
    }

    setIsLoading(false)
    typeMessage(replyText, () => {
      setMessages((prev) => [...prev, {
        sender: 'ai',
        text: replyText,
        timestamp: new Date()
      }])
      setTypingText('')
    })
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
            <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800 }}>{t('chat.title')}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '4px' }}>
              <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{t('chat.consultingAnalytics')}</span>
              {activeFarm ? (
                <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700 }}>
                  🟢 {activeFarm.farm_name}
                </span>
              ) : (
                <span style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700 }}>
                  🌾 {t('chat.generalAdvisor')}
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{t('chat.responseLanguage')}</span>
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
                    <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>{t('chat.thinkingStatus')}</span>
                  </div>
                </div>
              )}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Action Chips */}
          <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.75rem' }}>
            {[
              { text: t('chat.chipDiagnostics'), label: t('chat.chipDiagnosticsLabel') },
              { text: t('chat.chipFertilizer'), label: t('chat.chipFertilizerLabel') },
              { text: t('chat.chipHarvesting'), label: t('chat.chipHarvestingLabel') },
              { text: t('chat.chipSchemes'), label: t('chat.chipSchemesLabel') }
            ].map((chip, i) => (
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
              placeholder={activeFarm ? `${activeFarm.farm_name}: ${t('chat.placeholder')}` : t('chat.placeholder')}
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
