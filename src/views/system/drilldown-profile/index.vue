<template>
  <div class="profile-page">
    <el-alert type="info" :closable="false" show-icon class="page-tip">
      告警事件进入下钻分析页时，按「触发指标编码」匹配画像（精确匹配优先，其次最长前缀），驱动下钻页的关联指标、可能原因、排查路径与建议动作；均未命中时使用兜底画像（匹配规则为空的「通用类」）。
    </el-alert>

    <ProTable
      :data="filteredProfiles"
      :columns="columns"
      :loading="loading"
      :show-pagination="false"
      :show-add="false"
      :operation-width="150"
      :delete-confirm-msg="(row: any) => `确认删除画像「${row.profileLabel}」？`"
      :delete-request="removeProfile"
      @search="load"
    >
      <template #toolbar>
        <el-input v-model="keyword" placeholder="搜索画像名称/编码" clearable style="width: 220px">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-button v-permission="'drilldown_profile:update'" type="primary" :icon="Plus" @click="openCreate">新增画像</el-button>
      </template>

      <template #col-label="{ row }">
        <div class="label-cell">
          <span class="label-name">{{ row.profileLabel }}</span>
          <span class="label-code">{{ row.profileCode }}</span>
        </div>
      </template>

      <template #col-match="{ row }">
        <el-tooltip v-if="row.matchRules?.length" placement="top" :show-after="200">
          <template #content>
            <div v-for="(r, i) in row.matchRules" :key="i">{{ r.matchType === 'exact' ? '精确' : '前缀' }}：{{ r.pattern }}</div>
          </template>
          <el-tag size="small" type="primary" effect="plain">{{ row.matchRules.length }} 条规则</el-tag>
        </el-tooltip>
        <el-tag v-else size="small" type="warning" effect="plain">兜底画像</el-tag>
      </template>

      <template #col-content="{ row }">
        <span class="content-summary">
          指标 {{ row.relatedMetrics?.length ?? 0 }}｜原因 {{ row.causes?.length ?? 0 }}｜步骤 {{ row.steps?.length ?? 0 }}｜动作 {{ row.actions?.length ?? 0 }}
        </span>
      </template>

      <template #col-builtin="{ row }">
        <el-tag size="small" :type="row.builtin ? 'info' : 'success'">{{ row.builtin ? '内置' : '自定义' }}</el-tag>
      </template>

      <template #col-enabled="{ row }">
        <el-switch
          :model-value="row.enabled"
          :disabled="!canToggle"
          @change="v => toggle(row as DrilldownProfileVo, v as boolean)"
        />
      </template>

      <template #operation="{ row, confirmDelete }">
        <el-button v-permission="'drilldown_profile:view'" link type="primary" size="small" @click="openView(row as DrilldownProfileVo)">查看</el-button>
        <el-button v-permission="'drilldown_profile:update'" link type="primary" size="small" @click="openEdit(row as DrilldownProfileVo)">编辑</el-button>
        <el-button
          v-if="!row.builtin"
          v-permission="'drilldown_profile:delete'"
          link
          type="danger"
          size="small"
          @click="confirmDelete(row as DrilldownProfileVo)"
        >删除</el-button>
      </template>
    </ProTable>

    <!-- 画像 新增/编辑/查看 抽屉 -->
    <CrudDrawer
      ref="drawerRef"
      :visible="drawerVisible"
      type="drawer"
      :mode="drawerMode"
      title="下钻画像"
      size="760px"
      :form-ref="formRef"
      :confirm-on-save="false"
      @update:visible="drawerVisible = $event"
      @save="onSave"
      @closed="resetForm"
    >
      <template #default="{ readonly }">
        <el-form ref="formRef" :model="form" :rules="rules" label-width="96px" :disabled="readonly">
          <el-row :gutter="12">
            <el-col :span="12">
              <el-form-item label="画像名称" prop="profileLabel">
                <el-input v-model="form.profileLabel" placeholder="如 连接与会话类" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="画像编码" prop="profileCode">
                <el-input v-model="form.profileCode" placeholder="如 connections" :disabled="readonly || editingBuiltin" />
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="12">
            <el-col :span="8">
              <el-form-item label="数据库类型" prop="dbType">
                <el-select v-model="form.dbType" placeholder="请选择数据库类型" :disabled="readonly || editingBuiltin" style="width: 100%">
                  <el-option
                    v-for="type in dbTypeOptions"
                    :key="type.id"
                    :label="type.label"
                    :value="type.code.toLowerCase()"
                  />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="排序">
                <el-input-number v-model="form.sort" :min="0" controls-position="right" style="width: 100%" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="启用">
                <el-switch v-model="form.enabled" />
              </el-form-item>
            </el-col>
          </el-row>
          <el-form-item label="备注">
            <el-input v-model="form.remark" placeholder="备注（可选）" />
          </el-form-item>

          <!-- 匹配规则：结构化编辑 -->
          <el-form-item label="匹配规则">
            <div class="match-rules">
              <div class="match-tip">按告警触发指标编码匹配；精确匹配优先于前缀匹配，前缀匹配长者优先。留空表示兜底画像（其他画像均未命中时使用）。</div>
              <div v-for="(r, idx) in form.matchRules" :key="idx" class="match-rule-row">
                <el-select v-model="r.matchType" style="width: 110px">
                  <el-option value="prefix" label="前缀匹配" />
                  <el-option value="exact" label="精确匹配" />
                </el-select>
                <el-input v-model="r.pattern" placeholder="如 mysql.conn." class="match-pattern" />
                <el-button v-if="!readonly" link type="danger" :icon="Delete" @click="form.matchRules.splice(idx, 1)" />
              </div>
              <el-button v-if="!readonly" link type="primary" :icon="Plus" @click="form.matchRules.push({ matchType: 'prefix', pattern: '' })">添加规则</el-button>
            </div>
          </el-form-item>

          <!-- 四块内容：JSON 编辑 -->
          <el-tabs v-model="activeTab" class="content-tabs">
            <el-tab-pane v-for="blk in CONTENT_BLOCKS" :key="blk.key" :label="blk.label" :name="blk.key">
              <div class="json-tip">{{ blk.hint }}</div>
              <el-input
                v-model="jsonBlocks[blk.key]"
                type="textarea"
                :rows="14"
                spellcheck="false"
                class="json-editor"
                :placeholder="blk.placeholder"
              />
              <div v-if="jsonErrors[blk.key]" class="json-error">{{ jsonErrors[blk.key] }}</div>
            </el-tab-pane>
          </el-tabs>
        </el-form>
      </template>
    </CrudDrawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { Delete, Plus, Search } from '@element-plus/icons-vue'
