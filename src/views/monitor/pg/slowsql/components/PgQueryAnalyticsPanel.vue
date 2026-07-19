<template>
  <div class="analytics-panel">
    <PgCollectionQualityAlert :instance-id="instanceId" scope="query" :item-codes="['pg_top_sql']" />
    <el-alert v-if="statsQualityMessage" type="warning" :closable="false" :title="statsQualityMessage" show-icon class="tip" />
    <el-card shadow="never" class="analytics-card">
      <el-tabs v-model="tab" @tab-change="loadActive">
        <el-tab-pane label="Query Analytics" name="analytics">
          <ProTable :data="analytics" :columns="analyticsColumns" :loading="loading" :show-add="false" :total="analyticsTotal" v-model:page-num="analyticsPage.pageNum" v-model:page-size="analyticsPage.pageSize" :page-sizes="[10,20,50,100]" collapsible default-collapsed embedded class="inner-table" @search="searchAnalytics" @reset="resetAnalytics" @page-change="loadAnalytics">
            <template #search>
              <el-form-item label="数据库"><el-input v-model="database" clearable placeholder="全部" /></el-form-item>
              <el-form-item label="用户"><el-input v-model="user" clearable placeholder="全部" /></el-form-item>
              <el-form-item label="Query ID"><el-input v-model="queryId" clearable placeholder="全部" style="width:170px" /></el-form-item>
              <el-form-item label="时间范围"><el-date-picker v-model="dateRange" type="datetimerange" range-separator="至" start-placeholder="开始" end-placeholder="结束" /></el-form-item>
              <el-form-item label="排序"><el-select v-model="sortBy" style="width:150px"><el-option label="总执行时间" value="totalExecTimeMs"/><el-option label="平均耗时" value="avgExecTimeMs"/><el-option label="调用次数" value="calls"/><el-option label="临时块写入" value="tempWritten"/><el-option label="WAL 字节" value="walBytes"/></el-select></el-form-item>
            </template>
            <template #col-avg="{row}">{{fmt(row.avgExecTimeMs)}}</template><template #col-std="{row}">{{fmt(row.stddevExecTimeMs)}}</template><template #col-read="{row}">{{fmt(row.sharedRead,0)}}</template><template #col-temp="{row}">{{fmt(row.tempWritten,0)}}</template><template #col-io="{row}">{{row.blockReadTimeMs==null?'未启用':fmt(row.blockReadTimeMs)}}</template><template #col-wal="{row}">{{bytes(row.walBytes)}}</template><template #col-reset="{row}">{{formatTime(row.statsReset)}}</template><template #col-dealloc="{row}">{{row.deallocations??0}}</template>
            <template #operation="{row}"><el-button link type="primary" @click.stop="openPlan(row as PgQueryAnalytics)">执行计划</el-button></template>
          </ProTable>
        </el-tab-pane>
        <el-tab-pane label="性能回退" name="regressions">
          <el-alert type="info" :closable="false" title="结论来自最近 2 小时与过去 4 周同星期、同时段对比，请结合业务发布记录判断。" class="tip" />
          <ProTable :data="regressions" :columns="regressionColumns" :loading="regressionLoading" :show-add="false" :show-operation="false" :total="regressionTotal" v-model:page-num="regressionPage.pageNum" v-model:page-size="regressionPage.pageSize" :page-sizes="[10,20,50,100]" embedded class="inner-table" @search="searchRegressions" @page-change="loadRegressions">
            <template #col-severity="{row}"><DictTag dict="pg_operation_severity" :value="row.severity" /></template><template #col-baseline="{row}">{{fmt(row.baselineValue)}} → {{fmt(row.currentValue)}}</template><template #col-change="{row}">{{row.changeRatio==null?'-':`${fmt(row.changeRatio*100)}%`}}</template>
          </ProTable>
        </el-tab-pane>
      </el-tabs>
    </el-card>
    <CrudDrawer ref="planDrawerRef" v-model:visible="planVisible" mode="create" title="安全执行计划" size="860px" :confirm-on-save="false" @save="capturePlan">
      <el-alert type="info" :closable="false" title="仅执行 EXPLAIN，不执行 ANALYZE；不会真正运行 SQL。" class="tip" />
      <el-input v-model="planSql" type="textarea" :rows="7" placeholder="仅支持无需绑定参数的 SELECT / WITH / TABLE 语句" />
      <div class="history-title">历史版本</div>
      <ProTable :data="plans" :columns="planColumns" :loading="planLoading" :show-toolbar="false" :show-operation="false" :show-pagination="false" embedded class="inner-table">
        <template #col-change="{row}"><DictTag dict="pg_plan_change_status" :value="row.planChanged?'changed':'unchanged'" /></template><template #col-nodes="{row}">{{row.nodeSummary?.length??0}}</template>
      </ProTable>
    </CrudDrawer>
  </div>
