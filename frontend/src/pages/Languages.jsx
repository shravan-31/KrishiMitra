import React, { useState } from 'react'
import { motion } from 'framer-motion'
import FarmLayout from '../components/FarmLayout'
import toast from 'react-hot-toast'
import { useTranslation, SUPPORTED_LANGUAGES } from '../i18n'
import LanguageSelector from '../components/LanguageSelector'

import { BACKEND_URL } from '../config'

const TARGET_LANGUAGES = [
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

export default function Languages() {
  const { t, i18n } = useTranslation()
  const [text, setText] = useState('')
  const [targetLang, setTargetLang] = useState('hi')
  const [translatedText, setTranslatedText] = useState('')
  const [detectedLang, setDetectedLang] = useState('')
  const [loading, setLoading] = useState(false)

  const handleTranslate = async () => {
    if (!text.trim()) {
      toast.error(t('validation.required'))
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text,
          target_language: targetLang
        })
      })

      if (!res.ok) throw new Error('Translation service failed')
      
      const data = await res.json()
      setTranslatedText(data.translated_text)
      setDetectedLang(data.detected_source_language)
      toast.success(t('messages.analysisCompleted'))
    } catch (err) {
      toast.error(err.message || t('messages.somethingWentWrong'))
    } finally {
      setLoading(false)
    }
  }

  const handleQuickTranslate = (phrase) => {
    setText(phrase)
  }

  const SAMPLE_PHRASES = [
    "Hello! Welcome to KrishiMitra farm services.",
    "The soil is deficient in nitrogen and needs fertilizer.",
    "Fungal infestation detected on the leaves. Spray pesticide immediately.",
    "Heavy rain expected next week. Postpone irrigation schedule."
  ]

  const activeLangObj = SUPPORTED_LANGUAGES.find(l => l.code === i18n.language) || SUPPORTED_LANGUAGES[0]

  return (
    <FarmLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Header */}
        <div>
          <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800 }}>{t('languages.title')}</h1>
          <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '4px' }}>
            {t('languages.subtitle')}
          </p>
        </div>

        {/* Global Platform Language Selector Card */}
        <div className="glass-card" style={{ padding: '1.75rem', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(6, 182, 212, 0.05) 100%)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#34d399' }}>
                🌐 {t('languages.selectLangTitle')}
              </h3>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '4px 0 0' }}>
                {t('languages.selectLangDesc')}
              </p>
            </div>
            <div style={{ padding: '0.4rem 0.85rem', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '20px', fontSize: '0.8rem', color: '#6ee7b7', fontWeight: 600 }}>
              {t('languages.activeNotice', { lang: activeLangObj.nativeName })}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            {SUPPORTED_LANGUAGES.map((lang) => {
              const isSelected = i18n.language === lang.code
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => {
                    i18n.changeLanguage(lang.code)
                    toast.success(t('messages.languageChanged', { lang: lang.nativeName }))
                  }}
                  style={{
                    padding: '1.25rem',
                    borderRadius: '16px',
                    border: isSelected ? '2px solid #10b981' : '1px solid rgba(255, 255, 255, 0.08)',
                    background: isSelected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s',
                    boxShadow: isSelected ? '0 0 20px rgba(16, 185, 129, 0.25)' : 'none'
                  }}
                >
                  <span style={{ fontSize: '2.2rem' }}>{lang.flag}</span>
                  <div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: isSelected ? '#34d399' : '#fff' }}>
                      {lang.nativeName}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                      {lang.label} {isSelected && '✓'}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Core Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'stretch' }}>
          
          {/* Input Panel */}
          <div className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>{t('languages.sourceText')}</h3>
              <p style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '2px' }}>{t('languages.sandboxDesc')}</p>
            </div>

            <textarea
              placeholder={t('languages.typePrompt')}
              value={text}
              onChange={(e) => setText(e.target.value)}
              style={{
                width: '100%',
                height: '150px',
                padding: '1rem',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                color: '#fff',
                outline: 'none',
                resize: 'none',
                fontFamily: "'Inter', sans-serif",
                fontSize: '0.95rem',
                boxSizing: 'border-box'
              }}
            />

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', width: '100%', fontWeight: 700 }}>{t('languages.quickPhrases')}</span>
              {SAMPLE_PHRASES.map((phrase, idx) => (
                <button
                  key={idx}
                  onClick={() => handleQuickTranslate(phrase)}
                  style={{
                    padding: '0.4rem 0.8rem',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '8px',
                    color: '#94a3b8',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '100%'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = '#10b981'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'}
                >
                  {phrase.slice(0, 30)}...
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{t('languages.targetLanguage')}:</span>
                <select
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value)}
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
                >
                  {TARGET_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code} style={{ background: '#0a1a0a' }}>{l.name}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleTranslate}
                disabled={loading}
                className="glow-btn"
                style={{
                  padding: '0.75rem 1.5rem',
                  color: '#fff',
                  fontWeight: 700,
                  borderRadius: '10px'
                }}
              >
                {loading ? t('languages.translating') : t('languages.translateBtn')}
              </button>
            </div>
          </div>

          {/* Output Panel */}
          <div className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>{t('languages.translatedResult')}</h3>
                <p style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '2px' }}>Neural Agronomic Translation</p>
              </div>
              {detectedLang && (
                <span style={{ background: 'rgba(6,182,212,0.1)', color: '#06b6d4', border: '1px solid rgba(6,182,212,0.2)', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700 }}>
                  Source: {detectedLang.toUpperCase()}
                </span>
              )}
            </div>

            <div
              style={{
                flex: 1,
                minHeight: '150px',
                padding: '1rem',
                background: 'rgba(0,0,0,0.15)',
                border: '1px solid rgba(255, 255, 255, 0.04)',
                borderRadius: '12px',
                color: translatedText ? '#fff' : '#64748b',
                fontSize: '1.1rem',
                lineHeight: 1.5,
                whiteSpace: 'pre-line',
                boxSizing: 'border-box'
              }}
            >
              {translatedText || t('common.loading')}
            </div>
            
            <div style={{ marginTop: 'auto', fontSize: '0.75rem', color: '#64748b', lineHeight: 1.4 }}>
              * KrishiMitra multilingual framework ensures 100% offline coverage for primary UI in Marathi, Hindi & English.
            </div>
          </div>

        </div>

      </div>
    </FarmLayout>
  )
}