import ProTable from '@/components/ProTable/index.vue'
import type { TableColumn } from '@/components/ProTable/types'
import { CrudDrawer } from '@/components/ProTable'
import {
  listDrilldownProfiles,
  saveDrilldownProfile,
  deleteDrilldownProfile,
  toggleDrilldownProfile,
  type DrilldownMatchRule,
  type DrilldownProfileVo
} from '@/api/alert'
import { useUserStore } from '@/stores/user'
import { listDbTypes } from '@/api/db-type'
import type { DbTypeOption } from '@/types'

const userStore = useUserStore()
const canToggle = computed(() => userStore.hasPermission('drilldown_profile:toggle'))

const columns: TableColumn[] = [
  { label: '画像', minWidth: 200, slot: 'col-label', showOverflowTooltip: false },
  { label: '匹配规则', width: 110, align: 'center', slot: 'col-match', showOverflowTooltip: false },
  { label: '内容', minWidth: 220, slot: 'col-content' },
  { prop: 'dbType', label: '数据库', width: 90, align: 'center' },
  { label: '来源', width: 90, align: 'center', slot: 'col-builtin', showOverflowTooltip: false },
  { label: '启用', width: 80, align: 'center', slot: 'col-enabled', showOverflowTooltip: false },
  { prop: 'sort', label: '排序', width: 70, align: 'center' },
  { prop: 'updatedAt', label: '更新时间', width: 160 }
]

// ── 列表 ─────────────────────────────────────────────────────────────────
const loading = ref(false)
const profiles = ref<DrilldownProfileVo[]>([])
const dbTypeOptions = ref<DbTypeOption[]>([])
const keyword = ref('')

const filteredProfiles = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return profiles.value
  return profiles.value.filter(
    p => p.profileLabel.toLowerCase().includes(kw) || p.profileCode.toLowerCase().includes(kw)
  )
})

