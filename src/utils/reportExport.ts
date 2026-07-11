import type { ReportDetailVo, ReportSection } from '@/api/report'

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function sectionHtml(section: ReportSection, chartSrc?: string): string {
  const parts: string[] = [`<h2>${esc(section.title)}</h2>`]
  if (section.type === 'summary') {
    if (section.summary) parts.push(`<p>${esc(section.summary)}</p>`)
    if (section.kv?.length) {
      parts.push('<table border="1" cellspacing="0" cellpadding="4" style="border-collapse:collapse;font-size:13px;"><tbody>')
      for (const item of section.kv) {
        parts.push(`<tr><td style="background:#f5f6f8;width:120px;">${esc(item.label)}</td><td>${esc(item.value)}</td></tr>`)
      }
      parts.push('</tbody></table>')
    }
  } else if (section.type === 'table') {
    if (!section.rows?.length) {
      parts.push(`<p style="color:#888;">${esc(section.emptyText || '暂无数据')}</p>`)
    } else {
      parts.push('<table border="1" cellspacing="0" cellpadding="4" style="border-collapse:collapse;font-size:13px;width:100%;"><thead><tr>')
      for (const col of section.columns ?? []) {
        parts.push(`<th style="background:#f5f6f8;">${esc(col.label)}</th>`)
      }
      parts.push('</tr></thead><tbody>')
      for (const row of section.rows) {
        parts.push('<tr>')
        for (const col of section.columns ?? []) {
          parts.push(`<td>${esc(row[col.key])}</td>`)
        }
        parts.push('</tr>')
      }
      parts.push('</tbody></table>')
    }
  } else if (section.type === 'list') {
    parts.push('<ol>')
    for (const item of section.items ?? []) {
      parts.push(`<li>${esc(item)}</li>`)
    }
    parts.push('</ol>')
  } else if (section.type === 'chart') {
    if (chartSrc) {
      parts.push(`<img src="${chartSrc}" width="640" style="max-width:100%;">`)
    } else {
      parts.push('<p style="color:#888;">（趋势图请在报告预览页导出以获取图片）</p>')
    }
  }
  return parts.join('\n')
}

/**
 * 报告归档正文 → 完整 HTML 文档（Word 可打开编辑）。
 * chartImages：chart 分段索引 → PNG dataURL（由预览页从已渲染 ECharts 截图提供）；
 * imgMode=inline 直接内嵌 dataURL（HTML 导出），imgMode=ref 引用 chart_i.png 附件名（MHTML/Word 导出）。
 */
export function buildReportHtml(
  report: ReportDetailVo,
  chartImages?: Map<number, string>,
  imgMode: 'inline' | 'ref' = 'inline'
): string {
  const sections = report.content?.sections ?? []
  const body = sections
    .map((s, idx) => {
      const dataUrl = chartImages?.get(idx)
      const src = dataUrl ? (imgMode === 'inline' ? dataUrl : `chart_${idx}.png`) : undefined
      return sectionHtml(s, src)
    })
    .join('\n')
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(report.title)}</title></head>
<body style="font-family:'Microsoft YaHei',sans-serif;max-width:800px;">
<h1>${esc(report.title)}</h1>
<p style="color:#888;">报告编号：${esc(report.reportCode)}｜生成时间：${esc(report.generateTime)}｜范围：${esc(report.scopeText || '-')}</p>
${body}
<p style="text-align:center;color:#aaa;margin-top:24px;">--- 报告结束 ---<br>本报告由数据库监控平台自动生成</p>
</body></html>`
}

/** 组装 MHTML（multipart/related）：HTML 正文 + PNG 附件，img src 与 Content-Location 对应 */
export function buildMhtml(html: string, images: { name: string; base64: string }[]): string {
  const boundary = '----=_NextPart_MonitorReport'
  const parts: string[] = [
    'MIME-Version: 1.0',
    `Content-Type: multipart/related; boundary="${boundary}"; type="text/html"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="utf-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    html,
    ''
  ]
  for (const img of images) {
    parts.push(
      `--${boundary}`,
      `Content-Location: ${img.name}`,
      'Content-Type: image/png',
      'Content-Transfer-Encoding: base64',
      '',
      img.base64.replace(/(.{76})/g, '$1\r\n'),
      ''
    )
  }
  parts.push(`--${boundary}--`)
  return parts.join('\r\n')
}

/**
 * 以 .doc 形式下载（Word 可编辑）。
 * 含图片（chartImages 提供 dataURL）时用 MHTML 打包内嵌，否则纯 HTML。
 */
export function downloadWord(html: string, filename: string, chartImages?: Map<number, string>) {
  let content: string
  if (chartImages && chartImages.size > 0) {
    const images = [...chartImages.entries()].map(([idx, dataUrl]) => ({
      name: `chart_${idx}.png`,
      base64: dataUrl.replace(/^data:image\/png;base64,/, '')
    }))
    content = buildMhtml(html, images)
  } else {
    content = '\ufeff' + html
  }
  const blob = new Blob([content], { type: 'application/msword;charset=utf-8' })
  triggerDownload(blob, filename)
}

/**
 * 打印报告：将完整报告 HTML 写入隐藏 iframe 后仅打印该 iframe，
 * 避免 window.print() 把顶栏、侧边菜单一起打印、且滚动区域内容被裁剪的问题。
 */
export function printHtml(html: string) {
  const printCss = `<style>
    @page { margin: 14mm 16mm; }
    body { font-family: 'Microsoft YaHei', sans-serif; color: #1f2d3d; }
    h1 { font-size: 22px; text-align: center; }
    h2 { font-size: 15px; border-left: 4px solid #0c7c97; padding-left: 8px; margin: 22px 0 10px; }
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; }
    img { max-width: 100%; }
  </style>`
  const docHtml = html.includes('</head>') ? html.replace('</head>', `${printCss}</head>`) : printCss + html

  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;'
  document.body.appendChild(iframe)
  const doc = iframe.contentDocument
  const win = iframe.contentWindow
  if (!doc || !win) {
    document.body.removeChild(iframe)
    return
  }
  doc.open()
  doc.write(docHtml)
  doc.close()

  const cleanup = () => {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe)
  }
  win.addEventListener('afterprint', () => setTimeout(cleanup, 100))
  // 等待 dataURL 图片渲染完成后再打印；afterprint 不触发时兜底移除
  setTimeout(() => {
    win.focus()
    win.print()
    setTimeout(cleanup, 60_000)
  }, 200)
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
