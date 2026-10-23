import { pathToFileURL, fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

export async function resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) {
    const base = join(root, specifier.slice(2))
    for (const candidate of [base + '.ts', base + '.tsx', join(base, 'index.ts')]) {
      if (existsSync(candidate)) return next(pathToFileURL(candidate).href, context)
    }
  }
  return next(specifier, context)
}
