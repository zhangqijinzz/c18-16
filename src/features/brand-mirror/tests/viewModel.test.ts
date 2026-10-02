import { describe, expect, it } from 'vitest'
import { BrandMirrorViewModel } from '../viewmodels/brandMirrorViewModel'
import { THEME_PRESETS, type BrandDocument } from '../models/brandMirrorModels'
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
    expect(repository.document?.overrides.primary).toBe('#123456')
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
    repository.document = { version: 2, theme: 'night', overrides: { primary: '#ABCDEF' }, versions: [] }
    const viewModel = new BrandMirrorViewModel(repository)
    viewModel.initialize()
    expect(viewModel.getSnapshot().theme).toBe('night')
    expect(viewModel.getSnapshot().tokens.primary).toBe('#ABCDEF')
    expect(viewModel.getSnapshot().tokens.secondary).toBe(THEME_PRESETS.night.tokens.secondary)
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

  it('treats the theme as a starting point: customized groups survive a theme switch, untouched groups follow it', () => {
    const repository = new MemoryRepository()
    const viewModel = new BrandMirrorViewModel(repository)
    viewModel.initialize()
    viewModel.updateColor('primary', '#123456')
    viewModel.selectTheme('editorial')
    const snapshot = viewModel.getSnapshot()
    expect(snapshot.theme).toBe('editorial')
    expect(snapshot.tokens.primary).toBe('#123456')
    expect(snapshot.tokens.secondary).toBe(THEME_PRESETS.editorial.tokens.secondary)
    expect(snapshot.tokens.radiusScale).toEqual(THEME_PRESETS.editorial.tokens.radiusScale)
    expect(snapshot.customizedGroups.primary).toBe(true)
    expect(snapshot.customizedGroups.secondary).toBe(false)
    expect(snapshot.message).toContain('保留 1 组')
    // 切换结果也落盘，而不是只停留在界面
    expect(repository.document?.theme).toBe('editorial')
    expect(repository.document?.overrides.primary).toBe('#123456')
    expect(repository.document?.overrides.radiusScale).toBeUndefined()
  })

  it('resets a single group back to the active theme default without touching other customizations', () => {
    const repository = new MemoryRepository()
    const viewModel = new BrandMirrorViewModel(repository)
    viewModel.initialize()
    viewModel.updateColor('primary', '#123456')
    viewModel.updateColor('secondary', '#654321')
    viewModel.resetGroup('primary')
    const snapshot = viewModel.getSnapshot()
    expect(snapshot.tokens.primary).toBe(THEME_PRESETS.studio.tokens.primary)
    expect(snapshot.tokens.secondary).toBe('#654321')
    expect(snapshot.customizedGroups.primary).toBe(false)
    expect(snapshot.customizedGroups.secondary).toBe(true)
  })

  it('resets every group to the active theme defaults while keeping the theme itself', () => {
    const repository = new MemoryRepository()
    const viewModel = new BrandMirrorViewModel(repository)
    viewModel.initialize()
    viewModel.updateColor('primary', '#123456')
    viewModel.selectTheme('night')
    viewModel.updateScale('typeScale', 0, 20)
    viewModel.resetAll()
    const snapshot = viewModel.getSnapshot()
    expect(snapshot.theme).toBe('night')
    expect(snapshot.tokens).toEqual(THEME_PRESETS.night.tokens)
    expect(snapshot.customizedCount).toBe(0)
    expect(repository.document?.overrides).toEqual({})
  })

  it('saved versions, persistence and export all reflect the resolved tokens', () => {
    const repository = new MemoryRepository()
    const exporter = new MemoryExporter()
    const viewModel = new BrandMirrorViewModel(repository, exporter)
    viewModel.initialize()
    viewModel.updateColor('primary', '#123456')
    viewModel.selectTheme('night')
    viewModel.saveVersion()
    const snapshot = viewModel.getSnapshot()
    const saved = snapshot.versions[0]
    expect(saved.theme).toBe('night')
    expect(saved.tokens.primary).toBe('#123456')
    expect(saved.tokens.radiusScale).toEqual(THEME_PRESETS.night.tokens.radiusScale)
    viewModel.exportBrandGuidelines()
    expect(exporter.received).toContain('#123456')
    expect(exporter.received).toContain('Night signal')
    expect(exporter.received).toContain('我的调整')
    expect(exporter.received).toContain(`${THEME_PRESETS.night.tokens.secondary}`)
  })
})
