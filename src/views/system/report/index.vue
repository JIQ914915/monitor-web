<template>
  <div class="report-page">
    <!-- 统计卡片（与首页/告警管理卡片样式统一） -->
    <el-row :gutter="12" class="stat-row">
      <el-col :span="8">
        <StatCard label="归档报告" :value="archiveTotal" sub="累计已生成报告数" tone="primary" />
      </el-col>
      <el-col :span="8">
        <StatCard label="定时任务" :value="schedules.length" sub="已配置定时报告任务" tone="success" />
      </el-col>
      <el-col :span="8">
        <StatCard label="运行中任务" :value="enabledScheduleCount" sub="处于启用状态的定时任务" tone="warning" />
      </el-col>
    </el-row>

    <el-card class="report-card" shadow="never">
      <el-tabs v-model="activeTab">
        <!-- ── 报告归档 ─────────────────────────────────────────── -->
        <el-tab-pane label="报告归档" name="archive">
          <ProTable
            class="inner-table"
            :data="archiveList"
            :columns="archiveColumns"
            :loading="archiveLoading"
            :total="archiveTotal"
            v-model:page-num="archivePage.pageNum"
            v-model:page-size="archivePage.pageSize"
            :show-add="false"
            :operation-width="120"
            :collapsible="false"
            :delete-confirm-msg="(row: any) => `确定删除报告「${row.title}」吗？删除后不可恢复。`"
            :delete-request="removeReport"
            @search="loadArchive"
            @reset="resetArchiveFilter"
            @page-change="loadArchive"
          >
            <template #search>
              <el-form-item label="报告名称">
                <el-input v-model="archiveFilter.keyword" placeholder="搜索报告名称" clearable style="width: 200px" />
              </el-form-item>
              <el-form-item label="报告类型">
                <el-select v-model="archiveFilter.reportType" placeholder="全部" clearable style="width: 140px">
                  <el-option
                    v-for="item in getDictItems('report_type')"
                    :key="item.itemValue as string"
                    :label="item.itemLabel as string"
                    :value="item.itemValue as string"
                  />
                </el-select>
              </el-form-item>
            </template>

            <template #toolbar>
              <el-button v-permission="'report:create'" type="primary" :icon="Plus" @click="openGenerate()">生成报告</el-button>
            </template>

            <template #col-title="{ row }">
              <el-link type="primary" :underline="false" @click="previewReport(row as ReportVo)">{{ row.title }}</el-link>
            </template>
            <template #col-type="{ row }">
              <DictTag dict="report_type" :value="(row as ReportVo).reportType" effect="plain" />
            </template>
            <template #col-range="{ row }">
              {{ dictLabel('report_time_range', (row as ReportVo).timeRange) }}
            </template>
            <template #col-genMode="{ row }">
              <DictTag dict="report_gen_mode" :value="(row as ReportVo).genMode" effect="plain" />
            </template>
            <template #col-status="{ row }">
              <DictTag dict="report_status" :value="(row as ReportVo).status" effect="plain" />
            </template>

            <template #operation="{ row, confirmDelete }">
              <el-button link type="primary" size="small" @click="previewReport(row as ReportVo)">预览</el-button>
              <el-button v-permission="'report:delete'" link type="danger" size="small" @click="confirmDelete(row)">删除</el-button>
            </template>
          </ProTable>
        </el-tab-pane>

        <!-- ── 定时任务 ─────────────────────────────────────────── -->
        <el-tab-pane label="定时任务" name="schedule">
          <ProTable
            class="inner-table"
            :data="schedules"
            :columns="scheduleColumns"
            :loading="scheduleLoading"
            :show-pagination="false"
            :show-add="false"
            :operation-width="210"
            :collapsible="false"
            :delete-confirm-msg="(row: any) => `确定删除定时任务「${row.name}」吗？`"
            :delete-request="removeSchedule"
            @search="loadSchedules"
          >
            <template #toolbar>
              <el-button v-permission="'report:schedule'" type="primary" :icon="Plus" @click="openGenerate('schedule')">新建定时任务</el-button>
            </template>

            <template #col-type="{ row }">
              <DictTag dict="report_type" :value="(row as ReportScheduleVo).reportType" effect="plain" />
              <el-tag v-if="row.cycle" size="small" effect="plain" style="margin-left: 4px">{{ dictLabel('report_cycle', row.cycle) }}</el-tag>
            </template>
            <template #col-frequency="{ row }">
              {{ dictLabel('report_frequency', (row as ReportScheduleVo).frequency) }}
            </template>
            <template #col-emails="{ row }">
              <span v-if="(row as ReportScheduleVo).notifyEmails?.length">
                {{ (row as ReportScheduleVo).notifyEmails!.join('、') }}
              </span>
              <span v-else class="text-placeholder">不推送</span>
            </template>
            <template #col-enabled="{ row }">
              <el-switch
                :model-value="row.enabled"
                :disabled="!canSchedule"
                @change="v => toggleSchedule(row as ReportScheduleVo, v as boolean)"
              />
            </template>

            <template #operation="{ row, confirmDelete }">
              <el-button v-permission="'report:schedule'" link type="primary" size="small" @click="runNow(row as ReportScheduleVo)">立即执行</el-button>
              <el-button v-permission="'report:schedule'" link type="danger" size="small" @click="confirmDelete(row)">删除</el-button>
            </template>
          </ProTable>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <!-- ── 生成报告对话框 ──────────────────────────────────────── -->
    <CrudDrawer
      ref="genDrawerRef"
      :visible="genVisible"
      type="dialog"
      mode="create"
      title="报告"
      dialog-width="620px"
      :form-ref="genFormRef"
      :confirm-on-save="false"
      :show-reset="false"
      @update:visible="genVisible = $event"
      @save="onGenerateSave"
    >
      <el-form ref="genFormRef" :model="genForm" :rules="genRules" label-width="90px">
        <el-form-item label="报告类型" prop="reportType">
          <el-radio-group v-model="genForm.reportType">
            <el-radio
              v-for="item in creatableReportTypes"
              :key="item.itemValue as string"
              :value="item.itemValue as string"
            >{{ item.itemLabel }}</el-radio>
          </el-radio-group>
          <div class="form-hint">事件报告由告警事件的下钻分析页针对具体事件生成，不在此处手动创建</div>
        </el-form-item>
        <el-form-item v-if="genForm.reportType === 'inspection'" label="巡检周期">
          <el-radio-group v-model="genForm.cycle">
            <el-radio-button
              v-for="item in getDictItems('report_cycle')"
              :key="item.itemValue as string"
              :value="item.itemValue as string"
            >{{ item.itemLabel }}</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="范围方式">
          <el-radio-group v-model="genForm.scopeType">
            <el-radio value="instance">按实例</el-radio>
            <el-radio value="group">按分组</el-radio>
            <el-radio value="owner">按负责人</el-radio>
          </el-radio-group>
          <div v-if="genForm.reportType === 'capacity'" class="form-hint">容量专项报告仅支持 MySQL 或 SQL Server，且一次报告只能包含同一种数据库类型</div>
        </el-form-item>
        <el-form-item v-if="genForm.scopeType === 'instance'" label="选择实例" prop="instanceIds">
          <el-select v-model="genForm.instanceIds" multiple filterable collapse-tags :max-collapse-tags="3" placeholder="请选择实例" style="width: 100%">
            <el-option v-for="ins in selectableInstanceOptions" :key="ins.id" :label="`${ins.name} (${ins.host})`" :value="ins.id" />
          </el-select>
          <div v-if="genForm.reportType === 'performance'" class="form-hint">性能分析报告仅支持单个实例，多选时取第一个</div>
          <div v-if="genForm.reportType === 'security'" class="form-hint">安全专项报告当前仅支持 MySQL；按分组或负责人生成时也不能包含 PG 实例</div>
          <div v-if="genForm.reportType === 'capacity'" class="form-hint">选择首个实例后，只显示相同数据库类型的可选实例</div>
        </el-form-item>
        <el-form-item v-if="genForm.scopeType === 'group'" label="选择分组" prop="groupIds">
          <el-select v-model="genForm.groupIds" multiple placeholder="请选择分组" style="width: 100%">
            <el-option v-for="g in groupOptions" :key="g.id" :label="g.name" :value="g.id" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="genForm.scopeType === 'owner'" label="选择负责人" prop="ownerIds">
          <el-select v-model="genForm.ownerIds" multiple placeholder="请选择负责人" style="width: 100%">
            <el-option v-for="u in ownerOptions" :key="u.id" :label="u.name" :value="u.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="时间范围">
          <el-radio-group v-model="genForm.timeRange">
            <el-radio-button
              v-for="item in getDictItems('report_time_range')"
              :key="item.itemValue as string"
              :value="item.itemValue as string"
            >{{ item.itemLabel }}</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="生成方式">
          <el-radio-group v-model="genForm.genMode">
            <el-radio value="now">立即生成</el-radio>
            <el-radio value="schedule" :disabled="!canSchedule">定时生成</el-radio>
          </el-radio-group>
        </el-form-item>
        <template v-if="genForm.genMode === 'schedule'">
          <el-form-item label="执行频率">
            <el-select v-model="genForm.frequency" style="width: 160px">
              <el-option
                v-for="item in getDictItems('report_frequency')"
                :key="item.itemValue as string"
                :label="item.itemLabel as string"
                :value="item.itemValue as string"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="执行时间">
            <el-time-select v-model="genForm.runTime" start="00:00" step="00:30" end="23:30" placeholder="选择时间" style="width: 160px" />
          </el-form-item>
          <el-form-item label="邮件推送" prop="notifyEmails">
            <el-select
              v-model="genForm.notifyEmails"
              multiple
              filterable
              allow-create
              default-first-option
              :reserve-keyword="false"
              placeholder="输入收件邮箱后回车添加（可留空）"
              style="width: 100%"
            />
            <div class="form-hint">报告生成后自动推送邮件；需要管理员在系统配置中启用邮件服务（spring.mail）</div>
          </el-form-item>
        </template>
      </el-form>
    </CrudDrawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import ProTable from '@/components/ProTable/index.vue'
