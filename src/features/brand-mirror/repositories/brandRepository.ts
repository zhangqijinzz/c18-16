import type { BrandDocument, SavedVersion, TokenOverrides } from '../models/brandMirrorModels'
import { clampTokenValues, customizedGroups, deriveOverrides, validateTokens } from '../domain/brandRules'
import type { StorageService } from '../services/storageService'

export interface BrandRepository {
  load(): BrandDocument | null
  save(document: BrandDocument): void
}

export class LocalBrandRepository implements BrandRepository {
  constructor(private readonly storage: StorageService) {}

  load(): BrandDocument | null {
    const raw = this.storage.read()
    if (!raw) return null
    try {
      const candidate: unknown = JSON.parse(raw)
      if (!isDocument(candidate)) return null
      const tokens = clampTokenValues(candidate.tokens)
      // 旧版本存档没有 overrides：以当前令牌相对主题默认值反推，
      // 让历史上的用户调整继续被识别为“自定义”。
      const overrides = candidate.overrides ? sanitizeOverrides(candidate.overrides) : deriveOverrides(candidate.theme, tokens)
      const versions = candidate.versions.map((version) => migrateVersion(version, candidate.theme))
      return { version: 1, tokens, theme: candidate.theme, overrides, versions }
    } catch {
      return null
    }
  }

  save(document: BrandDocument): void {
    const validationError = validateTokens(document.tokens)
    if (validationError) throw new Error(validationError)
    this.storage.write(JSON.stringify(document))
  }
}

function sanitizeOverrides(value: Partial<Record<keyof BrandDocument['tokens'], unknown>>): TokenOverrides {
  const overrides: TokenOverrides = {}
  if (typeof value.primary === 'string') overrides.primary = value.primary
  if (typeof value.secondary === 'string') overrides.secondary = value.secondary
  if (Array.isArray(value.radiusScale)) overrides.radiusScale = value.radiusScale.filter((item): item is number => typeof item === 'number')
  if (Array.isArray(value.spacingScale)) overrides.spacingScale = value.spacingScale.filter((item): item is number => typeof item === 'number')
  if (Array.isArray(value.typeScale)) overrides.typeScale = value.typeScale.filter((item): item is number => typeof item === 'number')
  return overrides
}

function isDocument(value: unknown): value is BrandDocument {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<BrandDocument>
  return candidate.version === 1 && !!candidate.tokens && Array.isArray(candidate.versions) && typeof candidate.theme === 'string'
}

const KNOWN_GROUPS = new Set(['color', 'radiusScale', 'spacingScale', 'typeScale'])

/** 旧版本保存时没有记录主题与自定义分组，这里按版本令牌反推补齐。 */
function migrateVersion(version: SavedVersion, fallbackTheme: BrandDocument['theme']): SavedVersion {
  const theme = version.theme ?? fallbackTheme
  if (Array.isArray(version.customizedGroups)) {
    return { ...version, theme, customizedGroups: version.customizedGroups.filter((group) => KNOWN_GROUPS.has(group)) }
  }
  return { ...version, theme, customizedGroups: customizedGroups(theme, deriveOverrides(theme, version.tokens)) }
}
