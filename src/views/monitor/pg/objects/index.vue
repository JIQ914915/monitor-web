<template>
  <div class="pg-objects-page">
    <InstanceEmpty v-if="!inst" />

    <template v-else>
      <!-- 表热点（小时级差值 Top N） -->
      <el-card shadow="never" class="block-card">
        <div class="section-head">
          <span class="section-title">表热点 Top {{ HOT_LIMIT }}</span>
          <span class="section-tip">最近一小时各用户表的扫描与行读写量（差值），顺序扫描偏高的大表通常缺索引；每小时更新，新接入实例需两个小时后出数</span>
        </div>
        <ProTable
          :data="hotRows"
          :columns="hotColumns"
          :loading="hotLoading"
          :show-toolbar="false"
          :show-add="false"
          :show-operation="false"
          :show-pagination="false"
          embedded
        >
          <template #col-seqScan="{ row }">
            <span :class="{ 'warn-text': row.seqScan > 0 && row.seqScan >= row.idxScan }">{{ fmtCount(row.seqScan) }}</span>
          </template>
          <template #col-idxScan="{ row }">{{ fmtCount(row.idxScan) }}</template>
          <template #col-readRows="{ row }">{{ fmtCount(row.readRows) }}</template>
          <template #col-writeRows="{ row }">{{ fmtCount(row.writeRows) }}</template>
        </ProTable>
        <el-empty v-if="!hotLoading && !hotRows.length" description="暂无表热点数据（首轮采集建基线，第二个小时起出数；空闲库无读写也不会有数据）" :image-size="60" />
      </el-card>

      <!-- 膨胀 Top 表（小时级） -->
      <el-card shadow="never" class="block-card">
        <div class="section-head">
          <span class="section-title">膨胀 Top 表</span>
          <span class="section-tip">死元组占比最高的用户表（活元组>1000）。死元组由 UPDATE/DELETE 产生、靠 vacuum 回收；占比持续偏高先排查长事务是否钉住了 vacuum 水位</span>
        </div>
        <ProTable
          :data="bloatRows"
          :columns="bloatColumns"
          :loading="bloatLoading"
          :show-toolbar="false"
          :show-add="false"
          :show-operation="false"
          :show-pagination="false"
          embedded
        >
          <template #col-deadPct="{ row }">
            <el-tag :type="row.deadPct >= 40 ? 'danger' : row.deadPct >= 20 ? 'warning' : 'info'" size="small">
              {{ row.deadPct }}%
            </el-tag>
          </template>
          <template #col-deadTup="{ row }">{{ fmtCount(row.deadTup) }}</template>
          <template #col-lastVacuumAt="{ row }">{{ row.lastVacuumAt || '从未执行' }}</template>
        </ProTable>
        <el-empty v-if="!bloatLoading && !bloatRows.length" description="暂无膨胀数据（每小时采集一次）" :image-size="60" />
      </el-card>

      <!-- 疑似未使用索引（天级） -->
      <el-card shadow="never" class="block-card">
        <div class="section-head">
          <span class="section-title">疑似未使用索引</span>
          <span class="section-tip">
            自统计重置以来扫描次数为 0 的非主键/非唯一索引（每日更新）。
            <template v-if="unusedUptimeDays < 7">当前实例运行仅 {{ unusedUptimeDays }} 天，统计窗口偏短，"未使用"结论不可靠，建议观察满一周后再评估。</template>
            删除前须人工确认业务低频场景（月结/年报）不依赖该索引。
          </span>
        </div>
        <ProTable
          :data="unusedRows"
          :columns="indexColumns"
          :loading="unusedLoading"
          :total="unusedTotal"
          v-model:page-num="unusedPageNum"
          v-model:page-size="unusedPageSize"
          :page-sizes="[10, 20, 50]"
          :show-toolbar="false"
          :show-add="false"
          :show-operation="false"
          embedded
          @page-change="loadUnused"
        />
        <el-empty v-if="!unusedLoading && !unusedRows.length" description="未发现疑似未使用索引" :image-size="60" />
      </el-card>

      <!-- 失效索引（天级） -->
      <el-card shadow="never" class="block-card">
        <div class="section-head">
          <span class="section-title">失效索引</span>
          <span class="section-tip">indisvalid=false 的索引（多为 CREATE INDEX CONCURRENTLY 失败残留）：不参与查询但拖累写入，应重建（REINDEX CONCURRENTLY）或删除</span>
        </div>
        <ProTable
          :data="invalidRows"
          :columns="indexColumns"
          :loading="invalidLoading"
          :show-toolbar="false"
          :show-add="false"
          :show-operation="false"
          :show-pagination="false"
          embedded
        />
        <el-alert
          v-if="!invalidLoading && !invalidRows.length"
          type="success"
          show-icon
          :closable="false"
          title="未发现失效索引"
        />
      </el-card>

      <PgAdvisorPanel />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useInstanceStore } from '@/stores/instance'