import { CrudDrawer } from '@/components/ProTable'
import type { TableColumn } from '@/components/ProTable/types'
import StatCard from '@/components/StatCard.vue'
import DictTag from '@/components/DictTag.vue'
import { useDict } from '@/composables/useDict'
import { useUserStore } from '@/stores/user'
import { listAllInstances } from '@/api/instance'
import { listGroupOptions } from '@/api/group'
import { listUserOptions } from '@/api/user'
import type { DbInstance, GroupOption, UserOption } from '@/types'
import {
  pageReports,
  generateReport,
  deleteReport,
  listReportSchedules,
  saveReportSchedule,
  toggleReportSchedule,
  deleteReportSchedule,
  runReportScheduleNow,
  type ReportVo,
  type ReportScheduleVo
} from '@/api/report'

const router = useRouter()
const userStore = useUserStore()
const { getDictItems } = useDict(
  'report_type', 'report_cycle', 'report_gen_mode', 'report_frequency', 'report_time_range', 'report_status'
)
const canSchedule = computed(() => userStore.hasPermission('report:schedule'))

/** 事件报告只能由告警下钻页针对具体事件生成（需 eventId），生成对话框中排除 */
const creatableReportTypes = computed(() =>
  getDictItems('report_type').filter(i => i.itemValue !== 'event')
)

