<template>
  <div class="pg-operations-panel">
    <CapabilityBanner :instance-id="id" />
    <div class="panel-intro">
      <div>
        <div class="panel-title">{{ title }}</div>
        <div class="panel-tip">{{ guidance }}</div>
      </div>
    </div>

    <section v-if="kind === 'timeline'" v-loading="healthLoading" class="health-section">
      <div class="health-headline">
        <DictTag dict="pg_operation_severity" :value="health?.severity || 'info'" />
        <strong>{{ health?.conclusion || '正在汇总最近 24 小时运维状态' }}</strong>
        <span>风险事件 {{ health?.riskCount ?? 0 }} 条，影响对象约 {{ health?.affectedObjectCount ?? 0 }} 个</span>
      </div>
      <ProTable
        :data="health?.risks || []"
        :columns="riskColumns"
        :loading="healthLoading"
        :show-add="false"
        :show-operation="false"
        :show-pagination="false"
        :show-toolbar="false"
        embedded
        class="inner-table risk-table"
      >
        <template #col-risk-severity="{ row }"><DictTag dict="pg_operation_severity" :value="row.severity" /></template>
        <template #empty><el-empty description="最近 24 小时未发现需要关注的原生运维风险" :image-size="70" /></template>
      </ProTable>
    </section>

    <ProTable
      :data="rows"
      :columns="columns"
      :loading="loading"
      :show-add="false"
      :show-operation="false"
      :total="total"
      v-model:page-num="pagination.pageNum"
      v-model:page-size="pagination.pageSize"
      :page-sizes="[10,20,50,100]"
      collapsible
      default-collapsed
      embedded
      class="inner-table"
      @search="search"
      @reset="resetFilters"
      @page-change="load"
      @row-click="showDetail"
    >
      <template #search>
        <el-form-item label="数据库"><el-input v-model="filters.database" clearable placeholder="全部数据库" style="width:150px" /></el-form-item>
        <el-form-item label="关键词"><el-input v-model="filters.keyword" clearable placeholder="消息、对象或指纹" style="width:210px" /></el-form-item>
        <el-form-item label="时间"><el-date-picker v-model="filters.range" type="datetimerange" range-separator="至" start-placeholder="开始" end-placeholder="结束" /></el-form-item>
      </template>
      <template #col-severity="{ row }"><DictTag dict="pg_operation_severity" :value="row.severity" /></template>
      <template #empty><el-empty :description="emptyDescription" :image-size="80" /></template>
    </ProTable>

    <CrudDrawer v-model:visible="detailVisible" mode="view" title="事件证据" size="640px">
      <el-descriptions :column="1" border>
        <el-descriptions-item label="状态"><DictTag dict="pg_operation_severity" :value="selected?.severity" /></el-descriptions-item>
        <el-descriptions-item label="发生时间">{{ selected?.eventTime || '-' }}</el-descriptions-item>
        <el-descriptions-item label="事件类型">{{ selected?.eventType || '-' }}</el-descriptions-item>
        <el-descriptions-item label="影响对象">{{ selected?.objectName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="错误指纹">{{ selected?.fingerprint || '-' }}</el-descriptions-item>
        <el-descriptions-item label="敏感信息">{{ selected?.sensitiveRedacted ? '已脱敏' : '无脱敏标记' }}</el-descriptions-item>
        <el-descriptions-item label="结论">{{ selected?.message || '已记录状态快照，请结合详情进一步判断。' }}</el-descriptions-item>
      </el-descriptions>
      <div class="detail-title">技术详情（高级信息）</div>
      <pre class="payload">{{ JSON.stringify(selected?.payload ?? {}, null, 2) }}</pre>
    </CrudDrawer>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useInstanceStore } from '@/stores/instance'
import { getPgOperationalHealth, listPgOperationalEvents } from '@/api/postgresql'
import type { PgOperationKind, PgOperationalEvent, PgOperationalHealth } from '@/api/postgresql'
import ProTable from '@/components/ProTable/index.vue'
import CrudDrawer from '@/components/ProTable/CrudDrawer.vue'
import DictTag from '@/components/DictTag.vue'
import CapabilityBanner from '@/components/CapabilityBanner.vue'
import type { TableColumn } from '@/components/ProTable/types'

const props=defineProps<{kind:PgOperationKind;title:string;category?:string}>()
const id=computed(()=>useInstanceStore().current?.id)
const loading=ref(false),healthLoading=ref(false)
const rows=ref<PgOperationalEvent[]>([]),health=ref<PgOperationalHealth>(),total=ref(0)
const pagination=reactive({pageNum:1,pageSize:20})
const filters=reactive({sqlState:'',database:'',user:'',keyword:'',range:[new Date(Date.now()-7*86400000),new Date()] as [Date,Date]})
const detailVisible=ref(false),selected=ref<PgOperationalEvent>()
const columns:TableColumn[]=[
  {prop:'eventTime',label:'时间',width:180},{label:'状态',width:100,slot:'col-severity'},
  {prop:'eventType',label:'事件类型',width:180},{prop:'database',label:'数据库',width:130},
  {prop:'user',label:'用户',width:120},{prop:'objectName',label:'影响对象',minWidth:170},
  {prop:'sqlState',label:'SQLSTATE',width:100},{prop:'message',label:'结论 / 状态',minWidth:300},
  {prop:'queryId',label:'Query ID',width:150}
]
const riskColumns:TableColumn[]=[
  {label:'状态',width:90,slot:'col-risk-severity'},{prop:'conclusion',label:'主要风险',minWidth:210},
  {prop:'impact',label:'影响',minWidth:220},{prop:'action',label:'下一步建议',minWidth:300},
  {prop:'eventCount',label:'事件数',width:85},{prop:'fingerprintCount',label:'对象数',width:85}
]
const guidance=computed(()=>props.kind==='progress'?'优先关注“关注/告警”任务，可打开详情查看停滞状态和阻塞 PID。':props.kind==='backups'?'WAL 归档正常不代表可恢复，请结合恢复演练验证结果判断。':'默认展示最近七天证据；内容已经截断并脱敏。')
const emptyDescription=computed(()=>props.kind==='progress'?'当前没有运行中的运维任务，数据库运行不受影响。':'暂无需要展示的原生运维事件，数据库当前未发现相关风险。')
async function load(){
  if(!id.value)return
  loading.value=true
  try{const page=await listPgOperationalEvents(props.kind,{instanceId:id.value,category:props.category,sqlState:filters.sqlState||undefined,database:filters.database||undefined,user:filters.user||undefined,keyword:filters.keyword||undefined,from:filters.range?.[0]?.toISOString(),to:filters.range?.[1]?.toISOString(),pageNum:pagination.pageNum,pageSize:pagination.pageSize});rows.value=page.list??[];total.value=page.total??0}finally{loading.value=false}
}
async function loadHealth(){
  if(!id.value||props.kind!=='timeline')return
  healthLoading.value=true
  try{health.value=await getPgOperationalHealth(id.value)}finally{healthLoading.value=false}
}
function search(){pagination.pageNum=1;load()}
function resetFilters(){Object.assign(filters,{sqlState:'',database:'',user:'',keyword:'',range:[new Date(Date.now()-7*86400000),new Date()]});pagination.pageNum=1;load()}
function showDetail(row:PgOperationalEvent){selected.value=row;detailVisible.value=true}
watch(id,()=>{pagination.pageNum=1;load();loadHealth()},{immediate:true})
</script>

<style scoped>
.pg-operations-panel{margin:16px}.panel-intro{display:flex;justify-content:space-between;margin-bottom:10px}.panel-title{font-weight:600;font-size:16px}.panel-tip{font-size:12px;color:var(--el-text-color-secondary);margin-top:5px}.health-section{border:1px solid var(--el-border-color-lighter);border-radius:8px;padding:14px;margin-bottom:14px}.health-headline{display:flex;align-items:center;gap:12px;margin-bottom:10px}.health-headline span{font-size:13px;color:var(--el-text-color-secondary)}.risk-table{margin-top:4px}.detail-title{font-weight:600;margin-top:18px}.payload{white-space:pre-wrap;word-break:break-all;background:var(--el-fill-color-light);padding:12px;border-radius:6px;max-height:420px;overflow:auto}
</style>
