import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import en from './locales/en.json'
import mr from './locales/mr.json'
import hi from './locales/hi.json'

const resources = {
  en,
  mr,
  hi
}

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'mr', label: 'Marathi', nativeName: 'मराठी', flag: '🇮🇳' },
  { code: 'hi', label: 'Hindi', nativeName: 'हिंदी', flag: '🇮🇳' }
]

const STORAGE_KEY = 'krishimitra_lang'
const DEFAULT_LANGUAGE = 'en'

// Helper to resolve nested keys like "disease.title"
function getNestedTranslation(obj, path) {
  if (!obj || !path) return undefined
  const parts = path.split('.')
  let current = obj
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part]
    } else {
      return undefined
    }
  }
  return typeof current === 'string' ? current : undefined
}

// Helper to interpolate variables like {{crop}} or {{count}}
function interpolate(template, variables) {
  if (!template || !variables) return template
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
    return variables[key] !== undefined && variables[key] !== null ? String(variables[key]) : match
  })
}

// Standalone translation function for direct calls
export function translate(key, variables = {}, lang = null) {
  const currentLang = lang || (typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null) || DEFAULT_LANGUAGE
  const currentDictionary = resources[currentLang] || resources[DEFAULT_LANGUAGE]
  
  // 1. Try target language
  let text = getNestedTranslation(currentDictionary, key)

  // 2. Fallback to English
  if (text === undefined && currentLang !== DEFAULT_LANGUAGE) {
    text = getNestedTranslation(resources[DEFAULT_LANGUAGE], key)
  }

  // 3. Fallback to key itself if not found
  if (text === undefined) {
    return key
  }

  return interpolate(text, variables)
}

// Event-based sync for non-React contexts and multi-tab updates
const listeners = new Set()

export const i18n = {
  language: DEFAULT_LANGUAGE,
  languages: ['en', 'mr', 'hi'],
  
  get currentLanguage() {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY) || DEFAULT_LANGUAGE
    }
    return DEFAULT_LANGUAGE
  },

  changeLanguage(newLang) {
    if (!resources[newLang]) {
      console.warn(`[i18n] Language "${newLang}" is not supported. Falling back to "${DEFAULT_LANGUAGE}".`)
      newLang = DEFAULT_LANGUAGE
    }
    this.language = newLang
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, newLang)
      document.documentElement.lang = newLang
    }
    listeners.forEach(fn => fn(newLang))
    return Promise.resolve()
  },

  t(key, variables) {
    return translate(key, variables, this.language)
  }
}

// Initialize stored language
if (typeof window !== 'undefined') {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved && resources[saved]) {
    i18n.language = saved
    document.documentElement.lang = saved
  } else {
    i18n.language = DEFAULT_LANGUAGE
    document.documentElement.lang = DEFAULT_LANGUAGE
  }
}

// React Context for seamless reactivity
const I18nContext = createContext({
  language: DEFAULT_LANGUAGE,
  changeLanguage: () => {},
  t: (key, vars) => key,
  i18n
})

export function I18nProvider({ children }) {
  const [currentLang, setCurrentLang] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY) || DEFAULT_LANGUAGE
    }
    return DEFAULT_LANGUAGE
  })

  useEffect(() => {
    const handleLangChange = (lang) => {
      setCurrentLang(lang)
    }
    listeners.add(handleLangChange)
    return () => listeners.delete(handleLangChange)
  }, [])

  const changeLanguage = useCallback((lang) => {
    i18n.changeLanguage(lang)
  }, [])

  const t = useCallback((key, variables) => {
    return translate(key, variables, currentLang)
  }, [currentLang])

  const contextValue = {
    language: currentLang,
    changeLanguage,
    t,
    i18n: {
      ...i18n,
      language: currentLang,
      changeLanguage
    }
  }

  return React.createElement(I18nContext.Provider, { value: contextValue }, children)
}

// Main Hook for Functional Components
export function useTranslation() {
  const context = useContext(I18nContext)
  if (!context) {
    // Graceful fallback if called outside Provider
    return {
      t: (key, vars) => translate(key, vars, i18n.language),
      i18n: {
        ...i18n,
        language: i18n.language,
        changeLanguage: (l) => i18n.changeLanguage(l)
      }
    }
  }
  return {
    t: context.t,
    i18n: context.i18n,
    ready: true
  }
}

// Default export for i18n setup imports
export default i18n
