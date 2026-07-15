<template>
  <el-card shadow="never" class="block-card">
    <el-tabs v-model="tab" @tab-change="loadActive">
      <el-tab-pane label="Vacuum Advisor" name="vacuum">
        <el-alert type="info" :closable="false" title="建议综合死元组、冻结年龄、自动清理参数与分区关系生成；执行前请结合业务窗口确认。" class="tip" />
        <AdvisorTable :rows="vacuumRows" :loading="vacuumLoading" />
      </el-tab-pane>
      <el-tab-pane label="Index Advisor" name="index">
        <el-alert type="warning" :closable="false" title="重复/未使用索引仅作为候选；主键、唯一约束、复制标识及约束依赖索引会被保护。" class="tip" />
        <AdvisorTable :rows="indexRows" :loading="indexLoading" />
      </el-tab-pane>
      <el-tab-pane label="跨库对象容量" name="objects">
        <el-table :data="objects" v-loading="objectLoading" border stripe height="460">
          <el-table-column prop="database" label="数据库" width="130" />
          <el-table-column prop="schema" label="Schema" width="130" />
          <el-table-column prop="objectType" label="类型" width="110" />
          <el-table-column prop="objectName" label="对象" min-width="240" show-overflow-tooltip />
          <el-table-column prop="parentName" label="父对象" min-width="180" show-overflow-tooltip />
          <el-table-column prop="tablespace" label="表空间" width="140" />
          <el-table-column label="大小" width="120" sortable><template #default="{ row }">{{ bytes(row.sizeBytes) }}</template></el-table-column>
          <el-table-column prop="estimatedRows" label="估算行数" width="120" />
          <el-table-column prop="sequentialScans" label="顺序扫描" width="120" />
          <el-table-column label="缓存命中率" width="120"><template #default="{ row }">{{ row.cacheHitRate == null ? '-' : `${Number(row.cacheHitRate).toFixed(2)}%` }}</template></el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </el-card>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, ref, watch } from 'vue'
import { ElTable, ElTableColumn, ElTag } from 'element-plus'
import { useInstanceStore } from '@/stores/instance'
import { listPgIndexAdvice, listPgObjectAnalysis, listPgVacuumAdvice } from '@/api/postgresql'
import type { PgAdvisor, PgObjectAnalysis } from '@/api/postgresql'

const AdvisorTable = defineComponent({
  props: { rows: { type: Array as () => PgAdvisor[], required: true }, loading: Boolean },
  setup(props) {
    const severity = (row: PgAdvisor) => h(ElTag, { type: row.severity === 'critical' ? 'danger' : row.severity === 'warning' ? 'warning' : 'info' }, () => row.severity)
    return () => h(ElTable, { data: props.rows, border: true, stripe: true, height: 430, 'v-loading': props.loading }, () => [
      h(ElTableColumn, { prop: 'database', label: '数据库', width: 125 }), h(ElTableColumn, { prop: 'objectName', label: '对象', minWidth: 220, showOverflowTooltip: true }),
      h(ElTableColumn, { label: '等级', width: 90 }, { default: ({ row }: { row: PgAdvisor }) => severity(row) }),
      h(ElTableColumn, { prop: 'evidence', label: '证据', minWidth: 260, showOverflowTooltip: true }), h(ElTableColumn, { prop: 'action', label: '建议动作', minWidth: 300, showOverflowTooltip: true }),
      h(ElTableColumn, { prop: 'risk', label: '风险', minWidth: 220, showOverflowTooltip: true }), h(ElTableColumn, { prop: 'observationWindow', label: '观察窗口', width: 140 })
    ])
  }
})
const instanceId = computed(() => useInstanceStore().current?.id)
const tab = ref('vacuum')
const vacuumRows = ref<PgAdvisor[]>([]), indexRows = ref<PgAdvisor[]>([]), objects = ref<PgObjectAnalysis[]>([])
const vacuumLoading = ref(false), indexLoading = ref(false), objectLoading = ref(false)
async function loadVacuum() { if (!instanceId.value) return; vacuumLoading.value = true; try { vacuumRows.value = await listPgVacuumAdvice(instanceId.value) } finally { vacuumLoading.value = false } }
async function loadIndex() { if (!instanceId.value) return; indexLoading.value = true; try { indexRows.value = await listPgIndexAdvice(instanceId.value) } finally { indexLoading.value = false } }
async function loadObjects() { if (!instanceId.value) return; objectLoading.value = true; try { objects.value = await listPgObjectAnalysis(instanceId.value) } finally { objectLoading.value = false } }
function loadActive(name: string | number) { if (name === 'index') loadIndex(); else if (name === 'objects') loadObjects(); else loadVacuum() }
function bytes(v: number) { if (!v) return '0 B'; const u = ['B', 'KB', 'MB', 'GB', 'TB']; const i = Math.min(Math.floor(Math.log(v) / Math.log(1024)), 4); return `${(v / 1024 ** i).toFixed(1)} ${u[i]}` }
watch(instanceId, () => loadVacuum(), { immediate: true })
</script>

<style scoped>.tip{margin-bottom:12px}</style>