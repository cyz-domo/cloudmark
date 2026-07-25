# Cloudmark

[![AGPL LICENSE](https://img.shields.io/badge/LICENSE-AGPL-blue.svg)](https://www.gnu.org/licenses/agpl-3.0.html)
[![在线试用](https://img.shields.io/badge/TryIt-Online-orange.svg)](https://cloudmark.site/)
[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/wesleyel/cloudmark)

[English](README.md)

## 简介

Cloudmark 是一款通用的云端书签管理工具，无需注册登录。创建集合 ID（`mark`）和密钥 **write token**，安装 bookmarklet 即可一键收藏网页。

在线试用：[https://cloudmark.site/](https://cloudmark.site/)

## 主要功能

- 🔑 **无需注册**：通过 `mark` 访问集合；写入需要 write token
- 🔖 **一键收藏**：Bookmarklet 内嵌 mark + write token
- 🏷️ **分类管理**：自定义分类整理书签
- ⌨️ **键盘优先**：`/` 搜索、`j/k` 导航、`n/e/d` 增删改、`?` 帮助
- 📋 **高信息密度**：紧凑列表 + 即时筛选 / 排序
- 🎨 **自定义图标**：表情、字母徽标，或上传 SVG/ICO/PNG
- 🌐 **跨设备访问**：任意设备可读；写入需在该设备配置 token
- 🌍 **多语言**：中文 / 英文
- 🗄️ **Cloudflare D1**：边缘关系型存储

## 安全模型

| 能力 | 条件 |
|------|------|
| 查看集合 | 知道 `mark`（URL） |
| 添加 / 编辑 / 删除 | 有效的 **write token** |
| Bookmarklet 保存 | `mark` + `token` 查询参数 |

- Write token 在 D1 中仅存 SHA-256 哈希；明文只存在浏览器 `localStorage` 与 bookmarklet 中。
- 带有速率限制与字段长度限制。

## 快速开始

1. 访问 [https://cloudmark.site/doc](https://cloudmark.site/doc)
2. 生成 `mark` 与 write token
3. 将 bookmarklet 拖到浏览器书签栏
4. 浏览时点击 bookmarklet 保存页面
5. 打开 `https://cloudmark.site/你的-mark` 管理书签

## 本地开发

### 环境要求

- Node.js 20+ 与 pnpm
- Cloudflare 账号（预览与部署）

### 安装依赖

```bash
pnpm install
```

### D1 配置

1. 先创建 D1 数据库，数据库名称使用你希望的名称：

```bash
pnpm exec wrangler d1 create cloudmark
```

2. 复制命令返回的数据库 ID，修改仓库中的 `wrangler.jsonc`：

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "cloudmark",
    "database_id": "上一步返回的数据库 ID",
    "migrations_dir": "migrations"
  }
]
```

如果创建时使用了其他数据库名称，需要同时修改 `database_name` 和 `database_id`，确保它们属于同一个数据库。

3. 将迁移应用到配置的数据库：

```bash
pnpm db:migrate:remote
```

### 开发模式

```bash
pnpm dev
```

### 预览 / 部署

一键部署（从本仓库创建 Cloudflare Worker）：

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/wesleyel/cloudmark)

或在本机：

```bash
pnpm db:migrate:local && pnpm preview
pnpm run deploy
```

如果通过 Git 连接 Cloudflare 部署，请先完成上面的 D1 配置，并提交已修改的 `wrangler.jsonc`，然后在 Cloudflare 项目中设置：

- 构建命令：`pnpm run cf:build`
- 部署命令：`npx wrangler deploy`

Cloudflare 构建命令会先构建项目，再将未执行的远程 migrations 应用到 `DB` binding 配置的数据库；随后部署命令使用同一份 `wrangler.jsonc` 发布 Worker。

## 技术栈

- **TypeScript 7** · **React 19** · **Vite** · **Hono**
- Cloudflare Workers（`@cloudflare/vite-plugin`）
- Cloudflare D1
- Tailwind CSS · shadcn/ui

## 许可证

[AGPL-3.0](https://www.gnu.org/licenses/agpl-3.0.html)

## 贡献

欢迎 Issue 与 PR！
