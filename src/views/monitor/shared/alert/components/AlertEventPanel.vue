<template>
  <div class="alert-event-panel">
    <el-row :gutter="12" class="stat-row">
      <el-col :span="6">
        <StatCard label="当前页事件" :value="total" sub="服务端总量" tone="primary" />
      </el-col>
      <el-col :span="6">
        <StatCard label="活跃事件" :value="activeCount" sub="待关注" tone="danger" />
      </el-col>
      <el-col :span="6">
        <StatCard label="已恢复" :value="recoveredCount" sub="自动恢复" tone="success" />
      </el-col>
      <el-col :span="6">
        <StatCard label="已关闭/忽略" :value="closedCount" sub="人工处置" tone="info" />
      </el-col>
    </el-row>

    <ProTable
      :data="tableData"
      :columns="columns"
      :loading="loading"
      :total="total"
      v-model:page-num="pagination.pageNum"
      v-model:page-size="pagination.pageSize"
      show-selection
      :show-add="false"
      :operation-width="180"
      :collapsible="false"
      @search="handleSearch"
      @reset="handleReset"
      @page-change="fetchList"
      @selection-change="(rows) => selectedRows = rows as AlertEventVo[]"
    >
      <template #search>
        <el-form-item label="告警级别">
          <el-select v-model="filters.ruleLevel" placeholder="全部" clearable style="width: 140px">
            <el-option
              v-for="item in getDictItems('alert_level')"
              :key="item.itemValue as string"
              :label="item.itemLabel as string"
              :value="item.itemValue as string"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="事件状态">
          <el-select v-model="filters.statusGroup" placeholder="全部" style="width: 140px">
            <el-option
              v-for="item in getDictItems('alert_event_status_group')"
              :key="item.itemValue as string"
              :label="item.itemLabel as string"
              :value="item.itemValue as string"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="事件来源">
          <el-select v-model="filters.eventSource" placeholder="全部" clearable style="width: 140px">
            <el-option
              v-for="item in getDictItems('event_source')"
              :key="item.itemValue as string"
              :label="item.itemLabel as string"
              :value="item.itemValue as string"
            />
          </el-select>
        </el-form-item>
      </template>

      <template #toolbar>
        <el-button
          v-permission="'alert_event:confirm'"
          type="success"
          :disabled="!confirmableSelectedIds.length"
          @click="handleBatchConfirm"
        >批量确认</el-button>
        <el-button
          v-permission="'alert_event:handling'"
          type="primary"
          :disabled="!handlingableSelectedIds.length"
          @click="handleBatchHandling"
        >批量受理</el-button>
        <el-button
          v-permission="'alert_event:silence'"
          type="warning"
          :disabled="!silenceableSelectedIds.length"
          @click="handleBatchSilence"
        >批量静默</el-button>
        <el-button
          v-permission="'alert_event:close'"
          type="info"
          :disabled="!closeableSelectedIds.length"
          @click="handleBatchClose"
        >批量关闭</el-button>
      </template>

      <template #col-source-type="{ row }">
        <DictTag dict="event_source" :value="(row as AlertEventVo).eventSource || 'rule'" effect="plain" />
      </template>

      <template #col-level="{ row }">
        <DictTag dict="alert_level" :value="(row as AlertEventVo).ruleLevel" effect="dark" />
      </template>

      <template #col-event-code="{ row }">
        <span class="mono">{{ row.eventCode }}</span>
      </template>

      <template #col-message="{ row }">
        <span
          class="event-msg event-msg-link"
          title="点击进入下钻分析"
          @click="goDrilldown(row as AlertEventVo)"
        >{{ buildMessage(row as AlertEventVo) }}</span>
      </template>

      <template #col-status="{ row }">
        <div class="status-cell">
          <el-tag :type="statusGroupTag((row as AlertEventVo).status)" size="small" effect="plain">
            {{ statusGroupLabel((row as AlertEventVo).status) }}
          </el-tag>
          <el-tag
            v-if="showStatusSubTag((row as AlertEventVo).status)"
            size="small"
            effect="plain"
            class="status-subtag"
          >
            {{ statusLabel((row as AlertEventVo).status) }}
          </el-tag>
        </div>
      </template>

      <template #col-duration="{ row }">
        {{ fmtDuration((row as AlertEventVo).durationSeconds) }}
      </template>

      <template #operation="{ row }">
        <el-button link type="primary" size="small" @click="showDetail(row as AlertEventVo)">详情</el-button>
        <el-button
          v-if="canConfirm(row as AlertEventVo)"
          v-permission="'alert_event:confirm'"
          link
          type="success"
          size="small"
          @click="handleConfirm(row as AlertEventVo)"
        >确认</el-button>
        <el-button
          v-if="canHandling(row as AlertEventVo)"
          v-permission="'alert_event:handling'"
          link
          type="primary"
          size="small"
          @click="handleHandling(row as AlertEventVo)"
        >受理</el-button>
        <el-button
          v-if="canSilence(row as AlertEventVo)"
          v-permission="'alert_event:silence'"
          link
          type="warning"
          size="small"
          @click="handleSilence(row as AlertEventVo)"
        >静默</el-button>
        <el-button
          v-if="canClose(row as AlertEventVo)"
          v-permission="'alert_event:close'"
          link
          type="info"
          size="small"
          @click="handleClose(row as AlertEventVo)"
        >关闭</el-button>
      </template>
    </ProTable>

    <AlertEventDetailDrawer
      v-model:visible="detailVisible"
      :event="currentDetail"
    />

    <el-dialog
      v-model="remarkDialog.visible"
      :title="remarkDialog.title"
      width="440px"
      @close="cancelRemarkDialog"
    >
      <el-form label-width="90px">
        <el-form-item v-if="remarkDialog.showSilenceHours" label="静默窗口">
          <el-input-number
            v-model="remarkDialog.silenceHours"
            :min="1"
            :max="720"
            controls-position="right"
            style="width: 160px"
          />
          <span class="hint">小时（窗口期内不再写入告警事件，也不再发送通知）</span>
        </el-form-item>
        <el-form-item label="处置备注">
          <el-input
            v-model="remarkDialog.remark"
            type="textarea"
            :rows="3"
            maxlength="500"
            show-word-limit
            placeholder="可选，记录处置说明（如原因、排查结论、后续计划）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="cancelRemarkDialog">取消</el-button>
        <el-button type="primary" @click="confirmRemarkDialog">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ProTable } from '@/components/ProTable'