</template>
<script setup lang="ts">
import {computed,reactive,ref,watch} from 'vue';import{ElMessage}from'element-plus';import{useInstanceStore}from'@/stores/instance';import{capturePgPlan,listPgPlanHistory,listPgQueryAnalytics,listPgSqlRegressions}from'@/api/postgresql';import type{PgPlanHistory,PgQueryAnalytics,PgSqlRegression}from'@/api/postgresql';import{getMetricLatest}from'@/api/metric';import{PG}from'@/constants/pg-metrics';import ProTable from '@/components/ProTable/index.vue';import CrudDrawer from '@/components/ProTable/CrudDrawer.vue';import DictTag from '@/components/DictTag.vue';import PgCollectionQualityAlert from '../../components/PgCollectionQualityAlert.vue';import type{TableColumn}from'@/components/ProTable/types'
const instanceId=computed(()=>useInstanceStore().current?.id),tab=ref('analytics'),database=ref(''),user=ref(''),queryId=ref(''),dateRange=ref<[Date,Date]>([new Date(Date.now()-7*86400000),new Date()]),sortBy=ref('totalExecTimeMs'),loading=ref(false),regressionLoading=ref(false),analytics=ref<PgQueryAnalytics[]>([]),regressions=ref<PgSqlRegression[]>([]),planVisible=ref(false),planLoading=ref(false),planSql=ref(''),planRow=ref<PgQueryAnalytics>(),plans=ref<PgPlanHistory[]>([]),planDrawerRef=ref<InstanceType<typeof CrudDrawer>>(),statsResetAge=ref<number>(),deallocDelta=ref<number>()
const analyticsPage=reactive({pageNum:1,pageSize:20}),regressionPage=reactive({pageNum:1,pageSize:20}),analyticsTotal=ref(0),regressionTotal=ref(0)
const analyticsColumns:TableColumn[]=[{prop:'database',label:'数据库',width:130},{prop:'user',label:'用户',width:120},{prop:'queryText',label:'SQL',minWidth:340},{prop:'calls',label:'调用',width:90,sortable:true},{label:'平均耗时(ms)',width:130,slot:'col-avg'},{label:'波动(ms)',width:115,slot:'col-std'},{label:'共享读块',width:110,slot:'col-read'},{label:'临时写块',width:110,slot:'col-temp'},{label:'I/O读(ms)',width:110,slot:'col-io'},{label:'WAL',width:100,slot:'col-wal'},{label:'统计重置',width:180,slot:'col-reset'},{label:'条目淘汰',width:100,slot:'col-dealloc'}]
const regressionColumns:TableColumn[]=[{prop:'database',label:'数据库',width:130},{prop:'queryText',label:'SQL',minWidth:360},{prop:'type',label:'回退类型',width:150},{label:'风险状态',width:100,slot:'col-severity'},{label:'基线 → 当前',width:180,slot:'col-baseline'},{label:'变化',width:100,slot:'col-change'},{prop:'detectedAt',label:'发现时间',width:180}]
const planColumns:TableColumn[]=[{prop:'capturedAt',label:'采集时间',width:190},{prop:'planHash',label:'Plan Hash',minWidth:220},{label:'计划变化',width:110,slot:'col-change'},{label:'节点数',width:90,slot:'col-nodes'}]
async function loadStatsQuality(){if(!instanceId.value)return;try{const result=await getMetricLatest(instanceId.value,[PG.STATEMENTS_RESET_AGE_SECONDS,PG.STATEMENTS_DEALLOC_DELTA]);statsResetAge.value=result.values?.[PG.STATEMENTS_RESET_AGE_SECONDS]??undefined;deallocDelta.value=result.values?.[PG.STATEMENTS_DEALLOC_DELTA]??undefined}catch{statsResetAge.value=undefined;deallocDelta.value=undefined}}
const statsQualityMessage=computed(()=>{const messages:string[]=[];if(statsResetAge.value!=null&&statsResetAge.value<86400)messages.push(`SQL 统计在 ${formatDuration(statsResetAge.value)}前重置，性能回退基线可能不连续`);if((deallocDelta.value??0)>0)messages.push(`最近采集周期有 ${deallocDelta.value} 次 SQL 统计条目被淘汰，Query Analytics 可能不完整`);return messages.join('；')})
async function loadAnalytics(){if(!instanceId.value)return;loading.value=true;try{const page=await listPgQueryAnalytics({instanceId:instanceId.value,database:database.value||undefined,user:user.value||undefined,queryId:queryId.value||undefined,from:dateRange.value?.[0]?.toISOString(),to:dateRange.value?.[1]?.toISOString(),sortBy:sortBy.value,pageNum:analyticsPage.pageNum,pageSize:analyticsPage.pageSize});analytics.value=page.list??[];analyticsTotal.value=page.total??0}finally{loading.value=false}}
async function loadRegressions(){if(!instanceId.value)return;regressionLoading.value=true;try{const page=await listPgSqlRegressions(instanceId.value,regressionPage.pageNum,regressionPage.pageSize);regressions.value=page.list??[];regressionTotal.value=page.total??0}finally{regressionLoading.value=false}}
function searchAnalytics(){analyticsPage.pageNum=1;loadAnalytics()}function searchRegressions(){regressionPage.pageNum=1;loadRegressions()}
function loadActive(name:string|number){name==='regressions'?loadRegressions():loadAnalytics()}function resetAnalytics(){database.value='';user.value='';queryId.value='';dateRange.value=[new Date(Date.now()-7*86400000),new Date()];sortBy.value='totalExecTimeMs';analyticsPage.pageNum=1;loadAnalytics()}
async function openPlan(row:PgQueryAnalytics){planRow.value=row;planSql.value=row.queryText;planVisible.value=true;if(instanceId.value)plans.value=await listPgPlanHistory(instanceId.value,row.database,row.queryId)}
async function capturePlan(){if(!instanceId.value||!planRow.value)return;planLoading.value=true;try{await capturePgPlan(instanceId.value,planRow.value.database,planRow.value.queryId,planSql.value);plans.value=await listPgPlanHistory(instanceId.value,planRow.value.database,planRow.value.queryId);planDrawerRef.value?.stopSaving(false);ElMessage.success('执行计划已安全采集')}catch(e){planDrawerRef.value?.stopSaving(false);throw e}finally{planLoading.value=false}}
function fmt(v?:number,digits=2){return v==null?'-':Number(v).toFixed(digits)}function bytes(v:number){if(!v)return'0 B';const u=['B','KB','MB','GB'];const i=Math.min(Math.floor(Math.log(v)/Math.log(1024)),3);return`${(v/1024**i).toFixed(1)} ${u[i]}`}function formatTime(v?:string){return v?new Date(v).toLocaleString():'-'}function formatDuration(v:number){if(v<3600)return`${Math.max(1,Math.round(v/60))} 分钟`;if(v<86400)return`${Math.round(v/3600)} 小时`;return`${Math.round(v/86400)} 天`}watch(instanceId,()=>{analyticsPage.pageNum=1;regressionPage.pageNum=1;loadAnalytics();loadStatsQuality()},{immediate:true})
</script>
<style scoped>.analytics-card{margin-top:16px}.tip{margin-bottom:12px}.history-title{font-weight:600;margin:18px 0 8px}</style>