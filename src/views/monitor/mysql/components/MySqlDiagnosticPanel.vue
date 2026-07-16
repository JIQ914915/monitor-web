<template>
  <section :class="['diagnostic-panel', { 'diagnostic-panel--correlation': kind === 'correlation', 'diagnostic-panel--embedded': embedded }]" v-loading="loading">
    <div class="headline">
      <div class="headline-copy">
        <div class="headline-title-row">
          <span class="headline-title">{{ panelTitle }}</span>
          <DictTag dict="mysql_diagnostic_status" :value="result?.status || 'no_data'" />
        </div>
        <div class="headline-conclusion">{{ displayConclusion }}</div>
      </div>
      <el-select v-if="kind === 'config'" v-model="baselineTemplate" size="small" style="width:150px" @change="load">
        <el-option v-for="item in getDictItems('mysql_config_baseline_template')" :key="item.itemValue" :label="item.itemLabel" :value="item.itemValue" />
      </el-select>
      <DictTag v-if="kind === 'replication'" dict="mysql_replication_channel_status" :value="result?.channelStatus || 'UNKNOWN'" />
      <el-switch v-if="kind === 'security'" v-model="enhanced" active-text="增强检查" @change="load" />
      <el-button size="small" :loading="loading" @click="load">刷新</el-button>
    </div>
    <div v-if="summary.length" class="summary-grid">
      <div v-for="item in summary" :key="item.label" class="summary-item">
        <span>{{ item.label }}</span><strong>{{ item.value }}</strong>
      </div>
    </div>
    <ProTable v-if="rows.length" :data="rows" :columns="columns" :show-add="false" :show-operation="false"
      :show-toolbar="false" :show-pagination="rows.length > 20" :total="rows.length"
      :border="kind !== 'correlation'" embedded class="inner-table" @row-click="showDetail">
      <template #col-risk="{ row }"><DictTag dict="mysql_risk_level" :value="row.riskLevel || 'unknown'" /></template>
      <template #col-stage="{ row }"><DictTag dict="mysql_replication_stage" :value="row.stage || result?.stage || 'unknown'" /></template>
      <template #col-worker="{ row }"><DictTag dict="mysql_replication_worker_status" :value="row.SERVICE_STATE || 'OFF'" /></template>
      <template #col-advice="{ row }"><DictTag dict="mysql_advice_type" :value="row.adviceType || 'info'" /></template>
      <template #col-schema="{ row }"><span class="schema-name">{{ row.schema_name || '-' }}</span></template>
      <template #col-digest="{ row }"><el-tooltip :content="row.digest || '-'" placement="top"><code class="digest-code">{{ row.digest || '-' }}</code></el-tooltip></template>
      <template #col-sql="{ row }"><el-tooltip :content="row.digest_text || '-'" placement="top" :show-after="300"><span class="sql-text">{{ row.digest_text || '-' }}</span></el-tooltip></template>
      <template #col-number="{ row, column }"><span class="number-value">{{ formatInteger(row[column.property]) }}</span></template>
      <template #col-lock-time="{ row }"><span class="number-value">{{ formatPicoseconds(row.lock_time) }}</span></template>

    </ProTable>
    <div v-else-if="!loading && result" :class="['compact-empty', { 'compact-empty--normal': result.status === 'normal' }]">
      <span class="compact-empty-dot" />
      <span>{{ emptyText }}</span>
    </div>
    <CrudDrawer v-model:visible="detailVisible" mode="view" title="诊断证据" size="680px">
      <el-descriptions :column="1" border>
        <el-descriptions-item label="结论">{{ selected?.conclusion || result?.conclusion || '-' }}</el-descriptions-item>
        <el-descriptions-item label="建议">{{ selected?.suggestion || '请结合业务影响人工确认，平台不会自动执行高风险动作。' }}</el-descriptions-item>
      </el-descriptions>
      <div class="detail-title">高级证据</div>
      <pre class="payload">{{ JSON.stringify(selected || result, null, 2) }}</pre>
    </CrudDrawer>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ProTable from '@/components/ProTable/index.vue'