import type { TableColumn } from '@/components/ProTable'
import StatCard from '@/components/StatCard.vue'
import DictTag from '@/components/DictTag.vue'
import { fmtDurationCn as fmtDuration } from '@/utils/format'
import { countAlertEvents, pageAlertEvents } from '@/api/metric'
import { closeAlertEvents, confirmAlertEvents, handlingAlertEvents, silenceAlertEvents } from '@/api/alert'
import type { AlertEventVo } from '@/types/monitor'
import { useDict } from '@/composables/useDict'
import { useInstanceStore } from '@/stores/instance'
import { getDrilldownPath } from '@/utils/instanceMenu'
import AlertEventDetailDrawer from './AlertEventDetailDrawer.vue'

const props = defineProps<{ instanceId?: number }>()

const { getDictItems, getDictLabel, getDictTagType } = useDict(
  'alert_level',
  'alert_event_status',
  'alert_event_status_group',
  'event_source'
)

const route = useRoute()
const router = useRouter()
const instanceStore = useInstanceStore()

const loading = ref(false)
const tableData = ref<AlertEventVo[]>([])
const total = ref(0)
const selectedRows = ref<AlertEventVo[]>([])
const activeCount = ref(0)
const recoveredCount = ref(0)
const closedCount = ref(0)

const filters = reactive({
  ruleLevel: '',
  statusGroup: 'firing' as 'firing' | 'recovered' | 'silenced' | 'closed' | 'all',
  eventSource: '',
  scenarioCode: ''
})

// 接收路由携带的筛选意图（如场景管理页"查看关联事件"跳转）
function applyRouteFilterIntent() {
  const src = route.query.eventSource
  const code = route.query.scenarioCode
  if (typeof src === 'string' && src) {
    filters.eventSource = src
    filters.statusGroup = 'all'
  }
  if (typeof code === 'string' && code) filters.scenarioCode = code
  if (src || code) {
    // 消费后清除，避免刷新/切换实例时反复套用
    router.replace({ query: { ...route.query, eventSource: undefined, scenarioCode: undefined } })
  }
}
applyRouteFilterIntent()
const pagination = reactive({ pageNum: 1, pageSize: 20 })

const columns: TableColumn[] = [
  { label: '来源', width: 90, align: 'center', slot: 'col-source-type' },
  { label: '告警级别', width: 90, align: 'center', slot: 'col-level' },
  { label: '告警信息', minWidth: 240, slot: 'col-message', showOverflowTooltip: true },
  { label: '状态', width: 150, align: 'center', slot: 'col-status' },
  { label: '触发时间', prop: 'triggerTime', width: 165 },
  { label: '持续时间', width: 110, slot: 'col-duration' }
]

