import { describe, expect, it } from 'vitest'
import { clampTokenValues, contrastRatio, customizedGroupsOf, overridesFromTokens, rebaseOverrides, resolveTokens, validateTokens } from '../domain/brandRules'
import { INITIAL_TOKENS, THEME_PRESETS } from '../models/brandMirrorModels'

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

  it('resolves tokens from the theme baseline plus sparse overrides', () => {
    const tokens = resolveTokens('studio', { primary: '#123456', typeScale: [12, 14, 18, 20, 28, 40] })
    expect(tokens.primary).toBe('#123456')
    expect(tokens.secondary).toBe(INITIAL_TOKENS.secondary)
    expect(tokens.typeScale[2]).toBe(18)
    expect(tokens.radiusScale).toEqual(INITIAL_TOKENS.radiusScale)
  })

  it('marks only groups that differ from the active theme as customized', () => {
    const tokens = { ...INITIAL_TOKENS, primary: '#123456' }
    const flags = customizedGroupsOf(tokens, 'studio')
    expect(flags.primary).toBe(true)
    expect(flags.secondary).toBe(false)
    expect(flags.radiusScale).toBe(false)
    expect(overridesFromTokens(tokens, 'studio')).toEqual({ primary: '#123456' })
  })

  it('keeps user adjustments on theme switch but lets untouched groups follow the new theme', () => {
    const edited = { ...INITIAL_TOKENS, primary: '#123456' }
    const rebased = rebaseOverrides(edited, 'studio')
    const resolved = resolveTokens('editorial', rebased)
    // 用户改过的主色保留
    expect(resolved.primary).toBe('#123456')
    // 没动过的组跟随 editorial 默认
    expect(resolved.secondary).toBe(THEME_PRESETS.editorial.tokens.secondary)
    expect(resolved.radiusScale).toEqual(THEME_PRESETS.editorial.tokens.radiusScale)
    expect(rebased.secondary).toBeUndefined()
  })

  it('keeps groups the user edited relative to the old theme even if the value matches the new theme default', () => {
    // 主色被用户改成了 editorial 的默认值；以旧主题 studio 判断这仍是一次自定义，
    // 切换后该值会作为覆盖保留（界面显示"我的调整"），不会被静默吞掉。
    const tokens = { ...INITIAL_TOKENS, primary: THEME_PRESETS.editorial.tokens.primary }
    const rebased = rebaseOverrides(tokens, 'studio')
    expect(rebased.primary).toBe(THEME_PRESETS.editorial.tokens.primary)
    const resolved = resolveTokens('editorial', rebased)
    expect(resolved.primary).toBe(THEME_PRESETS.editorial.tokens.primary)
  })
})