async function load() {
  loading.value = true
  try {
    profiles.value = await listDrilldownProfiles()
  } finally {
    loading.value = false
  }
}

async function toggle(row: DrilldownProfileVo, enabled: boolean) {
  try {
    await toggleDrilldownProfile(row.id, enabled)
    row.enabled = enabled
    ElMessage.success(enabled ? '已启用' : '已停用')
  } catch {
    ElMessage.error('操作失败，请稍后重试')
  }
}

async function removeProfile(row: DrilldownProfileVo) {
  await deleteDrilldownProfile(row.id)
  await load()
}

// ── 新增/编辑 ────────────────────────────────────────────────────────────
type BlockKey = 'relatedMetrics' | 'causes' | 'steps' | 'actions'

const CONTENT_BLOCKS: { key: BlockKey; label: string; hint: string; placeholder: string }[] = [
  {
    key: 'relatedMetrics',
    label: '关联指标',
    hint: 'JSON 数组：[{"code":"指标编码","label":"展示名","unit":"单位符号","color":"#0C7C97","toGB":false}]，下钻页按此拉取告警前后 ±30 分钟趋势。',
    placeholder: '[\n  { "code": "mysql.qps", "label": "QPS", "unit": "", "color": "#0C7C97" }\n]'
  },
  {
    key: 'causes',
    label: '可能原因',
    hint: 'JSON 数组：[{"cause":"原因","confidence":0.8,"color":"danger|warning|info","evidence":["依据，可用 {value}/{threshold}/{unit} 占位符"]}]，按可信度排序展示。',
    placeholder: '[\n  { "cause": "…", "confidence": 0.8, "color": "danger", "evidence": ["当前值 {value}{unit}，阈值 {threshold}{unit}"] }\n]'
  },
  {
    key: 'steps',
    label: '排查路径',
    hint: 'JSON 数组：[{"title":"步骤标题","description":"说明","action":"按钮文字","link":"页面编码"}]。link 可选值：slowsql / realtime / performance / scenario / knowledge / collector。',
    placeholder: '[\n  { "title": "查看慢SQL列表", "description": "…", "action": "前往慢SQL分析", "link": "slowsql" }\n]'
  },
  {
    key: 'actions',
    label: '建议动作',
    hint: 'JSON 数组：[{"action":"动作名","risk":"low|medium|high","description":"说明","sql":"SQL/命令","impact":"影响提示"}]。仅辅助决策，系统不会自动执行。',
    placeholder: '[\n  { "action": "…", "risk": "low", "description": "…", "sql": "SELECT 1;", "impact": "…" }\n]'
  }
]

const drawerVisible = ref(false)
const drawerMode = ref<'create' | 'edit' | 'view'>('create')
const drawerRef = ref<{ stopSaving: (close?: boolean) => void } | null>(null)
const formRef = ref<FormInstance>()
const activeTab = ref<BlockKey>('relatedMetrics')
const editingBuiltin = ref(false)

interface ProfileForm {
  id?: number | null
  profileCode: string
  profileLabel: string
  dbType: string
  matchRules: DrilldownMatchRule[]
  enabled: boolean
  sort: number
  remark: string
}

function emptyForm(): ProfileForm {
  return { id: null, profileCode: '', profileLabel: '', dbType: '', matchRules: [], enabled: true, sort: 0, remark: '' }
}

const form = reactive<ProfileForm>(emptyForm())
const jsonBlocks = reactive<Record<BlockKey, string>>({ relatedMetrics: '[]', causes: '[]', steps: '[]', actions: '[]' })
const jsonErrors = reactive<Record<BlockKey, string>>({ relatedMetrics: '', causes: '', steps: '', actions: '' })

const rules: FormRules = {
  profileLabel: [{ required: true, message: '请输入画像名称', trigger: 'blur' }],
  profileCode: [{ required: true, message: '请输入画像编码', trigger: 'blur' }],
  dbType: [{ required: true, message: '请选择数据库类型', trigger: 'change' }]
}

