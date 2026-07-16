<template>
  <div class="backup-page">
    <PgOperationsPanel kind="backups" title="WAL 归档状态" />
    <section class="drill-section">
      <div class="section-title">恢复演练记录</div>
      <div class="section-tip">平台仅记录原生 WAL 归档状态和人工恢复演练结果；演练通过后才能确认可恢复。</div>
      <el-alert v-if="drillRisk" :title="drillRisk" type="warning" show-icon :closable="false" class="drill-risk" />
      <ProTable :data="drills" :columns="columns" :loading="loading" :total="total" v-model:page-num="pagination.pageNum" v-model:page-size="pagination.pageSize" :page-sizes="[10,20,50,100]" :show-operation="false" add-text="登记演练" embedded class="inner-table" @add="open" @search="search" @page-change="load">
        <template #col-status="{row}"><DictTag dict="pg_restore_drill_status" :value="row.status" /></template>
        <template #col-validation="{row}"><DictTag dict="pg_restore_validation_result" :value="row.validationResult" /></template>
        <template #empty><el-empty description="尚未登记恢复演练，建议从最近一次完整备份开始验证。" :image-size="80" /></template>
      </ProTable>
    </section>
    <CrudDrawer ref="drawerRef" v-model:visible="visible" mode="create" title="恢复演练" size="620px" :form-ref="formRef" :confirm-on-save="false" @save="save">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="120px">
        <el-form-item label="备份 ID"><el-input v-model="form.backupId" placeholder="填写本次验证使用的备份标识" /></el-form-item>
        <el-form-item label="恢复目标时间"><el-date-picker v-model="target" type="datetime" placeholder="可选：PITR 目标时间" style="width:100%" /></el-form-item>
        <el-form-item label="开始/结束时间" prop="period"><el-date-picker v-model="period" type="datetimerange" range-separator="至" start-placeholder="开始" end-placeholder="结束" style="width:100%" /></el-form-item>
        <el-form-item label="演练状态" prop="status"><el-select v-model="form.status" placeholder="请选择"><el-option v-for="item in getDictItems('pg_restore_drill_status')" :key="item.itemValue" :label="item.itemLabel" :value="item.itemValue" /></el-select></el-form-item>
        <el-form-item label="验证结果" prop="validationResult"><el-select v-model="form.validationResult" placeholder="请选择"><el-option v-for="item in getDictItems('pg_restore_validation_result')" :key="item.itemValue" :label="item.itemLabel" :value="item.itemValue" /></el-select></el-form-item>
        <el-form-item label="负责人" prop="ownerName"><el-input v-model="form.ownerName" placeholder="填写本次演练负责人" /></el-form-item>
        <el-form-item label="结果说明"><el-input v-model="form.notes" type="textarea" :rows="4" placeholder="记录恢复范围、校验内容、异常和后续动作" /></el-form-item>
      </el-form>
    </CrudDrawer>
  </div>
</template>
<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { useInstanceStore } from '@/stores/instance'
import { listPgRestoreDrills, savePgRestoreDrill } from '@/api/postgresql'
import type { PgRestoreDrill } from '@/api/postgresql'
import PgOperationsPanel from '../components/PgOperationsPanel.vue'
import ProTable from '@/components/ProTable/index.vue'
import CrudDrawer from '@/components/ProTable/CrudDrawer.vue'
import DictTag from '@/components/DictTag.vue'
import type { TableColumn } from '@/components/ProTable/types'
import { useDict } from '@/composables/useDict'

const id=computed(()=>useInstanceStore().current?.id),drills=ref<PgRestoreDrill[]>([]),latestDrill=ref<PgRestoreDrill>(),total=ref(0),loading=ref(false),visible=ref(false)
const pagination=reactive({pageNum:1,pageSize:20})
const formRef=ref<FormInstance>(),drawerRef=ref<InstanceType<typeof CrudDrawer>>(),target=ref<Date>(),period=ref<[Date,Date]>()
const form=reactive<PgRestoreDrill>({startedAt:'',status:'',validationResult:'',ownerName:'',notes:''})
const {getDictItems,loadDict}=useDict('pg_restore_drill_status','pg_restore_validation_result')
const drillRisk=computed(()=>{const latest=latestDrill.value;if(!latest)return '尚未登记恢复演练；WAL 归档正常不等于可恢复，建议尽快安排人工演练。';const started=new Date(latest.startedAt).getTime();if(Date.now()-started>90*86400000)return '最近一次恢复演练已超过 90 天，建议重新验证备份可恢复性。';if(latest.validationResult!=='passed')return '最近一次恢复演练尚未验证通过，请查看结果说明并安排复验。';return ''})
const rules:FormRules={status:[{required:true,message:'请选择演练状态',trigger:'change'}],validationResult:[{required:true,message:'请选择验证结果',trigger:'change'}],ownerName:[{required:true,message:'请填写负责人',trigger:'blur'}]}
const columns:TableColumn[]=[{prop:'startedAt',label:'开始时间',width:180},{prop:'backupId',label:'备份 ID',width:180},{prop:'targetTime',label:'恢复目标时间',width:180},{label:'演练状态',width:110,slot:'col-status'},{label:'恢复验证',width:120,slot:'col-validation'},{prop:'durationSeconds',label:'耗时（秒）',width:110},{prop:'ownerName',label:'负责人',width:120},{prop:'notes',label:'结果说明',minWidth:240}]
async function load(){if(!id.value)return;loading.value=true;try{const requests=[listPgRestoreDrills(id.value,pagination.pageNum,pagination.pageSize),...(pagination.pageNum===1?[]:[listPgRestoreDrills(id.value,1,1)])];const pages=await Promise.all(requests);drills.value=pages[0].list??[];total.value=pages[0].total??0;latestDrill.value=pagination.pageNum===1?drills.value[0]:pages[1]?.list?.[0]}finally{loading.value=false}}
function search(){pagination.pageNum=1;load()}
async function open(){await Promise.all([loadDict('pg_restore_drill_status'),loadDict('pg_restore_validation_result')]);Object.assign(form,{backupId:'',status:getDictItems('pg_restore_drill_status')[0]?.itemValue||'',validationResult:getDictItems('pg_restore_validation_result')[0]?.itemValue||'',ownerName:'',notes:''});target.value=undefined;period.value=[new Date(),new Date()];visible.value=true}
async function save(){if(!id.value||!period.value)return;try{await savePgRestoreDrill({...form,instanceId:id.value,targetTime:target.value?.toISOString(),startedAt:period.value[0].toISOString(),finishedAt:period.value[1].toISOString()});drawerRef.value?.stopSaving();pagination.pageNum=1;await load();ElMessage.success('恢复演练已登记，可在列表中追溯验证结果')}catch(e){drawerRef.value?.stopSaving(false);throw e}}
watch(id,()=>{pagination.pageNum=1;load()},{immediate:true})
</script>
<style scoped>.backup-page{padding-bottom:16px}.drill-section{margin:16px}.section-title{font-size:16px;font-weight:600}.section-tip{font-size:12px;color:var(--el-text-color-secondary);margin:5px 0 10px}.drill-risk{margin-bottom:10px}</style>