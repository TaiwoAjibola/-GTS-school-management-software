// Zoom Meeting SDK signature generation (server-side).
// Uses ZOOM_SDK_CLIENT_ID / ZOOM_SDK_CLIENT_SECRET from env.
import crypto from 'node:crypto'

const base64UrlEncode = (input) =>
  Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

const signJwt = (payload, secret) => {
  const header = { alg: 'HS256', typ: 'JWT' }
  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const data = `${encodedHeader}.${encodedPayload}`
  const signature = crypto.createHmac('sha256', secret).update(data).digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `${data}.${signature}`
}

// Returns a Meeting SDK JWT signature string.
export const getJoinSignature = async ({ meetingNumber, meetingRole = 0 }) => {
  const sdkKey = process.env.ZOOM_SDK_CLIENT_ID
  const sdkSecret = process.env.ZOOM_SDK_CLIENT_SECRET
  if (!sdkKey || !sdkSecret) {
    throw new Error('Zoom Meeting SDK credentials missing: set ZOOM_SDK_CLIENT_ID and ZOOM_SDK_CLIENT_SECRET')
  }

  const mn = String(meetingNumber || '').replace(/\s+/g, '')
  if (!mn) throw new Error('Zoom meeting number is required')

  const role = meetingRole === 1 || meetingRole === '1' || meetingRole === 'host' ? 1 : 0
  const iat = Math.floor(Date.now() / 1000) - 30
  const exp = iat + 60 * 60 * 2
  const tokenExp = exp

  return signJwt({ appKey: sdkKey, sdkKey, mn, role, iat, exp, tokenExp }, sdkSecret)
}

export default { getJoinSignature }
