// Browser shim for `undici`. node-appwrite only touches these members, all of
// which exist natively in modern browsers. Both named and default exports are
// provided so the CJS interop resolves `.fetch` etc. either way.
export const fetch = (...args) => globalThis.fetch(...args)
export const FormData = globalThis.FormData
export const File = globalThis.File
export const Blob = globalThis.Blob
export class Agent {}

export default { fetch, FormData, File, Blob, Agent }
