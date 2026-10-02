import type { BrandMirrorSnapshot, BrandTheme, TokenGroupKey } from '../models/brandMirrorModels'

interface TokenControlsProps {
  snapshot: BrandMirrorSnapshot
  onThemeChange: (theme: BrandTheme) => void
  onColorChange: (field: 'primary' | 'secondary', value: string) => void
  onScaleChange: (field: 'radiusScale' | 'spacingScale' | 'typeScale', index: number, value: number) => void
  onResetGroup: (group: TokenGroupKey) => void
  onResetAll: () => void
}

const themes: { id: BrandTheme; label: string; note: string }[] = [
  { id: 'studio', label: 'Studio warm', note: '热烈 · 友好' },
  { id: 'editorial', label: 'Editorial green', note: '克制 · 自然' },
  { id: 'night', label: 'Night signal', note: '锐利 · 数字' },
]

export function TokenControls({ snapshot, onThemeChange, onColorChange, onScaleChange, onResetGroup, onResetAll }: TokenControlsProps) {
  return (
    <aside className="control-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">01 / TOKENS</span>
          <h2>视觉令牌</h2>
        </div>
        <button className="text-button" type="button" onClick={onResetAll} disabled={snapshot.customizedCount === 0}>全部恢复主题默认</button>
      </div>

      <section className="control-section">
        <div className="section-label"><span>基础主题</span><span className="muted">起点，不是覆盖</span></div>
        <div className="theme-list">
          {themes.map((theme) => (
            <button className={`theme-option ${snapshot.theme === theme.id ? 'selected' : ''}`} key={theme.id} onClick={() => onThemeChange(theme.id)} type="button">
              <span className={`theme-dot ${theme.id}`} />
              <span><strong>{theme.label}</strong><small>{theme.note}</small></span>
              {snapshot.theme === theme.id && <span className="check-mark">✓</span>}
            </button>
          ))}
        </div>
        <p className="theme-hint">切换主题只更换未调整的组{snapshot.customizedCount > 0 ? `，你的 ${snapshot.customizedCount} 组调整会保留` : ''}；每组可单独恢复默认。</p>
      </section>

      <section className="control-section">
        <GroupLabel text="品牌色" hint="HEX / 6 位" customized={snapshot.customizedGroups.primary || snapshot.customizedGroups.secondary} />
        <div className="color-fields">
          <ColorField label="主色" value={snapshot.tokens.primary} customized={snapshot.customizedGroups.primary} onReset={() => onResetGroup('primary')} onChange={(value) => onColorChange('primary', value)} />
          <ColorField label="辅助色" value={snapshot.tokens.secondary} customized={snapshot.customizedGroups.secondary} onReset={() => onResetGroup('secondary')} onChange={(value) => onColorChange('secondary', value)} />
        </div>
        <div className={`contrast-note ${snapshot.contrastWarning ? 'warning' : ''}`}>
          <span className="contrast-icon">◐</span>
          <span>对比度 <strong>{snapshot.contrastRatio.toFixed(1)}:1</strong> · {snapshot.contrastWarning ? '建议提高对比度' : '适合界面使用'}</span>
        </div>
      </section>

      <ScaleControl label="圆角尺度" hint="px" values={snapshot.tokens.radiusScale} field="radiusScale" customized={snapshot.customizedGroups.radiusScale} onChange={onScaleChange} onReset={onResetGroup} />
      <ScaleControl label="间距体系" hint="px" values={snapshot.tokens.spacingScale} field="spacingScale" customized={snapshot.customizedGroups.spacingScale} onChange={onScaleChange} onReset={onResetGroup} />
      <ScaleControl label="字体比例" hint="px" values={snapshot.tokens.typeScale} field="typeScale" customized={snapshot.customizedGroups.typeScale} onChange={onScaleChange} onReset={onResetGroup} />

      <div className="panel-footer"><span className="live-dot" />所有调整实时同步到预览、版本与导出</div>
    </aside>
  )
}

function GroupLabel({ text, hint, customized, resettable = customized, onReset }: { text: string; hint: string; customized: boolean; resettable?: boolean; onReset?: () => void }) {
  return (
    <div className="section-label">
      <span className="group-label-text">{text}{customized && <span className="custom-chip">我的调整</span>}</span>
      <span className="section-label-right"><span className="muted">{hint}</span>{resettable && onReset && <button className="group-reset" type="button" onClick={onReset}>恢复此组</button>}</span>
    </div>
  )
}

function ColorField({ label, value, customized, onReset, onChange }: { label: string; value: string; customized: boolean; onReset: () => void; onChange: (value: string) => void }) {
  return <label className="color-field"><span className="color-field-label">{label}{customized && <button className="inline-reset" type="button" onClick={(event) => { event.preventDefault(); onReset() }}>恢复</button>}</span><div className="color-input"><input aria-label={label} type="color" value={value} onChange={(event) => onChange(event.target.value)} /><input aria-label={`${label} HEX`} value={value} onChange={(event) => onChange(event.target.value)} /></div></label>
}

function ScaleControl({ label, hint, values, field, customized, onChange, onReset }: { label: string; hint: string; values: number[]; field: 'radiusScale' | 'spacingScale' | 'typeScale'; customized: boolean; onChange: (field: 'radiusScale' | 'spacingScale' | 'typeScale', index: number, value: number) => void; onReset: (group: TokenGroupKey) => void }) {
  return <section className="control-section scale-section"><GroupLabel text={label} hint={hint} customized={customized} onReset={() => onReset(field)} /><div className="scale-inputs">{values.map((value, index) => <label key={`${field}-${index}`}><span>{index + 1}</span><input aria-label={`${label}${index + 1}`} type="number" min={field === 'typeScale' ? 10 : 0} max={field === 'typeScale' ? 72 : field === 'spacingScale' ? 64 : 40} value={value} onChange={(event) => onChange(field, index, Number(event.target.value))} /></label>)}</div></section>
}
