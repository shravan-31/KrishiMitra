/**
 * KrishiMitra — Premium Login & Registration Page
 *
 * Implements a highly polished, glassmorphic agricultural interface.
 * Features:
 *   - Sliding form transitions via Framer Motion.
 *   - Google OAuth consent integration.
 *   - Email/password register and login with full validation.
 *   - Toast notifications via react-hot-toast.
 *   - Ambient floating agricultural particles.
 *   - Developer bypass login for local testing.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../i18n';
import LanguageSelector from '../components/LanguageSelector';

import { BACKEND_URL } from '../config';

export default function Login() {
  const { t } = useTranslation();
  const { user, loginWithGoogle, loginWithEmail, register } = useAuth();
  const navigate = useNavigate();

  // 'signin' or 'signup'
  const [mode, setMode] = useState('signin');

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  // Inject animation keyframes for particles and glows
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes floatUp {
        0% { transform: translateY(0vh) rotate(0deg); opacity: 0; }
        10% { opacity: 0.15; }
        90% { opacity: 0.12; }
        100% { transform: translateY(-105vh) rotate(360deg); opacity: 0; }
      }
      @keyframes pulseGlow {
        0% { transform: scale(1); opacity: 0.4; }
        50% { transform: scale(1.15); opacity: 0.6; }
        100% { transform: scale(1); opacity: 0.4; }
      }
      .input-glow:focus-within {
        border-color: #4ade80 !important;
        box-shadow: 0 0 15px rgba(74, 222, 128, 0.2) !important;
      }
      .glass-btn {
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .glass-btn:hover {
        background: rgba(255, 255, 255, 0.08) !important;
        border-color: rgba(255, 255, 255, 0.2) !important;
        transform: translateY(-2px);
      }
      .submit-btn {
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .submit-btn:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(16, 185, 129, 0.4);
      }
      .submit-btn:active:not(:disabled) {
        transform: translateY(0);
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Generate floating emojis background (similar to FarmLayout)
  const particles = Array.from({ length: 12 }).map((_, i) => {
    const emojis = ['🌾', '🍂', '🌱', '☀️', '💧'];
    const emoji = emojis[i % emojis.length];
    const left = Math.random() * 100;
    const delay = Math.random() * 10;
    const duration = 12 + Math.random() * 15;
    const size = 1.2 + Math.random() * 1.5;

    return (
      <div
        key={i}
        style={{
          position: 'fixed',
          left: `${left}%`,
          top: '100%',
          fontSize: `${size}rem`,
          animation: `floatUp ${duration}s linear infinite`,
          animationDelay: `${delay}s`,
          opacity: 0,
          zIndex: 0,
          pointerEvents: 'none',
        }}
      >
        {emoji}
      </div>
    );
  });

  // Handle Form Submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password || (mode === 'signup' && !fullName)) {
      toast.error(t('login.fillAllFields'));
      return;
    }

    if (password.length < 6) {
      toast.error(t('login.passwordMinLength'));
      return;
    }

    setLoading(true);
    if (mode === 'signin') {
      const res = await loginWithEmail(email, password);
      setLoading(false);
      if (res.success) {
        toast.success(t('login.loginSuccess'));
        navigate('/dashboard');
      } else {
        toast.error(res.error || t('login.invalidCredentials'));
      }
    } else {
      const res = await register(email, password, fullName);
      setLoading(false);
      if (res.success) {
        toast.success(t('login.registerSuccess'));
        navigate('/dashboard');
      } else {
        toast.error(res.error || t('login.registerFailed'));
      }
    }
  };

  // Quick Developer Bypass
  const handleDevLogin = () => {
    toast.loading(t('login.redirectingDev'));
    window.location.href = `${BACKEND_URL}/auth/dev-login`;
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #020602 0%, #041004 50%, #061a06 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: "'Outfit', 'Inter', system-ui, sans-serif",
        color: '#e2e8f0',
        padding: '1.5rem',
      }}
    >
      {/* Floating agricultural particles */}
      {particles}

      {/* Decorative ambient glowing spot behind the card */}
      <div
        style={{
          position: 'absolute',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, rgba(5, 150, 105, 0) 70%)',
          zIndex: 0,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          animation: 'pulseGlow 8s ease-in-out infinite',
          pointerEvents: 'none',
        }}
      />

      {/* Main Glass Card container */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        style={{
          width: '100%',
          maxWidth: '460px',
          background: 'rgba(10, 26, 10, 0.45)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderRadius: '24px',
          padding: '2.5rem 2.25rem',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
        }}
      >
        {/* Language Selector */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <LanguageSelector variant="pill" />
        </div>

        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <span style={{ fontSize: '3rem', display: 'block', marginBottom: '0.5rem' }}>🌾</span>
          <h1
            style={{
              fontSize: '2rem',
              fontWeight: 800,
              margin: 0,
              background: 'linear-gradient(135deg, #4ade80, #34d399, #22d3ee)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.02em',
            }}
          >
            KrishiMitra
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.5rem', fontWeight: 500 }}>
            {t('login.subtitle')}
          </p>
        </div>

        {/* Form Title & Switching Mode Header */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', marginBottom: '1.75rem' }}>
          <button
            onClick={() => { setMode('signin'); setPassword(''); }}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              borderBottom: mode === 'signin' ? '2px solid #4ade80' : '2px solid transparent',
              color: mode === 'signin' ? '#4ade80' : '#64748b',
              paddingBottom: '0.75rem',
              fontSize: '1rem',
              fontWeight: 700,
              cursor: 'pointer',
              outline: 'none',
              transition: 'all 0.2s',
            }}
          >
            {t('login.signInTab')}
          </button>
          <button
            onClick={() => { setMode('signup'); setPassword(''); }}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              borderBottom: mode === 'signup' ? '2px solid #4ade80' : '2px solid transparent',
              color: mode === 'signup' ? '#4ade80' : '#64748b',
              paddingBottom: '0.75rem',
              fontSize: '1rem',
              fontWeight: 700,
              cursor: 'pointer',
              outline: 'none',
              transition: 'all 0.2s',
            }}
          >
            {t('login.registerTab')}
          </button>
        </div>

        {/* Dynamic sliding forms via AnimatePresence & motion.form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          <AnimatePresence mode="wait">
            {mode === 'signup' && (
              <motion.div
                key="fullName"
                initial={{ opacity: 0, height: 0, y: -10 }}
                animate={{ opacity: 1, height: 'auto', y: 0 }}
                exit={{ opacity: 0, height: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                style={{ overflow: 'hidden' }}
              >
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {t('login.fullName')}
                </label>
                <div
                  className="input-glow"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '12px',
                    padding: '0.75rem 1rem',
                    transition: 'all 0.25s',
                  }}
                >
                  <span style={{ fontSize: '1rem', marginRight: '0.75rem', opacity: 0.6 }}>👤</span>
                  <input
                    type="text"
                    placeholder={t('login.enterFullName')}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    style={{
                      background: 'none',
                      border: 'none',
                      outline: 'none',
                      color: '#fff',
                      width: '100%',
                      fontSize: '0.95rem',
                    }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Email field */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('login.emailAddress')}
            </label>
            <div
              className="input-glow"
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '0.75rem 1rem',
                transition: 'all 0.25s',
              }}
            >
              <span style={{ fontSize: '1rem', marginRight: '0.75rem', opacity: 0.6 }}>✉️</span>
              <input
                type="email"
                placeholder={t('login.enterEmail')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  background: 'none',
                  border: 'none',
                  outline: 'none',
                  color: '#fff',
                  width: '100%',
                  fontSize: '0.95rem',
                }}
              />
            </div>
          </div>

          {/* Password field */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('login.password')}
            </label>
            <div
              className="input-glow"
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '0.75rem 1rem',
                transition: 'all 0.25s',
              }}
            >
              <span style={{ fontSize: '1rem', marginRight: '0.75rem', opacity: 0.6 }}>🔒</span>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  background: 'none',
                  border: 'none',
                  outline: 'none',
                  color: '#fff',
                  width: '100%',
                  fontSize: '0.95rem',
                }}
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="submit-btn"
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '12px',
              padding: '0.9rem',
              fontSize: '1rem',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.75 : 1,
              marginTop: '0.5rem',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '0.5rem',
              outline: 'none',
            }}
          >
            {loading ? (
              <>
                <span
                  style={{
                    width: '18px',
                    height: '18px',
                    border: '2px solid rgba(255,255,255,0.2)',
                    borderTop: '2px solid #fff',
                    borderRadius: '50%',
                    display: 'inline-block',
                    animation: 'floatUp 0.8s linear infinite',
                  }}
                />
                {mode === 'signin' ? t('login.signingIn') : t('login.registering')}
              </>
            ) : mode === 'signin' ? (
              t('login.signInBtn')
            ) : (
              t('login.registerBtn')
            )}
          </button>
        </form>

        {/* Separator line */}
        <div style={{ display: 'flex', alignItems: 'center', margin: '1.75rem 0' }}>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
          <span style={{ padding: '0 0.75rem', fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t('login.orContinueWith')}
          </span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
        </div>

        {/* Google OAuth Button */}
        <button
          onClick={loginWithGoogle}
          className="glass-btn"
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            padding: '0.75rem',
            color: '#fff',
            fontWeight: 600,
            fontSize: '0.95rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            outline: 'none',
          }}
        >
          {/* Custom inline vector Google 'G' logo */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          {t('login.googleSignIn')}
        </button>

        {/* Development bypass link */}
        <div style={{ textAlign: 'center', marginTop: '1.75rem' }}>
          <button
            onClick={handleDevLogin}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748b',
              fontSize: '0.75rem',
              fontWeight: 600,
              textDecoration: 'underline',
              cursor: 'pointer',
              outline: 'none',
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => e.target.style.color = '#ef4444'}
            onMouseLeave={(e) => e.target.style.color = '#64748b'}
          >
            ⚠️ {t('login.devLoginBtn')}
          </button>
        </div>

      </motion.div>
    </div>
  );
}