type StatusGroup = 'firing' | 'recovered' | 'silenced' | 'closed' | 'all'
const DEFAULT_STATUS_GROUP_BY_STATUS: Record<string, Exclude<StatusGroup, 'all'>> = {
  pending: 'firing',
  confirmed: 'firing',
  handling: 'firing',
  recovered: 'recovered',
  ignored: 'silenced',
  closed: 'closed'
}

type EventAction = 'confirm' | 'handling' | 'silence' | 'close'

/** 字典缺 actions 配置时的回退映射，按严格串行处置流程：
 *  待处理只能确认，确认后才出现受理，受理（处理中）后才出现静默/关闭。 */
const DEFAULT_ACTIONS_BY_STATUS: Record<string, EventAction[]> = {
  pending: ['confirm'],
  confirmed: ['handling'],
  handling: ['silence', 'close']
}

function parseGroupFromRemark(remark?: string | null): Exclude<StatusGroup, 'all'> | '' {
  if (!remark) return ''
  const raw = remark.trim()
  if (!raw) return ''
  try {
    const parsed = JSON.parse(raw) as { group?: string }
    const g = parsed.group as StatusGroup | undefined
    if (g === 'firing' || g === 'recovered' || g === 'silenced' || g === 'closed') return g
  } catch {
    if (raw.startsWith('group=')) {
      const g = raw.slice(6) as StatusGroup
      if (g === 'firing' || g === 'recovered' || g === 'silenced' || g === 'closed') return g
    }
  }
  return ''
}

function parseActionsFromRemark(remark?: string | null): EventAction[] | null {
  if (!remark) return null
  const raw = remark.trim()
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { actions?: unknown }
    if (!Array.isArray(parsed.actions)) return null
    return parsed.actions.filter(
      (a): a is EventAction => a === 'confirm' || a === 'handling' || a === 'silence' || a === 'close'
    )
  } catch {
    return null
  }
}

const statusGroupByStatusMap = computed<Record<string, Exclude<StatusGroup, 'all'>>>(() => {
  const map: Record<string, Exclude<StatusGroup, 'all'>> = { ...DEFAULT_STATUS_GROUP_BY_STATUS }
  for (const item of getDictItems('alert_event_status')) {
    const group = parseGroupFromRemark(item.remark)
    if (group) map[item.itemValue] = group
  }
  return map
})

const statusGroupToStatusesMap = computed<Record<Exclude<StatusGroup, 'all'>, string[]>>(() => {
  const grouped: Record<Exclude<StatusGroup, 'all'>, string[]> = {
    firing: [],
    recovered: [],
    silenced: [],
    closed: []
  }
  for (const [status, group] of Object.entries(statusGroupByStatusMap.value)) {
    grouped[group].push(status)
  }
  return grouped
})

function resolveStatuses() {
  if (filters.statusGroup === 'all') {
    return Object.keys(statusGroupByStatusMap.value)
  }
  return statusGroupToStatusesMap.value[filters.statusGroup]
}

async function fetchList() {
  if (!props.instanceId) {
    tableData.value = []
    total.value = 0
    activeCount.value = 0
    recoveredCount.value = 0
    closedCount.value = 0
    return
  }
  loading.value = true
  try {
    const res = await pageAlertEvents({
      instanceId: props.instanceId,
      ruleLevel: filters.ruleLevel || undefined,
      statuses: resolveStatuses(),
      eventSource: filters.eventSource || undefined,
      scenarioCode: filters.scenarioCode || undefined,
      pageNum: pagination.pageNum,
      pageSize: pagination.pageSize
    })
    tableData.value = res.list ?? []
    total.value = res.total ?? 0
    fetchStats()
  } finally {
    loading.value = false
  }
}

async function fetchStats() {
  if (!props.instanceId) return
  const base = {
    instanceId: props.instanceId,
    ruleLevel: filters.ruleLevel || undefined
  }
  try {
    // 状态列表由 alert_event_status 字典的分组映射（remark.group）动态归并，避免与字典配置脱节
    const groups = statusGroupToStatusesMap.value
    const [active, recovered, closed, silenced] = await Promise.all([
      countAlertEvents({ ...base, statuses: groups.firing }),
      countAlertEvents({ ...base, statuses: groups.recovered }),
      countAlertEvents({ ...base, statuses: groups.closed }),
      countAlertEvents({ ...base, statuses: groups.silenced })
    ])
    activeCount.value = active
    recoveredCount.value = recovered
    closedCount.value = closed + silenced
  } catch {
    activeCount.value = 0
    recoveredCount.value = 0
    closedCount.value = 0
  }
}

