import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const databaseName = "cloudmark";
const repositoryRoot = process.cwd();
const baseConfigPath = resolve(repositoryRoot, "wrangler.jsonc");
const temporaryConfigPath = resolve(repositoryRoot, `.wrangler-cloudmark-${randomUUID()}.jsonc`);

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
  const config = readFileSync(baseConfigPath, "utf8");
  const databaseBinding =
    /(\"binding\"\s*:\s*\"DB\"\s*,\s*\n\s*\"database_name\"\s*:\s*\"cloudmark\"\s*,)/;

  if (!databaseBinding.test(config)) {
    throw new Error("无法在 wrangler.jsonc 中找到 DB/cloudmark D1 binding。");
  }

  if (/\"database_id\"\s*:/.test(config)) {
    throw new Error("wrangler.jsonc 不应包含固定的 database_id。");
  }

  const temporaryConfig = config.replace(
    databaseBinding,
    `$1\n      "database_id": "${databaseId}",`,
  );
  writeFileSync(temporaryConfigPath, temporaryConfig);
}

try {
  const databaseId = findDatabaseId();
  process.stdout.write(`使用 D1 数据库 ${databaseName}（${databaseId}）。\n`);
  createTemporaryConfig(databaseId);
  execFileSync("wrangler", ["deploy", "--config", temporaryConfigPath], {
    cwd: repositoryRoot,
    stdio: "inherit",
  });
} finally {
  rmSync(temporaryConfigPath, { force: true });
}
