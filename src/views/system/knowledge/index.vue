<template>
  <el-card shadow="never" class="kb-card">
    <div class="toolbar">
      <el-input
        v-model="keyword"
        placeholder="搜索标题 / 正文 / 标签"
        clearable
        style="width: 320px"
        @input="onFilterChange"
        @clear="onFilterChange"
      >
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
      <div class="spacer" />
      <el-button v-permission="'knowledge:create'" type="primary" :icon="Plus" @click="openCreate">新增文章</el-button>
    </div>

    <div class="kb-body" v-loading="loading">
      <!-- 左侧分类导航（独立滚动） -->
      <div class="kb-cat">
        <el-scrollbar>
          <div
            class="kb-cat-item"
            :class="{ active: selectedCategory === 'all' }"
            @click="selectCategory('all')"
          >
            <span>全部文章</span>
            <el-tag size="small" round>{{ articles.length }}</el-tag>
          </div>
          <div
            v-for="cat in categoriesWithCount"
            :key="cat.id"
            class="kb-cat-item"
            :class="{ active: selectedCategory === cat.id }"
            @click="selectCategory(cat.id)"
          >
            <span>{{ cat.name }}</span>
            <el-tag size="small" round type="info">{{ cat.count }}</el-tag>
          </div>
        </el-scrollbar>
      </div>

      <!-- 右侧文章列表（独立滚动 + 固定底部分页） -->
      <div class="kb-list">
        <el-empty v-if="filtered.length === 0" description="暂无文章" />
        <template v-else>
          <el-scrollbar class="kb-list-scroll">
            <div v-for="a in paged" :key="a.id" class="kb-article" @click="openDetail(a)">
              <div class="kb-article-head">
                <h3 class="kb-article-title">{{ a.title }}</h3>
                <el-tag size="small">{{ categoryName(a.category) }}</el-tag>
              </div>
              <div class="kb-article-meta">
                <span><el-icon><User /></el-icon> {{ a.author || '-' }}</span>
                <span><el-icon><View /></el-icon> {{ a.views ?? 0 }} 次浏览</span>
                <span><el-icon><Star /></el-icon> {{ a.likes ?? 0 }} 点赞</span>
                <span><el-icon><Clock /></el-icon> {{ a.updateTime || a.createTime }}</span>
              </div>
              <div v-if="a.tags?.length" class="kb-article-tags">
                <el-tag v-for="t in a.tags" :key="t" size="small" type="info" effect="plain">{{ t }}</el-tag>
              </div>
            </div>
          </el-scrollbar>
          <Pagination
            v-model:page-num="pageNum"
            v-model:page-size="pageSize"
            :total="filtered.length"
            :page-sizes="[5, 10, 20, 50]"
          />
        </template>
      </div>
    </div>

    <!-- 文章详情抽屉 -->
    <el-drawer v-model="detailVisible" :title="detail?.title || '文章详情'" direction="rtl" size="820px">
      <div v-if="detail" class="kb-detail">
        <div class="kb-detail-info">
          <el-tag>{{ categoryName(detail.category) }}</el-tag>
          <span class="info-item"><el-icon><User /></el-icon> {{ detail.author || '-' }}</span>
          <span class="info-item"><el-icon><View /></el-icon> {{ detail.views ?? 0 }}</span>
          <span class="info-item"><el-icon><Star /></el-icon> {{ detail.likes ?? 0 }}</span>
          <span class="info-item"><el-icon><Clock /></el-icon> 更新于 {{ detail.updateTime || detail.createTime }}</span>
        </div>
        <el-divider />
        <div class="kb-content" v-html="detail.content || '<p>（暂无正文）</p>'"></div>
        <el-divider />
        <div class="kb-detail-tags">
          <span style="color: var(--muted)">标签：</span>
          <el-tag v-for="t in detail.tags || []" :key="t" style="margin-right: 8px">{{ t }}</el-tag>
          <span v-if="!(detail.tags || []).length" style="color: var(--muted)">无</span>
        </div>
      </div>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
        <el-button :icon="Star" @click="like">点赞</el-button>
        <el-button v-permission="'knowledge:update'" type="primary" :icon="Edit" @click="openEdit(detail!)">编辑</el-button>
        <el-button v-permission="'knowledge:delete'" type="danger" plain :icon="Delete" @click="remove(detail!)">删除</el-button>
      </template>
    </el-drawer>

    <!-- 新增 / 编辑抽屉（富文本正文） -->
    <el-drawer v-model="editVisible" :title="form.id ? '编辑文章' : '新增文章'" direction="rtl" size="960px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="64px">
        <el-form-item label="标题" prop="title">
          <el-input v-model="form.title" placeholder="请输入文章标题" maxlength="120" show-word-limit />
        </el-form-item>
        <el-form-item label="分类" prop="category">
          <el-select v-model="form.category" placeholder="请选择分类" style="width: 260px">
            <el-option v-for="c in CATEGORIES" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="标签">
          <el-select
            v-model="form.tags"
            multiple
            filterable
            allow-create
            default-first-option
            placeholder="选择或输入标签后回车"
            style="width: 100%"
          >
            <el-option v-for="t in COMMON_TAGS" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item label="正文" prop="content">
          <RichTextEditor v-model="form.content" height="420px" placeholder="请输入正文，支持标题/加粗/列表/表格/代码块/链接等" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submit">保存</el-button>
      </template>
    </el-drawer>
  </el-card>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Search, Plus, Edit, Delete, Star, View, User, Clock } from '@element-plus/icons-vue'
