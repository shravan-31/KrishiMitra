/**
 * KrishiMitra — ProtectedRoute Component
 *
 * Wraps routes that require authentication.
 * Shows loading state while checking auth, redirects to / if not logged in.
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../i18n';

const loadingStyles = {
  container: {
    minHeight: '100vh',
    background: '#0a0f0a',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1.5rem',
  },
  spinner: {
    width: '48px',
    height: '48px',
    border: '3px solid rgba(74, 222, 128, 0.15)',
    borderTop: '3px solid #4ade80',
    borderRadius: '50%',
    animation: 'protectedSpin 0.8s linear infinite',
  },
  text: {
    color: '#4ade80',
    fontFamily: "'Inter', system-ui, sans-serif",
    fontSize: '1rem',
    fontWeight: 500,
    letterSpacing: '0.02em',
  },
  subtext: {
    color: '#64748b',
    fontFamily: "'Inter', system-ui, sans-serif",
    fontSize: '0.85rem',
    marginTop: '-0.75rem',
  },
};

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const { t } = useTranslation();

  if (loading) {
    return (
      <div style={loadingStyles.container}>
        <style>{`
          @keyframes protectedSpin {
            to { transform: rotate(360deg); }
          }
        `}</style>
        <div style={loadingStyles.spinner} />
        <p style={loadingStyles.text}>{t('common.loadingFarmData')}</p>
        <p style={loadingStyles.subtext}>{t('common.authenticating')}</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
