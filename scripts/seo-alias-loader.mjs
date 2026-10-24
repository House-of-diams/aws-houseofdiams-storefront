// Test-only module hooks: resolve the "@/..." import alias and extension-less TypeScript files.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export async function resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) {
    const base = path.join(root, specifier.slice(2))
    for (const candidate of [`${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), base]) {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return next(pathToFileURL(candidate).href, context)
    }
  }
  return next(specifier, context)
}