import InstanceEmpty from '@/components/InstanceEmpty.vue'
import ProTable from '@/components/ProTable/index.vue'
import PgAdvisorPanel from './components/PgAdvisorPanel.vue'
import { getMetricObjects, getMetricTextLatest, pageUnusedIndex } from '@/api/metric'
import { PG } from '@/constants/pg-metrics'
import type { TableColumn } from '@/components/ProTable/types'

const instanceStore = useInstanceStore()
const inst = computed(() => instanceStore.current)

const HOT_LIMIT = 20

// ── 表热点 ────────────────────────────────────────────────────────────────
interface HotRow {
  table: string
  seqScan: number
  idxScan: number
  readRows: number
  writeRows: number
}

const hotLoading = ref(false)
const hotRows = ref<HotRow[]>([])

const hotColumns: TableColumn[] = [
  { prop: 'table',     label: '表（schema.table）', minWidth: 220, showOverflowTooltip: true },
  { prop: 'readRows',  label: '读取行数', minWidth: 110, slot: 'col-readRows' },
  { prop: 'writeRows', label: '写入行数', minWidth: 110, slot: 'col-writeRows' },
  { prop: 'seqScan',   label: '顺序扫描', minWidth: 100, slot: 'col-seqScan' },
  { prop: 'idxScan',   label: '索引扫描', minWidth: 100, slot: 'col-idxScan' }
]

async function loadHotspots() {
  if (!inst.value) return
  hotLoading.value = true
  try {
    const id = inst.value.id
    const [read, write, seq, idx] = await Promise.all([
      getMetricObjects(id, PG.PGTABLE_READ_ROWS, 200),
      getMetricObjects(id, PG.PGTABLE_WRITE_ROWS, 200),
      getMetricObjects(id, PG.PGTABLE_SEQ_SCAN, 200),
      getMetricObjects(id, PG.PGTABLE_IDX_SCAN, 200)
    ])
    const rowByName = new Map<string, HotRow>()
    const ensure = (name: string) => {
      let row = rowByName.get(name)
      if (!row) {
        row = { table: name, seqScan: 0, idxScan: 0, readRows: 0, writeRows: 0 }
        rowByName.set(name, row)
      }
      return row
    }
    for (const o of read.items ?? []) ensure(o.objectName).readRows = o.value
    for (const o of write.items ?? []) ensure(o.objectName).writeRows = o.value
    for (const o of seq.items ?? []) ensure(o.objectName).seqScan = o.value
    for (const o of idx.items ?? []) ensure(o.objectName).idxScan = o.value
    hotRows.value = [...rowByName.values()]
      .sort((a, b) => (b.readRows + b.writeRows) - (a.readRows + a.writeRows))
      .slice(0, HOT_LIMIT)
  } finally {
    hotLoading.value = false
  }
}

// ── 膨胀 Top 表 ───────────────────────────────────────────────────────────
interface BloatRow {
  table: string
  deadTup: number
  deadPct: number
  lastVacuumAt: string
}