function handleSearch() {
  pagination.pageNum = 1
  fetchList()
}

function handleReset() {
  filters.ruleLevel = ''
  filters.statusGroup = 'firing'
  filters.eventSource = ''
  filters.scenarioCode = ''
  pagination.pageNum = 1
  fetchList()
}

function buildMessage(row: AlertEventVo) {
  return row.alertMessage?.trim() || '-'
}

function statusLabel(status: string) {
  return getDictLabel('alert_event_status', status) || status
}

function statusGroupByStatus(status: string): 'firing' | 'recovered' | 'silenced' | 'closed' {
  return statusGroupByStatusMap.value[status] ?? 'firing'
}

function statusGroupLabel(status: string): string {
  const group = statusGroupByStatus(status)
  return getDictLabel('alert_event_status_group', group) || group
}

function statusGroupTag(status: string): 'danger' | 'warning' | 'primary' | 'success' | 'info' {
  const group = statusGroupByStatus(status)
  const t = getDictTagType('alert_event_status_group', group)
  return t || 'info'
}

function showStatusSubTag(status: string): boolean {
  return statusLabel(status) !== statusGroupLabel(status)
}

/** 各状态可用操作由 alert_event_status 字典项 remark 中的 actions 字段驱动
 *  （见迁移 V97），示例：{"group":"firing","actions":["confirm"]}。
 *  字典未配置 actions 时回退到 DEFAULT_ACTIONS_BY_STATUS。
 *  按严格串行处置流程展示，每个状态只显示下一步操作：
 *  pending -> 确认，confirmed -> 受理，handling -> 静默/关闭。
 */
const actionsByStatusMap = computed<Record<string, EventAction[]>>(() => {
  const map: Record<string, EventAction[]> = { ...DEFAULT_ACTIONS_BY_STATUS }
  for (const item of getDictItems('alert_event_status')) {
    const actions = parseActionsFromRemark(item.remark)
    if (actions) map[item.itemValue] = actions
  }
  return map
})

function statusAllows(status: string, action: EventAction): boolean {
  return (actionsByStatusMap.value[status] ?? []).includes(action)
}

function canConfirm(row: AlertEventVo) {
  return statusAllows(row.status, 'confirm')
}

function canHandling(row: AlertEventVo) {
  return statusAllows(row.status, 'handling')
}

function canSilence(row: AlertEventVo) {
  return statusAllows(row.status, 'silence')
}

function canClose(row: AlertEventVo) {
  return statusAllows(row.status, 'close')
}

const handlingableSelectedIds = computed(() =>
  selectedRows.value.filter((v) => canHandling(v)).map((v) => v.id)
)
const confirmableSelectedIds = computed(() =>
  selectedRows.value.filter((v) => canConfirm(v)).map((v) => v.id)
)
const silenceableSelectedIds = computed(() =>
  selectedRows.value.filter((v) => canSilence(v)).map((v) => v.id)
)
const closeableSelectedIds = computed(() =>
  selectedRows.value.filter((v) => canClose(v)).map((v) => v.id)
)

async function handlingByIds(ids: number[], tips: string, remark?: string) {
  if (!ids.length) return
  await handlingAlertEvents(ids, remark)
  ElMessage.success(tips)
  fetchList()
}

async function confirmByIds(ids: number[], tips: string, remark?: string) {
  if (!ids.length) return
  await confirmAlertEvents(ids, remark)
  ElMessage.success(tips)
  fetchList()
}

async function silenceByIds(ids: number[], tips: string, silenceHours: number, remark?: string) {
  if (!ids.length) return
  await silenceAlertEvents(ids, silenceHours, remark)
  ElMessage.success(tips)
  fetchList()
}

async function closeByIds(ids: number[], tips: string, remark?: string) {
  if (!ids.length) return
  await closeAlertEvents(ids, remark)
  ElMessage.success(tips)
  fetchList()
}

async function handleHandling(row: AlertEventVo) {
  const res = await openRemarkDialog({ title: `受理告警「${row.eventCode}」` })
  if (!res) return
  await handlingByIds([row.id], '告警已受理', res.remark)
}

async function handleConfirm(row: AlertEventVo) {
  const res = await openRemarkDialog({ title: `确认告警「${row.eventCode}」` })
  if (!res) return
  await confirmByIds([row.id], '告警已确认', res.remark)
}

async function handleSilence(row: AlertEventVo) {
  const res = await openRemarkDialog({ title: `静默告警「${row.eventCode}」`, showSilenceHours: true })
  if (!res) return
  await silenceByIds([row.id], '告警已静默', res.silenceHours!, res.remark)
}

