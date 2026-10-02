import { describe, expect, it } from 'vitest'
import { LocalBrandRepository, type BrandRepository } from '../repositories/brandRepository'
import type { StorageService } from '../services/storageService'
import { THEME_PRESETS, type BrandDocument, type BrandTokens } from '../models/brandMirrorModels'

class MemoryStorage implements StorageService {
  raw: string | null = null
  read(): string | null { return this.raw }
  write(value: string): void { this.raw = value }
}

const studioTokens: BrandTokens = THEME_PRESETS.studio.tokens
const nightTokens: BrandTokens = THEME_PRESETS.night.tokens

describe('LocalBrandRepository migration', () => {
  it('migrates a v1 document into theme plus sparse overrides', () => {
    const storage = new MemoryStorage()
    const v1 = {
      version: 1,
      theme: 'studio',
      tokens: { ...studioTokens, primary: '#123456' },
      versions: [],
    }
    storage.raw = JSON.stringify(v1)
    const repository: BrandRepository = new LocalBrandRepository(storage)
    const loaded = repository.load()
    expect(loaded?.version).toBe(2)
    expect(loaded?.theme).toBe('studio')
    expect(loaded?.overrides).toEqual({ primary: '#123456' })
  })

  it('keeps a v1 document fully on-theme with no overrides when nothing was changed', () => {
    const storage = new MemoryStorage()
    storage.raw = JSON.stringify({ version: 1, theme: 'night', tokens: nightTokens, versions: [] })
    const loaded = new LocalBrandRepository(storage).load()
    expect(loaded?.overrides).toEqual({})
    expect(loaded?.theme).toBe('night')
  })

  it('round-trips a v2 document through save and load', () => {
    const storage = new MemoryStorage()
    const repository = new LocalBrandRepository(storage)
    const document: BrandDocument = { version: 2, theme: 'editorial', overrides: { typeScale: [12, 14, 16, 22, 30, 48] }, versions: [] }
    repository.save(document)
    const loaded = repository.load()
    expect(loaded?.theme).toBe('editorial')
    expect(loaded?.overrides.typeScale).toEqual([12, 14, 16, 22, 30, 48])
  })

  it('returns null for malformed storage', () => {
    const storage = new MemoryStorage()
    storage.raw = '{not json'
    expect(new LocalBrandRepository(storage).load()).toBeNull()
  })
})