const activeTab = ref('archive')

// ── 报告归档 ─────────────────────────────────────────────────────────────
const archiveList = ref<ReportVo[]>([])
const archiveTotal = ref(0)
const archiveLoading = ref(false)
const archivePage = reactive({ pageNum: 1, pageSize: 10 })
const archiveFilter = reactive<{ keyword: string; reportType: string }>({ keyword: '', reportType: '' })

const archiveColumns: TableColumn[] = [
  { prop: 'title', label: '报告名称', minWidth: 220, slot: 'col-title', showOverflowTooltip: true },
  { prop: 'reportType', label: '类型', width: 110, slot: 'col-type' },
  { prop: 'scopeText', label: '报告范围', minWidth: 160, showOverflowTooltip: true },
  { prop: 'timeRange', label: '时间范围', width: 110, slot: 'col-range' },
  { prop: 'genMode', label: '生成方式', width: 100, slot: 'col-genMode' },
  { prop: 'generateTime', label: '生成时间', width: 170 },
  { prop: 'status', label: '状态', width: 90, slot: 'col-status' }
]

async function loadArchive() {
  archiveLoading.value = true
  try {
    const res = await pageReports({
      pageNum: archivePage.pageNum,
      pageSize: archivePage.pageSize,
      keyword: archiveFilter.keyword || undefined,
      reportType: archiveFilter.reportType || undefined
    })
    archiveList.value = res.list ?? []
    archiveTotal.value = res.total ?? 0
  } finally {
    archiveLoading.value = false
  }
}

function resetArchiveFilter() {
  archiveFilter.keyword = ''
  archiveFilter.reportType = ''
  archivePage.pageNum = 1
  loadArchive()
}

async function removeReport(row: Record<string, unknown>) {
  await deleteReport((row as unknown as ReportVo).id)
  ElMessage.success('报告已删除')
  loadArchive()
}

function previewReport(row: ReportVo) {
  router.push({ path: '/system/report-preview', query: { id: String(row.id) } })
}

