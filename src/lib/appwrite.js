// Appwrite data-layer helpers. Uses the official node-appwrite SDK in the
// browser (undici is aliased to native fetch in vite.config.js). Requests are
// authorized with the OAuth2 bearer token and console admin mode.
import { Client, TablesDB, Storage, Query, Project } from 'node-appwrite'

export const DB_ID = 'blurhashes'
export const DB_NAME = 'Blurhashes'
const PAGE = 100
export const BUCKET_HARD_CAP = 1000

/** Console API host for listing OAuth-authorized projects. */
const CONSOLE_HOST = 'https://fra.cloud.appwrite.io'

/**
 * List projects the OAuth token is authorized for.
 * @returns {Promise<{total:number, projects:Array<{$id:string, endpoint:string, name?:string}>}>}
 */
export async function listConsoleProjects(accessToken, { limit = 6, offset = 0, search = '' } = {}) {
  const url = new URL(`${CONSOLE_HOST}/v1/oauth2/console/projects`)
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('offset', String(offset))
  if (search) url.searchParams.set('search', search)

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  })
  if (!res.ok) {
    let msg = `Failed to load projects (${res.status})`
    try {
      const j = await res.json()
      msg = j.message || msg
    } catch {
      /* ignore */
    }
    throw new Error(msg)
  }
  const data = await res.json()
  return { total: data.total ?? (data.projects?.length || 0), projects: data.projects || [] }
}

/** Build an authenticated SDK bundle for a specific project + endpoint. */
export function makeServices({ endpoint, projectId, accessToken }) {
  const client = new Client().setEndpoint(endpoint).setProject(projectId)
  // Console admin mode + OAuth bearer, exactly as the console itself operates.
  client.addHeader('X-Appwrite-Mode', 'admin')
  client.addHeader('Authorization', `Bearer ${accessToken}`)
  return {
    client,
    tablesDB: new TablesDB(client),
    storage: new Storage(client),
  }
}

/* ---------------- project ---------------- */

/**
 * Fetch the current project's details (incl. its human name) via `GET /project`.
 * The client already carries setProject(id) + setEndpoint + admin mode + bearer,
 * so this reads the project from the X-Appwrite-Project context.
 */
export async function getProjectInfo(client) {
  return new Project(client).get()
}

/* ---------------- database ---------------- */

export async function getBlurhashDatabase(tablesDB) {
  return tablesDB.get({ databaseId: DB_ID })
}

export async function createBlurhashDatabase(tablesDB) {
  return tablesDB.create({ databaseId: DB_ID, name: DB_NAME })
}

/* ---------------- buckets ---------------- */

/**
 * List every bucket with offset pagination (pages of 100, up to a hard cap).
 * @returns {Promise<{buckets:Array, capped:boolean}>}
 */
export async function listAllBuckets(storage) {
  const buckets = []
  let offset = 0
  let capped = false
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await storage.listBuckets({
      queries: [Query.limit(PAGE), Query.offset(offset)],
    })
    buckets.push(...res.buckets)
    if (res.buckets.length < PAGE) break
    offset += PAGE
    if (offset >= BUCKET_HARD_CAP) {
      capped = res.total > BUCKET_HARD_CAP
      break
    }
  }
  return { buckets, capped }
}

/* ---------------- tables ---------------- */

/**
 * Return the set of table IDs (from `ids`) that already exist in the DB.
 * Uses batched listTables with Query.equal('$id', [...]) — up to 100 per call.
 */
export async function existingTableIds(tablesDB, ids) {
  const found = new Set()
  for (let i = 0; i < ids.length; i += PAGE) {
    const chunk = ids.slice(i, i + PAGE)
    if (!chunk.length) continue
    const res = await tablesDB.listTables({
      databaseId: DB_ID,
      queries: [Query.equal('$id', chunk), Query.limit(PAGE)],
    })
    for (const t of res.tables) found.add(t.$id)
  }
  return found
}

/** Create a blurhash table for a bucket, with its columns. */
export async function createBlurhashTable(tablesDB, bucketId, bucketName) {
  await tablesDB.createTable({
    databaseId: DB_ID,
    tableId: bucketId,
    name: bucketName ? `Blurhashes · ${bucketName}` : bucketId,
  })
  // Columns. Created sequentially; Appwrite processes them shortly after.
  await tablesDB.createStringColumn({ databaseId: DB_ID, tableId: bucketId, key: 'fileId', size: 255, required: false })
  await tablesDB.createStringColumn({ databaseId: DB_ID, tableId: bucketId, key: 'blurhash', size: 512, required: false })
  await tablesDB.createIntegerColumn({ databaseId: DB_ID, tableId: bucketId, key: 'width', required: false })
  await tablesDB.createIntegerColumn({ databaseId: DB_ID, tableId: bucketId, key: 'height', required: false })
  await tablesDB.createStringColumn({ databaseId: DB_ID, tableId: bucketId, key: 'fileName', size: 512, required: false })
  await tablesDB.createStringColumn({ databaseId: DB_ID, tableId: bucketId, key: 'mimeType', size: 255, required: false })
}

/* ---------------- files ---------------- */

const IMAGE_MIME = /^image\//i

/** List all image files in a bucket (offset pagination). */
export async function listImageFiles(storage, bucketId) {
  const files = []
  let offset = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await storage.listFiles(bucketId, [Query.limit(PAGE), Query.offset(offset)])
    for (const f of res.files) {
      if (IMAGE_MIME.test(f.mimeType || '')) files.push(f)
    }
    if (res.files.length < PAGE) break
    offset += PAGE
    if (offset >= 10000) break // safety cap
  }
  return files
}

/** Map of fileId -> blurhash row for a bucket's table. */
export async function getBlurhashRows(tablesDB, bucketId) {
  const map = new Map()
  let offset = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await tablesDB.listRows({
      databaseId: DB_ID,
      tableId: bucketId,
      queries: [Query.limit(PAGE), Query.offset(offset)],
    })
    for (const row of res.rows) map.set(row.$id, row)
    if (res.rows.length < PAGE) break
    offset += PAGE
    if (offset >= 100000) break
  }
  return map
}

/** Fetch a file's raw bytes (auth-aware) as an ArrayBuffer. */
export async function getFileBytes(storage, bucketId, fileId) {
  return storage.getFileView(bucketId, fileId)
}

/** Upsert a blurhash row keyed by fileId. */
export async function saveBlurhashRow(tablesDB, bucketId, file, hash) {
  return tablesDB.upsertRow({
    databaseId: DB_ID,
    tableId: bucketId,
    rowId: file.$id,
    data: {
      fileId: file.$id,
      blurhash: hash.blurhash,
      width: hash.width,
      height: hash.height,
      fileName: file.name || '',
      mimeType: file.mimeType || '',
    },
  })
}
