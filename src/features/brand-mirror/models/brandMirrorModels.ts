export type BrandTheme = 'studio' | 'editorial' | 'night'
export type TokenGroupKey = 'primary' | 'secondary' | 'radiusScale' | 'spacingScale' | 'typeScale'
export type MirrorStatus = 'loading' | 'ready' | 'editing' | 'error'

export interface BrandTokens {
  primary: string
  secondary: string
  radiusScale: number[]
  spacingScale: number[]
  typeScale: number[]
}

/** 相对主题基线的稀疏覆盖：没有出现在这里的组一律跟随当前主题 */
export type TokenOverrides = Partial<Record<TokenGroupKey, string | number[]>>

export interface SavedVersion {
  id: string
  label: string
  tokens: BrandTokens
  theme: BrandTheme
  overrides: TokenOverrides
  createdAt: string
}

export interface BrandDocument {
  version: 2
  theme: BrandTheme
  overrides: TokenOverrides
  versions: SavedVersion[]
}

export interface BrandMirrorSnapshot {
  status: MirrorStatus
  /** 由主题基线叠加 overrides 解析出的真实令牌，界面 / 保存 / 导出统一读这一份 */
  tokens: BrandTokens
  theme: BrandTheme
  overrides: TokenOverrides
  /** 每个组当前是否为用户自定义（相对当前主题基线） */
  customizedGroups: Record<TokenGroupKey, boolean>
  customizedCount: number
  versions: SavedVersion[]
  compareMode: boolean
  activeVersionId: string | null
  contrastRatio: number
  contrastWarning: boolean
  message: string
}

export const TOKEN_GROUPS: TokenGroupKey[] = ['primary', 'secondary', 'radiusScale', 'spacingScale', 'typeScale']

export const GROUP_LABELS: Record<TokenGroupKey, string> = {
  primary: '主色',
  secondary: '辅助色',
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
