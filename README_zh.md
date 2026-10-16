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

### 2. 配置运行期密钥

部署后在**刚创建的 Worker** → Settings → Variables and Secrets 添加以下三个 **Secret（加密）**。如果 Cloudflare 的官方部署向导已提示输入这些值，且确认它们已写入运行环境，就无需重复添加。

| Secret 名称 | 要求及用途 |
| --- | --- |
| `SETUP_TOKEN` | 独立强随机值，建议至少 32 字符；首次管理员认领时使用 |
| `SESSION_SECRET` | 与其他密钥不同，至少 32 字符；管理员登录会话签名 |
| `ACTIVATION_SECRET` | 与其他密钥不同，至少 32 字符；激活码安全校验 |

使用密码学安全随机生成器，例如在可信终端运行三次 `openssl rand -hex 32`。**不得直接使用 `.dev.vars.example` 的示例值、提交密钥到 Git、发送到聊天或贴到截图里。** 后续重新部署不要轮换 `SESSION_SECRET` 和 `ACTIVATION_SECRET`，否则可能使登录会话或已发放的激活码失效。

普通部署目前**尚未自动生成这三个 Secret**。仓库中的 `npm run setup:secrets` 是需要明确目标 Worker 和双重确认的可选高级命令，只补齐后两个运行密钥；不自动生成 `SETUP_TOKEN`，也未集成进 `npm run deploy`。

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

当前仍需人工核对部署命令及配置安全密钥；“完全零配置一键安装”“免 Token 安全认领”尚未完成。原有生产项目与私有开发仓库均不属于本公开模板。
