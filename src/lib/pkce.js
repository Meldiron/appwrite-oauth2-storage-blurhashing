// Minimal PKCE (RFC 7636) helpers using the Web Crypto API.

function base64UrlEncode(bytes) {
  let str = ''
  const arr = new Uint8Array(bytes)
  for (let i = 0; i < arr.length; i++) str += String.fromCharCode(arr[i])
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function randomBytes(length) {
  const arr = new Uint8Array(length)
  crypto.getRandomValues(arr)
  return arr
}

/** A high-entropy cryptographic random string, url-safe. */
export function randomString(length = 64) {
  return base64UrlEncode(randomBytes(length)).slice(0, length)
}

/** Build a PKCE verifier + S256 challenge pair. */
export async function createPkcePair() {
  const verifier = randomString(96)
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  const challenge = base64UrlEncode(digest)
  return { verifier, challenge, method: 'S256' }
}
