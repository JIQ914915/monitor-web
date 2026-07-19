<template>
  <el-card shadow="never" class="diagnostic-card">
    <template #header>
      <div class="header">
        <div><div>实时会话与阻塞诊断</div><small>先看结论，再按需展开 SQL 和技术字段；高风险操作必须填写原因。</small></div>
        <el-button size="small" :loading="loading" @click="loadAll">刷新现场</el-button>
      </div>
    </template>
    <el-tabs v-model="tab">
      <el-tab-pane label="实时会话" name="sessions">
        <ProTable
          v-model:page-num="pagination.pageNum"
          v-model:page-size="pagination.pageSize"
          :data="sessions"
          :columns="sessionColumns"
          :loading="loading"
          :total="total"
          :page-sizes="[10,20,50,100]"
          collapsible
          default-collapsed
          :show-add="false"
          embedded
          class="inner-table"
          @search="searchSessions"
          @reset="resetFilters"
          @page-change="loadSessions"
        >
          <template #search>
            <el-form-item label="数据库"><el-input v-model="filters.database" clearable /></el-form-item>
            <el-form-item label="用户"><el-input v-model="filters.user" clearable /></el-form-item>
            <el-form-item label="会话状态"><el-input v-model="filters.state" clearable /></el-form-item>
            <el-form-item label="等待类型"><el-input v-model="filters.waitEventType" clearable /></el-form-item>
          </template>
          <template #col-duration="{row}">{{formatDuration(row.durationSeconds)}}</template>
          <template #col-wait="{row}">{{[row.waitEventType,row.waitEvent].filter(Boolean).join(':')||'无等待'}}</template>
          <template #col-blocker="{row}"><el-tag v-if="row.rootBlocker" type="danger">根阻塞者</el-tag><span v-else>{{row.blockedBy?.join(', ')||'未被阻塞'}}</span></template>
          <template #operation="{row}"><el-button link @click.stop="copyText(String(row.pid),'PID')">复制 PID</el-button><el-button link :disabled="!row.query" @click.stop="copyText(row.query||'','SQL')">复制 SQL</el-button><el-button v-permission="'pg_session:cancel'" link type="warning" @click.stop="act(row as PgSession,false)">取消查询</el-button><el-button v-permission="'pg_session:terminate'" link type="danger" @click.stop="act(row as PgSession,true)">终止会话</el-button></template>
        </ProTable>
      </el-tab-pane>
      <el-tab-pane :label="`阻塞树 (${trees.length})`" name="blocking">
        <el-alert v-if="!trees.length" type="success" :closable="false" title="数据库运行正常：当前未检测到会话阻塞" />
        <ProTable v-else :data="trees" :columns="treeColumns" :loading="loading" row-key="pid" :tree-props="{children:'children'}" default-expand-all :show-toolbar="false" :show-operation="false" :show-pagination="false" embedded class="inner-table">
          <template #col-affected="{row}"><el-tag type="danger">{{row.affectedSessions}}</el-tag></template><template #col-duration="{row}">{{formatDuration(row.durationSeconds)}}</template><template #col-objects="{row}">{{row.lockedObjects?.join(', ')||'未识别'}}</template>
        </ProTable>
      </el-tab-pane>
    </el-tabs>
  </el-card>
