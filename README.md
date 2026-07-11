# monitor-web

数据库监控产品前端工程脚手架

## 技术栈

- 运行时：Node.js 20.19+（开发使用 24.x）
- 框架/UI：Vue 3 + Element Plus
- 构建：Vite 8
- 状态：Pinia（持久化）
- 路由：Vue Router
- HTTP：Axios（统一封装：JWT 注入 / 401 处理 / 业务码解包）

## 目录结构

```
src/
├── main.ts                 # 入口：app + Pinia + Router + ElementPlus + 主题应用
├── api/                    # request.ts(Axios 封装) + mock.ts(本地 mock) + 业务接口
├── router/                 # 静态路由 + 守卫(鉴权/标题)
├── stores/                 # user(多角色并集) / instance(当前实例) / app / theme
├── directives/             # v-permission 按钮级权限(menu:action)
├── components/             # HealthGauge、SparkLine
├── layout/                 # Navbar + Sidebar + SettingsDrawer(主题设置抽屉)
├── views/                  # login / dashboard / instance / error
└── assets/theme/           # 控制室主题 token + 暗色 + 色盲预设
```

## 开发

```bash
pnpm install
pnpm dev          # http://localhost:5173
```

默认 `.env.development` 中 `VITE_USE_MOCK=true`，无需后端即可跑通登录→总览→实例列表。
联调真实 `monitor-admin` 时，将 `VITE_USE_MOCK` 设为 `false`，`VITE_API_BASE=/api`（网关前缀），各接口在 `src/api/*.ts` 中写带版本的相对路径（如 `/v1/metrics/...`），Vite 将 `/api` 反代到后端。

## 主题

- 可配：明暗模式、主题主色、布局形态、密度、圆角、字号、多标签页。
- 锁定：严重度语义色 `--sev-*` 仅提供「默认 / 色盲友好」整体切换，不开放逐色自由改。
- 实现：CSS 变量运行时换肤（`stores/theme`）+ localStorage 持久化。

## 构建

```bash
pnpm build        # vue-tsc 类型检查 + vite 构建
pnpm preview
```