import CrudDrawer from '@/components/ProTable/CrudDrawer.vue'
import DictTag from '@/components/DictTag.vue'
import { useDict } from '@/composables/useDict'
import type { TableColumn } from '@/components/ProTable/types'
import { getMySqlCapacityRisks, getMySqlConfigDrift, getMySqlCorrelation,
  getMySqlMetadataLocks, getMySqlReplicationDiagnosis, getMySqlSecurityBaseline,
  type MySqlDiagnosticResult } from '@/api/mysqlDiagnostics'

type Kind = 'capacity' | 'config' | 'replication' | 'mdl' | 'correlation' | 'security'
const props = withDefaults(defineProps<{ instanceId: number; kind: Kind; from?: number; to?: number; embedded?: boolean }>(), { embedded: false })
const loading = ref(false), enhanced = ref(false), baselineTemplate = ref('stability'), result = ref<MySqlDiagnosticResult>()
const { getDictItems } = useDict('mysql_config_baseline_template')
const detailVisible = ref(false), selected = ref<Record<string, any>>()

const PANEL_TITLES: Record<Kind, string> = {
  capacity: '容量风险诊断',
  config: '配置风险诊断',
  replication: '复制故障诊断',
  mdl: '元数据锁诊断',
  correlation: '等待与 SQL 关联诊断',
  security: '安全基线诊断'
}
const WAIT_LABELS: Record<string, string> = {
  'mysql.waits.io_file_ms': '文件 I/O 等待',
  'mysql.waits.io_table_ms': '表 I/O 等待',
  'mysql.waits.lock_ms': '锁等待',
  'mysql.waits.synch_ms': '同步等待'
}
const panelTitle = computed(() => PANEL_TITLES[props.kind])
const displayConclusion = computed(() => {
  const conclusion = result.value?.conclusion || '正在获取诊断结论'
  const dominant = result.value?.dominantWait
  return dominant ? conclusion.replace(String(dominant), waitLabel(dominant)) : conclusion
})