const bloatLoading = ref(false)
const bloatRows = ref<BloatRow[]>([])

const bloatColumns: TableColumn[] = [
  { prop: 'table',        label: '表（schema.table）', minWidth: 220, showOverflowTooltip: true },
  { prop: 'deadPct',      label: '死元组占比',   minWidth: 110, slot: 'col-deadPct' },
  { prop: 'deadTup',      label: '死元组数',     minWidth: 110, slot: 'col-deadTup' },
  { prop: 'lastVacuumAt', label: '最近 vacuum', minWidth: 160, slot: 'col-lastVacuumAt' }
]

async function loadBloat() {
  if (!inst.value) return
  bloatLoading.value = true
  try {
    const res = await getMetricTextLatest(inst.value.id, [PG.BLOAT_TOP_TABLES], '1h')
    const raw = res.values?.[PG.BLOAT_TOP_TABLES]
    if (!raw) {
      bloatRows.value = []
      return
    }
    const arr = JSON.parse(raw) as Array<{ table: string; deadTup: number; deadPct: number; lastVacuumAt?: string }>
    bloatRows.value = (Array.isArray(arr) ? arr : []).map(t => ({
      table: t.table,
      deadTup: t.deadTup ?? 0,
      deadPct: t.deadPct ?? 0,
      lastVacuumAt: t.lastVacuumAt ?? ''
    }))
  } catch {
    bloatRows.value = []
  } finally {
    bloatLoading.value = false
  }
}

// ── 索引清单（未使用 + 失效共用列定义） ──────────────────────────────────
const indexColumns: TableColumn[] = [
  { prop: 'schemaName', label: 'Schema', minWidth: 120, showOverflowTooltip: true },
  { prop: 'tableName',  label: '表',     minWidth: 180, showOverflowTooltip: true },
  { prop: 'indexName',  label: '索引',   minWidth: 220, showOverflowTooltip: true }
]

interface IndexRow { schemaName: string; tableName: string; indexName: string }

const unusedLoading = ref(false)
const unusedRows = ref<IndexRow[]>([])
const unusedTotal = ref(0)
const unusedUptimeDays = ref(0)
const unusedPageNum = ref(1)
const unusedPageSize = ref(10)

async function loadUnused() {
  if (!inst.value) return
  unusedLoading.value = true
  try {
    const res = await pageUnusedIndex(inst.value.id, unusedPageNum.value, unusedPageSize.value)
    unusedRows.value = res.list ?? []
    unusedTotal.value = res.total ?? 0
    unusedUptimeDays.value = res.uptimeDays ?? 0
  } finally {
    unusedLoading.value = false
  }
}

const invalidLoading = ref(false)
const invalidRows = ref<IndexRow[]>([])

async function loadInvalid() {
  if (!inst.value) return
  invalidLoading.value = true
  try {
    const res = await getMetricTextLatest(inst.value.id, [PG.INDEX_INVALID_LIST], '1d')
    const raw = res.values?.[PG.INDEX_INVALID_LIST]
    if (!raw) {
      invalidRows.value = []
      return
    }
    const root = JSON.parse(raw) as { indexes?: Array<{ schema: string; table: string; index: string }> }
    invalidRows.value = (root.indexes ?? []).map(i => ({
      schemaName: i.schema,
      tableName: i.table,
      indexName: i.index
    }))
  } catch {
    invalidRows.value = []
  } finally {
    invalidLoading.value = false
  }
}

function fmtCount(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)} K`
  return String(Math.round(v))
}

watch(() => inst.value?.id, (id) => {
  if (!id) return
  unusedPageNum.value = 1
  loadHotspots()
  loadBloat()
  loadUnused()
  loadInvalid()
}, { immediate: true })
</script>

<style scoped lang="scss">
.pg-objects-page {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.block-card {
  border-radius: 8px;
}

.section-head {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  white-space: nowrap;
}

.section-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}

.warn-text {
  color: var(--el-color-warning);
  font-weight: 600;
}
</style>