// ── 定时任务 ─────────────────────────────────────────────────────────────
const schedules = ref<ReportScheduleVo[]>([])
const scheduleLoading = ref(false)
const enabledScheduleCount = computed(() => schedules.value.filter(s => s.enabled).length)

const scheduleColumns: TableColumn[] = [
  { prop: 'name', label: '任务名称', minWidth: 200, showOverflowTooltip: true },
  { prop: 'reportType', label: '类型', width: 150, slot: 'col-type' },
  { prop: 'scopeText', label: '报告范围', minWidth: 150, showOverflowTooltip: true },
  { prop: 'frequency', label: '执行频率', width: 90, slot: 'col-frequency' },
  { prop: 'runTime', label: '执行时间', width: 90 },
  { prop: 'notifyEmails', label: '邮件推送', minWidth: 150, slot: 'col-emails', showOverflowTooltip: true },
  { prop: 'nextRun', label: '下次执行', width: 170 },
  { prop: 'enabled', label: '启用', width: 80, slot: 'col-enabled' }
]

async function loadSchedules() {
  scheduleLoading.value = true
  try {
    schedules.value = await listReportSchedules()
  } finally {
    scheduleLoading.value = false
  }
}

async function toggleSchedule(row: ReportScheduleVo, enabled: boolean) {
  await toggleReportSchedule(row.id, enabled)
  ElMessage.success(`任务已${enabled ? '启用' : '停用'}`)
  loadSchedules()
}

async function removeSchedule(row: Record<string, unknown>) {
  await deleteReportSchedule((row as unknown as ReportScheduleVo).id)
  ElMessage.success('定时任务已删除')
  loadSchedules()
}

async function runNow(row: ReportScheduleVo) {
  const reportId = await runReportScheduleNow(row.id)
  ElMessage.success('已执行一次，报告已加入归档')
  activeTab.value = 'archive'
  await Promise.all([loadArchive(), loadSchedules()])
  router.push({ path: '/system/report-preview', query: { id: String(reportId) } })
}

// ── 生成报告对话框 ────────────────────────────────────────────────────────
const genVisible = ref(false)
const genFormRef = ref<FormInstance>()
const genDrawerRef = ref<{ stopSaving: (close?: boolean) => void } | null>(null)
const instanceOptions = ref<DbInstance[]>([])
type CapacityDbFamily = 'mysql' | 'sqlserver'
function capacityDbFamily(dbType?: string | null): CapacityDbFamily | null {
  const normalized = (dbType ?? '').replace(/[\s_-]/g, '').toUpperCase()
  if (normalized === 'MYSQL') return 'mysql'
  if (normalized === 'SQLSERVER') return 'sqlserver'
  return null
}
const selectedCapacityFamily = computed<CapacityDbFamily | null>(() => {
  if (genForm.reportType !== 'capacity') return null
  for (const id of genForm.instanceIds) {
    const family = capacityDbFamily(instanceOptions.value.find(ins => ins.id === id)?.dbType)
    if (family) return family
  }
  return null
})
const selectableInstanceOptions = computed(() => {
  if (genForm.reportType === 'security') {
    return instanceOptions.value.filter(ins => capacityDbFamily(ins.dbType) === 'mysql')
  }
  if (genForm.reportType === 'capacity') {
    return instanceOptions.value.filter(ins => {
      const family = capacityDbFamily(ins.dbType)
      return family != null && (selectedCapacityFamily.value == null || family === selectedCapacityFamily.value)
    })
  }
  return instanceOptions.value
})
const groupOptions = ref<GroupOption[]>([])
const ownerOptions = ref<UserOption[]>([])

const genForm = reactive({
  reportType: 'inspection',
  cycle: 'daily',
  scopeType: 'instance',
  instanceIds: [] as number[],
  groupIds: [] as number[],
  ownerIds: [] as number[],
  timeRange: '24h',
  genMode: 'now',
  frequency: 'daily',
  runTime: '08:30',
  notifyEmails: [] as string[]
})

const EMAIL_RE = /^[\w.+-]+@[\w-]+(\.[\w-]+)+$/

