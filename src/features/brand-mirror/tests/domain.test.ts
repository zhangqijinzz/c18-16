import { describe, expect, it } from 'vitest'
import { clampTokenValues, contrastRatio, customizedGroups, deriveOverrides, pruneOverrides, resolveTokens, validateTokens } from '../domain/brandRules'
import { INITIAL_TOKENS, THEME_PRESETS } from '../models/brandMirrorModels'
import { LocalBrandRepository } from '../repositories/brandRepository'
import type { StorageService } from '../services/storageService'

describe('brand token rules', () => {
  it('calculates a readable contrast ratio', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 1)
    expect(contrastRatio('#F15A47', '#24324A')).toBeGreaterThan(3)
  })

  it('clamps extreme values to the supported design scale', () => {
    const clamped = clampTokenValues({ ...INITIAL_TOKENS, typeScale: [1, 80, 14, 20, 28, 40], radiusScale: [-4, 12, 18, 50], spacingScale: [0, 8, 12, 20, 99] })
    expect(clamped.typeScale).toEqual([10, 72, 14, 20, 28, 40])
    expect(clamped.radiusScale).toEqual([0, 12, 18, 40])
    expect(clamped.spacingScale).toEqual([2, 8, 12, 20, 64])
  })

  it('rejects invalid colors and unsupported scale lengths', () => {
    expect(validateTokens({ ...INITIAL_TOKENS, primary: 'red' })).toContain('HEX')
    expect(validateTokens({ ...INITIAL_TOKENS, typeScale: [12] })).toContain('数量')
  })

  it('resolves effective tokens as theme defaults plus overrides', () => {
    const tokens = resolveTokens('night', { primary: '#123456' })
    expect(tokens.primary).toBe('#123456')
    expect(tokens.secondary).toBe(THEME_PRESETS.night.tokens.secondary)
    expect(tokens.radiusScale).toEqual(THEME_PRESETS.night.tokens.radiusScale)
  })

  it('derives only the differences as overrides', () => {
    const overrides = deriveOverrides('studio', { ...INITIAL_TOKENS, primary: '#123456' })
    expect(overrides.primary).toBe('#123456')
    expect(overrides.secondary).toBeUndefined()
    expect(overrides.radiusScale).toBeUndefined()
  })

  it('prunes overrides that happen to match the new theme defaults', () => {
    // 在 studio 下 editorial 的主色属于自定义
    const carried = pruneOverrides('editorial', { primary: THEME_PRESETS.editorial.tokens.primary })
    expect(carried.primary).toBeUndefined()
  })

  it('lists customized groups across colors and scales', () => {
    const overrides = { primary: '#123456', typeScale: [12, 14, 16, 20, 28, 44] }
    expect(customizedGroups('studio', overrides)).toEqual(['color', 'typeScale'])
  })
})

class MemoryStorage implements StorageService {
  raw: string | null = null
  read(): string | null { return this.raw }
  write(value: string): void { this.raw = value }
}

describe('LocalBrandRepository migration', () => {
  it('derives overrides for legacy documents that only stored flat tokens', () => {
    const storage = new MemoryStorage()
    const legacy = { version: 1 as const, theme: 'studio' as const, tokens: { ...INITIAL_TOKENS, primary: '#123456' }, versions: [] }
    storage.write(JSON.stringify(legacy))
    const repository = new LocalBrandRepository(storage)
    const loaded = repository.load()
    expect(loaded).not.toBeNull()
    expect(loaded?.overrides.primary).toBe('#123456')
    expect(loaded?.overrides.secondary).toBeUndefined()
    // 迁移后再次保存，之后加载结果一致（幂等）
    if (loaded) repository.save(loaded)
    expect(repository.load()?.overrides.primary).toBe('#123456')
  })

  it('backfills theme and customized groups on legacy saved versions', () => {
    const storage = new MemoryStorage()
    const legacyVersion = { id: 'version-1', label: 'Version A', tokens: { ...INITIAL_TOKENS, primary: '#123456' }, createdAt: '2024-01-01T00:00:00.000Z' }
    const legacy = { version: 1 as const, theme: 'studio' as const, tokens: { ...INITIAL_TOKENS, primary: '#123456' }, versions: [legacyVersion] }
    storage.write(JSON.stringify(legacy))
    const loaded = new LocalBrandRepository(storage).load()
    expect(loaded?.versions[0].theme).toBe('studio')
    expect(loaded?.versions[0].customizedGroups).toEqual(['color'])
  })
})
