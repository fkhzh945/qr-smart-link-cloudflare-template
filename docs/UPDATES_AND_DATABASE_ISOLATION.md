# QR Smart Link Lite — 安全发布与用户升级

## 当前实现

- 私有仓库 `fkhzh945/qr-smart-link-lite` 的 `Publish application source to public template` 工作流是**人工触发**；使用只授予公开模板仓库写入权限的 `PUBLIC_TEMPLATE_TOKEN`。同步至公开仓库的 `release/source-sync` 分支后创建需审核的 PR，**不会自动发布未经审查的代码**。
- 公开模板的 `Check upstream application updates` 工作流每周运行，也可在用户自己的 GitHub 仓库手工触发。它只更新 `admin/src/`、`worker/src/`、`migrations/` 与 `admin/index.html`，生成升级 PR，由用户审核合并。
- 用户 GitHub 连接 Cloudflare Workers Builds 时，用户**合并自己的升级 PR**才会触发部署。是否自动触发取决于用户是否启用该 GitHub 集成。
- 有差异才创建 PR；**不同步** `wrangler.jsonc`、`package.json`、`scripts/deploy-template.mjs`、Secrets、GitHub 工作流等部署层代码。这些部署层变更需要单独评审升级。
- 两个工作流当前已提交，但**尚未实际触发或验证 GitHub Actions 权限与端到端 PR 创建**。GitHub 仓库可能需要在 Actions 设置里开启允许 Actions 创建 PR。

## 首次准备（由模板维护者执行一次）

1. 为私有仓库设置 Repository Secrets → `PUBLIC_TEMPLATE_TOKEN`（仅对 `fkhzh945/qr-smart-link-cloudflare-template` 有 Contents/Pull requests 写权限的最小权限令牌）。
2. 私有仓库 Actions → `Publish application source to public template` → Run workflow。
3. 审查公开模板的 `release/source-sync` PR：检查是否包含隐私、密钥、内部配置；运行 `npm run check && npm test && npm run build`。
4. 审查通过后合并 PR，使公开模板更新到新版本。不要将私有仓库数据库 ID、私有配置或客户数据公开。

## 用户更新

1. 已使用 GitHub 模板创建**自己仓库**的用户：打开自己的 GitHub Actions → `Check upstream application updates` → Run workflow，或等待每周自动检查。
2. 收到更新 PR 后检查 Release Notes、迁移脚本和当前 D1 备份；在测试 Worker 验证。
3. 合并 PR，Cloudflare（如果已开启 GitHub 自动构建）会部署新代码；保持原 Worker、D1 和 Secrets，不要重建数据库。
4. 使用 Cloudflare 的**直接连接公开仓库**（而非复制独立用户仓库）的安装者，由维护者更新公开仓库 main 后可能直接触发自动部署。这种安装模式**没有逐用户审核 PR 的隔离**；生产安装建议使用用户自己的 GitHub 仓库并审核升级。

## D1 隔离和兼容

- 老版本固定数据库名 `qr-smart-link-lite-template-db`。为兼容已安装实例，升级默认保留这一名称，不自动换库。
- **新安装且希望同账户数据库隔离时**，在 Cloudflare 构建环境变量设置独立且**永久固定**的 `QR_TEMPLATE_INSTANCE_ID`（例如 `customer-123-qr-project`），部署脚本会生成稳定的哈希数据库名称 `qrsl-<hash>-template-db`。每个实例使用不同 ID，后续每次部署都必须保持相同 ID。
- `QR_TEMPLATE_INSTANCE_ID` 是构建期标识，不是 Secret；严禁将旧实例中途改成新标识，除非已做正式数据迁移和人工验证。
- **注意：** 新安装若不填写此变量，仍走兼容模式，可能复用旧模板数据库。因此“同账户多实例默认自动隔离”仍受 Cloudflare 构建环境可用身份标识的限制；必须为每个新实例设置独立 ID。若无法保证，推荐每实例单独 Cloudflare 账户。
- 本次版本只保证按绑定名称选择 D1，并不强制验证数据库的实际归属，也不自动备份用户数据。

## 当前未覆盖的更新

- 部署模板自身安装脚本、构建依赖、Workflow 的变更**不会自动包含在用户 PR**中，需单独提供受控升级说明。
- 目前没有管理员后台的“新版本提醒”，也没有强制静默自动升级。
- 需要通过实际 GitHub Actions 运行与两个全新 Cloudflare 测试实例验证跨账号场景，方可标记为生产级更新系统。