const configs: Record<Kind, TableColumn[]> = {
  capacity: [{ prop:'riskType',label:'风险类型',width:110 },{ prop:'object_name',label:'表',minWidth:220 },{ label:'风险',slot:'col-risk',width:100 },{ prop:'value',label:'自增ID使用率(%)',width:150 },{ prop:'currentSize',label:'当前大小',width:120 },{ prop:'growthSize',label:'近7天增长',width:120 },{ prop:'conclusion',label:'结论与建议',minWidth:320 }],
  config: [{ prop:'parameter',label:'参数',minWidth:190 },{ label:'类型',slot:'col-advice',width:100 },{ label:'风险',slot:'col-risk',width:100 },{ prop:'previous_value',label:'变更前',minWidth:140 },{ prop:'value_text',label:'变更后/证据',minWidth:150 },{ prop:'collect_time',label:'发现时间',width:180 },{ prop:'conclusion',label:'风险说明',minWidth:280 }],
  replication: [{ label:'阶段',slot:'col-stage',width:110 },{ prop:'CHANNEL_NAME',label:'通道',width:120 },{ prop:'WORKER_ID',label:'Worker',width:90 },{ label:'状态',slot:'col-worker',width:110 },{ prop:'LAST_ERROR_NUMBER',label:'错误码',width:90 },{ prop:'LAST_ERROR_MESSAGE',label:'最近错误',minWidth:320 }],
  mdl: [{ prop:'object_schema',label:'Schema',width:130 },{ prop:'object_name',label:'对象',minWidth:160 },{ prop:'waiting_lock_type',label:'等待锁类型',width:140 },{ prop:'wait_seconds',label:'等待秒数',width:110 },{ prop:'waiting_pid',label:'等待会话',width:100 },{ prop:'blocking_pid',label:'阻塞会话',width:100 },{ prop:'waiting_query',label:'等待 SQL',minWidth:260 }],
  correlation: [{ prop:'schema_name',label:'Schema',slot:'col-schema',width:140 },{ prop:'digest',label:'SQL 指纹',slot:'col-digest',width:180 },{ prop:'digest_text',label:'主要贡献 SQL',slot:'col-sql',minWidth:420 },{ prop:'exec_count',label:'执行次数',slot:'col-number',width:110,align:'right' },{ prop:'rows_examined',label:'扫描行数',slot:'col-number',width:120,align:'right' },{ prop:'lock_time',label:'锁等待耗时',slot:'col-lock-time',width:130,align:'right' }],
  security: [{ label:'建议类型',slot:'col-advice',width:110 },{ label:'风险',slot:'col-risk',width:100 },{ prop:'conclusion',label:'风险结论',minWidth:260 },{ prop:'suggestion',label:'人工处理建议',minWidth:340 }]
}
const columns = computed(() => configs[props.kind])
const rows = computed<Record<string,any>[]>(() => {
  const data = result.value
  if (!data) return []
  if (props.kind === 'capacity') return [...(data.autoIncrementRisks || []).map((x:any) => ({...x,riskType:'自增ID'})), ...(data.fastestGrowingTables || []).map((x:any) => ({...x,riskType:'容量增长',object_name:x.objectName,riskLevel:'unknown',currentSize:formatBytes(x.currentBytes),growthSize:formatBytes(x.growthBytes),conclusion:x.growthBytes==null?'历史不足 7 天，暂无法比较':'近 7 天增长 '+formatBytes(x.growthBytes)}))]
  if (props.kind === 'config') return [...(data.risks || []), ...(data.changes || []).map((x:any) => ({...x, parameter:String(x.metric_code||'').replace('mysql.var_text.','').replace('mysql.var.',''), adviceType:'info', riskLevel:'unknown'}))]
  if (props.kind === 'replication') return (data.workers || []).map((x:any) => ({...x, stage:data.stage}))
  if (props.kind === 'mdl') return data.rows || []
  if (props.kind === 'correlation') return data.topSql || []
  return data.risks || []
})
const summary = computed(() => {
  const d=result.value;if(!d)return []
  if(props.kind==='capacity')return [{label:'预计风险日期',value:d.forecast?.estimatedExhaustionDate||'-'},{label:'Binlog 占用',value:formatBytes(d.binlogBytes)},{label:'Binlog 日增长',value:formatBytes(d.binlogDailyGrowthBytes)+'/天'},{label:'保留配置',value:d.binlogRetentionDays==null?'-':`${Number(d.binlogRetentionDays).toFixed(1)} 天`}]
  if(props.kind==='replication')return [{label:'诊断阶段',value:d.stage||'-'},{label:'复制延迟',value:d.secondsBehind==null?'未知':`${d.secondsBehind} 秒`},{label:'Relay Log',value:formatBytes(d.relayLogBytes)},{label:'延迟可信',value:d.secondsBehindReliable?'是':'否'}]
  if(props.kind==='mdl')return [{label:'等待会话',value:String(d.total??0)},{label:'根阻塞会话',value:String(d.rootBlockers??0)}]
  if(props.kind==='correlation')return [{label:'主要等待',value:waitLabel(d.dominantWait)},{label:'贡献 SQL',value:`${d.topSql?.length??0} 条`},{label:'当前诊断范围',value:formatWindow(props.from,props.to)}]
  return []
})
const emptyText = computed(() => props.kind==='mdl'?'当前未发现 Metadata Lock 等待':props.kind==='replication'?'暂无 Worker 错误或当前实例不是从库':'暂无需要关注的诊断明细')
function waitLabel(value:any){return WAIT_LABELS[String(value)] || String(value || '数据不足')}
function formatBytes(v:any){const n=Number(v);if(!Number.isFinite(n))return '-';if(n<1024)return `${n.toFixed(0)} B`;if(n<1024**2)return `${(n/1024).toFixed(1)} KB`;if(n<1024**3)return `${(n/1024**2).toFixed(1)} MB`;return `${(n/1024**3).toFixed(2)} GB`}
function formatInteger(v:any){const n=Number(v);return Number.isFinite(n)?Math.round(n).toLocaleString('zh-CN'):'-'}
function formatPicoseconds(v:any){const n=Number(v);if(!Number.isFinite(n))return '-';if(n>=1e12)return `${(n/1e12).toFixed(2)} s`;if(n>=1e9)return `${(n/1e9).toFixed(2)} ms`;if(n>=1e6)return `${(n/1e6).toFixed(2)} μs`;return `${Math.round(n).toLocaleString('zh-CN')} ps`}
function formatWindow(from?:number,to?:number){
  if(from==null||to==null)return '最近 2 小时'
  const span=to-from
  const duration=span%86400000===0?`${span/86400000} 天`:span%3600000===0?`${span/3600000} 小时`:'自定义'
  const fmt=(v:number)=>new Intl.DateTimeFormat('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(v)).replaceAll('/','-')
  return `${duration} · ${fmt(from)} 至 ${fmt(to)}`
}
async function load(){if(!props.instanceId)return;loading.value=true;try{result.value=await ({capacity:()=>getMySqlCapacityRisks(props.instanceId),config:()=>getMySqlConfigDrift(props.instanceId,undefined,baselineTemplate.value),replication:()=>getMySqlReplicationDiagnosis(props.instanceId),mdl:()=>getMySqlMetadataLocks(props.instanceId),correlation:()=>getMySqlCorrelation(props.instanceId,props.from,props.to),security:()=>getMySqlSecurityBaseline(props.instanceId,enhanced.value)}[props.kind]())}finally{loading.value=false}}
function showDetail(row:Record<string,any>){selected.value=row;detailVisible.value=true}
watch(() => [props.instanceId, props.kind, props.from, props.to], load, { immediate:true })
</script>

<style scoped>
.diagnostic-panel {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 14px;
  margin-bottom: 16px;
  background: var(--el-bg-color);
}
.headline {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.headline-copy { flex: 1; min-width: 0; }
.headline-title-row { display: flex; align-items: center; gap: 10px; }
.headline-title { font-size: 15px; font-weight: 600; color: var(--el-text-color-primary); }
.headline-conclusion {
  margin-top: 5px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.5;
}
.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}
.summary-item {
  min-width: 0;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-extra-light);
  border-radius: 6px;
  padding: 10px 12px;
}
.summary-item span { display: block; color: var(--el-text-color-secondary); font-size: 12px; }
.summary-item strong { display: block; margin-top: 5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.diagnostic-panel--embedded { border: 0; border-radius: 0; padding: 0; margin-bottom: 16px; background: transparent; }
.diagnostic-panel--embedded .headline { margin-bottom: 12px; }
.diagnostic-panel--embedded .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.diagnostic-panel--embedded .summary-item { padding: 9px 12px; }
.diagnostic-panel--correlation { padding: 0; margin-bottom: 0; overflow: hidden; }
.diagnostic-panel--correlation .headline { padding: 12px 16px; margin-bottom: 0; border-bottom: 1px solid var(--el-border-color-lighter); }
.diagnostic-panel--correlation .summary-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); padding: 14px 16px 12px; margin-bottom: 0; }
.diagnostic-panel--correlation .summary-item { background: var(--el-fill-color-blank); }
.diagnostic-panel--correlation .inner-table { padding: 0 16px 16px; }
.diagnostic-panel--correlation :deep(.el-table th.el-table__cell) { background: var(--el-fill-color-light); }
.schema-name { color: var(--el-text-color-regular); }
.digest-code { display: block; overflow: hidden; text-overflow: ellipsis; color: var(--el-color-primary); background: transparent; white-space: nowrap; }
.sql-text { display: block; overflow: hidden; text-overflow: ellipsis; color: var(--el-text-color-regular); font-family: var(--el-font-family); white-space: nowrap; }
.number-value { font-variant-numeric: tabular-nums; }
.compact-empty {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  padding: 9px 12px;
  border: 1px dashed var(--el-border-color);
  border-radius: 6px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.compact-empty-dot { width: 7px; height: 7px; flex: none; border-radius: 50%; background: var(--el-text-color-placeholder); }
.compact-empty--normal { background: var(--el-color-success-light-9); }
.compact-empty--normal .compact-empty-dot { background: var(--el-color-success); }
.detail-title { font-weight: 600; margin-top: 18px; }
.payload { white-space: pre-wrap; word-break: break-all; background: var(--el-fill-color-light); padding: 12px; border-radius: 6px; max-height: 430px; overflow: auto; }
@media (max-width: 1200px) {
  .summary-grid, .diagnostic-panel--correlation .summary-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>
