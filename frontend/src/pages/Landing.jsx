import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
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
      toast.error('Please complete all required fields.');
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      toast.success('Thank you! Your request has been received. Our team will contact you shortly.');
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
            About Us
          </button>
          <button
            onClick={() => scrollToSection('solutions')}
            className="hover-accent"
            style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', transition: 'color 0.2s' }}
          >
            Solutions
          </button>
          <button
            onClick={() => scrollToSection('benefits')}
            className="hover-accent"
            style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', transition: 'color 0.2s' }}
          >
            Unique Benefits
          </button>
          <button
            onClick={() => scrollToSection('faq')}
            className="hover-accent"
            style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', transition: 'color 0.2s' }}
          >
            FAQ
          </button>
          <button
            onClick={() => scrollToSection('contact')}
            className="hover-accent"
            style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', transition: 'color 0.2s' }}
          >
            Contact
          </button>
        </nav>

        {/* Enter Platform Button */}
        <div>
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
            {user ? 'Enter Platform' : 'Sign In'}
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
              <span>✨</span> Next-Gen Smart Agriculture
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
              The End-to-End Smart Agriculture Intelligence Platform
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
              KrishiMitra connects plant diagnostics, soil analysis, yield forecasts, mandi rates, and weather intelligence in a single unified dashboard, helping growers and agronomy teams make faster, data-driven decisions.
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
                Launch Platform <ArrowRight size={18} />
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
                Book a Demo
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
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8' }}>AI ENGINE ACTIVE</span>
                </div>
                <span style={{ fontSize: '0.75rem', background: 'rgba(74,222,128,0.1)', color: '#4ade80', padding: '0.15rem 0.5rem', borderRadius: '10px', fontWeight: 600 }}>v3.5 Live</span>
              </div>

              {/* Scanner Screen Simulation */}
              <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: '16px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.03)', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Diagnostic Target</span>
                  <span style={{ fontSize: '0.85rem', color: '#f97316', fontWeight: 700 }}>Tomato Leaf #042</span>
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
                    <div style={{ color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase' }}>Confidence</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#4ade80', marginTop: '2px' }}>98.4%</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.65rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <div style={{ color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase' }}>Anomaly</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f87171', marginTop: '2px' }}>Early Blight</div>
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
                  <TrendingUp size={20} /> Analytics & BI Insights
                </div>
                
                {/* Stylized bar graphs using pure HTML/CSS */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px', fontWeight: 600 }}>
                      <span>Yield Index (Acre-to-Quintal ratio)</span>
                      <span style={{ color: '#4ade80' }}>+12.4% vs last season</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: '82%', height: '100%', background: 'linear-gradient(90deg, #4ade80, #34d399)', borderRadius: '4px' }}></div>
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px', fontWeight: 600 }}>
                      <span>Pest Resistance Index</span>
                      <span style={{ color: '#60a5fa' }}>Stable</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: '65%', height: '100%', background: 'linear-gradient(90deg, #60a5fa, #3b82f6)', borderRadius: '4px' }}></div>
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px', fontWeight: 600 }}>
                      <span>NPK Balance Factor</span>
                      <span style={{ color: '#fb923c' }}>Action Recommended</span>
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
              <span style={{ color: '#f97316', fontWeight: 700, fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>What We Do</span>
              <h2 style={{ fontSize: '2.6rem', fontWeight: 800, margin: '0 0 1.25rem', lineHeight: 1.2 }}>Empowering Agriculture With Intelligent Insights</h2>
              <p style={{ color: '#94a3b8', lineHeight: 1.6, fontSize: '1.05rem', marginBottom: '1.5rem' }}>
                KrishiMitra was established to bridge the gap between advanced research-grade AI tools and on-the-ground agricultural activities. We deliver robust software tools tailored to standardise agricultural workflows, prevent crop losses, and enhance long-term food security.
              </p>
              <p style={{ color: '#94a3b8', lineHeight: 1.6, fontSize: '1.05rem', marginBottom: '2rem' }}>
                Our main cloud platform organizes spatial farm layouts, records NPK levels, detects leaf diseases in seconds via optical scanning, forecasts crop calendar stages, logs expenses, and monitors local mandi rates.
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
                Read About Our Modules
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
            <span style={{ color: '#4ade80', fontWeight: 700, fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Solutions Matrix</span>
            <h2 style={{ fontSize: '2.6rem', fontWeight: 800, margin: '0.5rem 0 1rem' }}>Tailored Agricultural Solutions</h2>
            <p style={{ color: '#94a3b8', maxWidth: '600px', margin: '0 auto', fontSize: '1.05rem', lineHeight: 1.5 }}>
              Choose a profile to see how KrishiMitra optimizes workflows based on your agronomic role and operational scale.
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
                For Farmers & Growers
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
                For Agronomists & Enterprise
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
                    <h3 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, color: '#f97316' }}>Maximize Farm Yields & Soil Health</h3>
                    <p style={{ color: '#94a3b8', fontSize: '1.05rem', lineHeight: 1.5, margin: 0 }}>
                      Empowering individual farmers and farming co-operatives with direct, user-friendly diagnostic systems that require zero technical training.
                    </p>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                        <CheckCircle2 style={{ color: '#4ade80', flexShrink: 0, marginTop: '2px' }} size={20} />
                        <div>
                          <strong style={{ display: 'block', color: '#fff', fontSize: '1rem' }}>Instant Disease & Pest Scans</strong>
                          <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Upload leaf images in real-time to get detailed diagnosis and treatment protocols.</span>
                        </div>
                      </li>
                      <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                        <CheckCircle2 style={{ color: '#4ade80', flexShrink: 0, marginTop: '2px' }} size={20} />
                        <div>
                          <strong style={{ display: 'block', color: '#fff', fontSize: '1rem' }}>NPK Soil Advisory & Fertilizer Calculators</strong>
                          <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Enter soil properties to get recommendations tailored to your crop selection.</span>
                        </div>
                      </li>
                      <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                        <CheckCircle2 style={{ color: '#4ade80', flexShrink: 0, marginTop: '2px' }} size={20} />
                        <div>
                          <strong style={{ display: 'block', color: '#fff', fontSize: '1rem' }}>Regional Mandi Price Forecasting</strong>
                          <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Know current crop values across regional mandis to log and maximize sales profits.</span>
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
                    <h3 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, color: '#4ade80' }}>Enterprise R&D & Variety Testing</h3>
                    <p style={{ color: '#94a3b8', fontSize: '1.05rem', lineHeight: 1.5, margin: 0 }}>
                      Providing seed companies, corporate farms, and agronomy researchers with complete workflow transparency, data backups, and multi-spectral indices.
                    </p>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                        <CheckCircle2 style={{ color: '#4ade80', flexShrink: 0, marginTop: '2px' }} size={20} />
                        <div>
                          <strong style={{ display: 'block', color: '#fff', fontSize: '1rem' }}>Multi-Farm Layout & Asset Mapping</strong>
                          <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Manage large geographic grids, boundaries, and regional acreage stats from a single hub.</span>
                        </div>
                      </li>
                      <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                        <CheckCircle2 style={{ color: '#4ade80', flexShrink: 0, marginTop: '2px' }} size={20} />
                        <div>
                          <strong style={{ display: 'block', color: '#fff', fontSize: '1rem' }}>Predictive Yield Modeling</strong>
                          <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Utilize historical telemetry, fertilizer schedules, and meteorological data to project seasonal yields.</span>
                        </div>
                      </li>
                      <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                        <CheckCircle2 style={{ color: '#4ade80', flexShrink: 0, marginTop: '2px' }} size={20} />
                        <div>
                          <strong style={{ display: 'block', color: '#fff', fontSize: '1rem' }}>Real-time Risk Alerts Integration</strong>
                          <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Automatically trigger warnings for pest outbreaks, frost, heat waves, and moisture deficits.</span>
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
            <span style={{ color: '#f97316', fontWeight: 700, fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Platform Modules</span>
            <h2 style={{ fontSize: '2.6rem', fontWeight: 800, margin: '0.5rem 0 1rem' }}>KrishiMitra Core Modules</h2>
            <p style={{ color: '#94a3b8', maxWidth: '600px', margin: '0 auto', fontSize: '1.05rem', lineHeight: 1.5 }}>
              A fully integrated, modular digital solution tailored for diagnostic accuracy and long-term farm tracking.
            </p>
          </div>

          {/* Module Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
            
            {/* Card 1: AI Diagnostics */}
            <div className="glass-card-landing" style={{ padding: '2.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ width: '50px', height: '50px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                <Sprout size={24} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>AI Diagnostics Portal</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.5, margin: 0 }}>
                Instant identification of crop leaf diseases and insect pest classes via neural network image analysis. Includes control advisories.
              </p>
            </div>

            {/* Card 2: Soil Analysis */}
            <div className="glass-card-landing" style={{ padding: '2.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ width: '50px', height: '50px', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.25)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22c55e' }}>
                <Layers size={24} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Soil & Crop Recommendation</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.5, margin: 0 }}>
                Provides intelligent NPK ratios, soil parameter mapping, and suggestions for the most profitable crops to plant based on climate parameters.
              </p>
            </div>

            {/* Card 3: Weather Advisory */}
            <div className="glass-card-landing" style={{ padding: '2.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ width: '50px', height: '50px', background: 'rgba(14, 165, 233, 0.1)', border: '1px solid rgba(14, 165, 233, 0.25)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0ea5e9' }}>
                <CloudSun size={24} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Weather & Alerts Hub</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.5, margin: 0 }}>
                Hyperlocal weather metrics coupled with real-time risk alerts for rainfall thresholds, wind speeds, temperature spikes, and moisture drops.
              </p>
            </div>

            {/* Card 4: Yield Prediction */}
            <div className="glass-card-landing" style={{ padding: '2.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ width: '50px', height: '50px', background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.25)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b5cf6' }}>
                <TrendingUp size={24} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Predictive Yield Modeler</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.5, margin: 0 }}>
                Input farm area, crop class, and irrigation schedule to project estimated seasonal harvest weights using regression algorithms.
              </p>
            </div>

            {/* Card 5: Finance & Mandi Tracker */}
            <div className="glass-card-landing" style={{ padding: '2.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ width: '50px', height: '50px', background: 'rgba(249, 115, 22, 0.1)', border: '1px solid rgba(249, 115, 22, 0.25)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f97316' }}>
                <MapPin size={24} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Market Prices & Expense Logs</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.5, margin: 0 }}>
                Real-time regional mandi rate tracking, seasonal expense ledger logs, and profit-and-loss insights to keep track of crop finances.
              </p>
            </div>

            {/* Card 6: AI Chat copilot */}
            <div className="glass-card-landing" style={{ padding: '2.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ width: '50px', height: '50px', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.25)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1' }}>
                <Bot size={24} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>AI Agronomist Copilot</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.5, margin: 0 }}>
                Instant conversation assistant trained in farming guidelines, sowing schedules, fertilizer applications, and state support schemes.
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
            <span style={{ color: '#4ade80', fontWeight: 700, fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Key Advantages</span>
            <h2 style={{ fontSize: '2.6rem', fontWeight: 800, margin: '0.5rem 0 1rem' }}>Unique Benefits of KrishiMitra</h2>
            <p style={{ color: '#94a3b8', maxWidth: '600px', margin: '0 auto', fontSize: '1.05rem', lineHeight: 1.5 }}>
              Engineered with modern workflows to optimize responsiveness, multi-lingual support, and high enterprise security.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '2rem' }}>
            
            {/* Benefit 1 */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '0.75rem' }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(249, 115, 22, 0.08)', border: '1px solid rgba(249, 115, 22, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f97316', marginBottom: '0.5rem' }}>
                <Globe size={26} />
              </div>
              <h4 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>Multi-Language UI</h4>
              <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.4, margin: 0 }}>
                Instant toggle between regional dialects ensuring equal accessibility.
              </p>
            </div>

            {/* Benefit 2 */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '0.75rem' }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(249, 115, 22, 0.08)', border: '1px solid rgba(249, 115, 22, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f97316', marginBottom: '0.5rem' }}>
                <Activity size={26} />
              </div>
              <h4 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>Integrated Analytics</h4>
              <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.4, margin: 0 }}>
                Built-in charts, historical reports, and seasonal data logs.
              </p>
            </div>

            {/* Benefit 3 */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '0.75rem' }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(249, 115, 22, 0.08)', border: '1px solid rgba(249, 115, 22, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f97316', marginBottom: '0.5rem' }}>
                <Zap size={26} />
              </div>
              <h4 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>Rapid Response</h4>
              <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.4, margin: 0 }}>
                High-speed model execution with immediate scan feedback loops.
              </p>
            </div>

            {/* Benefit 4 */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '0.75rem' }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(249, 115, 22, 0.08)', border: '1px solid rgba(249, 115, 22, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f97316', marginBottom: '0.5rem' }}>
                <Shield size={26} />
              </div>
              <h4 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>Ironclad Security</h4>
              <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.4, margin: 0 }}>
                GDPR-ready data pipelines ensuring complete ownership of farm telemetry.
              </p>
            </div>

            {/* Benefit 5 */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '0.75rem' }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(249, 115, 22, 0.08)', border: '1px solid rgba(249, 115, 22, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f97316', marginBottom: '0.5rem' }}>
                <Award size={26} />
              </div>
              <h4 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>Training & Support</h4>
              <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.4, margin: 0 }}>
                Step-by-step documentation, tutorial logs, and prompt ticket support.
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
            <h2 style={{ fontSize: '2.4rem', fontWeight: 800, margin: 0 }}>Frequently Asked Questions</h2>
            <p style={{ color: '#94a3b8', marginTop: '0.5rem' }}>Got questions? We have answers.</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[
              {
                q: "What is KrishiMitra and how does it compare to other platforms?",
                a: "KrishiMitra is an integrated AI-driven smart agriculture management solution. Unlike disjointed tools, it compiles crop diagnosis, soil parameters, expense Ledgers, and mandi rates in a unified, premium dashboard, giving farmers and enterprises a holistic view of their agricultural workflows."
              },
              {
                q: "How accurate is the leaf disease optical scanner?",
                a: "Our diagnostic model uses optimized deep learning CNN architectures trained on extensive agricultural crop datasets, delivering diagnostic confidence scores of up to 98% for targeted pests and leaf blight diseases."
              },
              {
                q: "Is there offline support for remote fields?",
                a: "Yes. Our systems are built using responsive design models allowing farmers to load offline cache resources to record diagnostic parameters and log expenses, syncing back once connected."
              },
              {
                q: "How can I set up multiple farm territories?",
                a: "Once signed in, you can create and configure boundaries for individual farm zones under the main system, mapping soil traits and size values for separate zones."
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
              <span style={{ color: '#f97316', fontWeight: 700, fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Get In Touch</span>
              <h2 style={{ fontSize: '2.4rem', fontWeight: 800, margin: '0.5rem 0 1rem' }}>Book a Demo of KrishiMitra</h2>
              <p style={{ color: '#94a3b8', lineHeight: 1.5, marginBottom: '2rem' }}>
                See how our intelligence portal can transform your agricultural operations. Schedule a live walkthrough with one of our agronomists.
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Mail style={{ color: '#f97316' }} size={20} />
                  <span style={{ color: '#94a3b8', fontSize: '0.95rem' }}>support@krishimitra.org</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Building style={{ color: '#f97316' }} size={20} />
                  <span style={{ color: '#94a3b8', fontSize: '0.95rem' }}>KrishiMitra AgriTech Labs, Pune, India</span>
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
                    Full Name *
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
                      placeholder="Dani Zamir"
                      value={contactForm.name}
                      onChange={handleFormChange}
                      style={{ background: 'none', border: 'none', outline: 'none', color: '#fff', width: '100%', fontSize: '0.95rem' }}
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                    Email Address *
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
                      placeholder="dani@phenome-networks.com"
                      value={contactForm.email}
                      onChange={handleFormChange}
                      style={{ background: 'none', border: 'none', outline: 'none', color: '#fff', width: '100%', fontSize: '0.95rem' }}
                    />
                  </div>
                </div>

                {/* Organization */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                    Organization
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
                      placeholder="Phenome Seed Ltd"
                      value={contactForm.organization}
                      onChange={handleFormChange}
                      style={{ background: 'none', border: 'none', outline: 'none', color: '#fff', width: '100%', fontSize: '0.95rem' }}
                    />
                  </div>
                </div>

                {/* Interest Dropdown */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                    Primary Interest
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
                      <option style={{ background: '#0a1a0a', color: '#fff' }} value="Enterprise Platform">Enterprise Platform Demo</option>
                      <option style={{ background: '#0a1a0a', color: '#fff' }} value="Individual Farm Portal">Individual Farm Portal</option>
                      <option style={{ background: '#0a1a0a', color: '#fff' }} value="Academic Research Trial">Academic Research Trial</option>
                    </select>
                  </div>
                </div>

                {/* Message */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                    Message *
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
                      placeholder="Hi, I would like to schedule a walk-through..."
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
                  {submitting ? 'Submitting Request...' : 'Book Demo Walkthrough'}
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
              Standardizing agricultural diagnostics and tracking metrics to foster food security and resilient crop yields.
            </p>
          </div>

          {/* Solutions Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h5 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.5rem' }}>Solutions</h5>
            <button onClick={() => scrollToSection('solutions')} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.9rem', textAlign: 'left', cursor: 'pointer' }} className="hover-accent">For Growers</button>
            <button onClick={() => scrollToSection('solutions')} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.9rem', textAlign: 'left', cursor: 'pointer' }} className="hover-accent">For Researchers</button>
            <button onClick={() => scrollToSection('solutions')} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.9rem', textAlign: 'left', cursor: 'pointer' }} className="hover-accent">AI Diagnosis Hub</button>
          </div>

          {/* Platform Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h5 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.5rem' }}>Platform</h5>
            <button onClick={() => navigate('/login')} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.9rem', textAlign: 'left', cursor: 'pointer' }} className="hover-accent">Launch App</button>
            <button onClick={() => scrollToSection('benefits')} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.9rem', textAlign: 'left', cursor: 'pointer' }} className="hover-accent">Core Benefits</button>
            <button onClick={() => scrollToSection('faq')} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.9rem', textAlign: 'left', cursor: 'pointer' }} className="hover-accent">FAQ Help</button>
          </div>

          {/* Legal Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h5 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.5rem' }}>Regulatory</h5>
            <span style={{ color: '#64748b', fontSize: '0.9rem' }}>GDPR Compliant</span>
            <span style={{ color: '#64748b', fontSize: '0.9rem' }}>ISO 27001 Certified</span>
            <span style={{ color: '#64748b', fontSize: '0.9rem' }}>Privacy & Terms</span>
          </div>

        </div>

        {/* Copy Line */}
        <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
            &copy; {new Date().getFullYear()} KrishiMitra Systems. All rights reserved.
          </span>
          <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
            Inspired by Phenome Networks.
          </span>
        </div>
      </footer>
    </div>
  );
}
