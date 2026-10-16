# Vercel 免费部署可行性评审（2026-10-16）

## 结论

- **技术可迁移**：Vue 前端可使用 Vercel 静态构建，Hono 路由可通过 Vercel Functions 入口接入；但 Cloudflare Workers + D1 业务后端不能直接复制部署。
- **个人免费试用**：Vercel Hobby（免费）+ Neon Free PostgreSQL 可以作为个人、非商业评估目标。需要实际适配、建立数据库、验证接口后才能提供真实 Deploy 按钮。
- **商业用户免费运营**：**不满足 Vercel Hobby 条款**。Hobby 仅允许个人非商业用途；门店、企业或商业客户应使用 Vercel Pro 等合规方案，或继续使用现有 Cloudflare 部署。
- **当前状态**：Cloudflare 部署模板已实际验收；Vercel **未实现、未部署、未验收**。不可将裸的 Vercel Clone URL 宣称为可用的一键安装。

## 对现有代码的影响

| 模块 | 现状 | Vercel 改造 |
| --- | --- | --- |
| Vue 3 + Vite 前端 | `admin/dist` 打包成 Cloudflare Assets | 使用 Vercel 输出目录与 SPA fallback |
| Hono API | Worker `worker/src/index.js` | 增加 Vercel Function 入口并转交请求到 Hono |
| DB | `c.env.DB.prepare().bind().first()/all()/run()` | 设计 PostgreSQL 适配层（Neon）或兼容桥接，保证事务与变化行数语义 |
| D1 SQL 迁移 | SQLite `AUTOINCREMENT`、时间字段、唯一约束等 | 创建对应 PostgreSQL 迁移与幂等初始化 |
| 管理员登录 | JWT Cookie + D1 | 保留安全验证、原子管理员初始化、限流及锁定 |
| 二维码与批量激活 | 基于 D1 的读取、批量写入、唯一性约束 | PostgreSQL 回归测试，防止部分写入/重复码 |
| 短链 `/q/:code` | Cloudflare Worker 路由 | Vercel Rewrite 到 Function；缓存策略不能改变跳转语义 |
| Cloudflare 用量页面 | 查询 Cloudflare Analytics | Vercel 应禁用该专有视图或替换为相应指标，避免错误额度展示 |
| 运行 Secret | Cloudflare Secret | Vercel 环境变量管理，首次管理员认领保持安全 |

## 一键部署的必要条件

1. 建立独立 Vercel 适配分支/目录，不改变已验收的 Cloudflare 生产部署。
2. 选择 Neon Free PostgreSQL，仅用于**个人非商业试用**；支持 Vercel Marketplace 安装/集成，连接串以 Secret 形式交付，不提交到仓库。
3. 将 SQL 与业务代码适配 PostgreSQL，完成扫码短链、批次 ZIP、管理员初始化、激活码、重置、限流等完整回归测试。
4. 正式建立 `vercel.json`、Function 入口及可靠的数据库迁移初始化方法。
5. 使用全新的测试数据库和 Vercel 个人账户完成首次部署、重复部署与 Secret 不轮换测试。
6. **仅在端到端验收通过后**把 [Deploy with Vercel](https://vercel.com/docs/deploy-button) 按钮加进 README。Deploy 按钮可以要求填写环境变量名称，但不能直接把密钥值放进 URL。

## 官方资料

- Vercel Hobby 免费套餐条款：https://vercel.com/legal/terms
- Vercel 免费版资源：https://vercel.com/docs/plans/hobby
- Vercel Deploy Button：https://vercel.com/docs/deploy-button
- Deploy Button 环境变量：https://vercel.com/docs/deploy-button/environment-variables
- Vercel Marketplace 数据库：https://vercel.com/docs/marketplace-storage
- Neon Free 数据库：https://neon.com/blog/neon-free-plan-1-gb-per-project

> 如果目标是 **面向真实门店和客户的长期免费商用部署**，Vercel Hobby 不适合；保留 Cloudflare 作为主要交付方式。若只是评估不同平台部署能力，可实施个人非商业 Vercel + Neon PoC。
