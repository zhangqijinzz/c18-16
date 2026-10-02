import { GROUP_LABELS, TOKEN_GROUPS, THEME_PRESETS, type BrandMirrorSnapshot, type TokenGroupKey } from '../models/brandMirrorModels'

export interface BrandGuidelinesExporter {
  export(snapshot: BrandMirrorSnapshot): void
}

function groupSource(group: TokenGroupKey, snapshot: BrandMirrorSnapshot): string {
  return snapshot.customizedGroups[group] ? '我的调整' : `${THEME_PRESETS[snapshot.theme].label} 默认`
}

function scaleRows(values: number[], key: string): string {
  return values.map((value, index) => `- \`${key}.${index + 1}\`: ${value}px`).join('\n')
}

export function buildBrandGuidelinesMarkdown(snapshot: BrandMirrorSnapshot): string {
  const { tokens } = snapshot
  const themeLabel = THEME_PRESETS[snapshot.theme].label
  const versions = snapshot.versions.length === 0
    ? '- 暂无保存版本'
    : snapshot.versions
      .map((version) => `- ${version.label} · ${version.createdAt.slice(0, 10)} · 基础主题 ${THEME_PRESETS[version.theme].label} · 主色 ${version.tokens.primary} · 辅助色 ${version.tokens.secondary}`)
      .join('\n')
  const groupProvenance = TOKEN_GROUPS.map((group) => `| ${GROUP_LABELS[group]} | ${groupSource(group, snapshot)} |`).join('\n')
  return `# BrandMirror 品牌规范

> 导出时间：${new Date().toISOString().slice(0, 10)}
> 基础主题：${themeLabel}
> 用户自定义组：${snapshot.customizedCount} / ${TOKEN_GROUPS.length}

## 调整来源

| 令牌组 | 来源 |
| --- | --- |
${groupProvenance}

## 品牌色

| 令牌 | 值 | 来源 |
| --- | --- | --- |
| 主色 \`primary\` | \`${tokens.primary}\` | ${groupSource('primary', snapshot)} |
| 辅助色 \`secondary\` | \`${tokens.secondary}\` | ${groupSource('secondary', snapshot)} |
| 对比度 | ${snapshot.contrastRatio.toFixed(1)}:1 | — |

## 圆角尺度

${scaleRows(tokens.radiusScale, 'radius')}

> 来源：${groupSource('radiusScale', snapshot)}

## 间距体系

${scaleRows(tokens.spacingScale, 'spacing')}

> 来源：${groupSource('spacingScale', snapshot)}

## 字体比例

${scaleRows(tokens.typeScale, 'type')}

> 来源：${groupSource('typeScale', snapshot)}

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
