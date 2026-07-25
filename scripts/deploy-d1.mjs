import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const databaseName = process.env.CLOUDMARK_DATABASE_NAME?.trim() || "cloudmark";
const repositoryRoot = process.cwd();
const generatedConfigPath = resolve(repositoryRoot, "dist/cloudmark/wrangler.json");
const temporaryConfigPath = resolve(
  repositoryRoot,
  "dist/cloudmark",
  `.wrangler-cloudmark-${randomUUID()}.json`,
);

function runWrangler(args) {
  return execFileSync("wrangler", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: ["inherit", "pipe", "inherit"],
  });
}

function findDatabaseId() {
  const listOutput = runWrangler(["d1", "list", "--json"]);
  let databases;

  try {
    databases = JSON.parse(listOutput);
  } catch {
    throw new Error("无法解析 Wrangler 返回的 D1 数据库列表。");
  }

  const matches = databases.filter((database) => database.name === databaseName);
  if (matches.length > 1) {
    throw new Error(`Cloudflare 账户中存在多个名为 ${databaseName} 的 D1 数据库，已停止部署。`);
  }

  if (matches.length === 1) {
    return matches[0].uuid;
  }

  process.stdout.write(`未找到 D1 数据库 ${databaseName}，正在创建……\n`);
  const createOutput = runWrangler(["d1", "create", databaseName]);
  const databaseId = createOutput.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
  )?.[0];

  if (!databaseId) {
    throw new Error("D1 数据库已创建，但无法从 Wrangler 输出中解析数据库 ID。");
  }

  return databaseId;
}

function createTemporaryConfig(databaseId) {
  const config = JSON.parse(readFileSync(generatedConfigPath, "utf8"));
  const databaseBindings = config.d1_databases?.filter((database) => database.binding === "DB");

  if (databaseBindings?.length !== 1) {
    throw new Error("无法在构建生成的 Wrangler 配置中找到唯一的 DB D1 binding。");
  }

  databaseBindings[0].database_name = databaseName;
  databaseBindings[0].database_id = databaseId;
  writeFileSync(temporaryConfigPath, JSON.stringify(config, null, 2));
}

try {
  const databaseId = findDatabaseId();
  process.stdout.write(`使用 D1 数据库 ${databaseName}（${databaseId}）。\n`);
  try {
    readFileSync(generatedConfigPath, "utf8");
  } catch {
    throw new Error("未找到 Vite 生成的 Wrangler 配置，请先执行 pnpm build。");
  }
  createTemporaryConfig(databaseId);
  execFileSync(
    "wrangler",
    ["d1", "migrations", "apply", databaseName, "--remote", "--config", temporaryConfigPath],
    {
      cwd: repositoryRoot,
      stdio: "inherit",
    },
  );
  execFileSync("wrangler", ["deploy", "--config", temporaryConfigPath], {
    cwd: repositoryRoot,
    stdio: "inherit",
  });
} finally {
  rmSync(temporaryConfigPath, { force: true });
}
