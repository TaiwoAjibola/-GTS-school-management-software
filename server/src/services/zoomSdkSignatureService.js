// Zoom Meeting SDK service (server): generates join signature for a meeting.
// Uses Zoom Meeting SDK keys from env (ZOOM_SDK_CLIENT_ID/SECRET).
import crypto from 'node:crypto'

function base64UrlEncode(data) {
  return Buffer.from(data).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// Generates a Meeting SDK "Zoom Web SDK" style join signature (V1: HMAC-based).
// meetingNumber/passcode/password/name/meetingRole.
export const getJoinSignature = async ({ meetingNumber, userName, meetingRole = 'participant', password, count = 10 }) => {
  const clientId = process.env.ZOOM_SDK_CLIENT_ID
  const clientSecret = process.env.ZOOM_SDK_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('Zoom Meeting SDK creds missing: ZOOM_SDK_CLIENT_ID / ZOOM_SDK_CLIENT_SECRET')
  }

  const now = Math.floor(Date.now() / 1000)
  // Per Meeting SDK protocol: signature payload = [zoomAppType?][n meetingNumber][t ts][r role][zd? auth?][p password]
  // z: public key (clientId), n: meetingNumber, t: timestamp, r: meetingRole, zd: signature, za: admin?, zapp: appType
  const parts = [
    '0', // appType 1 = ?; use 0 for web join
    String(meetingNumber),
    String(now),
    String(meetingRole === 'host' ? '0' : '1'),
    String(password || ''),
  ]

  const raw = parts.join('.')
  const signature = base64UrlEncode(crypto.createHmac('sha256', clientSecret).update(raw).digest('hex').slice(0, 28))

  return {
    signature,
    meetingNumber,
    userName,
    meetingRole,
    password,
  }
}

// Fetch an access token from Zoom to validate SDK/app health (best-effort).
let cachedToken = { token: null, expiresAt: 0 }
export const fetchZoomToken = async () => {
  const clientId = process.env.ZOOM_SDK_CLIENT_ID
  const clientSecret = process.env.ZOOM_SDK_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('Zoom Meeting SDK creds missing')
  if (cachedToken.token && cachedToken.expiresAt > Date.now()) return cachedToken.token

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const res = await fetch('https://api.zoom.us/v2/', {
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    method: 'POST',
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
  })
  const json = await res.json()
  if (json.access_token) {
    cachedToken = { token: json.access_token, expiresAt: Date.now() + 8 * 60 * 1000 }
    return json.access_token
  }
  if (json.error) console.warn('[Zoom] token fetch failed:', json.error)
  return null
}

export default { getJoinSignature, fetchZoomToken }
