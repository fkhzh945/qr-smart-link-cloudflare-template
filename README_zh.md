# QR Smart Link Lite — Cloudflare 部署模板

[English](README.md) · **简体中文** · 部署模板 V0.2 RC（应用接口版本仍为 0.1.0）

轻量级、单管理员的动态二维码系统：生产批次、SVG/ZIP 导出、激活码发放、手机自助激活、目标链接跳转及后台统计。适合在自己的 Cloudflare Workers + D1 账户中部署，不包含角色管理和子账号体系。

## 开始安装

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/fkhzh945/qr-smart-link-cloudflare-template)

**经实际验收的安装方式：** Cloudflare → Workers & Pages → 创建应用 → **通过 GitHub 导入存储库** → 选择本仓库 `fkhzh945/qr-smart-link-cloudflare-template`（`main` 分支）。若上面的部署按钮提示“无法获取存储库内容”，请改用这个已验证的 GitHub 仓库列表导入方式，不要反复使用 Git URL 克隆入口。

### 1. 配置构建并部署

| 配置 | 填写值 |
| --- | --- |
| 项目名称 | 自选，如 `qr-smart-link-cloudflare` |
| 分支 | `main` |
| Root directory | 仓库根目录 `/` |
| Build command | `npm run build` |
| **Deploy command** | **`npm run deploy`（必须核对）** |

Cloudflare 页面有时默认填写 `npx wrangler deploy`，**不能直接沿用**：那会跳过模板的自动 D1 建库和迁移。正确部署会执行 `node scripts/deploy-template.mjs`，显示 D1 检查、迁移、Worker 发布三个阶段。部署需具备 D1 查询、创建和读写权限。

脚本查找或创建当前账户内名为 `qr-smart-link-lite-template-db` 的 D1，填入真实数据库 ID，应用迁移后发布 Worker；不会使用原生产项目的数据库 ID。**同一 Cloudflare 账户内多个此模板实例默认会共用同名 D1；如需客户间数据隔离，推荐不同 Cloudflare 账户，不要误认为换 Worker 名就完成隔离。**

### 2. 只配置一个 Setup Token

首次安装只需要部署者在 Cloudflare 的可信安装向导（若提供该字段）或新 Worker → Settings → Variables and Secrets 中配置 **`SETUP_TOKEN`**，类型为 Secret（加密）。使用独立强随机值，建议通过可信终端运行 `openssl rand -hex 32` 生成，私下保存，用于第一次管理员认领。不得使用示例值，也不要发送至聊天、截图或提交到 GitHub。

`SESSION_SECRET` 和 `ACTIVATION_SECRET` **由 `npm run deploy` 在发布 Worker 后自动生成并写入运行期 Secret**。它根据部署成功日志确认实际 Worker 名称，已有值保持不变；如果无法确认目标或写入失败，则停止并报错，不会向猜测的 Worker 写入。

**重要：** 这项自动写入需要 Cloudflare 构建凭证拥有 Worker Secrets 管理权限。部署日志中应出现 `[4/4] Installing missing runtime secrets` 以及两项 `generated and installed` 或 `preserved`，但不显示密钥值。自动化目前通过本地检查和模拟名称识别测试，**尚待在新 Cloudflare 实例端到端验证**。如云端权限不足，需先配置构建凭证权限或由部署者在 Cloudflare 后台手动配置，不能认为已经成功。

常规更新**不要重设运行密钥**：这可能令登录会话失效或使已发放的激活码无法验证。系统保持 Setup Token 管理员认领验证，不开放首访注册管理员。

### 3. 创建管理员

打开本次部署的 `https://你的Worker地址/#/admin`，输入 `SETUP_TOKEN`、管理员邮箱及 **12–128 字符**密码，完成唯一管理员初始化。初始化后使用邮箱和密码登录，后台右上角可修改密码（需验证旧密码）。

**安全提示：** 登录 Cloudflare 的身份不会自动传递给公开 Worker 页面。目前仍由 Setup Token 验证管理员首次认领；没有开放“第一个访问网站的人即可成为管理员”的入口。

### 4. 上线前验收

