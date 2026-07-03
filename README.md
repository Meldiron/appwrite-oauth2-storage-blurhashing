# Blurhash for Appwrite Storage

A small add-on for Appwrite project developers to **auto-generate [BlurHash](https://blurha.sh)
placeholders** for every image in their Storage buckets. Styled after Wolt's BlurHash product —
light, colorful, and mobile-first.

## Flow

1. **Home** — hero + `Sign in with Appwrite` (OAuth 2.0 Authorization Code + **PKCE**, public client).
2. **/redirect** — exchanges the authorization code for an access token.
3. **/selection** — calls `GET /v1/oauth2/console/projects`.
   - 1 project → straight to `/preparation`.
   - Multiple → a searchable, paginated (limit 6, offset) picker modal.
4. **/preparation** — progress cards that:
   - ensure a `blurhashes` database exists (create button if missing),
   - ensure every bucket has a matching table (batched `listTables` + `Query.equal('$id', […])`,
     100 IDs per call; auto-create the missing ones; buckets paginated in pages of 100 up to 1000).
   - Continue button + a "Don't show again" checkbox.
5. **/dashboard**
   - **Synchronize** — scans all buckets, finds images without a blurhash, generates + stores them,
     with live progress.
   - **Viewer** — search buckets and files; each image shows its blurhash (with a peek at the
     original), or an empty state + one-click generate for files still missing a hash.

## Tech notes

- Uses the official **`node-appwrite`** SDK in the browser. `undici` is aliased to native `fetch`
  (see `vite.config.js` + `src/shims/undici.js`); a tiny `process` shim lives in `index.html`.
- Requests use the OAuth bearer token and console **admin** mode
  (`client.addHeader('X-Appwrite-Mode', 'admin')` + `Authorization: Bearer …`).
- BlurHash is encoded client-side from downsampled pixels (`src/lib/blurhash.js`), rendered with
  `react-blurhash`.

## Configuration

Everything lives in `src/lib/oauth.js`:

| Setting | Value |
| --- | --- |
| Client ID | `storage-blurhasing` |
| Redirect URI | `http://localhost:3000/redirect` |
| Authorize | `https://fra.cloud.appwrite.io/v1/oauth2/console/authorize` |
| Token | `https://fra.cloud.appwrite.io/v1/oauth2/console/token` |

## Develop

```bash
npm install
npm run dev      # http://localhost:3000  (port is fixed — it must match the redirect URI)
npm run build
```