import Pagination from '@/components/Pagination.vue'
import RichTextEditor from '@/components/RichTextEditor.vue'
import {
  listArticles,
  getArticle,
  createArticle,
  updateArticle,
  deleteArticle,
  likeArticle
} from '@/api/knowledge'
import type { KnowledgeArticle } from '@/types'

const CATEGORIES = [
  { id: 'fault', name: '故障诊断' },
  { id: 'performance', name: '性能优化' },
  { id: 'practice', name: '最佳实践' },
  { id: 'mysql', name: 'MySQL' },
  { id: 'postgresql', name: 'PostgreSQL' },
  { id: 'sqlserver', name: 'SQL Server' },
  { id: 'backup', name: '备份恢复' }
]
const COMMON_TAGS = ['MySQL', 'PostgreSQL', 'SQL Server', 'Oracle', '性能优化', '故障诊断', '索引', '复制', '备份恢复', '高可用', '运维']

function categoryName(id?: string) {
  return CATEGORIES.find((c) => c.id === id)?.name || id || '-'
}

const route = useRoute()
const loading = ref(false)
const articles = ref<KnowledgeArticle[]>([])
const keyword = ref('')
const selectedCategory = ref('all')
const pageNum = ref(1)
const pageSize = ref(10)

async function load() {
  loading.value = true
  try {
    articles.value = await listArticles()
  } finally {
    loading.value = false
  }
}

const categoriesWithCount = computed(() =>
  CATEGORIES.map((c) => ({ ...c, count: articles.value.filter((a) => a.category === c.id).length }))
)

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return articles.value.filter((a) => {
    if (selectedCategory.value !== 'all' && a.category !== selectedCategory.value) return false
    if (!kw) return true
    const hay = `${a.title} ${(a.tags || []).join(' ')} ${stripHtml(a.content)}`.toLowerCase()
    return hay.includes(kw)
  })
})

const paged = computed(() => {
  const start = (pageNum.value - 1) * pageSize.value
  return filtered.value.slice(start, start + pageSize.value)
})

function stripHtml(html?: string) {
  return (html || '').replace(/<[^>]+>/g, ' ')
}

function onFilterChange() {
  pageNum.value = 1
}
function selectCategory(id: string) {
  selectedCategory.value = id
  pageNum.value = 1
}

// ===== 详情 =====
const detailVisible = ref(false)
const detail = ref<KnowledgeArticle | null>(null)

async function openDetail(a: KnowledgeArticle) {
  detail.value = a
  detailVisible.value = true
  if (a.id != null) {
    try {
      const fresh = await getArticle(a.id)
      detail.value = fresh
      const idx = articles.value.findIndex((x) => x.id === a.id)
      if (idx >= 0) articles.value[idx] = fresh
    } catch {
      // 忽略：详情读取失败时仍展示列表已有数据
    }
  }
}

async function like() {
  if (!detail.value?.id) return
  await likeArticle(detail.value.id)
  detail.value.likes = (detail.value.likes ?? 0) + 1
  const idx = articles.value.findIndex((x) => x.id === detail.value!.id)
  if (idx >= 0) articles.value[idx].likes = detail.value.likes
  ElMessage.success('已点赞')
}

