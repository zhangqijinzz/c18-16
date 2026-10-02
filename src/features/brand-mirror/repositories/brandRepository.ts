import type { BrandDocument, BrandTokens, SavedVersion, TokenOverrides } from '../models/brandMirrorModels'
import { clampTokenValues, overridesFromTokens, resolveTokens, validateTokens } from '../domain/brandRules'
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
      return migrate(JSON.parse(raw))
    } catch {
      return null
    }
  }

  save(document: BrandDocument): void {
    const validationError = validateTokens(resolveTokens(document.theme, document.overrides))
    if (validationError) throw new Error(validationError)
    this.storage.write(JSON.stringify(document))
  }
}

/** 兼容 v1（扁平 tokens）与 v2（主题 + 稀疏覆盖）两种存档 */
function migrate(candidate: unknown): BrandDocument | null {
  if (!candidate || typeof candidate !== 'object') return null
  const raw = candidate as Record<string, unknown>
  if (!Array.isArray(raw.versions) || typeof raw.theme !== 'string') return null
  const theme = raw.theme as BrandDocument['theme']

  if (raw.version === 2 && isOverrides(raw.overrides)) {
    const versions = (raw.versions as unknown[]).map(migrateVersion).filter((version): version is SavedVersion => version !== null)
    return { version: 2, theme, overrides: raw.overrides, versions }
  }

  if (raw.version === 1 && isTokens(raw.tokens)) {
    const tokens = clampTokenValues(raw.tokens)
    const versions = (raw.versions as unknown[]).map(migrateVersion).filter((version): version is SavedVersion => version !== null)
    return { version: 2, theme, overrides: overridesFromTokens(tokens, theme), versions }
  }

  return null
}

function migrateVersion(value: unknown): SavedVersion | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  if (typeof raw.id !== 'string' || typeof raw.label !== 'string' || typeof raw.createdAt !== 'string' || !isTokens(raw.tokens)) return null
  const theme = typeof raw.theme === 'string' ? (raw.theme as SavedVersion['theme']) : undefined
  // v1 版本没有记录所属主题，退回 studio 仅用于标注来源；令牌本身已完整快照
  const resolvedTheme = theme ?? 'studio'
  const tokens = clampTokenValues(raw.tokens)
  const overrides = isOverrides(raw.overrides)
    ? raw.overrides
    : overridesFromTokens(tokens, resolvedTheme)
  return { id: raw.id, label: raw.label, createdAt: raw.createdAt, tokens, theme: resolvedTheme, overrides }
}

function isTokens(value: unknown): value is BrandTokens {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<BrandTokens>
  return typeof candidate.primary === 'string' && typeof candidate.secondary === 'string'
    && Array.isArray(candidate.radiusScale) && Array.isArray(candidate.spacingScale) && Array.isArray(candidate.typeScale)
}

function isOverrides(value: unknown): value is TokenOverrides {
  if (!value || typeof value !== 'object') return false
  return Object.values(value as Record<string, unknown>).every((entry) => typeof entry === 'string' || Array.isArray(entry))
}