1. 打开 `/health` 应返回 `ok: true`，初始化完成后 `/api/setup/status` 应返回 `initialized: true`。
2. 创建 3 张二维码的测试批次，下载 ZIP，核对图片和映射表。
3. 为一个二维码发放激活码，用手机完成自助激活并设置目标网址。
4. 再次扫码，核对跳转网址和后台激活数量。
5. 重复部署前先备份重要数据；确认 D1 仍指向同一库，且原有二维码与密钥保持有效。

Cloudflare Analytics 用量统计为**可选功能**，不配置只读 Analytics Token 也不影响二维码业务。

## 常见报错

| 现象 | 处理 |
| --- | --- |
| “无法获取存储库内容” | 使用 Cloudflare 的 **GitHub 仓库列表导入**，确认 GitHub App 已授权本仓库 |
| `npm ci` / 缺少锁文件 | 使用最新 `main`，Root directory 为仓库根目录，检查完整 `package-lock.json` |
| `EndOfFileExpected` | 检查是否使用最新合法的 `wrangler.jsonc` |
| D1 全零 ID / `10181` / `7400` | 检查 Deploy command 是否误填 `npx wrangler deploy`，必须用 `npm run deploy` |
| Worker 名称不匹配警告 | 核对 Cloudflare 当前项目和构建目标；不要修改原生产 Worker |
| 首次初始化提示 Setup Token 未配置 | 在正确的 Worker 的运行期 Secret 中配置 `SETUP_TOKEN` |
| 首页 Cloudflare 用量显示 `—` | 可选的 Analytics Token 尚未配置，不影响业务 |

## 开发与维护

需要 Node.js 和 npm 的开发人员可运行：

```bash
npm ci
npm run deploy:check
npm run check
npm test
npm run build
```

其中 `deploy:check` 只做本地配置预检，不修改云资源；`setup:check` 只检查当前 Wrangler 指向 Worker 的 Secret **名称**，不输出密钥值。请确认命令的目标 Worker，避免误操作。

详见 [部署验收与故障排查](docs/DEPLOYMENT_ACCEPTANCE_V0.2_RC.md)。

## 状态与限制

2026-10-16 已由用户确认：**独立 Cloudflare 实例部署、管理员初始化及二维码业务闭环验收通过**；在线实例为 [qr-smart-link-cloudflare.myqrcode.workers.dev](https://qr-smart-link-cloudflare.myqrcode.workers.dev/)。此结论针对已测试实例，不代表不同账户及全部安装入口都已零配置验证。

当前仍需人工核对部署命令及配置一个 Setup Token；“完全零配置一键安装”“免 Token 安全认领”尚未完成。原有生产项目与私有开发仓库均不属于本公开模板。

## 界面语言

自助激活页、管理员后台、操作反馈与 Element Plus 组件现支持 **10 种语言**：简体中文、英语、葡萄牙语、法语、德语、意大利语、日语、韩语、荷兰语、西班牙语。首次访问可根据浏览器语言自动选择，也可手动切换；选择会保存在当前浏览器中。

## Vercel 免费部署可行性

已评估 Vercel Hobby + Neon Free 的**个人非商业试用**路径，但本项目的 Cloudflare D1/Worker 后端尚未完成 Vercel 适配，当前**不能一键完整部署到 Vercel**。另外 Vercel Hobby 免费版不允许商业用途；门店和企业商用继续优先使用 Cloudflare。详见 [Vercel 免费部署评审与改造清单](docs/VERCEL_FREE_DEPLOY_FEASIBILITY.md)。

## 用户升级与数据库隔离

公开模板已加入每周上游源码检查工作流：通过自己的 GitHub 仓库部署的用户可在 Actions 中运行 **Check upstream application updates**，收到更新 PR 后审核、测试并合并。合并后由已配置的 Cloudflare GitHub 集成部署。不会自动修改 D1 配置或 Secret。

新安装在同一个 Cloudflare 账户下如需隔离多个实例，**必须**在 Cloudflare 构建环境变量设置不同且长期不变的 `QR_TEMPLATE_INSTANCE_ID`；旧安装保持默认标识以防数据库切换。没有标识的新安装仍可能复用旧库。详情见 [版本发布与安全升级说明](docs/UPDATES_AND_DATABASE_ISOLATION.md)。
