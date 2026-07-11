<template>
  <div>
  <!-- 参数调优建议（规则化体检，只出建议不出手） -->
  <div class="advice-block">
    <div class="advice-head">
      <span class="advice-title">参数调优建议</span>
      <el-button size="small" :loading="adviceLoading" @click="loadAdvice">
        {{ adviceLoaded ? '重新体检' : '一键体检' }}
      </el-button>
    </div>
    <template v-if="adviceLoaded">
      <el-alert
        v-if="!advices.length"
        type="success"
        show-icon
        :closable="false"
        title="参数体检未发现明显问题：关键参数配置与当前运行指标匹配良好"
      />
      <template v-else>
        <el-alert
          type="warning"
          show-icon
          :closable="false"
          title="以下建议基于已采集的配置参数与运行指标自动生成，仅供参考；任何参数调整须人工评估并通过变更流程执行，系统不会自动修改参数。"
          class="advice-alert"
        />
        <div v-for="(a, i) in advices" :key="i" class="advice-card">
          <div class="advice-card-head">
            <el-tag :type="a.level === 'warning' ? 'warning' : 'info'" size="small">
              {{ a.level === 'warning' ? '建议评估' : '提示' }}
            </el-tag>
            <span class="advice-param mono">{{ a.paramName }}</span>
            <span class="advice-display">{{ a.displayName }}</span>
            <span class="advice-current">当前值：{{ a.currentValue }}</span>
          </div>
          <div class="advice-observation">观察：{{ a.observation }}</div>
          <div class="advice-suggestion">建议：{{ a.advice }}</div>
        </div>
      </template>
    </template>
  </div>

  <ProTable
    :data="params"
    :columns="columns"
    :loading="loading"
    :total="total"
    v-model:page-num="pageNum"
    v-model:page-size="pageSize"
    :page-sizes="[20, 50, 100]"
    :show-add="false"
    :show-export="true"
    show-operation
    :operation-width="120"
    :collapsible="false"
    @search="onSearch"
    @reset="onReset"
    @export="exportConfig"
    @page-change="loadParams"
  >
    <!-- 搜索条件 -->
    <template #search>
      <el-form-item label="参数名称">
        <el-input
          v-model="keyword"
          placeholder="搜索参数名称或说明"
          clearable
          style="width: 220px"
        />
      </el-form-item>
      <el-form-item label="分类">
        <el-select v-model="categoryFilter" placeholder="全部分类" clearable style="width: 140px">
          <el-option label="性能优化" value="performance" />
          <el-option label="连接管理" value="connection" />
          <el-option label="日志配置" value="logging" />
          <el-option label="复制设置" value="replication" />
          <el-option label="缓存配置" value="cache" />
        </el-select>
      </el-form-item>
    </template>

    <!-- 当前值列 -->
    <template #col-value="{ row }">
      <div class="cell-value">
        <el-tooltip
          v-if="row.hasValue"
          :content="row.value ?? ''"
          placement="top"
          :show-after="300"
        >
          <el-tag type="primary" size="small" class="mono value-text">{{ row.value }}</el-tag>
        </el-tooltip>
        <span v-else class="no-data">-</span>
      </div>
    </template>

    <!-- 类型列 -->
    <template #col-isDynamic="{ row }">
      <el-tag :type="row.isDynamic ? 'success' : 'info'" size="small">
        {{ row.isDynamic ? '动态' : '静态' }}
      </el-tag>
    </template>

    <!-- 分类列 -->
    <template #col-category="{ row }">{{ catLabel(row.category) }}</template>

    <!-- 操作列 -->
    <template #operation="{ row }">
      <el-button
        link type="primary" size="small"
        :disabled="!row.isDynamic"
        :title="row.isDynamic ? '' : '静态参数需重启后生效，暂不支持在线修改'"
        @click="modifyParam(row as ParamPageItemVo)"
      >修改</el-button>
      <el-button link type="primary" size="small" @click="viewHistory(row as ParamPageItemVo)">历史</el-button>
    </template>
  </ProTable>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import ProTable from '@/components/ProTable/index.vue'
import { pageParams, getParamAdvice } from '@/api/metric'
import type { ParamPageItemVo, ParamAdviceVo } from '@/types/monitor'
import type { TableColumn } from '@/components/ProTable/types'

const props = defineProps<{ instanceId: number }>()

const loading        = ref(false)
const keyword        = ref('')
const categoryFilter = ref('')
const pageNum        = ref(1)
const pageSize       = ref(20)
const total          = ref(0)
const params         = ref<ParamPageItemVo[]>([])

