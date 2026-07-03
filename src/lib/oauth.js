// OAuth2 Authorization Code + PKCE flow against Appwrite's public console client.
// Endpoints from https://cloud.appwrite.io/v1/oauth2/console/.well-known/openid-configuration
import { createPkcePair } from './pkce'

export const OAUTH = {
  authorizationEndpoint: 'https://fra.cloud.appwrite.io/v1/oauth2/console/authorize',
  tokenEndpoint: 'https://fra.cloud.appwrite.io/v1/oauth2/console/token',
  userinfoEndpoint: 'https://fra.cloud.appwrite.io/v1/oauth2/console/userinfo',
  clientId: 'storage-blurhasing',
  get redirectUri() {
    return `${window.location.origin}/redirect`
  },
  // openid scopes + everything this tool needs to read projects and manage the
  // blurhashes database, tables, rows, buckets and files.
  scopes: [
    'openid',
    'profile',
    'email',
    'project:project.read',
    'project:databases.read',
    'project:databases.write',
    'project:tables.read',
    'project:tables.write',
    'project:columns.read',
    'project:columns.write',
    'project:rows.read',
    'project:rows.write',
    'project:buckets.read',
    'project:files.read',
    'project:files.write',
  ],
}

const STORE_KEY = 'bh_auth'
const PKCE_KEY = 'bh_pkce'

export function getStoredAuth() {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data.accessToken) return null
    return data
  } catch {
    return null
  }
}

export function saveAuth(data) {
  localStorage.setItem(STORE_KEY, JSON.stringify(data))
}

export function clearAuth() {
  localStorage.removeItem(STORE_KEY)
  localStorage.removeItem('bh_project')
  sessionStorage.removeItem(PKCE_KEY)
}

/** Kick off the redirect to Appwrite's authorize endpoint. */
export async function beginLogin() {
  const { verifier, challenge, method } = await createPkcePair()
  const state = crypto.randomUUID()
  sessionStorage.setItem(PKCE_KEY, JSON.stringify({ verifier, state }))

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: OAUTH.clientId,
    redirect_uri: OAUTH.redirectUri,
    scope: OAUTH.scopes.join(' '),
    state,
    code_challenge: challenge,
    code_challenge_method: method,
  })
  window.location.assign(`${OAUTH.authorizationEndpoint}?${params.toString()}`)
}

/** Exchange the authorization code for tokens (public client, no secret). */
export async function completeLogin({ code, state }) {
  const raw = sessionStorage.getItem(PKCE_KEY)
  if (!raw) throw new Error('Missing PKCE state. Please start sign-in again.')
  const { verifier, state: expectedState } = JSON.parse(raw)
  if (!code) throw new Error('No authorization code returned.')
  if (state && expectedState && state !== expectedState) {
    throw new Error('State mismatch — possible CSRF. Please retry sign-in.')
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: OAUTH.redirectUri,
    client_id: OAUTH.clientId,
    code_verifier: verifier,
  })

  const res = await fetch(OAUTH.tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body,
  })

  if (!res.ok) {
    let detail = ''
    try {
      const j = await res.json()
      detail = j.error_description || j.error || JSON.stringify(j)
    } catch {
      detail = await res.text()
    }
    throw new Error(`Token exchange failed (${res.status}): ${detail}`)
  }

  const token = await res.json()
  sessionStorage.removeItem(PKCE_KEY)

  const auth = {
    accessToken: token.access_token,
    refreshToken: token.refresh_token || null,
    tokenType: token.token_type || 'Bearer',
    scope: token.scope || '',
    expiresAt: token.expires_in ? Date.now() + token.expires_in * 1000 : null,
  }
  saveAuth(auth)
  return auth
}

export async function fetchUserInfo(accessToken) {
  const res = await fetch(OAUTH.userinfoEndpoint, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  })
  if (!res.ok) return null
  return res.json()
}