// ===== 新增 / 编辑 =====
const editVisible = ref(false)
const saving = ref(false)
const formRef = ref<FormInstance>()
const form = reactive<KnowledgeArticle>(emptyForm())

function emptyForm(): KnowledgeArticle {
  return { id: undefined, title: '', category: '', tags: [], content: '' }
}

const rules: FormRules<KnowledgeArticle> = {
  title: [{ required: true, message: '请输入标题', trigger: 'blur' }],
  category: [{ required: true, message: '请选择分类', trigger: 'change' }],
  content: [
    {
      validator: (_r, _v, cb) => (stripHtml(form.content).trim() ? cb() : cb(new Error('请输入正文'))),
      trigger: 'blur'
    }
  ]
}

function openCreate() {
  Object.assign(form, emptyForm())
  editVisible.value = true
}

function openEdit(a: KnowledgeArticle) {
  Object.assign(form, { ...emptyForm(), ...a, tags: [...(a.tags || [])] })
  detailVisible.value = false
  editVisible.value = true
}

async function submit() {
  await formRef.value?.validate()
  saving.value = true
  try {
    if (form.id) await updateArticle({ ...form })
    else await createArticle({ ...form })
    ElMessage.success('保存成功')
    editVisible.value = false
    await load()
  } finally {
    saving.value = false
  }
}

async function remove(a: KnowledgeArticle) {
  await ElMessageBox.confirm(`确认删除文章「${a.title}」？`, '删除确认', { type: 'warning' })
  await deleteArticle(a.id!)
  ElMessage.success('删除成功')
  detailVisible.value = false
  await load()
}

onMounted(async () => {
  await load()
  // 支持外部跳转直达文章（场景管理/告警事件详情携带 articleId）
  const articleId = Number(route.query.articleId)
  if (articleId) {
    const target = articles.value.find(a => a.id === articleId)
    if (target) openDetail(target)
  }
})
</script>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}
.spacer {
  flex: 1;
}
.kb-body {
  display: flex;
  gap: 16px;
  height: calc(100vh - 220px);
  min-height: 420px;
}
.kb-cat {
  width: 220px;
  flex-shrink: 0;
  border: 1px solid var(--el-border-color-lighter, #ebeef5);
  border-radius: var(--radius-base);
  padding: 8px;
  overflow: hidden;
}
.kb-cat-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  color: var(--ink);
  transition: background 0.15s;
}
.kb-cat-item:hover {
  background: var(--el-fill-color-light, #f5f7fa);
}
.kb-cat-item.active {
  background: var(--el-color-primary-light-9, #ecf5ff);
  color: var(--el-color-primary, #409eff);
  font-weight: 600;
}
.kb-list {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--el-border-color-lighter, #ebeef5);
  border-radius: var(--radius-base);
  padding: 8px 12px;
}
.kb-list-scroll {
  flex: 1;
}
.kb-article {
  padding: 14px 8px;
  border-bottom: 1px solid var(--el-border-color-lighter, #ebeef5);
  cursor: pointer;
  transition: background 0.15s;
}
.kb-article:hover {
  background: var(--el-fill-color-light, #f5f7fa);
}
.kb-article-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.kb-article-title {
  margin: 0;
  font-size: 15px;
  color: var(--ink);
}
.kb-article-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  color: var(--muted);
  font-size: 13px;
  margin-bottom: 8px;
}
.kb-article-meta span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.kb-article-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.kb-detail-info {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  color: var(--muted);
  font-size: 13px;
}
.kb-detail-info .info-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.kb-content {
  line-height: 1.7;
  color: var(--ink);
  word-break: break-word;
}
.kb-content :deep(h2) {
  font-size: 18px;
  margin: 16px 0 8px;
}
.kb-content :deep(h3) {
  font-size: 16px;
  margin: 14px 0 6px;
}
.kb-content :deep(pre) {
  background: var(--el-fill-color-light, #f5f7fa);
  padding: 12px;
  border-radius: var(--radius-sm);
  overflow-x: auto;
}
.kb-content :deep(code) {
  font-family: var(--font-mono, monospace);
}
.kb-content :deep(table) {
  border-collapse: collapse;
  width: 100%;
}
.kb-content :deep(td),
.kb-content :deep(th) {
  border: 1px solid var(--el-border-color, #dcdfe6);
  padding: 6px 10px;
}
</style>
