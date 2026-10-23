// Test-only resolver so lib modules that import '@/...' can run under node:test.
import { register } from 'node:module'
register('./alias-hooks.mjs', import.meta.url)
