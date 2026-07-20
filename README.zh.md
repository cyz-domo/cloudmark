# Cloudmark

[![AGPL LICENSE](https://img.shields.io/badge/LICENSE-AGPL-blue.svg)](https://www.gnu.org/licenses/agpl-3.0.html)
[![在线试用](https://img.shields.io/badge/TryIt-Online-orange.svg)](https://cloudmark.yxra3603.workers.dev/)

[English](README.md)

## 简介

Cloudmark 是一款通用的云端书签管理工具，无需注册登录。创建集合 ID（`mark`）和密钥 **write token**，安装 bookmarklet 即可一键收藏网页。

在线试用：[https://cloudmark.yxra3603.workers.dev/](https://cloudmark.yxra3603.workers.dev/)

## 主要功能

- 🔑 **无需注册**：通过 `mark` 访问集合；写入需要 write token
- 🔖 **一键收藏**：Bookmarklet 内嵌 mark + write token
- 🏷️ **分类管理**：自定义分类整理书签
- 🌐 **跨设备访问**：任意设备可读；写入需在该设备配置 token
- 📝 **详细描述**：可为书签添加备注
- 🌍 **多语言**：中文 / 英文
- ✨ **现代界面**：响应式设计
- 🗄️ **Cloudflare D1**：关系型存储，支持从旧版 KV 自动迁移

## 安全模型

| 能力 | 条件 |
|------|------|
| 查看集合 | 知道 `mark`（URL） |
| 添加 / 编辑 / 删除 | 有效的 **write token** |
| Bookmarklet 保存 | `mark` + `token` 查询参数 |

- Write token 在 D1 中仅存 SHA-256 哈希；明文只存在浏览器 `localStorage` 与 bookmarklet 中。
- KV → D1 迁移后会一次性签发 write token，页面横幅展示新 token 与新 bookmarklet，可关闭。
- 带有速率限制与字段长度限制。

## 快速开始

1. 访问 [https://cloudmark.yxra3603.workers.dev/doc](https://cloudmark.yxra3603.workers.dev/doc)
2. 生成 `mark` 与 write token
3. 将 bookmarklet 拖到浏览器书签栏
4. 浏览时点击 bookmarklet 保存页面
5. 打开 `https://cloudmark.yxra3603.workers.dev/你的-mark` 管理书签

### 从旧版（KV）迁移

1. 打开原有集合 URL（`/你的-mark`）
2. 数据自动迁移到 D1
3. 横幅显示 **新 write token** 与 **新 bookmarklet**
4. 复制 token、重装 bookmarklet，然后关闭横幅
5. 其他设备在提示时粘贴同一 token

## 本地开发

### 环境要求

- Node.js 20+ 与 pnpm
- Cloudflare 账号（预览与部署）

### 安装依赖

```bash
pnpm install
```

### D1 配置

```bash
pnpm exec wrangler d1 create cloudmark
# 将 database_id 写入 wrangler.jsonc
pnpm db:migrate:local    # 本地
pnpm db:migrate:remote   # 生产
```

旧版 KV binding 可保留用于自动迁移，全部迁移完成后可移除。

### 开发模式

```bash
pnpm dev
```

### 预览 / 部署

```bash
pnpm db:migrate:local && pnpm preview
pnpm db:migrate:remote && pnpm deploy
```

## 技术栈

- Next.js、Cloudflare Workers（OpenNext）
- Cloudflare D1（主存储）/ KV（迁移源）
- Tailwind CSS、Next-Intl

## 许可证

[AGPL-3.0](https://www.gnu.org/licenses/agpl-3.0.html)

## 贡献

欢迎 Issue 与 PR！
