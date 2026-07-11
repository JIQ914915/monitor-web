<template>
  <div class="not-found">
    <h1>404</h1>
    <p>页面不存在</p>
    <el-button type="primary" @click="$router.push('/')">返回首页</el-button>
  </div>
</template>

<script setup lang="ts"></script>

<style scoped>
.not-found {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
}
.not-found h1 {
  font-family: var(--font-display);
  font-size: 72px;
  color: var(--signal);
  margin: 0;
}
.not-found p {
  color: var(--muted);
  margin: 0 0 8px;
}
</style>
