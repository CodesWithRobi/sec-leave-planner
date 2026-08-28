import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, test } from 'vitest'

// vitest runs with cwd = project root
const integrationSrc = readFileSync(resolve('src/components/ImportExport.tsx'), 'utf8')
const bookmarkletJs = readFileSync(resolve('public/bookmarklet.js'), 'utf8')

describe('bookmarklet', () => {
  test('public/bookmarklet.js parses as valid JavaScript (new Function)', () => {
    // Regression guard: the inline bookmarklet shipped once with an unclosed paren
    // and silently did nothing. The external script must always parse.
    expect(() => new Function(bookmarkletJs)).not.toThrow()
  })

  test('BOOKMARKLET_SCRIPT (the tiny loader) parses as valid JavaScript', () => {
    const m = integrationSrc.match(/const BOOKMARKLET_SCRIPT = '([^']*)'/)
    expect(m).toBeTruthy()
    const loader = decodeURIComponent(m![1])
    expect(() => new Function(loader)).not.toThrow()
  })

  test('BOOKMARKLET_URL is a javascript: URL wrapping an encoded, parseable script', () => {
    const m = integrationSrc.match(/const BOOKMARKLET_URL = '([^']*)'/)
    expect(m).toBeTruthy()
    const url = m![1]
    expect(url.startsWith('javascript:')).toBe(true)
    const code = decodeURIComponent(url.replace(/^javascript:/, ''))
    expect(() => new Function(code)).not.toThrow()
  })

  test('loader references the deployed bookmarklet.js on GitHub Pages', () => {
    const m = integrationSrc.match(/const BOOKMARKLET_SCRIPT = '([^']*)'/)
    const loader = decodeURIComponent(m![1])
    expect(loader).toContain('codeswithrobi.github.io/sec-leave-planner/bookmarklet.js')
  })
})