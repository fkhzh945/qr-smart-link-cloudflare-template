# 一键部署验收与使用指引（V0.2 RC）

## 当前验证状态

2026-10-16：已收到用户确认：使用 GitHub 仓库直接导入、Build `npm run build`、Deploy `npm run deploy`，**云端部署成功**。本记录只代表部署成功的用户反馈；管理员初始化、二维码扫描跳转和跨账户复用尚未逐项验收。

## 首次安装（无需本地 Node.js）

1. 在 Cloudflare Workers & Pages 中通过 GitHub 仓库列表导入 `fkhzh945/qr-smart-link-cloudflare-template`，生产分支 `main`，项目根目录为仓库根目录。
2. Build command：`npm run build`；**Deploy command：`npm run deploy`**。Cloudflare 有时默认显示 `npx wrangler deploy`；务必手动核对并替换，否则不会执行自动建库和 D1 迁移。
3. Deploy 会先查询或创建 `qr-smart-link-lite-template-db`，写入本次构建的真实 D1 ID、执行迁移，然后上传 Worker；所用 Cloudflare 构建凭据必须拥有 D1 读写/创建权限。
4. 在 Worker 设置中用 **Secret** 类型设置 `SETUP_TOKEN`（至少 16 字符）、`SESSION_SECRET`（至少 32 字符）、`ACTIVATION_SECRET`（至少 32 字符）。三个密钥都应由密码学安全随机源生成并且互不相同。**请勿在聊天、工单、Git 或截图中暴露实际值**。
5. 打开本次部署的 `https://<your-worker>.<your-subdomain>.workers.dev/#/admin`，输入 Setup Token、管理员邮箱和新密码完成单管理员初始化。新密码至少 12 字符；成功后可以在后台修改密码（需要验证原密码）。
6. 验证创建测试批次、导出二维码文件、扫描二维码、自助激活与配置跳转。全部完成后才可作为客户正式上线验收。

## 复用/更新说明

- 同一账户、同一数据库名称下，部署脚本会优先**复用已有同名 D1**，不清除历史数据。**不支持在同一个 Cloudflare 账户下直接用相同数据库名称建立相互隔离的多个客户实例**。不同客户请使用不同账户；后续才考虑实例级数据库命名。
- 新部署的 Worker 名称由 Cloudflare 创建时填写的项目名决定；若出现 Worker 名称不一致警告，先确认实际发布目标。
- Analytics 只读 API Token 是可选项；不影响二维码的基本业务。
- 从 GitHub 导入部署不等于已经自动配置运行期密钥。密钥和管理员初始化仍需按上述步骤完成。

## 常见问题

| 报错现象 | 原因 / 处理 |
|---|---|
| `npm ci` 缺锁文件 | 确认 GitHub 最新 main 下有完整 `package-lock.json`，构建根目录是仓库根目录，重新构建而非使用旧副本 |
| `EndOfFileExpected` | `wrangler.jsonc` 不是合法 JSON，更新为模板最新版 |
| D1 `000...000` invalid UUID 或 10181 | Cloudflare Deploy command 被默认成 `npx wrangler deploy`；应改为 `npm run deploy`，检查日志是否执行 `node scripts/deploy-template.mjs` |
| `无法获取存储库内容` | 不使用“通过 Git URL 克隆”入口；改从已授权的 GitHub 仓库列表选择 |
| D1 创建或查询失败 | 核实 Cloudflare Builds 使用的账户和构建 API Token 的 D1 权限；不要把生产数据库 ID 复制到模板 |
| 后台提示 Setup Token 未配置 | 在部署的 Worker **运行期** Settings → Variables and Secrets 设置所需 Secret，并重新打开后台 |

## 后续收口

- P0：新账户/新部署验证密钥配置与管理员初始化。
- P0：测试重复触发部署不会新建第二份 D1，也不会清空数据。
- P0：二维码生产 → 自助激活 → 实际跳转闭环。
- P1：部署向导默认命令识别的兼容性改进；在没有 Cloudflare 明确保障前仍需展示“核对 Deploy command”。
- P1：同账户多实例 D1 命名隔离、自动升级和安全依赖扫描。

## 部署脚本收口更新（2026-10-16）

- 新增 `npm run deploy:check`：离线核对模板 Worker 名称、唯一 D1 绑定和数据库名称；不访问或修改 Cloudflare。
- `npm run deploy` 分成 `[1/3]` 查询/创建 D1、`[2/3]` 数据库迁移、`[3/3]` Worker 发布，方便根据日志定位故障。
- 使用本项目已有的 Wrangler，不允许部署时从 npm 临时拉取新版本；保留同名 D1 复用机制。
- 实测：`npm run deploy:check`、`npm run check`、`npm test` 通过。没有在客户的已初始化实例上执行重新部署或数据库写入测试。
- Cloudflare 创建应用向导目前仍可能默认使用 `npx wrangler deploy`。**必须核对并选择 `npm run deploy`**；这不是已解决的自动配置功能。
- 密钥自动生成及安全管理员认领尚未完成；不得取消 Setup Token 验证，也不得在代码中内置共享密钥。
