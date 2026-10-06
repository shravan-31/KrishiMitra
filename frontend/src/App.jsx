/**
 * KrishiMitra — Root Application Component
 *
 * Sets up:
 *  - AuthProvider (context for user state)
 *  - BrowserRouter with page routes
 *  - PageTransition for animated route changes
 *  - ProtectedRoute for authenticated pages
 */

import React from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import PageTransition from './components/PageTransition';
import ProtectedRoute from './components/ProtectedRoute';

// Import all pages
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Alerts from './pages/Alerts';
import Chat from './pages/Chat';
import Disease from './pages/Disease';
import Pest from './pages/Pest';
import Soil from './pages/Soil';
import Crops from './pages/Crops';
import Yield from './pages/Yield';
import Calendar from './pages/Calendar';
import Health from './pages/Health';
import Market from './pages/Market';
import Expenses from './pages/Expenses';
import Schemes from './pages/Schemes';
import Languages from './pages/Languages';
import Weather from './pages/Weather';
import Login from './pages/Login';
import Report from './pages/Report';


function AnimatedRoutes() {
  const location = useLocation();

  return (
    <PageTransition locationKey={location.pathname}>
      <Routes location={location}>
        {/* Landing Page */}
        <Route path="/" element={<Landing />} />

        {/* Public Login Route */}
        <Route path="/login" element={<Login />} />

        {/* Protected routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/alerts"
          element={
            <ProtectedRoute>
              <Alerts />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <Chat />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chatbot"
          element={
            <ProtectedRoute>
              <Chat />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ai-chat"
          element={
            <ProtectedRoute>
              <Chat />
            </ProtectedRoute>
          }
        />
        <Route
          path="/disease"
          element={
            <ProtectedRoute>
              <Disease />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pest"
          element={
            <ProtectedRoute>
              <Pest />
            </ProtectedRoute>
          }
        />
        <Route
          path="/soil"
          element={
            <ProtectedRoute>
              <Soil />
            </ProtectedRoute>
          }
        />
        <Route
          path="/crops"
          element={
            <ProtectedRoute>
              <Crops />
            </ProtectedRoute>
          }
        />
        <Route
          path="/yield"
          element={
            <ProtectedRoute>
              <Yield />
            </ProtectedRoute>
          }
        />
        <Route
          path="/calendar"
          element={
            <ProtectedRoute>
              <Calendar />
            </ProtectedRoute>
          }
        />
        <Route
          path="/health"
          element={
            <ProtectedRoute>
              <Health />
            </ProtectedRoute>
          }
        />
        <Route
          path="/market"
          element={
            <ProtectedRoute>
              <Market />
            </ProtectedRoute>
          }
        />
        <Route
          path="/expenses"
          element={
            <ProtectedRoute>
              <Expenses />
            </ProtectedRoute>
          }
        />
        <Route
          path="/schemes"
          element={
            <ProtectedRoute>
              <Schemes />
            </ProtectedRoute>
          }
        />
        <Route
          path="/languages"
          element={
            <ProtectedRoute>
              <Languages />
            </ProtectedRoute>
          }
        />
        <Route
          path="/weather"
          element={
            <ProtectedRoute>
              <Weather />
            </ProtectedRoute>
          }
        />
        <Route
          path="/report"
          element={
            <ProtectedRoute>
              <Report />
            </ProtectedRoute>
          }
        />

        {/* Catch-all → dashboard */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </PageTransition>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AnimatedRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
