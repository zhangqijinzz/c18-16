import type { BrandTheme, BrandTokens, TokenGroupKey, TokenOverrides } from '../models/brandMirrorModels'
import { INITIAL_TOKENS, TOKEN_GROUPS, THEME_PRESETS } from '../models/brandMirrorModels'

const HEX_COLOR = /^#[0-9A-F]{6}$/i

export function cloneTokens(tokens: BrandTokens): BrandTokens {
  return { ...tokens, radiusScale: [...tokens.radiusScale], spacingScale: [...tokens.spacingScale], typeScale: [...tokens.typeScale] }
}

export function isHexColor(value: string): boolean {
  return HEX_COLOR.test(value)
}

export function normalizeColor(value: string): string {
  const candidate = value.trim().toUpperCase()
  return isHexColor(candidate) ? candidate : INITIAL_TOKENS.primary
}

export function clampTokenValues(tokens: BrandTokens): BrandTokens {
  return {
    ...cloneTokens(tokens),
    radiusScale: tokens.radiusScale.map((value) => Math.min(40, Math.max(0, Math.round(value)))),
    spacingScale: tokens.spacingScale.map((value) => Math.min(64, Math.max(2, Math.round(value)))),
    typeScale: tokens.typeScale.map((value) => Math.min(72, Math.max(10, Math.round(value)))),
  }
}

export function validateTokens(tokens: BrandTokens): string | null {
  if (!isHexColor(tokens.primary) || !isHexColor(tokens.secondary)) return '请输入 6 位 HEX 颜色'
  if (tokens.radiusScale.length !== 4 || tokens.spacingScale.length !== 5 || tokens.typeScale.length !== 6) return '令牌层级数量不完整'
  if (tokens.typeScale.some((value) => value < 10 || value > 72)) return '字号范围应在 10–72px'
  return null
}

function channel(value: number): number {
  const scaled = value / 255
  return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4
}

function luminance(color: string): number {
  const red = Number.parseInt(color.slice(1, 3), 16)
  const green = Number.parseInt(color.slice(3, 5), 16)
  const blue = Number.parseInt(color.slice(5, 7), 16)
  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue)
}

export function contrastRatio(first: string, second: string): number {
  const one = luminance(first)
  const two = luminance(second)
  return (Math.max(one, two) + 0.05) / (Math.min(one, two) + 0.05)
}

export function themeTokens(theme: BrandTheme): BrandTokens {
  return cloneTokens(THEME_PRESETS[theme].tokens)
}

/** 主题基线叠加稀疏覆盖，得到界面 / 保存 / 导出共用的真实令牌 */
export function resolveTokens(theme: BrandTheme, overrides: TokenOverrides): BrandTokens {
  const base = themeTokens(theme)
  const resolveScale = (group: 'radiusScale' | 'spacingScale' | 'typeScale'): number[] => {
    const override = overrides[group]
    return Array.isArray(override) && override.length === base[group].length
      ? override.map((value) => Number(value))
      : [...base[group]]
  }
  const resolveColor = (group: 'primary' | 'secondary'): string => {
    const override = overrides[group]
    return typeof override === 'string' && isHexColor(normalizeColor(override))
      ? normalizeColor(override)
      : base[group]
  }
  return {
    primary: resolveColor('primary'),
    secondary: resolveColor('secondary'),
    radiusScale: resolveScale('radiusScale'),
    spacingScale: resolveScale('spacingScale'),
    typeScale: resolveScale('typeScale'),
  }
}

function sameGroupValue(group: TokenGroupKey, tokens: BrandTokens, base: BrandTokens): boolean {
  if (group === 'primary' || group === 'secondary') return tokens[group] === base[group]
  const current = tokens[group]
  const baseline = base[group]
  return current.length === baseline.length && current.every((value, index) => value === baseline[index])
}

/** 相对某主题基线，逐组判断令牌是否被用户自定义 */
export function customizedGroupsOf(tokens: BrandTokens, theme: BrandTheme): Record<TokenGroupKey, boolean> {
  const base = themeTokens(theme)
  return {
    primary: !sameGroupValue('primary', tokens, base),
    secondary: !sameGroupValue('secondary', tokens, base),
    radiusScale: !sameGroupValue('radiusScale', tokens, base),
    spacingScale: !sameGroupValue('spacingScale', tokens, base),
    typeScale: !sameGroupValue('typeScale', tokens, base),
  }
}

/** 从真实令牌生成稀疏覆盖：只保留相对主题基线真正改过的组 */
export function overridesFromTokens(tokens: BrandTokens, theme: BrandTheme): TokenOverrides {
  const flags = customizedGroupsOf(tokens, theme)
  const overrides: TokenOverrides = {}
  for (const group of TOKEN_GROUPS) {
    if (!flags[group]) continue
    overrides[group] = group === 'primary' || group === 'secondary' ? tokens[group] : [...tokens[group]]
  }
  return overrides
}

/**
 * 切换主题：以旧主题基线判断用户改过哪些组，这些组的当前值作为自定义跟随到新主题；
 * 没动过的组不生成覆盖，从而跟随新主题默认。
 */
export function rebaseOverrides(currentTokens: BrandTokens, previousTheme: BrandTheme): TokenOverrides {
  return overridesFromTokens(clampTokenValues(currentTokens), previousTheme)
}
