import { describe, expect, it } from 'vitest'
import { BrandMirrorViewModel } from '../viewmodels/brandMirrorViewModel'
import type { BrandDocument } from '../models/brandMirrorModels'
import { THEME_PRESETS } from '../models/brandMirrorModels'
import type { BrandRepository } from '../repositories/brandRepository'
import { buildBrandGuidelinesMarkdown, type BrandGuidelinesExporter } from '../services/exportService'

class MemoryRepository implements BrandRepository {
  document: BrandDocument | null = null
  shouldFail = false
  load(): BrandDocument | null { return this.document }
  save(document: BrandDocument): void { if (this.shouldFail) throw new Error('offline'); this.document = document }
}

class MemoryExporter implements BrandGuidelinesExporter {
  received: string | null = null
  export(snapshot: Parameters<BrandGuidelinesExporter['export']>[0]): void { this.received = buildBrandGuidelinesMarkdown(snapshot) }
}

describe('BrandMirrorViewModel', () => {
  it('initializes, updates tokens and persists the latest state', () => {
    const repository = new MemoryRepository()
    const viewModel = new BrandMirrorViewModel(repository)
    viewModel.initialize()
    viewModel.updateColor('primary', '#123456')
    viewModel.updateScale('typeScale', 0, 18)
    expect(viewModel.getSnapshot().tokens.primary).toBe('#123456')
    expect(viewModel.getSnapshot().tokens.typeScale[0]).toBe(18)
    expect(repository.document?.tokens.primary).toBe('#123456')
  })

  it('saves two versions and enters comparison mode', () => {
    const repository = new MemoryRepository()
    const viewModel = new BrandMirrorViewModel(repository)
    viewModel.initialize()
    viewModel.saveVersion()
    viewModel.updateColor('primary', '#238B73')
    viewModel.saveVersion()
    viewModel.toggleCompare()
    expect(viewModel.getSnapshot().versions.map((version) => version.label)).toEqual(['Version A', 'Version B'])
    expect(viewModel.getSnapshot().compareMode).toBe(true)
  })

  it('keeps editing usable when persistence fails', () => {
    const repository = new MemoryRepository()
    const viewModel = new BrandMirrorViewModel(repository)
    viewModel.initialize()
    repository.shouldFail = true
    viewModel.updateColor('secondary', '#FFFFFF')
    expect(viewModel.getSnapshot().status).toBe('error')
    expect(viewModel.getSnapshot().tokens.secondary).toBe('#FFFFFF')
  })

  it('recovers a previously persisted document on initialization', () => {
    const repository = new MemoryRepository()
    repository.document = { version: 1, theme: 'night', overrides: {}, tokens: THEME_PRESETS.night.tokens, versions: [] }
    const viewModel = new BrandMirrorViewModel(repository)
    viewModel.initialize()
    expect(viewModel.getSnapshot().theme).toBe('night')
    expect(viewModel.getSnapshot().message).toContain('恢复')
  })

  it('exports the current token system as brand guidelines', () => {
    const repository = new MemoryRepository()
    const exporter = new MemoryExporter()
    const viewModel = new BrandMirrorViewModel(repository, exporter)
    viewModel.initialize()
    viewModel.exportBrandGuidelines()
    expect(exporter.received).toContain('# BrandMirror 品牌规范')
    expect(exporter.received).toContain('`primary`')
    expect(viewModel.getSnapshot().message).toContain('导出')
  })

  it('switches theme directly when the user has no adjustments', () => {
    const repository = new MemoryRepository()
    const viewModel = new BrandMirrorViewModel(repository)
    viewModel.initialize()
    viewModel.requestThemeChange('night')
    const snapshot = viewModel.getSnapshot()
    expect(snapshot.theme).toBe('night')
    expect(snapshot.pendingTheme).toBeNull()
    expect(snapshot.tokens).toEqual(THEME_PRESETS.night.tokens)
    expect(snapshot.customizedGroups).toEqual([])
  })

  it('asks for confirmation before switching when groups are customized', () => {
    const repository = new MemoryRepository()
    const viewModel = new BrandMirrorViewModel(repository)
    viewModel.initialize()
    viewModel.updateColor('primary', '#123456')
    viewModel.requestThemeChange('night')
    expect(viewModel.getSnapshot().theme).toBe('studio')
    expect(viewModel.getSnapshot().pendingTheme).toBe('night')
  })

  it('keeps user adjustments on a confirmed theme switch and only carries customized groups', () => {
    const repository = new MemoryRepository()
    const viewModel = new BrandMirrorViewModel(repository)
    viewModel.initialize()
    viewModel.updateColor('primary', '#123456')
    viewModel.updateScale('radiusScale', 0, 2)
    viewModel.requestThemeChange('night')
    viewModel.confirmThemeChange(true)
    const snapshot = viewModel.getSnapshot()
    expect(snapshot.theme).toBe('night')
    expect(snapshot.pendingTheme).toBeNull()
    // 用户的颜色调整保留
    expect(snapshot.tokens.primary).toBe('#123456')
    expect(snapshot.tokens.radiusScale[0]).toBe(2)
    // 未调整的字段跟随新主题默认
    expect(snapshot.tokens.secondary).toBe(THEME_PRESETS.night.tokens.secondary)
    expect(snapshot.tokens.spacingScale).toEqual(THEME_PRESETS.night.tokens.spacingScale)
    expect(snapshot.customizedGroups).toEqual(['color', 'radiusScale'])
    // 持久化的是解析后的真实结果
    expect(repository.document?.tokens.primary).toBe('#123456')
    expect(repository.document?.overrides.primary).toBe('#123456')
    expect(repository.document?.tokens.secondary).toBe(THEME_PRESETS.night.tokens.secondary)
  })

  it('drops user adjustments when the user chooses theme defaults', () => {
    const repository = new MemoryRepository()
    const viewModel = new BrandMirrorViewModel(repository)
    viewModel.initialize()
    viewModel.updateColor('primary', '#123456')
    viewModel.requestThemeChange('editorial')
    viewModel.confirmThemeChange(false)
    const snapshot = viewModel.getSnapshot()
    expect(snapshot.tokens).toEqual(THEME_PRESETS.editorial.tokens)
    expect(snapshot.customizedGroups).toEqual([])
  })

  it('cancels a pending theme change without touching tokens', () => {
    const repository = new MemoryRepository()
    const viewModel = new BrandMirrorViewModel(repository)
    viewModel.initialize()
    viewModel.updateColor('primary', '#123456')
    viewModel.requestThemeChange('night')
    viewModel.cancelThemeChange()
    const snapshot = viewModel.getSnapshot()
    expect(snapshot.theme).toBe('studio')
    expect(snapshot.pendingTheme).toBeNull()
    expect(snapshot.tokens.primary).toBe('#123456')
  })

  it('resets a single group back to the current theme defaults while keeping other adjustments', () => {
    const repository = new MemoryRepository()
    const viewModel = new BrandMirrorViewModel(repository)
    viewModel.initialize()
    viewModel.updateColor('primary', '#123456')
    viewModel.updateScale('radiusScale', 0, 2)
    viewModel.resetGroup('color')
    const snapshot = viewModel.getSnapshot()
    expect(snapshot.tokens.primary).toBe(THEME_PRESETS.studio.tokens.primary)
    expect(snapshot.tokens.radiusScale[0]).toBe(2)
    expect(snapshot.customizedGroups).toEqual(['radiusScale'])
  })

  it('resets everything back to the current theme without changing the theme', () => {
    const repository = new MemoryRepository()
    const viewModel = new BrandMirrorViewModel(repository)
    viewModel.initialize()
    viewModel.updateColor('primary', '#123456')
    viewModel.updateScale('typeScale', 0, 30)
    viewModel.requestThemeChange('night')
    viewModel.confirmThemeChange(true)
    viewModel.resetAll()
    const snapshot = viewModel.getSnapshot()
    expect(snapshot.theme).toBe('night')
    expect(snapshot.tokens).toEqual(THEME_PRESETS.night.tokens)
    expect(snapshot.customizedGroups).toEqual([])
  })

  it('drops an adjustment that matches the new theme defaults after a switch', () => {
    const repository = new MemoryRepository()
    const viewModel = new BrandMirrorViewModel(repository)
    viewModel.initialize()
    // 把主色改成 editorial 默认主色，然后切到 editorial 并“保留调整”
    viewModel.updateColor('primary', THEME_PRESETS.editorial.tokens.primary)
    viewModel.requestThemeChange('editorial')
    viewModel.confirmThemeChange(true)
    const snapshot = viewModel.getSnapshot()
    expect(snapshot.customizedGroups).toEqual([])
    expect(snapshot.overrides.primary).toBeUndefined()
  })

  it('stores theme and customized groups on saved versions', () => {
    const repository = new MemoryRepository()
    const viewModel = new BrandMirrorViewModel(repository)
    viewModel.initialize()
    viewModel.updateScale('spacingScale', 0, 10)
    viewModel.saveVersion()
    const version = viewModel.getSnapshot().versions[0]
    expect(version.theme).toBe('studio')
    expect(version.customizedGroups).toEqual(['spacingScale'])
  })

  it('marks customization provenance in exported guidelines', () => {
    const repository = new MemoryRepository()
    const exporter = new MemoryExporter()
    const viewModel = new BrandMirrorViewModel(repository, exporter)
    viewModel.initialize()
    viewModel.updateColor('primary', '#123456')
    viewModel.exportBrandGuidelines()
    expect(exporter.received).toContain('起点主题：Studio warm')
    expect(exporter.received).toContain('自定义：品牌色')
    expect(exporter.received).toContain('| 主色 `primary` | `#123456` | 自定义 |')
    expect(exporter.received).toContain('| 辅助色 `secondary` | `#24324A` | 主题默认 |')
  })
})
