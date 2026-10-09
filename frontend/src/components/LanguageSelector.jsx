import React, { useState, useRef, useEffect } from 'react'
import { useTranslation, SUPPORTED_LANGUAGES } from '../i18n'

export default function LanguageSelector({ variant = 'pill' }) {
  const { i18n } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  const currentLang = SUPPORTED_LANGUAGES.find(l => l.code === i18n.language) || SUPPORTED_LANGUAGES[0]

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (langCode) => {
    i18n.changeLanguage(langCode)
    setIsOpen(false)
  }

  // Variant: direct inline pill buttons (great for headers and sandboxes)
  if (variant === 'pill') {
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          padding: '3px',
          gap: '2px',
          backdropFilter: 'blur(8px)'
        }}
      >
        {SUPPORTED_LANGUAGES.map((lang) => {
          const isActive = i18n.language === lang.code
          return (
            <button
              key={lang.code}
              type="button"
              onClick={() => handleSelect(lang.code)}
              style={{
                padding: '0.4rem 0.75rem',
                borderRadius: '9px',
                border: 'none',
                background: isActive ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'transparent',
                color: isActive ? '#fff' : '#94a3b8',
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap'
              }}
            >
              <span>{lang.flag}</span>
              <span>{lang.nativeName}</span>
            </button>
          )
        })}
      </div>
    )
  }

  // Variant: compact dropdown selector (great for tight mobile headers)
  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 0.85rem',
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '10px',
          color: '#e2e8f0',
          fontSize: '0.85rem',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.2s ease'
        }}
      >
        <span>{currentLang.flag}</span>
        <span>{currentLang.nativeName}</span>
        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>▼</span>
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            background: 'rgba(10, 20, 10, 0.98)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '12px',
            padding: '4px',
            minWidth: '140px',
            zIndex: 1000,
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(12px)'
          }}
        >
          {SUPPORTED_LANGUAGES.map((lang) => {
            const isActive = i18n.language === lang.code
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => handleSelect(lang.code)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  padding: '0.55rem 0.75rem',
                  border: 'none',
                  borderRadius: '8px',
                  background: isActive ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                  color: isActive ? '#34d399' : '#cbd5e1',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.15s ease'
                }}
              >
                <span>{lang.flag}</span>
                <span>{lang.nativeName}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
