import { describe, expect, test } from 'vitest'

// ak-tokens.css kommt aus der AK-App (dort `npm run sync:design`). Liegt deren Repo neben diesem
// (lokale Entwicklung), muss die Kopie stimmen; sonst (z. B. Build auf Vercel) entfällt der Test.
const own = import.meta.glob<string>('./ak-tokens.css', { query: '?raw', import: 'default', eager: true })
const source = import.meta.glob<string>('../../../aktapp/design/ak-tokens.css', { query: '?raw', import: 'default', eager: true })

describe.skipIf(Object.keys(source).length === 0)('design package', () => {
  test('ak-tokens.css matches the AK app (otherwise run npm run sync:design there)', () => {
    expect(own['./ak-tokens.css']).toBe(source['../../../aktapp/design/ak-tokens.css'])
  })
})
