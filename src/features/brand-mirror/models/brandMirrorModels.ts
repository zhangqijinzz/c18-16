export type BrandTheme = 'studio' | 'editorial' | 'night'
export type MirrorStatus = 'loading' | 'ready' | 'editing' | 'error'

export type TokenColorField = 'primary' | 'secondary'
export type TokenScaleField = 'radiusScale' | 'spacingScale' | 'typeScale'
export type TokenField = TokenColorField | TokenScaleField
export type TokenGroupKey = 'color' | TokenScaleField

/**
 * 用户相对主题默认值的调整。未出现的字段表示“跟随主题”，
 * 因此切换主题时这些字段会自然落到新主题的默认值上。
 */
export interface TokenOverrides {
  primary?: string
  secondary?: string
  radiusScale?: number[]
  spacingScale?: number[]
  typeScale?: number[]
}

export interface BrandTokens {
  primary: string
  secondary: string
  radiusScale: number[]
  spacingScale: number[]
  typeScale: number[]
}

export interface SavedVersion {
  id: string
  label: string
  tokens: BrandTokens
  theme: BrandTheme
  customizedGroups: TokenGroupKey[]
  createdAt: string
}

export interface BrandDocument {
  version: 1
  tokens: BrandTokens
  theme: BrandTheme
  overrides: TokenOverrides
  versions: SavedVersion[]
}

export interface BrandMirrorSnapshot {
  status: MirrorStatus
  tokens: BrandTokens
  theme: BrandTheme
  overrides: TokenOverrides
  customizedGroups: TokenGroupKey[]
  pendingTheme: BrandTheme | null
  versions: SavedVersion[]
  compareMode: boolean
  activeVersionId: string | null
  contrastRatio: number
  contrastWarning: boolean
  message: string
}

export const TOKEN_GROUP_LABELS: Record<TokenGroupKey, string> = {
  color: '品牌色',
  radiusScale: '圆角尺度',
  spacingScale: '间距体系',
  typeScale: '字体比例',
}

export const INITIAL_TOKENS: BrandTokens = {
  primary: '#F15A47',
  secondary: '#24324A',
  radiusScale: [8, 12, 18, 28],
  spacingScale: [4, 8, 12, 20, 32],
  typeScale: [12, 14, 16, 20, 28, 40],
}

export const THEME_PRESETS: Record<BrandTheme, { label: string; tokens: BrandTokens }> = {
  studio: {
    label: 'Studio warm',
    tokens: INITIAL_TOKENS,
  },
  editorial: {
    label: 'Editorial green',
    tokens: {
      primary: '#238B73', secondary: '#173C35', radiusScale: [4, 8, 12, 18], spacingScale: [4, 8, 16, 24, 40], typeScale: [12, 14, 16, 22, 30, 44],
    },
  },
  night: {
    label: 'Night signal',
    tokens: {
      primary: '#A98BFF', secondary: '#191829', radiusScale: [6, 10, 14, 22], spacingScale: [4, 8, 12, 18, 28], typeScale: [12, 14, 16, 20, 28, 38],
    },
  },
}
