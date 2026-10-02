import { clampTokenValues, cloneOverrides, cloneTokens, contrastRatio, customizedGroups, customizedGroupLabels, normalizeColor, pruneOverrides, resolveTokens, validateTokens } from '../domain/brandRules'
import type { BrandRepository } from '../repositories/brandRepository'
import type { BrandGuidelinesExporter } from '../services/exportService'
import { THEME_PRESETS, TOKEN_GROUP_LABELS, type BrandDocument, type BrandMirrorSnapshot, type BrandTheme, type SavedVersion, type TokenColorField, type TokenGroupKey, type TokenOverrides, type TokenScaleField } from '../models/brandMirrorModels'

type Listener = () => void

const EMPTY_OVERRIDES: TokenOverrides = {}

export class BrandMirrorViewModel {
  private theme: BrandTheme = 'studio'
  private overrides: TokenOverrides = EMPTY_OVERRIDES
  private versions: SavedVersion[] = []
  private pendingTheme: BrandTheme | null = null
  private compareMode = false
  private status: BrandMirrorSnapshot['status'] = 'loading'
  private message = ''
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
    const tokens = resolveTokens(this.theme, this.overrides)
    const ratio = contrastRatio(tokens.primary, tokens.secondary)
    const latestVersion = this.versions[this.versions.length - 1]
    return {
      status: this.status,
      tokens,
      theme: this.theme,
      overrides: cloneOverrides(this.overrides),
      customizedGroups: customizedGroups(this.theme, this.overrides),
      pendingTheme: this.pendingTheme,
      versions: this.versions,
      compareMode: this.compareMode,
      activeVersionId: latestVersion?.id ?? null,
      contrastRatio: ratio,
      contrastWarning: ratio < 3,
      message: this.message,
    }
  }

  initialize(): void {
    const stored = this.repository.load()
    if (stored) {
      this.theme = stored.theme
      this.overrides = pruneOverrides(stored.theme, stored.overrides)
      this.versions = stored.versions
      this.pendingTheme = null
      this.compareMode = false
      this.status = 'ready'
      this.message = '已恢复最近一次工作状态'
    } else {
      this.theme = 'studio'
      this.overrides = EMPTY_OVERRIDES
      this.versions = []
      this.status = 'ready'
      this.message = '从 Studio warm 开始探索'
    }
    this.emit()
  }

  /**
   * 主题只是“起点”：
   * - 没有自定义调整时直接切换；
   * - 有自定义调整时先挂起主题、由界面确认，用户可选择保留或放弃调整。
   */
  requestThemeChange(theme: BrandTheme): void {
    if (theme === this.theme) return
    if (customizedGroups(this.theme, this.overrides).length === 0) {
      this.commitThemeChange(theme, false)
      return
    }
    this.pendingTheme = theme
    this.status = 'editing'
    this.message = `切换到 ${THEME_PRESETS[theme].label}：保留你的调整，或改用该主题默认`
    this.emit()
  }

  confirmThemeChange(keepAdjustments: boolean): void {
    const theme = this.pendingTheme
    if (!theme) return
    this.commitThemeChange(theme, keepAdjustments)
  }

  cancelThemeChange(): void {
    if (!this.pendingTheme) return
    this.pendingTheme = null
    this.message = '已取消切换，仍停留在当前主题'
    this.emit()
  }

  updateColor(field: TokenColorField, value: string): void {
    const color = normalizeColor(value)
    this.apply({ ...this.overrides, [field]: color }, '令牌已更新')
  }

  updateScale(field: TokenScaleField, index: number, value: number): void {
    const current = resolveTokens(this.theme, this.overrides)[field]
    const values = [...current]
    values[index] = Number.isFinite(value) ? value : values[index]
    // 先在完整令牌上夹紧，再以夹紧后的整组写回覆盖层
    const clamped = clampTokenValues({ ...resolveTokens(this.theme, this.overrides), [field]: values })
    this.apply({ ...this.overrides, [field]: clamped[field] }, '令牌已更新')
  }

  /** 只重置某一组（颜色 / 圆角 / 间距 / 字体）回到当前主题默认，其余调整保留。 */
  resetGroup(group: TokenGroupKey): void {
    let next: TokenOverrides
    if (group === 'color') {
      next = { ...this.overrides }
      delete next.primary
      delete next.secondary
    } else {
      next = { ...this.overrides }
      delete next[group]
    }
    this.apply(next, `「${TOKEN_GROUP_LABELS[group]}」已恢复为 ${THEME_PRESETS[this.theme].label} 默认`)
  }

  /** 全部回到当前主题默认（不切换主题）。 */
  resetAll(): void {
    this.apply(EMPTY_OVERRIDES, `所有调整已清除，回到 ${THEME_PRESETS[this.theme].label} 默认`)
  }

  saveVersion(): void {
    const tokens = resolveTokens(this.theme, this.overrides)
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
      customizedGroups: customizedGroups(this.theme, this.overrides),
      createdAt: new Date().toISOString(),
    }
    this.versions = [...this.versions, nextVersion]
    this.persist('版本已保存', 'ready')
  }

  toggleCompare(): void {
    this.compareMode = !this.compareMode
    this.message = this.compareMode ? '正在对比最近两个版本' : '已退出对比模式'
    this.emit()
  }

  exportBrandGuidelines(): void {
    if (!this.exporter) return
    try {
      this.exporter.export(this.getSnapshot())
      this.message = '品牌规范已导出'
    } catch {
      this.status = 'error'
      this.message = '导出失败，请稍后重试'
    }
    this.emit()
  }

  private commitThemeChange(theme: BrandTheme, keepAdjustments: boolean): void {
    this.theme = theme
    this.pendingTheme = null
    // 保留时把恰好等于新主题默认值的覆盖项剔除，让其明确“跟随主题”
    this.overrides = keepAdjustments ? pruneOverrides(theme, this.overrides) : EMPTY_OVERRIDES
    const labels = customizedGroupLabels(theme, this.overrides)
    this.message = keepAdjustments
      ? (labels.length > 0
          ? `已切换到 ${THEME_PRESETS[theme].label}，保留你的调整：${labels.join('、')}`
          : `已切换到 ${THEME_PRESETS[theme].label}，你的调整与新主题默认一致，已全部跟随主题`)
      : `已切换到 ${THEME_PRESETS[theme].label}，全部使用主题默认`
    this.persist(this.message, 'editing')
  }

  private apply(overrides: TokenOverrides, message: string): void {
    this.overrides = pruneOverrides(this.theme, overrides)
    this.persist(message, 'editing')
  }

  private persist(message: string, status: BrandMirrorSnapshot['status']): void {
    const tokens = resolveTokens(this.theme, this.overrides)
    try {
      const document: BrandDocument = { version: 1, tokens, theme: this.theme, overrides: cloneOverrides(this.overrides), versions: this.versions }
      this.repository.save(document)
      this.status = status
      this.message = message
    } catch {
      this.status = 'error'
      this.message = '本地保存失败，但当前编辑仍保留在页面中'
    }
    this.emit()
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener())
  }
}
