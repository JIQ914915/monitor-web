# ProTable 使用说明

`ProTable` 是基于 Element Plus 的业务表格封装，内置：

- 搜索区（可折叠）
- 工具栏（新增/导入/导出/批量删除）
- 列显示设置
- 密度切换、全屏
- 操作列默认按钮（详情/编辑/删除）
- 分页联动

组件文件：`src/components/ProTable/index.vue`

---

## 1. 快速上手

```vue
<template>
  <ProTable
    :data="rows"
    :columns="columns"
    :loading="loading"
    :total="total"
    v-model:page-num="query.pageNum"
    v-model:page-size="query.pageSize"
    @search="load"
    @page-change="load"
    @edit="openEdit"
    @delete="handleDelete"
  />
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import ProTable from '@/components/ProTable/index.vue'
import type { TableColumn } from '@/components/ProTable/types'

const loading = ref(false)
const total = ref(0)
const rows = ref<any[]>([])
const query = reactive({ pageNum: 1, pageSize: 10 })

const columns: TableColumn[] = [
  { prop: 'name', label: '名称', minWidth: 160 },
  { prop: 'status', label: '状态', width: 100, align: 'center' },
  { prop: 'remark', label: '备注', minWidth: 200 }
]

function load() {}
function openEdit(row: any) {}
function handleDelete(row: any) {}
</script>
```

---

## 2. 常用配置

### 2.1 搜索区 + 工具栏

```vue
<ProTable
  :data="rows"
  :columns="columns"
  :loading="loading"
  :show-add="false"
  collapsible
  @search="load"
  @reset="resetQuery"
>
  <template #search>
    <el-form-item label="关键字">
      <el-input v-model="query.keyword" clearable />
    </el-form-item>
  </template>

  <template #toolbar>
    <el-button type="primary" @click="openCreate">新增</el-button>
  </template>
</ProTable>
```

### 2.2 自定义单元格与操作列

```vue
<ProTable
  :data="rows"
  :columns="columns"
  :show-operation="true"
>
  <template #col-status="{ row }">
    <el-tag :type="row.enabled ? 'success' : 'info'">
      {{ row.enabled ? '启用' : '禁用' }}
    </el-tag>
  </template>

  <template #operation="{ row, confirmDelete }">
    <el-button link type="primary" @click="openView(row)">详情</el-button>
    <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
    <el-button link type="danger" @click="confirmDelete(row)">删除</el-button>
  </template>
</ProTable>
```

> `columns` 中配置 `slot: 'col-status'` 后，可用 `#col-status` 渲染该列。

### 2.3 默认操作按钮行为

如果不写 `#operation` 插槽，`ProTable` 会按事件监听自动显示默认按钮：

- 绑定了 `@view` 才显示“详情”
- 绑定了 `@edit` 才显示“编辑”
- 绑定了 `@delete` 或配置了 `deleteRequest` 才显示“删除”

示例：

```vue
<ProTable
  :data="rows"
  :columns="columns"
  @view="openView"
  @edit="openEdit"
  @delete="handleDelete"
/>
```

---

## 3. 核心 Props（常用）

- `data`: 表格数据
- `columns`: 列定义（`TableColumn[]`）
- `loading`: 加载状态
- `showSelection`: 是否显示多选
- `showIndex`: 是否显示序号
- `showOperation`: 是否显示操作列
- `operationWidth`: 操作列宽度（默认 `160`，支持覆盖）
- `showPagination`: 是否分页
- `pageNum/pageSize`: 分页双向绑定
- `showToolbar`: 是否显示工具栏
- `deleteConfirmMsg`: 删除确认文案（支持函数）
- `deleteRequest`: 可选删除请求函数（配置后由组件统一处理“确认 + 调用 + 成功提示”）
- `deleteSuccessMsg`: 删除成功提示文案（`false` 表示不提示，支持函数）

---

## 4. 事件说明（常用）

- `search`：点击查询
- `reset`：点击重置
- `add` / `import` / `export`
- `edit(row)` / `view(row)` / `delete(row)`（未配置 `deleteRequest` 时）
- `batch-delete(rows)`
- `selection-change(rows)`
- `page-change`
- `update:pageNum` / `update:pageSize`

---

## 5. 列定义 `TableColumn`

```ts
interface TableColumn {
  prop?: string
  label: string
  width?: number | string
  minWidth?: number | string
  align?: 'left' | 'center' | 'right'
  headerAlign?: 'left' | 'center' | 'right'
  fixed?: boolean | 'left' | 'right'
  showOverflowTooltip?: boolean
  sortable?: boolean | string
  slot?: string
  formatter?: (row: any) => string | number
  hide?: boolean
}
```

---

## 6. 使用建议

- 复杂页面优先使用 `#operation`，可通过 `confirmDelete(row)` 复用组件二次确认。
- 需要“详情”时请显式绑定 `@view`，否则默认不会显示“详情”按钮。
- 删除操作建议优先使用 `deleteRequest`，统一确认和成功提示；不使用时可继续监听 `@delete`。
