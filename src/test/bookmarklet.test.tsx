// @vitest-environment jsdom
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import ImportExport from '../components/ImportExport'
import { BOOKMARKLET_SCRIPT, BOOKMARKLET_URL } from '../bookmarklet'

const bookmarkletJs = readFileSync(resolve('public/bookmarklet.js'), 'utf8')

// Props for rendering ImportExport
const noop = () => {}

describe('bookmarklet', () => {
  test('public/bookmarklet.js parses as valid JavaScript (new Function)', () => {
    // Regression guard: the inline bookmarklet shipped once with an unclosed paren
    // and silently did nothing. The external script must always parse.
    expect(() => new Function(bookmarkletJs)).not.toThrow()
  })

  test('BOOKMARKLET_SCRIPT (the tiny loader) parses as valid JavaScript', () => {
    expect(() => new Function(BOOKMARKLET_SCRIPT)).not.toThrow()
  })

  test('BOOKMARKLET_URL is a javascript: URL wrapping an encoded, parseable script', () => {
    expect(BOOKMARKLET_URL.startsWith('javascript:')).toBe(true)
    const code = decodeURIComponent(BOOKMARKLET_URL.replace(/^javascript:/, ''))
    expect(code).toBe(BOOKMARKLET_SCRIPT)
    expect(() => new Function(code)).not.toThrow()
  })

  test('loader references the deployed bookmarklet.js on GitHub Pages', () => {
    expect(BOOKMARKLET_SCRIPT).toContain('codeswithrobi.github.io/sec-leave-planner/bookmarklet.js')
  })

  test('draggable link href is the real bookmarklet URL, not React 19\'s blocked error', () => {
    // React 19 rewrites javascript: JSX href props to:
    //   javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')
    // The href must be set via DOM setAttribute so dragging saves the real URL.
    render(
      <ImportExport
        onImport={noop}
        onClear={noop}
        hasData={false}
        overrides={[]}
        onAddOverride={noop}
        onRemoveOverride={noop}
        odEntries={[]}
        onAddOD={noop}
        onUpdateOD={noop}
        onRemoveOD={noop}
      />
    )
    const link = screen.getByText('📋 SEC Attendance').closest('a') as HTMLAnchorElement
    expect(link).toBeTruthy()
    expect(link.getAttribute('href')).toBe(BOOKMARKLET_URL)
  })
})