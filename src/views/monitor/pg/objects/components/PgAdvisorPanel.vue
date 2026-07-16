<template>
  <el-card shadow="never" class="block-card">
    <el-tabs v-model="tab" @tab-change="loadActive">
      <el-tab-pane label="清理建议" name="vacuum">
        <el-alert type="info" :closable="false" title="建议综合死元组、冻结年龄和自动清理配置生成；执行前请结合业务窗口确认。" class="tip" />
        <AdvisorTable :rows="vacuumRows" :loading="vacuumLoading" />
      </el-tab-pane>
      <el-tab-pane label="索引建议" name="index">
        <el-alert type="warning" :closable="false" title="重复或未使用索引仅作为候选；主键、唯一约束和复制标识所需索引会被保护。" class="tip" />
        <AdvisorTable :rows="indexRows" :loading="indexLoading" />
      </el-tab-pane>
      <el-tab-pane label="跨库对象容量" name="objects">
        <ProTable :data="objects" :columns="objectColumns" :loading="objectLoading" :total="objectTotal" v-model:page-num="objectPage.pageNum" v-model:page-size="objectPage.pageSize" :page-sizes="[10,20,50,100]" :show-add="false" :show-operation="false" embedded class="inner-table" @search="searchObjects" @page-change="loadObjects">
          <template #col-size="{row}">{{bytes(row.sizeBytes)}}</template><template #col-hit="{row}">{{row.cacheHitRate==null?'-':`${Number(row.cacheHitRate).toFixed(2)}%`}}</template>
        </ProTable>
      </el-tab-pane>
    </el-tabs>
  </el-card>
</template>
<script setup lang="ts">
import{computed,defineComponent,h,reactive,ref,watch}from'vue';import{useInstanceStore}from'@/stores/instance';import{listPgIndexAdvice,listPgObjectAnalysis,listPgVacuumAdvice}from'@/api/postgresql';import type{PgAdvisor,PgObjectAnalysis}from'@/api/postgresql';import ProTable from '@/components/ProTable/index.vue';import DictTag from '@/components/DictTag.vue';import type{TableColumn}from'@/components/ProTable/types'
const advisorColumns:TableColumn[]=[{prop:'database',label:'数据库',width:125},{prop:'objectName',label:'影响对象',minWidth:220},{label:'风险状态',width:100,slot:'col-severity'},{prop:'evidence',label:'判断依据',minWidth:260},{prop:'action',label:'建议动作',minWidth:300},{prop:'risk',label:'执行风险',minWidth:220},{prop:'observationWindow',label:'观察窗口',width:140}]
const AdvisorTable=defineComponent({props:{rows:{type:Array as()=>PgAdvisor[],required:true},loading:Boolean},setup(props){return()=>h(ProTable,{data:props.rows,columns:advisorColumns,loading:props.loading,showAdd:false,showOperation:false,showPagination:false,embedded:true,class:'inner-table'},{'col-severity':({row}:{row:PgAdvisor})=>h(DictTag,{dict:'pg_operation_severity',value:row.severity})})}})
const instanceId=computed(()=>useInstanceStore().current?.id),tab=ref('vacuum'),vacuumRows=ref<PgAdvisor[]>([]),indexRows=ref<PgAdvisor[]>([]),objects=ref<PgObjectAnalysis[]>([]),vacuumLoading=ref(false),indexLoading=ref(false),objectLoading=ref(false)
const objectPage=reactive({pageNum:1,pageSize:20}),objectTotal=ref(0)
const objectColumns:TableColumn[]=[{prop:'database',label:'数据库',width:130},{prop:'schema',label:'Schema',width:130},{prop:'objectType',label:'对象类型',width:110},{prop:'objectName',label:'对象',minWidth:240},{prop:'parentName',label:'父对象',minWidth:180},{prop:'tablespace',label:'表空间',width:140},{label:'大小',width:120,sortable:true,slot:'col-size'},{prop:'estimatedRows',label:'估算行数',width:120},{prop:'sequentialScans',label:'顺序扫描',width:120},{label:'缓存命中率',width:120,slot:'col-hit'}]
async function loadVacuum(){if(!instanceId.value)return;vacuumLoading.value=true;try{vacuumRows.value=await listPgVacuumAdvice(instanceId.value)}finally{vacuumLoading.value=false}}async function loadIndex(){if(!instanceId.value)return;indexLoading.value=true;try{indexRows.value=await listPgIndexAdvice(instanceId.value)}finally{indexLoading.value=false}}async function loadObjects(){if(!instanceId.value)return;objectLoading.value=true;try{const page=await listPgObjectAnalysis(instanceId.value,objectPage.pageNum,objectPage.pageSize);objects.value=page.list??[];objectTotal.value=page.total??0}finally{objectLoading.value=false}}function searchObjects(){objectPage.pageNum=1;loadObjects()}function loadActive(name:string|number){name==='index'?loadIndex():name==='objects'?loadObjects():loadVacuum()}function bytes(v:number){if(!v)return'0 B';const u=['B','KB','MB','GB','TB'];const i=Math.min(Math.floor(Math.log(v)/Math.log(1024)),4);return`${(v/1024**i).toFixed(1)} ${u[i]}`}watch(instanceId,()=>{objectPage.pageNum=1;loadVacuum()},{immediate:true})
</script>
<style scoped>.tip{margin-bottom:12px}</style>