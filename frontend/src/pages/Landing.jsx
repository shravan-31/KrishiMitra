import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { useTranslation } from '../i18n';
import LanguageSelector from '../components/LanguageSelector';
import {
  Sprout,
  Activity,
  CloudSun,
  TrendingUp,
  Bot,
  Shield,
  Award,
  BookOpen,
  CheckCircle2,
  HelpCircle,
  ArrowRight,
  Globe,
  Layers,
  MapPin,
  Zap,
  Mail,
  Building,
  User,
  MessageSquare
} from 'lucide-react';

export default function Landing() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('growers'); // 'growers' or 'enterprise'
  
  // FAQ accordion state
  const [openFaq, setOpenFaq] = useState(null);

  // Form states
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    organization: '',
    interest: 'Enterprise Platform',
    message: ''
  });
  const [submitting, setSubmitting] = useState(false);

  // Inject CSS animations and custom classes
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes floatUp {
        0% { transform: translateY(0vh) rotate(0deg); opacity: 0; }
        10% { opacity: 0.15; }
        90% { opacity: 0.1; }
        100% { transform: translateY(-105vh) rotate(360deg); opacity: 0; }
      }
      @keyframes gradientFlow {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
      @keyframes pulseGlow {
        0% { transform: scale(1); opacity: 0.3; }
        50% { transform: scale(1.1); opacity: 0.45; }
        100% { transform: scale(1); opacity: 0.3; }
      }
      .glass-nav {
        background: rgba(2, 6, 2, 0.75);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      }
      .hover-accent:hover {
        color: #f97316 !important; /* Orange accent */
      }
      .premium-btn {
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        font-family: 'Outfit', sans-serif;
      }
      .premium-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 10px 25px rgba(249, 115, 22, 0.35); /* Orange glow */
      }
      .glass-card-landing {
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid rgba(255, 255, 255, 0.05);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border-radius: 24px;
        transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
      }
      .glass-card-landing:hover {
        background: rgba(255, 255, 255, 0.035);
        border-color: rgba(74, 222, 128, 0.2); /* green glow boundary */
        transform: translateY(-5px);
        box-shadow: 0 15px 35px rgba(0, 0, 0, 0.5), 0 0 1px rgba(74, 222, 128, 0.2);
      }
      .input-glow:focus-within {
        border-color: #f97316 !important;
        box-shadow: 0 0 15px rgba(249, 115, 22, 0.15) !important;
      }
      html {
        scroll-behavior: smooth;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Floating background agricultural particles
  const particles = Array.from({ length: 15 }).map((_, i) => {
    const emojis = ['🌾', '🍂', '🌱', '☀️', '💧', '🍊'];
    const emoji = emojis[i % emojis.length];
    const left = Math.random() * 100;
    const delay = Math.random() * 15;
    const duration = 15 + Math.random() * 20;
    const size = 1.2 + Math.random() * 1.5;

    return (
      <div
        key={i}
        style={{
          position: 'absolute',
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

  const handleFormChange = (e) => {
    setContactForm({
      ...contactForm,
      [e.target.name]: e.target.value
    });
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!contactForm.name || !contactForm.email || !contactForm.message) {
      toast.error(t('landing.contactRequiredError'));
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      toast.success(t('landing.contactSuccessToast'));
      setContactForm({
        name: '',
        email: '',
        organization: '',
        interest: 'Enterprise Platform',
        message: ''
      });
    }, 1200);
  };

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #020602 0%, #041004 50%, #061a06 100%)',
        fontFamily: "'Outfit', 'Inter', system-ui, sans-serif",
        color: '#e2e8f0',
        position: 'relative',
        overflowX: 'hidden'
      }}
    >
      {/* Floating particles wrapper */}
      <div style={{ position: 'absolute', width: '100%', height: '100%', overflow: 'hidden', top: 0, left: 0, zIndex: 0, pointerEvents: 'none' }}>
        {particles}
      </div>

      {/* Decorative ambient glowing spots */}
      <div
        style={{
          position: 'absolute',
          width: '600px',
          height: '600px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(16, 185, 129, 0.05) 0%, rgba(5, 150, 105, 0) 70%)',
          zIndex: 0,
          top: '10%',
          right: '-10%',
          pointerEvents: 'none',
          animation: 'pulseGlow 10s ease-in-out infinite',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: '700px',
          height: '700px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(249, 115, 22, 0.04) 0%, rgba(249, 115, 22, 0) 70%)',
          zIndex: 0,
          bottom: '15%',
          left: '-15%',
          pointerEvents: 'none',
          animation: 'pulseGlow 12s ease-in-out infinite',
        }}
      />

      {/* NAVBAR */}
      <header
        className="glass-nav"
        style={{
          position: 'sticky',
          top: 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1.25rem 3rem',
          zIndex: 100
        }}
      >
        {/* Brand Logo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            fontSize: '1.6rem',
            fontWeight: 800,
            background: 'linear-gradient(135deg, #4ade80, #34d399, #f97316)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            cursor: 'pointer'
          }}
          onClick={() => scrollToSection('hero')}
        >
          <span>🌾</span> KrishiMitra
        </div>

        {/* Desktop Navigation Links */}
        <nav style={{ display: 'flex', gap: '2.5rem', alignItems: 'center' }}>
          <button
            onClick={() => scrollToSection('about')}
            className="hover-accent"
            style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', transition: 'color 0.2s' }}
          >
            {t('landing.navAbout')}
          </button>
          <button
            onClick={() => scrollToSection('solutions')}
            className="hover-accent"
            style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', transition: 'color 0.2s' }}
          >
            {t('landing.navSolutions')}
          </button>
          <button
            onClick={() => scrollToSection('benefits')}
            className="hover-accent"
            style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', transition: 'color 0.2s' }}
          >
            {t('landing.navBenefits')}
          </button>
          <button
            onClick={() => scrollToSection('faq')}
            className="hover-accent"
            style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', transition: 'color 0.2s' }}
          >
            {t('landing.navFaq')}
          </button>
          <button
            onClick={() => scrollToSection('contact')}
            className="hover-accent"
            style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', transition: 'color 0.2s' }}
          >
            {t('landing.navContact')}
          </button>
        </nav>

        {/* Enter Platform Button & Language Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <LanguageSelector variant="pill" />
          <button
            onClick={() => navigate(user ? '/dashboard' : '/login')}
            className="premium-btn"
            style={{
              padding: '0.65rem 1.5rem',
              background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '30px',
              fontSize: '0.95rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            {user ? t('landing.signIn') : t('login.googleSignIn')}
          </button>
        </div>
      </header>

      {/* HERO SECTION */}
      <section
        id="hero"
        style={{
          minHeight: '85vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4rem 3rem',
          position: 'relative',
          zIndex: 1
        }}
      >
        <div style={{ maxWidth: '1200px', width: '100%', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '4rem', alignItems: 'center' }}>
          {/* Left Content */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            {/* Promo Badge */}
            <div
              style={{
                background: 'rgba(249, 115, 22, 0.08)',
                border: '1px solid rgba(249, 115, 22, 0.2)',
                borderRadius: '30px',
                padding: '0.35rem 1rem',
                color: '#f97316',
                fontSize: '0.85rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '1.5rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <span>✨</span> {t('landing.badge')}
            </div>

            {/* Main Headline */}
            <h1
              style={{
                fontSize: '3.6rem',
                fontWeight: 800,
                lineHeight: 1.15,
                margin: 0,
                letterSpacing: '-0.02em',
                background: 'linear-gradient(135deg, #ffffff 30%, #a7f3d0 70%, #fdba74 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textAlign: 'left'
              }}
            >
              {t('landing.heroTitle1')} — {t('landing.heroTitle2')}
            </h1>

            {/* Subtitle */}
            <p
              style={{
                fontSize: '1.2rem',
                color: '#94a3b8',
                lineHeight: 1.6,
                marginTop: '1.5rem',
                marginBottom: '2.5rem',
                textAlign: 'left',
                maxWidth: '620px'
              }}
            >
              {t('landing.heroSubtitle')}
            </p>

            {/* CTAs */}
            <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => navigate(user ? '/dashboard' : '/login')}
                className="premium-btn"
                style={{
                  padding: '1rem 2.25rem',
                  background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '30px',
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                {t('landing.launchPlatform')} <ArrowRight size={18} />
              </button>
              <button
                onClick={() => scrollToSection('contact')}
                style={{
                  padding: '1rem 2.25rem',
                  background: 'rgba(255, 255, 255, 0.03)',
                  color: '#fff',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '30px',
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.3s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(255, 255, 255, 0.06)';
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(255, 255, 255, 0.03)';
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                }}
              >
                {t('landing.bookDemo')}
              </button>
            </div>
          </div>

          {/* Right Visual mockup */}
          <div style={{ display: 'flex', justifyContent: 'center', position: 'relative' }}>
            {/* Visual Glass Box */}
            <div
              style={{
                width: '100%',
                maxWidth: '440px',
                background: 'rgba(10, 26, 10, 0.45)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(16px)',
                borderRadius: '24px',
                padding: '2rem',
                boxShadow: '0 30px 60px rgba(0, 0, 0, 0.5)'
              }}
            >
              {/* Telemetry panel simulation */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#4ade80' }}></span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8' }}>{t('landing.aiEngineActive')}</span>
                </div>
                <span style={{ fontSize: '0.75rem', background: 'rgba(74,222,128,0.1)', color: '#4ade80', padding: '0.15rem 0.5rem', borderRadius: '10px', fontWeight: 600 }}>{t('landing.liveVersion')}</span>
              </div>

              {/* Scanner Screen Simulation */}
              <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: '16px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.03)', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{t('landing.diagnosticTarget')}</span>
                  <span style={{ fontSize: '0.85rem', color: '#f97316', fontWeight: 700 }}>{t('landing.tomatoLeafSample')}</span>
                </div>
                <div style={{ height: '140px', background: 'url(https://images.unsplash.com/photo-1592417817098-8f3d6eb19675?auto=format&fit=crop&w=600&q=80)', backgroundSize: 'cover', backgroundPosition: 'center', borderRadius: '10px', overflow: 'hidden', position: 'relative', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'linear-gradient(180deg, rgba(0,0,0,0) 50%, rgba(2, 6, 2, 0.8) 100%)' }} />
                  {/* Scanner line animation */}
                  <div
                    style={{
                      position: 'absolute',
                      width: '100%',
                      height: '2px',
                      background: '#4ade80',
                      boxShadow: '0 0 10px #4ade80',
                      top: '20%',
                      animation: 'scan 3s ease-in-out infinite'
                    }}
                  />
                  <style>{`
                    @keyframes scan {
                      0% { top: 0%; }
                      50% { top: 98%; }
                      100% { top: 0%; }
                    }
                  `}</style>
                </div>
                
                {/* Metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '1rem' }}>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.65rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <div style={{ color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase' }}>{t('landing.confidenceLabel')}</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#4ade80', marginTop: '2px' }}>98.4%</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.65rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <div style={{ color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase' }}>{t('landing.anomalyLabel')}</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f87171', marginTop: '2px' }}>{t('landing.earlyBlightSample')}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ABOUT / WHAT WE DO SECTION */}
      <section
        id="about"
        style={{
          padding: '6rem 3rem',
          background: 'rgba(2, 6, 2, 0.5)',
          borderTop: '1px solid rgba(255, 255, 255, 0.03)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
          position: 'relative',
          zIndex: 1
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5rem', alignItems: 'center' }}>
            {/* Visual Telemetry Chart Mockup */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div
                style={{
                  background: 'rgba(10, 26, 10, 0.45)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  backdropFilter: 'blur(16px)',
                  borderRadius: '24px',
                  padding: '2.25rem',
                  boxShadow: '0 20px 45px rgba(0, 0, 0, 0.4)'
                }}
              >
                <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f97316' }}>
                  <TrendingUp size={20} /> {t('landing.analyticsTitle')}
                </div>
                
                {/* Stylized bar graphs using pure HTML/CSS */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px', fontWeight: 600 }}>
                      <span>{t('landing.yieldIndex')}</span>
                      <span style={{ color: '#4ade80' }}>{t('landing.yieldIndexChange')}</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: '82%', height: '100%', background: 'linear-gradient(90deg, #4ade80, #34d399)', borderRadius: '4px' }}></div>
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px', fontWeight: 600 }}>
                      <span>{t('landing.pestIndex')}</span>
                      <span style={{ color: '#60a5fa' }}>{t('landing.pestStable')}</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: '65%', height: '100%', background: 'linear-gradient(90deg, #60a5fa, #3b82f6)', borderRadius: '4px' }}></div>
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px', fontWeight: 600 }}>
                      <span>{t('landing.npkFactor')}</span>
                      <span style={{ color: '#fb923c' }}>{t('landing.actionRecommended')}</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: '48%', height: '100%', background: 'linear-gradient(90deg, #fb923c, #f97316)', borderRadius: '4px' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Copy Content */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ color: '#f97316', fontWeight: 700, fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>{t('landing.whatWeDo')}</span>
              <h2 style={{ fontSize: '2.6rem', fontWeight: 800, margin: '0 0 1.25rem', lineHeight: 1.2 }}>{t('landing.empoweringTitle')}</h2>
              <p style={{ color: '#94a3b8', lineHeight: 1.6, fontSize: '1.05rem', marginBottom: '1.5rem' }}>
                {t('landing.aboutDesc1')}
              </p>
              <p style={{ color: '#94a3b8', lineHeight: 1.6, fontSize: '1.05rem', marginBottom: '2rem' }}>
                {t('landing.aboutDesc2')}
              </p>
              <button
                onClick={() => scrollToSection('solutions')}
                className="premium-btn"
                style={{
                  padding: '0.75rem 1.75rem',
                  background: 'rgba(249, 115, 22, 0.08)',
                  border: '1px solid rgba(249, 115, 22, 0.25)',
                  color: '#f97316',
                  borderRadius: '30px',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {t('landing.readModules')}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* SOLUTIONS & CAPABILITIES (TABS) */}
      <section
        id="solutions"
        style={{
          padding: '6rem 3rem',
          position: 'relative',
          zIndex: 1
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <span style={{ color: '#4ade80', fontWeight: 700, fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('landing.solutionsBadge')}</span>
            <h2 style={{ fontSize: '2.6rem', fontWeight: 800, margin: '0.5rem 0 1rem' }}>{t('landing.solutionsTitle')}</h2>
            <p style={{ color: '#94a3b8', maxWidth: '600px', margin: '0 auto', fontSize: '1.05rem', lineHeight: 1.5 }}>
              {t('landing.solutionsSubtitle')}
            </p>

            {/* Tabs Selector */}
            <div style={{ display: 'inline-flex', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '30px', padding: '0.35rem', marginTop: '2.5rem' }}>
              <button
                onClick={() => setActiveTab('growers')}
                style={{
                  padding: '0.75rem 2rem',
                  background: activeTab === 'growers' ? 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' : 'none',
                  color: activeTab === 'growers' ? '#fff' : '#94a3b8',
                  border: 'none',
                  borderRadius: '25px',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.3s'
                }}
              >
                {t('landing.tabGrowers')}
              </button>
              <button
                onClick={() => setActiveTab('enterprise')}
                style={{
                  padding: '0.75rem 2rem',
                  background: activeTab === 'enterprise' ? 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' : 'none',
                  color: activeTab === 'enterprise' ? '#fff' : '#94a3b8',
                  border: 'none',
                  borderRadius: '25px',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.3s'
                }}
              >
                {t('landing.tabEnterprise')}
              </button>
            </div>
          </div>

          {/* Tabs Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              {activeTab === 'growers' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '4rem', alignItems: 'center' }}>
                  {/* Left Bullet points */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, color: '#f97316' }}>{t('landing.growersHeroTitle')}</h3>
                    <p style={{ color: '#94a3b8', fontSize: '1.05rem', lineHeight: 1.5, margin: 0 }}>
                      {t('landing.growersHeroDesc')}
                    </p>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                        <CheckCircle2 style={{ color: '#4ade80', flexShrink: 0, marginTop: '2px' }} size={20} />
                        <div>
                          <strong style={{ display: 'block', color: '#fff', fontSize: '1rem' }}>{t('landing.growerBullet1Title')}</strong>
                          <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>{t('landing.growerBullet1Desc')}</span>
                        </div>
                      </li>
                      <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                        <CheckCircle2 style={{ color: '#4ade80', flexShrink: 0, marginTop: '2px' }} size={20} />
                        <div>
                          <strong style={{ display: 'block', color: '#fff', fontSize: '1rem' }}>{t('landing.growerBullet2Title')}</strong>
                          <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>{t('landing.growerBullet2Desc')}</span>
                        </div>
                      </li>
                      <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                        <CheckCircle2 style={{ color: '#4ade80', flexShrink: 0, marginTop: '2px' }} size={20} />
                        <div>
                          <strong style={{ display: 'block', color: '#fff', fontSize: '1rem' }}>{t('landing.growerBullet3Title')}</strong>
                          <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>{t('landing.growerBullet3Desc')}</span>
                        </div>
                      </li>
                    </ul>
                  </div>

                  {/* Right Image */}
                  <div style={{ borderRadius: '20px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
                    <img
                      src="https://images.unsplash.com/photo-1595273670150-db0a3e368157?auto=format&fit=crop&w=600&q=80"
                      alt="Soil testing and farming"
                      style={{ width: '100%', height: '320px', objectFit: 'cover' }}
                    />
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '4rem', alignItems: 'center' }}>
                  {/* Left Bullet points */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, color: '#4ade80' }}>{t('landing.enterpriseHeroTitle')}</h3>
                    <p style={{ color: '#94a3b8', fontSize: '1.05rem', lineHeight: 1.5, margin: 0 }}>
                      {t('landing.enterpriseHeroDesc')}
                    </p>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                        <CheckCircle2 style={{ color: '#4ade80', flexShrink: 0, marginTop: '2px' }} size={20} />
                        <div>
                          <strong style={{ display: 'block', color: '#fff', fontSize: '1rem' }}>{t('landing.enterpriseBullet1Title')}</strong>
                          <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>{t('landing.enterpriseBullet1Desc')}</span>
                        </div>
                      </li>
                      <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                        <CheckCircle2 style={{ color: '#4ade80', flexShrink: 0, marginTop: '2px' }} size={20} />
                        <div>
                          <strong style={{ display: 'block', color: '#fff', fontSize: '1rem' }}>{t('landing.enterpriseBullet2Title')}</strong>
                          <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>{t('landing.enterpriseBullet2Desc')}</span>
                        </div>
                      </li>
                      <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                        <CheckCircle2 style={{ color: '#4ade80', flexShrink: 0, marginTop: '2px' }} size={20} />
                        <div>
                          <strong style={{ display: 'block', color: '#fff', fontSize: '1rem' }}>{t('landing.enterpriseBullet3Title')}</strong>
                          <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>{t('landing.enterpriseBullet3Desc')}</span>
                        </div>
                      </li>
                    </ul>
                  </div>

                  {/* Right Image */}
                  <div style={{ borderRadius: '20px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
                    <img
                      src="https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&q=80"
                      alt="Advanced agronomy testing"
                      style={{ width: '100%', height: '320px', objectFit: 'cover' }}
                    />
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* MODULES SHOWCASE (inspired by PhenomeOne Modules) */}
      <section
        style={{
          padding: '6rem 3rem',
          background: 'rgba(2, 6, 2, 0.4)',
          borderTop: '1px solid rgba(255, 255, 255, 0.03)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
          position: 'relative',
          zIndex: 1
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <span style={{ color: '#f97316', fontWeight: 700, fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('landing.platformModules')}</span>
            <h2 style={{ fontSize: '2.6rem', fontWeight: 800, margin: '0.5rem 0 1rem' }}>{t('landing.featuresTitle')}</h2>
            <p style={{ color: '#94a3b8', maxWidth: '600px', margin: '0 auto', fontSize: '1.05rem', lineHeight: 1.5 }}>
              {t('landing.featuresSubtitle')}
            </p>
          </div>

          {/* Module Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
            
            {/* Card 1: AI Diagnostics */}
            <div className="glass-card-landing" style={{ padding: '2.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ width: '50px', height: '50px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                <Sprout size={24} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>{t('landing.diseaseCardTitle')}</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.5, margin: 0 }}>
                {t('landing.diseaseCardDesc')}
              </p>
            </div>

            {/* Card 2: Soil Analysis */}
            <div className="glass-card-landing" style={{ padding: '2.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ width: '50px', height: '50px', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.25)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22c55e' }}>
                <Layers size={24} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>{t('landing.soilCardTitle')}</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.5, margin: 0 }}>
                {t('landing.soilCardDesc')}
              </p>
            </div>

            {/* Card 3: Weather Advisory */}
            <div className="glass-card-landing" style={{ padding: '2.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ width: '50px', height: '50px', background: 'rgba(14, 165, 233, 0.1)', border: '1px solid rgba(14, 165, 233, 0.25)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0ea5e9' }}>
                <CloudSun size={24} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>{t('landing.weatherCardTitle')}</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.5, margin: 0 }}>
                {t('landing.weatherCardDesc')}
              </p>
            </div>

            {/* Card 4: Yield Prediction */}
            <div className="glass-card-landing" style={{ padding: '2.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ width: '50px', height: '50px', background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.25)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b5cf6' }}>
                <TrendingUp size={24} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>{t('landing.yieldCardTitle')}</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.5, margin: 0 }}>
                {t('landing.yieldCardDesc')}
              </p>
            </div>

            {/* Card 5: Finance & Mandi Tracker */}
            <div className="glass-card-landing" style={{ padding: '2.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ width: '50px', height: '50px', background: 'rgba(249, 115, 22, 0.1)', border: '1px solid rgba(249, 115, 22, 0.25)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f97316' }}>
                <MapPin size={24} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>{t('landing.marketCardTitle')}</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.5, margin: 0 }}>
                {t('landing.marketCardDesc')}
              </p>
            </div>

            {/* Card 6: AI Chat copilot */}
            <div
              className="glass-card-landing"
              onClick={() => navigate('/chat')}
              style={{ padding: '2.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', cursor: 'pointer', transition: 'all 0.3s ease' }}
              title="Click to open KrishiMitra AI Chatbot"
            >
              <div style={{ width: '50px', height: '50px', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.25)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1' }}>
                <Bot size={24} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{t('landing.chatCardTitle')}</span>
                <span style={{ fontSize: '0.8rem', color: '#818cf8', fontWeight: 600 }}>{t('landing.chatNow')}</span>
              </h3>
              <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.5, margin: 0 }}>
                {t('landing.chatCardDesc')}
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* UNIQUE BENEFITS */}
      <section
        id="benefits"
        style={{
          padding: '6rem 3rem',
          position: 'relative',
          zIndex: 1
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '4.5rem' }}>
            <span style={{ color: '#4ade80', fontWeight: 700, fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('landing.benefitsBadge')}</span>
            <h2 style={{ fontSize: '2.6rem', fontWeight: 800, margin: '0.5rem 0 1rem' }}>{t('landing.benefitsTitle')}</h2>
            <p style={{ color: '#94a3b8', maxWidth: '600px', margin: '0 auto', fontSize: '1.05rem', lineHeight: 1.5 }}>
              {t('landing.benefitsSubtitle')}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '2rem' }}>
            
            {/* Benefit 1 */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '0.75rem' }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(249, 115, 22, 0.08)', border: '1px solid rgba(249, 115, 22, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f97316', marginBottom: '0.5rem' }}>
                <Globe size={26} />
              </div>
              <h4 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>{t('landing.benefit4Title')}</h4>
              <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.4, margin: 0 }}>
                {t('landing.benefit4Desc')}
              </p>
            </div>

            {/* Benefit 2 */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '0.75rem' }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(249, 115, 22, 0.08)', border: '1px solid rgba(249, 115, 22, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f97316', marginBottom: '0.5rem' }}>
                <Activity size={26} />
              </div>
              <h4 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>{t('landing.benefit2Title')}</h4>
              <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.4, margin: 0 }}>
                {t('landing.benefit2Desc')}
              </p>
            </div>

            {/* Benefit 3 */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '0.75rem' }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(249, 115, 22, 0.08)', border: '1px solid rgba(249, 115, 22, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f97316', marginBottom: '0.5rem' }}>
                <Zap size={26} />
              </div>
              <h4 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>{t('landing.benefitRapid')}</h4>
              <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.4, margin: 0 }}>
                {t('landing.benefitRapidDesc')}
              </p>
            </div>

            {/* Benefit 4 */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '0.75rem' }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(249, 115, 22, 0.08)', border: '1px solid rgba(249, 115, 22, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f97316', marginBottom: '0.5rem' }}>
                <Shield size={26} />
              </div>
              <h4 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>{t('landing.benefitSecurity')}</h4>
              <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.4, margin: 0 }}>
                {t('landing.benefitSecurityDesc')}
              </p>
            </div>

            {/* Benefit 5 */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '0.75rem' }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(249, 115, 22, 0.08)', border: '1px solid rgba(249, 115, 22, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f97316', marginBottom: '0.5rem' }}>
                <Award size={26} />
              </div>
              <h4 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>{t('landing.benefitSupport')}</h4>
              <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.4, margin: 0 }}>
                {t('landing.benefitSupportDesc')}
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* FAQ SECTION */}
      <section
        id="faq"
        style={{
          padding: '6rem 3rem',
          background: 'rgba(2, 6, 2, 0.5)',
          borderTop: '1px solid rgba(255, 255, 255, 0.03)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
          position: 'relative',
          zIndex: 1
        }}
      >
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <HelpCircle size={32} style={{ color: '#f97316', marginBottom: '0.5rem' }} />
            <h2 style={{ fontSize: '2.4rem', fontWeight: 800, margin: 0 }}>{t('landing.faqTitle')}</h2>
            <p style={{ color: '#94a3b8', marginTop: '0.5rem' }}>{t('landing.faqSubtitle')}</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[
              {
                q: t('landing.faqQ1'),
                a: t('landing.faqA1')
              },
              {
                q: t('landing.faqQ2'),
                a: t('landing.faqA2')
              },
              {
                q: t('landing.faqQ3'),
                a: t('landing.faqA3')
              },
              {
                q: t('landing.faqQ4'),
                a: t('landing.faqA4')
              },
              {
                q: t('landing.faqQ5'),
                a: t('landing.faqA5')
              }
            ].map((item, idx) => (
              <div
                key={idx}
                style={{
                  background: 'rgba(255, 255, 255, 0.01)',
                  border: '1px solid rgba(255,255,255,0.04)',
                  borderRadius: '16px',
                  padding: '1.25rem 1.5rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onClick={() => toggleFaq(idx)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#fff' }}>{item.q}</h4>
                  <span style={{ fontSize: '1.2rem', color: '#f97316', fontWeight: 'bold' }}>
                    {openFaq === idx ? '−' : '+'}
                  </span>
                </div>
                {openFaq === idx && (
                  <p style={{ color: '#94a3b8', marginTop: '0.75rem', lineHeight: 1.5, fontSize: '0.95rem', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '0.75rem' }}>
                    {item.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT / BOOK DEMO SECTION */}
      <section
        id="contact"
        style={{
          padding: '6rem 3rem',
          position: 'relative',
          zIndex: 1
        }}
      >
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '4rem', alignItems: 'center' }}>
            
            {/* Left Info Column */}
            <div>
              <span style={{ color: '#f97316', fontWeight: 700, fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('landing.contactBadge')}</span>
              <h2 style={{ fontSize: '2.4rem', fontWeight: 800, margin: '0.5rem 0 1rem' }}>{t('landing.contactTitle')}</h2>
              <p style={{ color: '#94a3b8', lineHeight: 1.5, marginBottom: '2rem' }}>
                {t('landing.contactSubtitle')}
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Mail style={{ color: '#f97316' }} size={20} />
                  <span style={{ color: '#94a3b8', fontSize: '0.95rem' }}>support@krishimitra.org</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Building style={{ color: '#f97316' }} size={20} />
                  <span style={{ color: '#94a3b8', fontSize: '0.95rem' }}>{t('landing.contactLocation')}</span>
                </div>
              </div>
            </div>

            {/* Right Contact Form */}
            <div
              style={{
                background: 'rgba(10, 26, 10, 0.45)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(16px)',
                borderRadius: '24px',
                padding: '2.5rem',
                boxShadow: '0 20px 45px rgba(0, 0, 0, 0.5)'
              }}
            >
              <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                
                {/* Name */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                    {t('landing.contactNameLabel')} *
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
                      transition: 'all 0.25s'
                    }}
                  >
                    <User style={{ color: '#64748b', marginRight: '0.75rem' }} size={16} />
                    <input
                      type="text"
                      name="name"
                      required
                      placeholder={t('landing.contactNameLabel')}
                      value={contactForm.name}
                      onChange={handleFormChange}
                      style={{ background: 'none', border: 'none', outline: 'none', color: '#fff', width: '100%', fontSize: '0.95rem' }}
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                    {t('landing.contactEmailLabel')} *
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
                      transition: 'all 0.25s'
                    }}
                  >
                    <Mail style={{ color: '#64748b', marginRight: '0.75rem' }} size={16} />
                    <input
                      type="email"
                      name="email"
                      required
                      placeholder="farmer@krishimitra.org"
                      value={contactForm.email}
                      onChange={handleFormChange}
                      style={{ background: 'none', border: 'none', outline: 'none', color: '#fff', width: '100%', fontSize: '0.95rem' }}
                    />
                  </div>
                </div>

                {/* Organization */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                    {t('landing.contactOrgLabel')}
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
                      transition: 'all 0.25s'
                    }}
                  >
                    <Building style={{ color: '#64748b', marginRight: '0.75rem' }} size={16} />
                    <input
                      type="text"
                      name="organization"
                      placeholder={t('landing.contactOrgLabel')}
                      value={contactForm.organization}
                      onChange={handleFormChange}
                      style={{ background: 'none', border: 'none', outline: 'none', color: '#fff', width: '100%', fontSize: '0.95rem' }}
                    />
                  </div>
                </div>

                {/* Interest Dropdown */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                    {t('landing.contactInterestLabel')}
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
                      transition: 'all 0.25s'
                    }}
                  >
                    <select
                      name="interest"
                      value={contactForm.interest}
                      onChange={handleFormChange}
                      style={{ background: 'none', border: 'none', outline: 'none', color: '#fff', width: '100%', fontSize: '0.95rem', cursor: 'pointer' }}
                    >
                      <option style={{ background: '#0a1a0a', color: '#fff' }} value="Enterprise Platform">{t('landing.contactInterestEnterprise')}</option>
                      <option style={{ background: '#0a1a0a', color: '#fff' }} value="Individual Farm Portal">{t('landing.contactInterestIndividual')}</option>
                      <option style={{ background: '#0a1a0a', color: '#fff' }} value="Academic Research Trial">{t('landing.contactInterestResearch')}</option>
                    </select>
                  </div>
                </div>

                {/* Message */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                    {t('landing.contactMsgLabel')} *
                  </label>
                  <div
                    className="input-glow"
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '12px',
                      padding: '0.75rem 1rem',
                      transition: 'all 0.25s'
                    }}
                  >
                    <MessageSquare style={{ color: '#64748b', marginRight: '0.75rem', marginTop: '0.2rem' }} size={16} />
                    <textarea
                      name="message"
                      required
                      rows={3}
                      placeholder={t('landing.contactMsgLabel')}
                      value={contactForm.message}
                      onChange={handleFormChange}
                      style={{ background: 'none', border: 'none', outline: 'none', color: '#fff', width: '100%', fontSize: '0.95rem', resize: 'none', fontFamily: 'inherit' }}
                    />
                  </div>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="premium-btn"
                  style={{
                    padding: '0.9rem',
                    background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '1rem',
                    fontWeight: 700,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    opacity: submitting ? 0.75 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    marginTop: '0.5rem'
                  }}
                >
                  {submitting ? t('landing.contactSubmitting') : t('landing.contactSubmitBtn')}
                </button>
              </form>
            </div>

          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer
        style={{
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          padding: '4rem 3rem 2rem',
          background: 'rgba(2, 6, 2, 0.8)',
          position: 'relative',
          zIndex: 1
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr', gap: '3rem', marginBottom: '3rem' }}>
          
          {/* Logo column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'flex-start' }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f97316' }}>
              🌾 KrishiMitra
            </div>
            <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.5, margin: 0, maxWidth: '280px' }}>
              {t('landing.footerDesc')}
            </p>
          </div>

          {/* Solutions Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h5 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.5rem' }}>{t('landing.footerSolutions')}</h5>
            <button onClick={() => scrollToSection('solutions')} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.9rem', textAlign: 'left', cursor: 'pointer' }} className="hover-accent">{t('landing.tabGrowers')}</button>
            <button onClick={() => scrollToSection('solutions')} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.9rem', textAlign: 'left', cursor: 'pointer' }} className="hover-accent">{t('landing.forResearchers')}</button>
            <button onClick={() => scrollToSection('solutions')} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.9rem', textAlign: 'left', cursor: 'pointer' }} className="hover-accent">{t('landing.diseaseCardTitle')}</button>
          </div>

          {/* Platform Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h5 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.5rem' }}>{t('landing.footerPlatform')}</h5>
            <button onClick={() => navigate('/login')} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.9rem', textAlign: 'left', cursor: 'pointer' }} className="hover-accent">{t('landing.launchPlatform')}</button>
            <button onClick={() => scrollToSection('benefits')} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.9rem', textAlign: 'left', cursor: 'pointer' }} className="hover-accent">{t('landing.navBenefits')}</button>
            <button onClick={() => scrollToSection('faq')} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.9rem', textAlign: 'left', cursor: 'pointer' }} className="hover-accent">{t('landing.navFaq')}</button>
          </div>

          {/* Legal Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h5 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.5rem' }}>{t('landing.footerRegulatory')}</h5>
            <span style={{ color: '#64748b', fontSize: '0.9rem' }}>{t('landing.gdprCompliant')}</span>
            <span style={{ color: '#64748b', fontSize: '0.9rem' }}>{t('landing.isoCertified')}</span>
            <span style={{ color: '#64748b', fontSize: '0.9rem' }}>{t('landing.privacyTerms')}</span>
          </div>

        </div>

        {/* Copy Line */}
        <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
            &copy; {new Date().getFullYear()} {t('landing.footerText')}
          </span>
          <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
            KrishiMitra (AgriMind)
          </span>
        </div>
      </footer>
    </div>
  );
}
