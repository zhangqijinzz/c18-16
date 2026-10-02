import type { BrandTheme, BrandTokens, TokenColorField, TokenField, TokenGroupKey, TokenOverrides, TokenScaleField } from '../models/brandMirrorModels'
import { INITIAL_TOKENS, TOKEN_GROUP_LABELS, THEME_PRESETS } from '../models/brandMirrorModels'

const HEX_COLOR = /^#[0-9A-F]{6}$/i

export const COLOR_FIELDS: TokenColorField[] = ['primary', 'secondary']
export const SCALE_FIELDS: TokenScaleField[] = ['radiusScale', 'spacingScale', 'typeScale']

export function cloneTokens(tokens: BrandTokens): BrandTokens {
  return { ...tokens, radiusScale: [...tokens.radiusScale], spacingScale: [...tokens.spacingScale], typeScale: [...tokens.typeScale] }
}

export function cloneOverrides(overrides: TokenOverrides): TokenOverrides {
  return {
    ...(overrides.primary !== undefined ? { primary: overrides.primary } : {}),
    ...(overrides.secondary !== undefined ? { secondary: overrides.secondary } : {}),
    ...(overrides.radiusScale ? { radiusScale: [...overrides.radiusScale] } : {}),
    ...(overrides.spacingScale ? { spacingScale: [...overrides.spacingScale] } : {}),
    ...(overrides.typeScale ? { typeScale: [...overrides.typeScale] } : {}),
  }
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

export function themeLabel(theme: BrandTheme): string {
  return THEME_PRESETS[theme].label
}

/** 主题默认值 + 用户覆盖层 = 界面上真正生效的令牌。 */
export function resolveTokens(theme: BrandTheme, overrides: TokenOverrides): BrandTokens {
  const base = themeTokens(theme)
  return {
    primary: overrides.primary ?? base.primary,
    secondary: overrides.secondary ?? base.secondary,
    radiusScale: overrides.radiusScale ? [...overrides.radiusScale] : base.radiusScale,
    spacingScale: overrides.spacingScale ? [...overrides.spacingScale] : base.spacingScale,
    typeScale: overrides.typeScale ? [...overrides.typeScale] : base.typeScale,
  }
}

function sameColors(first: string, second: string): boolean {
  return first.toUpperCase() === second.toUpperCase()
}

function sameScale(first: number[], second: number[]): boolean {
  return first.length === second.length && first.every((value, index) => value === second[index])
}

export function isFieldOverridden(theme: BrandTheme, overrides: TokenOverrides, field: TokenField): boolean {
  if (field === 'primary' || field === 'secondary') {
    const value = overrides[field]
    return value !== undefined && !sameColors(value, THEME_PRESETS[theme].tokens[field])
  }
  const value = overrides[field]
  return value !== undefined && !sameScale(value, THEME_PRESETS[theme].tokens[field])
}

/**
 * 从一份（可能来自旧版本、或被外部改写过的）完整令牌反推覆盖层。
 * 与主题默认值相同的部分不进入覆盖层，保证切主题后能干净地跟随。
 */
export function deriveOverrides(theme: BrandTheme, tokens: BrandTokens): TokenOverrides {
  const base = THEME_PRESETS[theme].tokens
  const overrides: TokenOverrides = {}
  if (!sameColors(tokens.primary, base.primary)) overrides.primary = tokens.primary
  if (!sameColors(tokens.secondary, base.secondary)) overrides.secondary = tokens.secondary
  if (!sameScale(tokens.radiusScale, base.radiusScale)) overrides.radiusScale = [...tokens.radiusScale]
  if (!sameScale(tokens.spacingScale, base.spacingScale)) overrides.spacingScale = [...tokens.spacingScale]
  if (!sameScale(tokens.typeScale, base.typeScale)) overrides.typeScale = [...tokens.typeScale]
  return overrides
}

/** 去掉覆盖层里恰好等于新主题默认值的字段，避免“已恢复”却仍显示自定义标记。 */
export function pruneOverrides(theme: BrandTheme, overrides: TokenOverrides): TokenOverrides {
  return deriveOverrides(theme, resolveTokens(theme, overrides))
}

export function customizedGroups(theme: BrandTheme, overrides: TokenOverrides): TokenGroupKey[] {
  const groups: TokenGroupKey[] = []
  if (COLOR_FIELDS.some((field) => isFieldOverridden(theme, overrides, field))) groups.push('color')
  SCALE_FIELDS.forEach((field) => {
    if (isFieldOverridden(theme, overrides, field)) groups.push(field)
  })
  return groups
}

export function customizedGroupLabels(theme: BrandTheme, overrides: TokenOverrides): string[] {
  return customizedGroups(theme, overrides).map((group) => TOKEN_GROUP_LABELS[group])
}

/** 把覆盖层中的某个尺度数组重置为主题默认，返回该字段被移除后的新覆盖层。 */
export function withoutScaleOverride(overrides: TokenOverrides, field: TokenScaleField): TokenOverrides {
  const next = cloneOverrides(overrides)
  delete next[field]
  return next
}