const columns: TableColumn[] = [
  { prop: 'paramName',   label: '参数名称', minWidth: 160, fixed: true, showOverflowTooltip: true },
  { prop: 'value',       label: '当前值',   minWidth: 160, slot: 'col-value' },
  { prop: 'isDynamic',   label: '类型',     width: 80,    slot: 'col-isDynamic' },
  { prop: 'category',    label: '分类',     width: 100,   slot: 'col-category' },
  { prop: 'description', label: '说明',     minWidth: 200, showOverflowTooltip: true },
]

const CAT_LABEL: Record<string, string> = {
  performance: '性能优化',
  connection:  '连接管理',
  logging:     '日志配置',
  replication: '复制设置',
  cache:       '缓存配置'
}
function catLabel(c: string | null) { return c ? (CAT_LABEL[c] ?? c) : '-' }

function modifyParam(row: ParamPageItemVo) {
  ElMessageBox.prompt(
    `修改参数 ${row.paramName}（当前值：${row.value ?? '-'}）`, '在线修改',
    { confirmButtonText: '确认', cancelButtonText: '取消', inputValue: row.value ?? '', inputPlaceholder: '请输入新值' }
  ).then(({ value }) => {
    ElMessage.info(`已提交修改：${row.paramName} = ${value}（需后端接口支持）`)
  }).catch(() => {})
}

function viewHistory(row: ParamPageItemVo) {
  ElMessage.info(`参数 ${row.paramName} 历史变更（需后端接口支持）`)
}

function exportConfig() {
  const lines = params.value.map(p => `${p.paramName} = ${p.value ?? ''}  # ${p.description ?? ''}`)
  const blob = new Blob(['# MySQL 参数配置导出\n' + lines.join('\n')], { type: 'text/plain' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = 'mysql-params.cnf'; a.click()
  URL.revokeObjectURL(url)
  ElMessage.success('导出成功')
}

async function loadParams() {
  if (!props.instanceId) return
  loading.value = true
  try {
    const r = await pageParams({
      instanceId: props.instanceId,
      keyword:    keyword.value  || undefined,
      category:   categoryFilter.value || undefined,
      pageNum:    pageNum.value,
      pageSize:   pageSize.value
    })
    params.value = r.list  ?? []
    total.value  = r.total ?? 0
  } finally {
    loading.value = false
  }
}

function onSearch() { pageNum.value = 1; loadParams() }
function onReset()  { keyword.value = ''; categoryFilter.value = ''; pageNum.value = 1; loadParams() }

// ── 参数调优建议 ─────────────────────────────────────────────────────────
const adviceLoading = ref(false)
const adviceLoaded  = ref(false)
const advices       = ref<ParamAdviceVo[]>([])

async function loadAdvice() {
  if (!props.instanceId) return
  adviceLoading.value = true
  try {
    advices.value = await getParamAdvice(props.instanceId) ?? []
    adviceLoaded.value = true
  } finally {
    adviceLoading.value = false
  }
}

watch(() => props.instanceId, () => {
  pageNum.value = 1
  adviceLoaded.value = false
  advices.value = []
  loadParams()
}, { immediate: true })
</script>

<style scoped>
/* 搜索卡片：浅背景色区分搜索区，去掉多余边框 */
:deep(.search-card) {
  background: var(--el-fill-color-light);
  border-color: var(--el-border-color-lighter);
  box-shadow: none;
  border-radius: var(--radius-sm);
}
:deep(.search-card .el-card__body) {
  padding: 10px 16px !important;
}

/* 列表卡片：去掉卡片边框/阴影，内边距清零 */
:deep(.table-card) {
  border: none;
  box-shadow: none;
  border-radius: 0;
  margin-top: 4px;
}
:deep(.table-card .el-card__body) {
  padding: 0 !important;
}

.mono { font-family: var(--font-mono, 'JetBrains Mono', monospace); font-size: 12px; }

/* 参数调优建议 */
.advice-block {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--radius-sm);
  padding: 12px 16px;
  margin-bottom: 12px;
  background: var(--el-fill-color-blank);
}
.advice-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}
.advice-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.advice-alert {
  margin: 8px 0 10px;
}
.advice-card {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  margin-bottom: 8px;
}
.advice-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.advice-param {
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.advice-display {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.advice-current {
  font-size: 12px;
  color: var(--el-text-color-regular);
  margin-left: auto;
}
.advice-observation {
  font-size: 12px;
  color: var(--el-text-color-regular);
  margin-top: 6px;
  line-height: 1.6;
}
.advice-suggestion {
  font-size: 12px;
  color: var(--el-text-color-primary);
  margin-top: 4px;
  line-height: 1.6;
}
.no-data { color: var(--el-text-color-placeholder); }

.cell-value {
  display: flex;
  align-items: center;
  height: 100%;
  overflow: hidden;
}
.value-text {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}
.value-text :deep(.el-tag__content) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
