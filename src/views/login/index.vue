<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-brand">
        <el-icon class="login-logo"><DataLine /></el-icon>
        <h1>数据库监控平台</h1>
        <p>Database Monitoring Platform</p>
      </div>

      <el-form ref="formRef" :model="form" :rules="rules" @submit.prevent>
        <el-form-item prop="username">
          <el-input v-model="form.username" size="large" placeholder="用户名" :prefix-icon="User" clearable />
        </el-form-item>
        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            type="password"
            size="large"
            placeholder="密码"
            :prefix-icon="Lock"
            show-password
            @keyup.enter="onSubmit"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" size="large" class="login-btn" :loading="loading" @click="onSubmit">
            登 录
          </el-button>
        </el-form-item>
      </el-form>
    </div>

    <div class="login-footer">© 2026 数据库监控平台 · Control Room</div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { DataLine, User, Lock } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const formRef = ref<FormInstance>()
const loading = ref(false)
const form = reactive({ username: 'admin', password: '123456' })

const rules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

async function onSubmit() {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    loading.value = true
    try {
      await userStore.login(form.username, form.password)
      await userStore.loadInfo()
      const redirect = (route.query.redirect as string) || '/'
      // 等待导航真正完成（守卫会在此期间注册动态路由）再提示，避免"提示成功但未跳转"
      await router.replace(redirect)
      ElMessage.success('登录成功')
    } finally {
      loading.value = false
    }
  })
}
</script>

<style scoped>
.login-page {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background:
    radial-gradient(1100px 560px at 82% -12%, rgba(12, 124, 151, 0.4), transparent 60%),
    radial-gradient(820px 460px at -8% 112%, rgba(45, 127, 240, 0.2), transparent 58%),
    linear-gradient(155deg, #081320 0%, #0e1a2b 48%, #122740 100%);
}

/* 控制室网格底纹（带径向遮罩聚焦中部） */
.login-page::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(124, 214, 209, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(124, 214, 209, 0.06) 1px, transparent 1px);
  background-size: 34px 34px;
  mask-image: radial-gradient(1000px 700px at 50% 30%, #000 40%, transparent 85%);
  pointer-events: none;
}

.login-card {
  position: relative;
  width: 400px;
  padding: 40px 36px 30px;
  background: rgba(255, 255, 255, 0.98);
  border-radius: var(--radius-lg);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(6px);
  animation: loginCardIn 0.45s cubic-bezier(0.22, 1, 0.36, 1);
}
@keyframes loginCardIn {
  from {
    opacity: 0;
    transform: translateY(18px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.login-brand {
  text-align: center;
  margin-bottom: 28px;
}
.login-logo {
  width: 72px;
  height: 72px;
  font-size: 40px;
  color: #fff;
  border-radius: var(--radius-lg);
  background: linear-gradient(135deg, var(--signal) 0%, var(--signal-strong) 100%);
  box-shadow: 0 10px 24px rgba(12, 124, 151, 0.5);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.login-brand h1 {
  font-family: var(--font-display);
  font-size: 23px;
  font-weight: 600;
  letter-spacing: 1px;
  margin: 16px 0 6px;
  color: var(--ink);
}
.login-brand p {
  margin: 0;
  font-size: 12px;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: var(--muted);
}

.login-card :deep(.el-form-item) {
  margin-bottom: 22px;
}
.login-card :deep(.el-input__wrapper) {
  border-radius: var(--radius-lg);
  padding: 4px 14px;
  box-shadow: 0 0 0 1px var(--line) inset;
}
.login-card :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px var(--signal) inset;
}

.login-btn {
  width: 100%;
  height: 44px;
  font-size: 15px;
  letter-spacing: 6px;
  border: none;
  border-radius: var(--radius-lg);
  background: linear-gradient(135deg, var(--signal) 0%, var(--signal-strong) 100%);
  box-shadow: 0 8px 18px rgba(12, 124, 151, 0.42);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.login-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 22px rgba(12, 124, 151, 0.52);
}

.login-footer {
  position: relative;
  margin-top: 24px;
  font-size: 12px;
  letter-spacing: 0.5px;
  color: rgba(255, 255, 255, 0.78);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}
</style>
