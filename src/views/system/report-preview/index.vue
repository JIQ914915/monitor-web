<template>
  <div class="preview-page">
    <div class="preview-toolbar">
      <el-button :icon="ArrowLeft" @click="goBack">返回报告中心</el-button>
      <div class="toolbar-right">
        <el-button :icon="Printer" @click="handlePrint">打印报告</el-button>
        <el-button type="primary" :icon="Download" @click="handleExportWord">导出 Word</el-button>
      </div>
    </div>

    <div v-loading="loading" class="preview-body">
      <el-empty v-if="!loading && !report" description="报告不存在或已被删除" />

      <div v-else-if="report" class="report-paper" id="report-paper">
        <!-- 报告头部 -->
        <div class="report-header">
          <h1>{{ report.title }}</h1>
          <div class="report-meta">
            <span>报告编号：{{ report.reportCode }}</span>
            <span>生成时间：{{ report.generateTime }}</span>
            <span>报告范围：{{ report.scopeText || '-' }}</span>
            <span>时间范围：{{ getDictLabel('report_time_range', report.timeRange) }}</span>
            <span>生成方式：{{ getDictLabel('report_gen_mode', report.genMode) }}</span>
          </div>
        </div>

        <!-- 分段正文 -->
        <div v-for="(section, idx) in sections" :key="idx" class="report-section">
          <h2>{{ section.title }}</h2>

          <!-- 结论 + 键值对 -->
          <template v-if="section.type === 'summary'">
            <p v-if="section.summary" class="section-summary">{{ section.summary }}</p>
            <table v-if="section.kv?.length" class="kv-table">
              <tbody>
                <tr v-for="item in section.kv" :key="item.label">
                  <td class="kv-label">{{ item.label }}</td>
                  <td>{{ item.value }}</td>
                </tr>
              </tbody>
            </table>
          </template>

          <!-- 数据表格 -->
          <template v-else-if="section.type === 'table'">
            <p v-if="!section.rows?.length" class="section-empty">{{ section.emptyText || '暂无数据' }}</p>
            <table v-else class="data-table">
              <thead>
                <tr>
                  <th v-for="col in section.columns" :key="col.key">{{ col.label }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, ri) in section.rows" :key="ri">
                  <td v-for="col in section.columns" :key="col.key" :class="{ 'sql-cell': col.key === 'sql' }">{{ row[col.key] }}</td>
                </tr>
              </tbody>
            </table>
          </template>

          <!-- 建议条目 -->
          <ol v-else-if="section.type === 'list'" class="tips-list">
            <li v-for="(item, ii) in section.items" :key="ii">{{ item }}</li>
          </ol>

          <!-- 趋势折线图（ECharts 渲染，导出时截图嵌入） -->
          <ReportChart
            v-else-if="section.type === 'chart'"
            :ref="el => setChartRef(idx, el)"
            :section="section"
          />
        </div>

        <div class="report-footer">
          <p>--- 报告结束 ---</p>
          <p class="footer-note">本报告由数据库监控平台自动生成</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Download, Printer } from '@element-plus/icons-vue'
import { useDict } from '@/composables/useDict'
import { getReportDetail, type ReportDetailVo, type ReportSection } from '@/api/report'
import { buildReportHtml, downloadWord, printHtml } from '@/utils/reportExport'
import ReportChart from './ReportChart.vue'

const route = useRoute()
const router = useRouter()
const { getDictLabel } = useDict('report_type', 'report_time_range', 'report_gen_mode')

const loading = ref(true)
const report = ref<ReportDetailVo | null>(null)
const sections = computed<ReportSection[]>(() => report.value?.content?.sections ?? [])

// chart 分段组件引用（按分段索引），导出时截取趋势图 PNG
const chartRefs = new Map<number, { getImage: () => string | null }>()
function setChartRef(idx: number, el: unknown) {
  if (el) chartRefs.set(idx, el as { getImage: () => string | null })
  else chartRefs.delete(idx)
}

/** 收集所有已渲染 chart 分段的 PNG dataURL（分段索引 → dataURL） */
function collectChartImages(): Map<number, string> {
  const images = new Map<number, string>()
  chartRefs.forEach((chart, idx) => {
    const dataUrl = chart.getImage()
    if (dataUrl) images.set(idx, dataUrl)
  })
  return images
}

async function load() {
  const id = Number(route.query.id)
  if (!id) {
    loading.value = false
    return
  }
  loading.value = true
  try {
    report.value = await getReportDetail(id)
  } catch {
    report.value = null
  } finally {
    loading.value = false
  }
}

function goBack() {
  router.push('/system/report')
}

function handlePrint() {
  if (!report.value) return
  const charts = collectChartImages()
  const html = buildReportHtml(report.value, charts, 'inline')
  printHtml(html)
}

function handleExportWord() {
  if (!report.value) return
  const charts = collectChartImages()
  const html = buildReportHtml(report.value, charts, 'ref')
  downloadWord(html, `${report.value.title}_${report.value.reportCode}.doc`, charts)
  ElMessage.success(charts.size ? '报告已导出（Word 可编辑，含趋势图）' : '报告已导出（Word 可编辑）')
}

onMounted(load)
</script>

<style scoped>
.preview-page {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.preview-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.toolbar-right {
  display: flex;
  gap: 8px;
}
.preview-body {
  min-height: 300px;
}

/* 纸张式排版 */
.report-paper {
  max-width: 900px;
  margin: 0 auto;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--radius-base);
  box-shadow: 0 1px 4px rgba(14, 26, 43, 0.08);
  padding: 40px 48px;
}
.report-header h1 {
  margin: 0 0 12px;
  font-size: 24px;
  text-align: center;
  color: var(--el-text-color-primary);
}
.report-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 18px;
  justify-content: center;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  padding-bottom: 16px;
  border-bottom: 2px solid var(--el-border-color);
}
.report-section {
  margin-top: 26px;
}
.report-section h2 {
  font-size: 16px;
  margin: 0 0 10px;
  padding-left: 8px;
  border-left: 4px solid var(--signal, #0c7c97);
  color: var(--el-text-color-primary);
}
.section-summary {
  font-size: 13px;
  line-height: 1.8;
  color: var(--el-text-color-regular);
  margin: 0 0 10px;
}
.section-empty {
  font-size: 13px;
  color: var(--el-text-color-placeholder);
  margin: 4px 0;
}

/* 键值对表格 */
.kv-table {
  border-collapse: collapse;
  font-size: 13px;
  width: 100%;
}
.kv-table td {
  border: 1px solid var(--el-border-color-lighter);
  padding: 6px 12px;
  color: var(--el-text-color-regular);
}
.kv-label {
  width: 140px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-secondary);
}

/* 数据表格 */
.data-table {
  border-collapse: collapse;
  font-size: 13px;
  width: 100%;
}
.data-table th,
.data-table td {
  border: 1px solid var(--el-border-color-lighter);
  padding: 6px 10px;
  text-align: left;
  color: var(--el-text-color-regular);
}
.data-table th {
  background: var(--el-fill-color-light);
  color: var(--el-text-color-secondary);
  font-weight: 600;
  white-space: nowrap;
}
.sql-cell {
  font-family: var(--font-mono, monospace);
  font-size: 12px;
  word-break: break-all;
}

/* 建议列表 */
.tips-list {
  margin: 4px 0 0;
  padding-left: 22px;
  font-size: 13px;
  line-height: 2;
  color: var(--el-text-color-regular);
}

.report-footer {
  margin-top: 32px;
  text-align: center;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}
.report-footer p {
  margin: 4px 0;
}
</style>