async function handleClose(row: AlertEventVo) {
  const res = await openRemarkDialog({ title: `关闭告警「${row.eventCode}」` })
  if (!res) return
  await closeByIds([row.id], '告警已关闭', res.remark)
}

async function handleBatchHandling() {
  const ids = handlingableSelectedIds.value
  if (!ids.length) return
  const res = await openRemarkDialog({ title: `批量受理 ${ids.length} 条告警` })
  if (!res) return
  await handlingByIds(ids, `已受理 ${ids.length} 条告警`, res.remark)
}

async function handleBatchConfirm() {
  const ids = confirmableSelectedIds.value
  if (!ids.length) return
  const res = await openRemarkDialog({ title: `批量确认 ${ids.length} 条告警` })
  if (!res) return
  await confirmByIds(ids, `已确认 ${ids.length} 条告警`, res.remark)
}

async function handleBatchSilence() {
  const ids = silenceableSelectedIds.value
  if (!ids.length) return
  const res = await openRemarkDialog({ title: `批量静默 ${ids.length} 条告警`, showSilenceHours: true })
  if (!res) return
  await silenceByIds(ids, `已静默 ${ids.length} 条告警`, res.silenceHours!, res.remark)
}

async function handleBatchClose() {
  const ids = closeableSelectedIds.value
  if (!ids.length) return
  const res = await openRemarkDialog({ title: `批量关闭 ${ids.length} 条告警` })
  if (!res) return
  await closeByIds(ids, `已关闭 ${ids.length} 条告警`, res.remark)
}

interface RemarkDialogResult {
  remark?: string
  silenceHours?: number
}

const remarkDialog = reactive({
  visible: false,
  title: '',
  showSilenceHours: false,
  silenceHours: 2,
  remark: '',
})
let remarkDialogResolve: ((v: RemarkDialogResult | null) => void) | null = null

function openRemarkDialog(opts: { title: string; showSilenceHours?: boolean }): Promise<RemarkDialogResult | null> {
  remarkDialog.title = opts.title
  remarkDialog.showSilenceHours = !!opts.showSilenceHours
  remarkDialog.silenceHours = 2
  remarkDialog.remark = ''
  remarkDialog.visible = true
  return new Promise((resolve) => {
    remarkDialogResolve = resolve
  })
}

function confirmRemarkDialog() {
  if (remarkDialog.showSilenceHours) {
    const hours = remarkDialog.silenceHours
    if (!Number.isInteger(hours) || hours < 1 || hours > 720) {
      ElMessage.warning('静默窗口需为 1-720 小时')
      return
    }
  }
  remarkDialog.visible = false
  remarkDialogResolve?.({
    remark: remarkDialog.remark.trim() || undefined,
    silenceHours: remarkDialog.showSilenceHours ? remarkDialog.silenceHours : undefined
  })
  remarkDialogResolve = null
}

function cancelRemarkDialog() {
  remarkDialog.visible = false
  remarkDialogResolve?.(null)
  remarkDialogResolve = null
}

const detailVisible = ref(false)
const currentDetail = ref<AlertEventVo | null>(null)

function showDetail(row: AlertEventVo) {
  currentDetail.value = row
  detailVisible.value = true
}

/** 点击告警信息进入事件下钻分析页（§11.7）：触发信息、前后趋势、可能原因、排查路径、建议动作、历史对比 */
function goDrilldown(row: AlertEventVo) {
  // 下钻页按当前实例类型归属对应分组（MySQL / PG），避免跨类型跳转导致菜单与内容脱节
  const path = getDrilldownPath(instanceStore.current?.dbType)
  if (!path) {
    ElMessage.warning('当前实例数据库类型未识别，无法打开事件分析')
    return
  }
  router.push({ path, query: { eventId: row.id } })
}

watch(() => props.instanceId, (id) => {
  if (!id) {
    tableData.value = []
    total.value = 0
    activeCount.value = 0
    recoveredCount.value = 0
    closedCount.value = 0
    return
  }
  pagination.pageNum = 1
  fetchList()
}, { immediate: true })
</script>

<style scoped>
.alert-event-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.stat-row {
  flex-shrink: 0;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}

.event-msg {
  color: var(--el-text-color-regular);
}

.event-msg-link {
  color: var(--el-color-primary);
  cursor: pointer;
}

.event-msg-link:hover {
  text-decoration: underline;
}

.status-cell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.status-subtag {
  color: var(--el-text-color-secondary);
}

.hint {
  margin-left: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