</template>
<script setup lang="ts">
import{reactive,ref,watch}from'vue';import{ElMessage,ElMessageBox}from'element-plus';import{cancelPgSession,getPgBlockingTree,listPgSessions,terminatePgSession,type PgBlockingNode,type PgSession}from'@/api/postgresql';import ProTable from '@/components/ProTable/index.vue';import type{TableColumn}from'@/components/ProTable/types'
const props=defineProps<{instanceId:number}>(),tab=ref('sessions'),loading=ref(false),sessions=ref<PgSession[]>([]),total=ref(0),trees=ref<PgBlockingNode[]>([])
const filters=reactive({database:'',user:'',state:'',waitEventType:''}),pagination=reactive({pageNum:1,pageSize:20})
const sessionColumns:TableColumn[]=[{prop:'pid',label:'PID',width:90,fixed:'left'},{prop:'database',label:'数据库',minWidth:110},{prop:'user',label:'用户',minWidth:100},{prop:'application',label:'应用',minWidth:130},{prop:'clientAddress',label:'客户端',width:125},{prop:'state',label:'数据库状态',width:130},{label:'持续时间',width:100,slot:'col-duration'},{label:'等待结论',minWidth:150,slot:'col-wait'},{label:'阻塞结论',minWidth:130,slot:'col-blocker'},{prop:'query',label:'SQL（高级信息）',minWidth:320}]
const treeColumns:TableColumn[]=[{prop:'pid',label:'阻塞关系 / PID',width:180},{prop:'database',label:'数据库',width:110},{prop:'user',label:'用户',width:100},{prop:'application',label:'应用',minWidth:130},{label:'影响会话',width:100,slot:'col-affected'},{label:'持续时间',width:100,slot:'col-duration'},{label:'锁对象',minWidth:180,slot:'col-objects'},{prop:'query',label:'SQL（高级信息）',minWidth:360}]
async function loadSessions(){loading.value=true;try{const page=await listPgSessions({instanceId:props.instanceId,...filters,pageNum:pagination.pageNum,pageSize:pagination.pageSize});sessions.value=page.list??[];total.value=page.total??0}finally{loading.value=false}}
async function loadAll(){loading.value=true;try{const[s,t]=await Promise.allSettled([listPgSessions({instanceId:props.instanceId,...filters,pageNum:pagination.pageNum,pageSize:pagination.pageSize}),getPgBlockingTree(props.instanceId)]);sessions.value=s.status==='fulfilled'?(s.value.list??[]):[];total.value=s.status==='fulfilled'?(s.value.total??0):0;trees.value=t.status==='fulfilled'?t.value:[]}finally{loading.value=false}}
function searchSessions(){pagination.pageNum=1;loadSessions()}function resetFilters(){Object.assign(filters,{database:'',user:'',state:'',waitEventType:''});pagination.pageNum=1;loadSessions()}
async function act(row:PgSession,terminate:boolean){const verb=terminate?'终止会话':'取消查询',context='PID '+row.pid+'；数据库 '+(row.database||'—')+'；用户 '+(row.user||'—')+'；应用 '+(row.application||'—')+'；客户端 '+(row.clientAddress||'—')+'；持续 '+formatDuration(row.durationSeconds)+'。';if(terminate)await ElMessageBox.confirm(context+' 未提交事务将回滚，请再次确认业务影响。','终止会话二次确认',{type:'warning',confirmButtonText:'继续填写原因'});const{value}=await ElMessageBox.prompt(context+(terminate?' 请填写终止原因。':' 数据库将尝试取消当前语句。'),verb,{inputPlaceholder:'请输入操作原因',inputValidator:v=>!!v?.trim()||'操作原因不能为空',type:'warning'});terminate?await terminatePgSession(props.instanceId,row.pid,value.trim()):await cancelPgSession(props.instanceId,row.pid,value.trim());ElMessage.success(verb+'请求已执行');await loadAll()}
async function copyText(value:string,label:string){await navigator.clipboard.writeText(value);ElMessage.success(label+' 已复制')}function formatDuration(s:number){if(s<60)return s+'秒';if(s<3600)return Math.floor(s/60)+'分钟';return Math.floor(s/3600)+'小时 '+Math.floor(s%3600/60)+'分钟'}watch(()=>props.instanceId,()=>{pagination.pageNum=1;loadAll()},{immediate:true})
</script>
<style scoped>.header{display:flex;align-items:center;justify-content:space-between;font-weight:600}.header small{display:block;color:var(--el-text-color-secondary);font-weight:400;margin-top:4px}</style>
