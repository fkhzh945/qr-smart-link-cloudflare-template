# QR Smart Link Lite — Cloudflare 一键部署模板

**简体中文** | [English](README.md)

动态二维码管理系统，包含批次生产、移动端自助激活、跳转网址管理及单管理员后台。

## Cloudflare 一键部署

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/fkhzh945/qr-smart-link-cloudflare-template)

本仓库是独立的公开部署模板。原有私有开发仓库不对外公开。

### 部署步骤

1. 准备自己的 Cloudflare 账户，按 Cloudflare 页面流程关联 GitHub。
2. 提前生成三个**不同的随机密钥**，可使用 `openssl rand -hex 32` 分别生成。
3. 部署设置中填写 `SETUP_TOKEN`（不少于 16 字符）、`SESSION_SECRET`（不少于 32 字符）及 `ACTIVATION_SECRET`（不少于 32 字符）。不要公开真实值。
4. 确认 Cloudflare 为此系统**新建 D1 数据库**。配置文件的全 0 数据库 ID 只是模板占位符，不是生产库。
5. 确认 Build 命令是 `npm run build`，Deploy 命令是 `npm run deploy`。部署时会先应用数据库迁移，再发布 Worker。
6. 部署后打开新 `workers.dev` 地址，访问 `/#/admin`；输入专属 `SETUP_TOKEN`、管理员邮箱和 12–128 字符密码完成初始化。该 Token 不可用管理员密码替代。

Cloudflare Analytics 用量监控为**可选配置**，不影响二维码业务。未配置只读 Token 时，真实用量显示不可用。

## 技术测试

```bash
npm ci
npm run check
npm test
npm run build
```

**安全提示：** 模板不能包含原部署账户的数据库 ID、生产 Secret、客户数据或管理员凭证。产品仅支持单管理员，不包含角色管理。

## 当前状态

已经制作独立部署模板，**尚需通过公开模板在全新 Cloudflare 账户中完成端到端验收**；未验收前，不宣称已实现可用的一键安装。
