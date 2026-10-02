import type { BrandMirrorSnapshot, BrandTheme, TokenColorField, TokenGroupKey, TokenScaleField } from '../models/brandMirrorModels'
import { TOKEN_GROUP_LABELS } from '../models/brandMirrorModels'
import { isFieldOverridden, themeLabel } from '../domain/brandRules'

interface TokenControlsProps {
  snapshot: BrandMirrorSnapshot
  onThemeChange: (theme: BrandTheme) => void
  onThemeConfirm: (keepAdjustments: boolean) => void
  onThemeCancel: () => void
  onColorChange: (field: 'primary' | 'secondary', value: string) => void
  onScaleChange: (field: TokenScaleField, index: number, value: number) => void
  onResetGroup: (group: TokenGroupKey) => void
  onResetAll: () => void
}

const themes: { id: BrandTheme; label: string; note: string }[] = [
  { id: 'studio', label: 'Studio warm', note: '热烈 · 友好' },
  { id: 'editorial', label: 'Editorial green', note: '克制 · 自然' },
  { id: 'night', label: 'Night signal', note: '锐利 · 数字' },
]

export function TokenControls({ snapshot, onThemeChange, onThemeConfirm, onThemeCancel, onColorChange, onScaleChange, onResetGroup, onResetAll }: TokenControlsProps) {
  const isCustom = (group: TokenGroupKey) => snapshot.customizedGroups.includes(group)
  return (
    <aside className="control-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">01 / TOKENS</span>
          <h2>视觉令牌</h2>
        </div>
        <button className="text-button" type="button" onClick={onResetAll} disabled={snapshot.customizedGroups.length === 0}>
          全部回到主题默认
        </button>
      </div>

      <section className="control-section">
        <div className="section-label"><span>基础主题</span><span className="muted">快速起点</span></div>
        <div className="theme-list">
          {themes.map((theme) => (
            <button className={`theme-option ${snapshot.theme === theme.id ? 'selected' : ''}`} key={theme.id} onClick={() => onThemeChange(theme.id)} type="button">
              <span className={`theme-dot ${theme.id}`} />
              <span><strong>{theme.label}</strong><small>{theme.note}</small></span>
              {snapshot.theme === theme.id && <span className="check-mark">✓</span>}
            </button>
          ))}
        </div>
        {snapshot.pendingTheme && (
          <div className="theme-confirm" role="dialog" aria-label="确认切换主题">
            <p><strong>切换到 {themeLabel(snapshot.pendingTheme)}？</strong></p>
            <p className="theme-confirm-copy">该主题的默认值会整体换入。你已经调整过的部分可以保留，仍作为你的自定义覆盖在新主题之上。</p>
            {snapshot.customizedGroups.length > 0 && (
              <ul className="theme-confirm-groups">
                {snapshot.customizedGroups.map((group) => <li key={group}>保留：{TOKEN_GROUP_LABELS[group]}</li>)}
              </ul>
            )}
            <div className="theme-confirm-actions">
              <button className="primary-button" type="button" onClick={() => onThemeConfirm(true)}>保留我的调整</button>
              <button className="secondary-button" type="button" onClick={() => onThemeConfirm(false)}>放弃，用主题默认</button>
              <button className="text-button" type="button" onClick={onThemeCancel}>取消</button>
            </div>
          </div>
        )}
        <p className="theme-source-note">主题决定起点；标记为「我的调整」的分组不会在切换时被覆盖。</p>
      </section>

      <section className="control-section">
        <div className="section-label">
          <span><GroupTag active={isCustom('color')} />品牌色</span>
          {isCustom('color')
            ? <button className="text-button reset-group-button" type="button" onClick={() => onResetGroup('color')}>恢复本组默认</button>
            : <span className="muted">HEX / 6 位 · 跟随主题</span>}
        </div>
        <div className="color-fields">
          <ColorField label="主色" value={snapshot.tokens.primary} customized={isFieldCustom(snapshot, 'primary')} onChange={(value) => onColorChange('primary', value)} />
          <ColorField label="辅助色" value={snapshot.tokens.secondary} customized={isFieldCustom(snapshot, 'secondary')} onChange={(value) => onColorChange('secondary', value)} />
        </div>
        <div className={`contrast-note ${snapshot.contrastWarning ? 'warning' : ''}`}>
          <span className="contrast-icon">◐</span>
          <span>对比度 <strong>{snapshot.contrastRatio.toFixed(1)}:1</strong> · {snapshot.contrastWarning ? '建议提高对比度' : '适合界面使用'}</span>
        </div>
      </section>

      <ScaleControl label="圆角尺度" hint="px" values={snapshot.tokens.radiusScale} field="radiusScale" customized={isCustom('radiusScale')} onChange={onScaleChange} onReset={() => onResetGroup('radiusScale')} />
      <ScaleControl label="间距体系" hint="px" values={snapshot.tokens.spacingScale} field="spacingScale" customized={isCustom('spacingScale')} onChange={onScaleChange} onReset={() => onResetGroup('spacingScale')} />
      <ScaleControl label="字体比例" hint="px" values={snapshot.tokens.typeScale} field="typeScale" customized={isCustom('typeScale')} onChange={onScaleChange} onReset={() => onResetGroup('typeScale')} />

      <div className="panel-footer"><span className="live-dot" />所有调整实时同步到预览、版本与导出</div>
    </aside>
  )
}

function isFieldCustom(snapshot: BrandMirrorSnapshot, field: TokenColorField): boolean {
  return isFieldOverridden(snapshot.theme, snapshot.overrides, field)
}

function GroupTag({ active }: { active: boolean }) {
  return <span className={`group-tag ${active ? 'custom' : ''}`}>{active ? '我的调整' : '跟随主题'}</span>
}

function ColorField({ label, value, customized, onChange }: { label: string; value: string; customized: boolean; onChange: (value: string) => void }) {
  return <label className="color-field"><span className="color-field-label">{customized && <span className="dot-tag" />}{label}</span><div className="color-input"><input aria-label={label} type="color" value={value} onChange={(event) => onChange(event.target.value)} /><input aria-label={`${label} HEX`} value={value} onChange={(event) => onChange(event.target.value)} /></div></label>
}

function ScaleControl({ label, hint, values, field, customized, onChange, onReset }: { label: string; hint: string; values: number[]; field: TokenScaleField; customized: boolean; onChange: (field: TokenScaleField, index: number, value: number) => void; onReset: () => void }) {
  return <section className="control-section scale-section"><div className="section-label"><span><GroupTag active={customized} />{label}</span>{customized ? <button className="text-button reset-group-button" type="button" onClick={onReset}>恢复本组默认</button> : <span className="muted">{hint} · 跟随主题</span>}</div><div className="scale-inputs">{values.map((value, index) => <label key={`${field}-${index}`}><span>{index + 1}</span><input aria-label={`${label}${index + 1}`} type="number" min={field === 'typeScale' ? 10 : 0} max={field === 'typeScale' ? 72 : field === 'spacingScale' ? 64 : 40} value={value} onChange={(event) => onChange(field, index, Number(event.target.value))} /></label>)}</div></section>
}
