import type { BrandMirrorSnapshot, TokenField } from '../models/brandMirrorModels'
import { THEME_PRESETS, TOKEN_GROUP_LABELS, type TokenGroupKey } from '../models/brandMirrorModels'
import { isFieldOverridden, themeLabel } from '../domain/brandRules'

export interface BrandGuidelinesExporter {
  export(snapshot: BrandMirrorSnapshot): void
}

function mark(snapshot: BrandMirrorSnapshot, field: TokenField): string {
  return isFieldOverridden(snapshot.theme, snapshot.overrides, field) ? '  _（你的调整）_' : ''
}

function scaleLines(snapshot: BrandMirrorSnapshot, field: Extract<TokenGroupKey, 'radiusScale' | 'spacingScale' | 'typeScale'>, keyPrefix: string): string {
  const lines = snapshot.tokens[field].map((value, index) => `- \`${keyPrefix}.${index + 1}\`: ${value}px`)
  return isFieldOverridden(snapshot.theme, snapshot.overrides, field)
    ? `${lines.join('\n')}\n\n> ${TOKEN_GROUP_LABELS[field]}已自定义，未跟随主题默认`
    : lines.join('\n')
}

export function buildBrandGuidelinesMarkdown(snapshot: BrandMirrorSnapshot): string {
  const { tokens, theme } = snapshot
  const customLabels = snapshot.customizedGroups.map((group) => TOKEN_GROUP_LABELS[group])
  const customSummary = customLabels.length > 0
    ? `自定义：${customLabels.join('、')}（其余跟随主题默认）`
    : '全部跟随主题默认'
  const versions = snapshot.versions.length === 0
    ? '- 暂无保存版本'
    : snapshot.versions
      .map((version) => {
        const versionLabel = `${version.label} · ${version.createdAt.slice(0, 10)} · 起点主题 ${themeLabel(version.theme)} · 主色 ${version.tokens.primary} · 辅助色 ${version.tokens.secondary}`
        const versionCustom = version.customizedGroups.length > 0 ? ` · 自定义 ${version.customizedGroups.map((group) => TOKEN_GROUP_LABELS[group]).join('、')}` : ''
        return `- ${versionLabel}${versionCustom}`
      })
      .join('\n')
  return `# BrandMirror 品牌规范

> 导出时间：${new Date().toISOString().slice(0, 10)}
> 起点主题：${themeLabel(theme)}（${theme}）
> ${customSummary}

## 品牌色

| 令牌 | 值 | 来源 |
| --- | --- | --- |
| 主色 \`primary\` | \`${tokens.primary}\` | ${isFieldOverridden(theme, snapshot.overrides, 'primary') ? '自定义' : '主题默认'} |
| 辅助色 \`secondary\` | \`${tokens.secondary}\` | ${isFieldOverridden(theme, snapshot.overrides, 'secondary') ? '自定义' : '主题默认'} |
| 对比度 | ${snapshot.contrastRatio.toFixed(1)}:1 | — |

主题默认色：主色 \`${THEME_PRESETS[theme].tokens.primary}\` · 辅助色 \`${THEME_PRESETS[theme].tokens.secondary}\`

## 圆角尺度${mark(snapshot, 'radiusScale')}

${scaleLines(snapshot, 'radiusScale', 'radius')}

## 间距体系${mark(snapshot, 'spacingScale')}

${scaleLines(snapshot, 'spacingScale', 'spacing')}

## 字体比例${mark(snapshot, 'typeScale')}

${scaleLines(snapshot, 'typeScale', 'type')}

## 保存版本

${versions}

---
由 BrandMirror 品牌视觉实验室生成。
`
}

export class BrowserBrandGuidelinesExporter implements BrandGuidelinesExporter {
  export(snapshot: BrandMirrorSnapshot): void {
    const content = buildBrandGuidelinesMarkdown(snapshot)
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `BrandMirror-Brand-Guidelines-${new Date().toISOString().slice(0, 10)}.md`
    link.click()
    URL.revokeObjectURL(url)
  }
}
