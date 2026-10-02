import { clampTokenValues, cloneTokens, contrastRatio, normalizeColor, rebaseOverrides, resolveTokens, themeTokens, validateTokens } from '../domain/brandRules'
import type { BrandRepository } from '../repositories/brandRepository'
import type { BrandGuidelinesExporter } from '../services/exportService'
import { GROUP_LABELS, THEME_PRESETS, TOKEN_GROUPS, type BrandDocument, type BrandMirrorSnapshot, type BrandTheme, type SavedVersion, type TokenGroupKey, type TokenOverrides } from '../models/brandMirrorModels'

type Listener = () => void

export class BrandMirrorViewModel {
  private theme: BrandTheme = 'studio'
  private overrides: TokenOverrides = {}
  private versions: SavedVersion[] = []
  private compareMode = false
  private status: BrandMirrorSnapshot['status'] = 'loading'
  private message = ''
  private snapshot: BrandMirrorSnapshot = this.makeSnapshot()
  private readonly listeners = new Set<Listener>()
  private readonly repository: BrandRepository
  private readonly exporter?: BrandGuidelinesExporter

  constructor(repository: BrandRepository, exporter?: BrandGuidelinesExporter) {
    this.repository = repository
    this.exporter = exporter
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot(): BrandMirrorSnapshot {
    return this.snapshot
  }

  initialize(): void {
    const stored = this.repository.load()
    if (stored) {
      this.theme = stored.theme
      this.overrides = stored.overrides
      this.versions = stored.versions
      this.compareMode = false
      this.commit('已恢复最近一次工作状态', 'ready')
    } else {
      this.commit('从 Studio warm 开始探索', 'ready')
    }
    this.emit()
  }

  /** 主题只是起点：未改过的组跟随新主题，用户的自定义调整保留下来 */
  selectTheme(nextTheme: BrandTheme): void {
    if (nextTheme === this.theme) {
      this.commit('当前已使用该主题', this.status === 'error' ? 'error' : 'ready')
      this.emit()
      return
    }
    const currentTokens = this.snapshot.tokens
    this.overrides = rebaseOverrides(currentTokens, this.theme)
    this.theme = nextTheme
    const kept = TOKEN_GROUPS.filter((group) => this.overrides[group] !== undefined).length
    const label = THEME_PRESETS[nextTheme].label
    this.commit(kept > 0 ? `已切换到 ${label}，保留 ${kept} 组你的调整，其余跟随新主题` : `已切换到 ${label}`, 'editing')
    this.persistCurrent()
  }

  updateColor(field: 'primary' | 'secondary', value: string): void {
    const color = normalizeColor(value)
    const next = { ...this.overrides }
    // 规范化后与主题基线相同的值不算自定义，避免出现虚假的"我的调整"
    if (color === themeTokens(this.theme)[field]) delete next[field]
    else next[field] = color
    this.overrides = next
    this.commit('令牌已更新', 'editing')
    this.persistCurrent()
  }

  updateScale(field: 'radiusScale' | 'spacingScale' | 'typeScale', index: number, value: number): void {
    const draft = cloneTokens(this.snapshot.tokens)
    draft[field][index] = Number.isFinite(value) ? value : draft[field][index]
    const values = clampTokenValues(draft)[field]
    const baseline = themeTokens(this.theme)[field]
    const next = { ...this.overrides }
    if (values.length === baseline.length && values.every((entry, i) => entry === baseline[i])) delete next[field]
    else next[field] = [...values]
    this.overrides = next
    this.commit('令牌已更新', 'editing')
    this.persistCurrent()
  }

  /** 只把某一组恢复为当前主题默认，其它自定义不受影响 */
  resetGroup(group: TokenGroupKey): void {
    if (this.overrides[group] === undefined) {
      this.commit(`${GROUP_LABELS[group]}本就跟随主题`, 'ready')
      this.emit()
      return
    }
    const next = { ...this.overrides }
    delete next[group]
    this.overrides = next
    this.commit(`已将${GROUP_LABELS[group]}恢复为主题默认`, 'editing')
    this.persistCurrent()
  }

  /** 全部回到当前主题的默认令牌 */
  resetAll(): void {
    this.overrides = {}
    this.commit(`已全部恢复为 ${THEME_PRESETS[this.theme].label} 默认`, 'editing')
    this.persistCurrent()
  }

  saveVersion(): void {
    const tokens = this.snapshot.tokens
    const validationError = validateTokens(tokens)
    if (validationError) {
      this.status = 'error'
      this.message = validationError
      this.emit()
      return
    }
    const nextVersion: SavedVersion = {
      id: `version-${Date.now()}`,
      label: this.versions.length === 0 ? 'Version A' : `Version ${String.fromCharCode(65 + this.versions.length)}`,
      tokens: cloneTokens(tokens),
      theme: this.theme,
      overrides: { ...this.overrides },
      createdAt: new Date().toISOString(),
    }
    this.versions = [...this.versions, nextVersion]
    this.commit('版本已保存', 'ready')
    this.persistCurrent()
  }

  toggleCompare(): void {
    this.compareMode = !this.compareMode
    this.message = this.compareMode ? '正在对比最近两个版本' : '已退出对比模式'
    this.emit()
  }

  exportBrandGuidelines(): void {
    if (!this.exporter) return
    try {
      this.exporter.export(this.snapshot)
      this.message = '品牌规范已导出'
    } catch {
      this.status = 'error'
      this.message = '导出失败，请稍后重试'
    }
    this.emit()
  }

  private persistCurrent(): void {
    const document: BrandDocument = { version: 2, theme: this.theme, overrides: this.overrides, versions: this.versions }
    try {
      this.repository.save(document)
    } catch {
      this.status = 'error'
      this.message = '本地保存失败，但当前编辑仍保留在页面中'
    }
    this.emit()
  }

  private commit(message: string, status: BrandMirrorSnapshot['status']): void {
    this.message = message
    this.status = status
    this.snapshot = this.makeSnapshot()
  }

  private makeSnapshot(): BrandMirrorSnapshot {
    const tokens = resolveTokens(this.theme, this.overrides)
    const customizedGroups = {
      primary: this.overrides.primary !== undefined,
      secondary: this.overrides.secondary !== undefined,
      radiusScale: this.overrides.radiusScale !== undefined,
      spacingScale: this.overrides.spacingScale !== undefined,
      typeScale: this.overrides.typeScale !== undefined,
    }
    const ratio = contrastRatio(tokens.primary, tokens.secondary)
    const latestVersion = this.versions[this.versions.length - 1]
    return {
      status: this.status,
      tokens,
      theme: this.theme,
      overrides: { ...this.overrides },
      customizedGroups,
      customizedCount: TOKEN_GROUPS.filter((group) => customizedGroups[group]).length,
      versions: this.versions,
      compareMode: this.compareMode,
      activeVersionId: latestVersion?.id ?? null,
      contrastRatio: ratio,
      contrastWarning: ratio < 3,
      message: this.message,
    }
  }

  private emit(): void {
    this.snapshot = this.makeSnapshot()
    this.listeners.forEach((listener) => listener())
  }
}
