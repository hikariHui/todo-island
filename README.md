# Todo Island

个人 Todo List：Next.js + Animal-Island-UI，文件持久化，可选同步到 iCloud 日历。

## 技术栈

- Next.js 16（App Router）
- Node.js 22 + pnpm 12
- [Animal-Island-UI](https://github.com/guokaigdg/animal-island-ui)
- 本地 JSON 文件存储（无需数据库）
- 环境变量密码登录
- CalDAV（`tsdav`）同步 iCloud Calendar
- Docker / docker-compose 部署
- PWA（Serwist）：可安装到主屏幕，支持离线兜底页

## 快速开始

### 1. 环境要求

- Node.js 22.x
- pnpm 12.x（`packageManager` 已锁定为 `pnpm@12.7.0`）

安装 pnpm 12（npm 的 `latest` 仍是 11 线）：

```bash
pnpm self-update latest-12
# 或
curl -fsSL https://get.pnpm.io/install.sh | env PNPM_VERSION=12.7.0 sh -
```

### 2. 配置

```bash
cp .env.example .env
```

必填：

| 变量 | 说明 |
| --- | --- |
| `AUTH_PASSWORD` | 登录密码（生产勿用示例默认值） |
| `SESSION_SECRET` | Cookie 签名密钥；**生产必填**，至少 16 字符随机串，且不要与密码相同 |

可选（iCloud 日历）：

| 变量 | 说明 |
| --- | --- |
| `ICLOUD_APPLE_ID` | Apple ID 邮箱 |
| `ICLOUD_APP_PASSWORD` | [App 专用密码](https://appleid.apple.com)（不要用登录密码） |
| `ICLOUD_CALENDAR_NAME` | 目标日历显示名；不填则用第一个日历 |

### 3. 本地运行

```bash
pnpm install
pnpm dev
```

打开 http://localhost:3000 ，用 `AUTH_PASSWORD` 登录。

数据默认写在 `./data/todos.json`。

### 4. Docker 部署

```bash
cp .env.example .env
# 编辑 .env（务必改掉 AUTH_PASSWORD / SESSION_SECRET）后：
docker compose up -d --build
```

- 服务端口：仅监听本机 `127.0.0.1:${HOST_PORT:-8080}` → 容器 `3000`（供本机 nginx 反代）
  - 在 `.env` 里改 `HOST_PORT` 即可，例如 `HOST_PORT=9080`
- 数据目录：项目下的 `./data` 绑定挂载到容器 `/app/data`（`todos.json`、`icloud-queue.json` 都在这里）
- 生产请用 **nginx（或同类）终止 HTTPS** 再反代到上述本机端口，不要把容器端口直接对公网开放

## PWA

生产构建后可用 HTTPS（或 localhost）安装到主屏幕：

- Manifest：`/manifest.webmanifest`
- Service Worker：`/serwist/sw.js`（`@serwist/turbopack`）
- 离线兜底页：`/~offline`（**仅提示离线**，不能离线读写待办）
- 图标：`public/icons/`（由脚本从原图生成）

换图标时替换 `assets/brand/icon-source.jpg`，然后执行：

```bash
pnpm icons
```

会生成 `public/icons/*`、`public/favicon.ico`，以及一份 `assets/brand/icon-source.png` 母版。

开发时 Service Worker 也会注册；若改动不明显，可在浏览器里注销旧 SW 后硬刷新。

## iCloud 同步说明

1. 在 [Apple ID](https://appleid.apple.com) → 登录与安全 → App 专用密码，生成密码。
2. 填入 `ICLOUD_APPLE_ID` 与 `ICLOUD_APP_PASSWORD`。
3. 创建/编辑 Todo 时可选**日期**：
   - 不选 = 待定（不同步日历）
   - 只选日期 = **全天**事件同步到 iCloud
   - 展开「设定具体时间」= 定点事件（默认时长 1 小时，按 `APP_TIMEZONE` / `TZ` 墙钟时间，默认 `Asia/Shanghai`）
4. 保存后通过异步队列写入 iCloud（不阻塞本地操作）：
   - 新建 / 编辑（含清空日期）→ 入队 upsert（同待办去重合并；清空日期时由同步逻辑删除远端事件）
   - 删除待办 → 入队 delete（并取消未执行的 upsert）
   - 队列持久化在 `data/icloud-queue.json`：任务先 **lease** 再执行（崩溃可回收），失败指数退避重试；耗尽后写入死信并在 UI 显示「同步失败」可手动重试
5. 日历事件会标明由本应用管理：
   - 分类 `Todo Island`
   - 描述末尾注明「由 Todo Island 管理」
   - 自定义字段 `X-TODO-ISLAND-MANAGED` / `X-TODO-ISLAND-ID`
   - `SEQUENCE` 随每次成功更新递增

未配置 iCloud 时，应用仍可正常使用，只是不会同步日历。

## 已完成事项清理

服务启动后会定时清理**本地**已完成事项：

- 条件：`completed === true` 且 `completedAt`（缺失则用 `updatedAt`）早于保留期
- 默认保留 **30 天**，每 **24 小时**跑一次（启动时先跑一轮）
- **只删本地 JSON，不入队 iCloud delete**（日历里旧事件会保留）
- 同时丢弃这些待办在 `icloud-queue.json` 里尚未执行的任务，避免误删日历

环境变量：

```env
CLEANUP_COMPLETED_DAYS=30
CLEANUP_INTERVAL_HOURS=24
```

## 目录结构

```
src/
  app/                 # 页面与 API（含 /tags 标签管理）
  components/          # 登录 / Todo / 标签管理 UI
  instrumentation.ts   # 启动定时清理 + iCloud 队列
  lib/
    auth.ts            # 密码登录 + Cookie
    store.ts           # JSON 文件读写（todos + 标签库）
    cleanup.ts         # 已完成事项本地清理
    icloud.ts          # CalDAV 同步
    icloud-queue.ts    # iCloud 异步队列
    tags.ts            # 标签规范化
    types.ts
data/todos.json        # 持久化数据（gitignore）
Dockerfile
docker-compose.yml
```

## 安全提示

这是单用户自用方案：密码存在环境变量，没有多用户体系。

- 请勿把 `.env` 提交到仓库。
- 生产必须设置强随机 `SESSION_SECRET`（启动时会校验）；本地开发未设置时才会回退。
- **修改 `AUTH_PASSWORD` 时请同步更换 `SESSION_SECRET`**，否则旧会话 Cookie 在过期前仍有效（无服务端会话表，靠换密钥使旧签名失效）。
- 会话默认 30 天，**滑动续期**：打开应用会调用 `/api/auth/refresh`；剩余不足 15 天时 proxy 也会自动续期。只要在过期前还在用，就不用每月重新登录；连续超过 30 天不用仍需登录。
- 登录接口有简易按 IP 限流（15 分钟内约 10 次）；仍建议只通过本机 nginx + HTTPS 对外。
- Compose 默认只绑 `127.0.0.1`，由 nginx 反代；勿把应用端口直接暴露公网。
