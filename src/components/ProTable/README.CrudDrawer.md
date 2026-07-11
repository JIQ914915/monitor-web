# CrudDrawer 使用说明

`CrudDrawer` 是面向 CRUD 表单场景的弹层封装，支持：

- `drawer` / `dialog` 两种展示模式
- `create` / `edit` / `view` 三种业务模式
- 保存前校验、二次确认
- 重置确认
- 脏数据拦截关闭
- 暴露 `stopSaving()` 统一结束保存态

组件文件：`src/components/ProTable/CrudDrawer.vue`

---

## 1. 快速上手（最小案例）

```vue
<template>
  <CrudDrawer
    ref="drawerRef"
    v-model:visible="visible"
    mode="create"
    title="用户"
    :form-ref="formRef"
    :confirm-on-save="true"
    @save="handleSave"
    @reset="handleReset"
    @closed="handleClosed"
  >
    <template #default="{ readonly }">
      <el-form ref="formRef" :model="form" label-width="90px">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" :disabled="readonly" />
        </el-form-item>
      </el-form>
    </template>
  </CrudDrawer>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import type { FormInstance } from 'element-plus'
import CrudDrawer from '@/components/ProTable/CrudDrawer.vue'

const visible = ref(false)
const drawerRef = ref<InstanceType<typeof CrudDrawer>>()
const formRef = ref<FormInstance>()
const form = reactive({ username: '' })

async function handleSave() {
  try {
    // await apiSave(form)
    drawerRef.value?.stopSaving(true) // true: 保存成功后关闭
  } catch {
    drawerRef.value?.stopSaving(false) // false: 仅取消 loading，不关闭
  }
}

function handleReset() {
  form.username = ''
}

function handleClosed() {
  formRef.value?.clearValidate()
}
</script>
```

---

## 2. 常用场景

### 2.1 编辑模式 + 脏数据检测

```vue
<CrudDrawer
  v-model:visible="visible"
  mode="edit"
  title="数据库类型"
  :form-ref="formRef"
  :row="currentRow"
  :is-dirty="isDirty"
  @save="handleSave"
>
  <template #default="{ readonly }">
    <!-- 表单内容 -->
  </template>
</CrudDrawer>
```

```ts
function isDirty() {
  return JSON.stringify(form) !== JSON.stringify(snapshot.value)
}
```

### 2.2 查看模式（只读）

```vue
<CrudDrawer
  v-model:visible="visible"
  mode="view"
  title="实例"
  :row="currentRow"
>
  <template #default="{ readonly, row }">
    <el-form :model="row" label-width="90px">
      <el-form-item label="实例名">
        <el-input :model-value="row.name" :disabled="readonly" />
      </el-form-item>
    </el-form>
  </template>
</CrudDrawer>
```

> `mode="view"` 时不显示保存按钮，底部为“关闭”。

---

## 3. Props（常用）

- `visible`: 显隐（`v-model:visible`）
- `type`: `'drawer' | 'dialog'`，默认 `drawer`
- `mode`: `'create' | 'edit' | 'view'`
- `title`: 业务标题，自动拼接“新增/编辑/查看”
- `row`: 当前行数据
- `formRef`: `el-form` 实例，用于 `validate/clearValidate`
- `showReset`: 是否展示重置按钮
- `confirmOnSave`: 保存前确认（默认开启）
- `confirmOnReset`: 重置前确认
- `isDirty`: 关闭前脏数据检测函数

---

## 4. 事件

- `update:visible(v)`：更新显隐
- `save(mode, row)`：点击保存后触发（组件仅触发，不自动调接口）
- `reset`：点击重置触发（父组件自行重置表单值）
- `closed`：弹层完全关闭后触发

---

## 5. 暴露方法

- `stopSaving(close = true)`
  - 结束保存 loading
  - `close = true` 时同时关闭弹层

典型用法：

```ts
async function handleSave() {
  try {
    await saveApi(payload)
    drawerRef.value?.stopSaving(true)
  } catch {
    drawerRef.value?.stopSaving(false)
  }
}
```

---

## 6. 使用建议

- 统一在 `save` 回调里处理 API 与异常，并始终调用 `stopSaving()`。
- `reset` 事件只表示“用户意图重置”，真正重置逻辑放在父组件，便于按业务定制。
- 有复杂表单时建议传 `isDirty`，避免误关导致数据丢失。