const genRules: FormRules = {
  reportType: [{ required: true, message: '请选择报告类型', trigger: 'change' }],
  instanceIds: [{
    validator: (_r, _v, cb) => {
      if (genForm.scopeType === 'instance' && !genForm.instanceIds.length) {
        cb(new Error('请至少选择一个实例'))
        return
      }
      const hasUnsupported = genForm.reportType === 'security'
        && genForm.instanceIds.some(id => instanceOptions.value.find(ins => ins.id === id)?.dbType !== 'MySQL')
      if (hasUnsupported) {
        cb(new Error('安全专项报告当前仅支持 MySQL 实例'))
        return
      }
      if (genForm.reportType === 'capacity') {
        const families = new Set(genForm.instanceIds.map(id =>
          capacityDbFamily(instanceOptions.value.find(ins => ins.id === id)?.dbType)
        ))
        if (families.has(null)) {
          cb(new Error('容量专项报告仅支持 MySQL 或 SQL Server 实例'))
          return
        }
        if (families.size > 1) {
          cb(new Error('容量专项报告一次只能选择同一种数据库类型'))
          return
        }
      }
      cb()
    },
    trigger: 'change'
  }],
  groupIds: [{
    validator: (_r, _v, cb) => {
      if (genForm.scopeType === 'group' && !genForm.groupIds.length) cb(new Error('请至少选择一个分组'))
      else cb()
    },
    trigger: 'change'
  }],
  ownerIds: [{
    validator: (_r, _v, cb) => {
      if (genForm.scopeType === 'owner' && !genForm.ownerIds.length) cb(new Error('请至少选择一个负责人'))
      else cb()
    },
    trigger: 'change'
  }],
  notifyEmails: [{
    validator: (_r, _v, cb) => {
      const bad = genForm.notifyEmails.find(m => !EMAIL_RE.test(m.trim()))
      if (bad) cb(new Error(`邮箱格式不正确：${bad}`))
      else cb()
    },
    trigger: 'change'
  }]
}

async function openGenerate(mode?: string) {
  genForm.genMode = mode === 'schedule' ? 'schedule' : 'now'
  genVisible.value = true
  if (!instanceOptions.value.length) {
    const [ins, groups, users] = await Promise.all([listAllInstances(), listGroupOptions(), listUserOptions()])
    instanceOptions.value = ins
    groupOptions.value = groups
    ownerOptions.value = users
  }
}

async function onGenerateSave() {
  try {
    const payload = {
      reportType: genForm.reportType,
      cycle: genForm.reportType === 'inspection' ? genForm.cycle : undefined,
      scopeType: genForm.scopeType,
      instanceIds: genForm.scopeType === 'instance' ? genForm.instanceIds : undefined,
      groupIds: genForm.scopeType === 'group' ? genForm.groupIds : undefined,
      ownerIds: genForm.scopeType === 'owner' ? genForm.ownerIds : undefined,
      timeRange: genForm.timeRange
    }
    if (genForm.genMode === 'schedule') {
      await saveReportSchedule({
        ...payload,
        frequency: genForm.frequency,
        runTime: genForm.runTime,
        notifyEmails: genForm.notifyEmails.map(m => m.trim()).filter(Boolean)
      })
      ElMessage.success('定时任务已创建')
      genDrawerRef.value?.stopSaving(true)
      activeTab.value = 'schedule'
      await loadSchedules()
      return
    }
    const reportId = await generateReport(payload)
    ElMessage.success('报告生成成功')
    genDrawerRef.value?.stopSaving(true)
    await loadArchive()
    router.push({ path: '/system/report-preview', query: { id: String(reportId) } })
  } catch {
    genDrawerRef.value?.stopSaving(false)
  }
}

// ── 字典工具 ─────────────────────────────────────────────────────────────
function dictLabel(dict: string, value?: string | null): string {
  if (!value) return '-'
  const item = getDictItems(dict).find(i => i.itemValue === value)
  return (item?.itemLabel as string) ?? value
}

watch(() => genForm.reportType, reportType => {
  if (reportType === 'security') {
    genForm.instanceIds = genForm.instanceIds.filter(id =>
      capacityDbFamily(instanceOptions.value.find(ins => ins.id === id)?.dbType) === 'mysql'
    )
  }
  if (reportType === 'capacity') {
    const firstFamily = genForm.instanceIds
      .map(id => capacityDbFamily(instanceOptions.value.find(ins => ins.id === id)?.dbType))
      .find((family): family is CapacityDbFamily => family != null)
    genForm.instanceIds = genForm.instanceIds.filter(id => {
      const family = capacityDbFamily(instanceOptions.value.find(ins => ins.id === id)?.dbType)
      return family != null && (firstFamily == null || family === firstFamily)
    })
  }
})

onMounted(() => {
  loadArchive()
  loadSchedules()
})
</script>

<style scoped>
.report-page {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.stat-row :deep(.el-col) {
  margin-bottom: 0;
}
.report-card :deep(.el-card__body) {
  padding-top: 4px;
}
.form-hint {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  line-height: 1.6;
}
.text-placeholder {
  color: var(--el-text-color-placeholder);
}
</style>
