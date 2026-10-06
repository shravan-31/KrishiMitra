import { useEffect, useRef } from 'react'
import { useFarmStore } from '../store/farmStore'
import toast from 'react-hot-toast'

import { BACKEND_URL } from '../config'

const MAX_RETRIES = 10
const BASE_DELAY_MS = 1000
const MAX_DELAY_MS = 30000

export function useFarmWebSocket(farmId) {
  const { addAlert, updateHealth } = useFarmStore()
  const socketRef = useRef(null)
  const reconnectTimeoutRef = useRef(null)
  const retriesRef = useRef(0)

  useEffect(() => {
    // Guard: don't connect without a valid numeric farm ID
    if (!farmId || (typeof farmId !== 'number' && isNaN(Number(farmId)))) return

    let isClosed = false

    function connect() {
      if (isClosed) return

      // Determine WebSocket URL based on BACKEND_URL
      let wsUrl
      if (BACKEND_URL.startsWith('http')) {
        wsUrl = BACKEND_URL.replace(/^http/, 'ws') + `/ws/farm/${farmId}`
      } else {
        // Handle relative URLs
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const host = window.location.host
        // Ensure leading slash if BACKEND_URL is relative but doesn't have one
        const pathPrefix = BACKEND_URL ? (BACKEND_URL.startsWith('/') ? BACKEND_URL : `/${BACKEND_URL}`) : ''
        wsUrl = `${protocol}//${host}${pathPrefix}/ws/farm/${farmId}`
      }

      // Resolve localhost to 127.0.0.1 to avoid IPv6 loopback [::1] connection issues in WebSockets
      wsUrl = wsUrl.replace('://localhost', '://127.0.0.1')

      if (retriesRef.current === 0) {
        console.log(`[WS] Connecting to ${wsUrl}`)
      } else {
        console.log(`[WS] Reconnect attempt ${retriesRef.current}/${MAX_RETRIES}`)
      }

      const ws = new WebSocket(wsUrl)
      socketRef.current = ws

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          const eventType = data.event_type || data.type
          if (eventType === 'ping') {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send('pong')
            }
            return
          }

          console.log("WebSocket event received:", data)

          const payload = data.payload || data

          if (!eventType) return

          let newAlert = {
            id: data.id || Math.random().toString(36).substr(2, 9),
            farm_id: farmId,
            alert_type: "SYSTEM",
            severity: payload.severity || "LOW",
            title: "System Update",
            message: "",
            is_read: false,
            created_at: new Date().toISOString()
          }

          switch (eventType) {
            case 'disease_detected': {
              const { disease_name, severity, confidence, health_score } = payload
              const msg = `Disease Detected: ${disease_name} (Confidence: ${confidence}%, Severity: ${severity})`
              toast.error(msg, { duration: 6000 })
              newAlert = {
                ...newAlert,
                alert_type: "DISEASE",
                severity: severity || "HIGH",
                title: "Leaf Disease Detected",
                message: msg
              }
              addAlert(newAlert)
              if (health_score !== undefined) {
                updateHealth(health_score)
              }
              break
            }
            case 'soil_analyzed': {
              const { health_score, recommended_crops } = payload
              const cropsStr = Array.isArray(recommended_crops) ? recommended_crops.join(", ") : String(recommended_crops || "")
              const msg = `Soil Analysis Completed! Health Score: ${health_score}. Recommended Crops: ${cropsStr}`
              toast.success(msg, { duration: 6000 })
              newAlert = {
                ...newAlert,
                alert_type: "SOIL",
                severity: "LOW",
                title: "Soil Report Analyzed",
                message: msg
              }
              addAlert(newAlert)
              if (health_score !== undefined) {
                updateHealth(health_score)
              }
              break
            }
            case 'pest_detected': {
              const { pest_name, level, health_score } = payload
              const msg = `Pest Detected: ${pest_name} (Infestation Level: ${level})`
              toast.error(msg, { duration: 6000 })
              newAlert = {
                ...newAlert,
                alert_type: "PEST",
                severity: level || "HIGH",
                title: "Insect Pest Detected",
                message: msg
              }
              addAlert(newAlert)
              if (health_score !== undefined) {
                updateHealth(health_score)
              }
              break
            }
            case 'weather_alert': {
              const { alerts, weather } = payload
              const alertsStr = Array.isArray(alerts) ? alerts.join(", ") : String(alerts)
              const msg = `Weather Advisory: ${alertsStr}. Temp: ${weather.temp}°C, Humidity: ${weather.humidity}%`
              toast(msg, { icon: '⛅', duration: 5000 })
              newAlert = {
                ...newAlert,
                alert_type: "WEATHER",
                severity: "MEDIUM",
                title: "Weather Advisory Alert",
                message: msg
              }
              addAlert(newAlert)
              break
            }
            case 'health_score_update': {
              const { score, grade } = payload
              updateHealth(score)
              const msg = `Farm health updated: Score ${score} (${grade})`
              toast.success(msg)
              newAlert = {
                ...newAlert,
                alert_type: "HEALTH",
                severity: score < 50 ? "HIGH" : "LOW",
                title: "Farm Health Score Changed",
                message: msg
              }
              addAlert(newAlert)
              break
            }
            case 'price_alert': {
              const { crop, price, mandi, below_msp } = payload
              const msg = `${crop} Price Alert: ₹${price}/qtl at ${mandi || 'local market'}.` + (below_msp ? " (BELOW MSP!)" : "")
              if (below_msp) {
                toast.error(msg, { duration: 5000 })
              } else {
                toast.success(msg)
              }
              newAlert = {
                ...newAlert,
                alert_type: "MARKET",
                severity: below_msp ? "HIGH" : "LOW",
                title: "Market Price Alert",
                message: msg
              }
              addAlert(newAlert)
              break
            }
            case 'yield_predicted': {
              const { predicted_kg, crop } = payload
              const msg = `Yield forecast computed for ${crop || 'crop'}: ${predicted_kg} kg.`
              toast.success(msg)
              newAlert = {
                ...newAlert,
                alert_type: "YIELD",
                severity: "LOW",
                title: "Yield Forecast Ready",
                message: msg
              }
              addAlert(newAlert)
              break
            }
            case 'calendar_update': {
              const msg = payload.message || "Calendar updated."
              toast.success(msg)
              break
            }
            default:
              console.log("Unhandled WebSocket event type:", eventType, payload)
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err)
        }
      }

      ws.onopen = () => {
        console.log("[WS] Connection opened successfully")
        // Reset retry counter on successful connection
        retriesRef.current = 0
      }

      ws.onclose = () => {
        if (isClosed) return

        if (retriesRef.current >= MAX_RETRIES) {
          console.warn(`[WS] Max retries (${MAX_RETRIES}) reached. Giving up. Reload the page to retry.`)
          return
        }

        // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s cap
        const delay = Math.min(BASE_DELAY_MS * Math.pow(2, retriesRef.current), MAX_DELAY_MS)
        retriesRef.current += 1
        console.log(`[WS] Disconnected. Reconnecting in ${(delay / 1000).toFixed(1)}s...`)
        reconnectTimeoutRef.current = setTimeout(connect, delay)
      }

      ws.onerror = () => {
        // Suppress noisy repeated error logs — the onclose handler manages reconnection
        if (retriesRef.current === 0) {
          console.warn("[WS] Connection error (backend may be unreachable)")
        }
      }
    }

    connect()

    return () => {
      isClosed = true
      retriesRef.current = 0
      if (socketRef.current) {
        socketRef.current.close()
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [farmId, addAlert, updateHealth])

  return socketRef.current
}
