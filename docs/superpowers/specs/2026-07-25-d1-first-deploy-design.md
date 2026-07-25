# D1 首次部署解析设计

## 目标

让 `pnpm deploy` 在部署时解析 Cloudflare 账户中指定名称的 D1 数据库。仓库中的 `wrangler.jsonc` 不保存固定的 `database_id`。

数据库名称通过 `CLOUDMARK_DATABASE_NAME` 环境变量指定，未设置时默认为 `cloudmark`。

## 行为

1. 部署入口先执行现有的应用构建。
2. Wrangler 查询当前认证的 Cloudflare 账户中的 D1 数据库列表。
3. 如果存在指定名称的数据库，直接复用其 ID。
4. 如果不存在同名数据库，创建一个指定名称的数据库，并使用返回的 ID。
5. 部署脚本基于 `wrangler.jsonc` 创建临时配置，把解析出的 ID 注入 `DB` D1 binding。
6. 使用同一份临时配置对目标远程 D1 执行未应用的 migrations。
7. Wrangler 使用临时配置部署；脚本退出时删除临时配置。被 Git 跟踪的 `wrangler.jsonc` 始终不变且不包含固定 ID。

## 安全与失败处理

- 任一命令失败时立即停止，并清理临时配置。
- 如果账户中返回多个同名数据库，部署失败，不做任意选择。
- 如果当前 Wrangler 认证账户不可用，保留并透传 Wrangler 的错误。
- 保持现有迁移目录、binding 名称和其他 Worker 配置不变。
- 迁移失败时不继续部署 Worker，避免运行时访问不存在的表。

## 范围

- 更新部署命令并新增一个本地部署辅助脚本，负责 D1 解析、迁移和部署。
- 从 `wrangler.jsonc` 删除已提交的 D1 `database_id`。
- 不修改运行时代码或数据库迁移文件。

## 验证

- 验证带注释的 Wrangler 配置仍可被 Wrangler 解析。
- 运行仓库中可用的类型检查或静态检查。
- 确认仓库配置不包含已提交的 `database_id`，且脚本只将解析出的 ID 写入临时部署配置。