function fillForm(row?: DrilldownProfileVo) {
  Object.assign(form, emptyForm())
  jsonErrors.relatedMetrics = jsonErrors.causes = jsonErrors.steps = jsonErrors.actions = ''
  activeTab.value = 'relatedMetrics'
  if (!row) {
    jsonBlocks.relatedMetrics = jsonBlocks.causes = jsonBlocks.steps = jsonBlocks.actions = '[]'
    editingBuiltin.value = false
    return
  }
  Object.assign(form, {
    id: row.id,
    profileCode: row.profileCode,
    profileLabel: row.profileLabel,
    dbType: row.dbType || '',
    matchRules: (row.matchRules ?? []).map(r => ({ ...r })),
    enabled: row.enabled,
    sort: row.sort ?? 0,
    remark: row.remark ?? ''
  })
  jsonBlocks.relatedMetrics = JSON.stringify(row.relatedMetrics ?? [], null, 2)
  jsonBlocks.causes = JSON.stringify(row.causes ?? [], null, 2)
  jsonBlocks.steps = JSON.stringify(row.steps ?? [], null, 2)
  jsonBlocks.actions = JSON.stringify(row.actions ?? [], null, 2)
  editingBuiltin.value = row.builtin
}

function openCreate() {
  fillForm()
  drawerMode.value = 'create'
  drawerVisible.value = true
}
function openEdit(row: DrilldownProfileVo) {
  fillForm(row)
  drawerMode.value = 'edit'
  drawerVisible.value = true
}
function openView(row: DrilldownProfileVo) {
  fillForm(row)
  drawerMode.value = 'view'
  drawerVisible.value = true
}
function resetForm() {
  fillForm()
}

/** 校验并解析 JSON 块；出错时记录到 jsonErrors 并返回 null */
function parseBlock(key: BlockKey): Record<string, unknown>[] | null {
  jsonErrors[key] = ''
  try {
    const parsed = JSON.parse(jsonBlocks[key] || '[]')
    if (!Array.isArray(parsed)) {
      jsonErrors[key] = '必须是 JSON 数组（以 [ 开头）'
      return null
    }
    return parsed
  } catch (err) {
    jsonErrors[key] = `JSON 格式错误：${err instanceof Error ? err.message : String(err)}`
    return null
  }
}

async function onSave() {
  // 匹配规则：过滤空行
  const matchRules = form.matchRules.filter(r => r.pattern.trim())
  const blocks = {} as Record<BlockKey, Record<string, unknown>[]>
  for (const blk of CONTENT_BLOCKS) {
    const parsed = parseBlock(blk.key)
    if (parsed == null) {
      activeTab.value = blk.key
      ElMessage.warning(`「${blk.label}」JSON 格式有误，请修正后再保存`)
      drawerRef.value?.stopSaving(false)
      return
    }
    blocks[blk.key] = parsed
  }
  try {
    await saveDrilldownProfile({
      id: form.id,
      profileCode: form.profileCode.trim(),
      profileLabel: form.profileLabel.trim(),
      dbType: form.dbType.trim(),
      matchRules: matchRules.map(r => ({ matchType: r.matchType, pattern: r.pattern.trim() })),
      relatedMetrics: blocks.relatedMetrics,
      causes: blocks.causes,
      steps: blocks.steps,
      actions: blocks.actions,
      enabled: form.enabled,
      sort: form.sort,
      remark: form.remark || null
    })
    ElMessage.success('保存成功')
    drawerRef.value?.stopSaving(true)
    await load()
  } catch {
    drawerRef.value?.stopSaving(false)
  }
}

onMounted(async () => {
  const [, types] = await Promise.all([load(), listDbTypes()])
  dbTypeOptions.value = types.filter(type => ['MYSQL', 'POSTGRESQL'].includes(type.code.toUpperCase()))
})
</script>

<style scoped>
.profile-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.page-tip :deep(.el-alert__description) {
  margin: 0;
}

.label-cell {
  display: flex;
  flex-direction: column;
  line-height: 1.5;
}
.label-name {
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.label-code {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.content-summary {
  font-size: 12px;
  color: var(--el-text-color-regular);
}

.match-rules {
  width: 100%;
}
.match-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
  margin-bottom: 8px;
}
.match-rule-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.match-pattern {
  flex: 1;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.content-tabs {
  margin-top: 4px;
}
.json-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
  margin-bottom: 8px;
}
.json-editor :deep(textarea) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.6;
}
.json-error {
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-color-danger);
}
</style>
