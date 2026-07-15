# Skill Market 技术规范（SPEC）

> 仿 skillhub 的轻量级全栈技能市场。导航仅「首页 / 全部技能」;首页去掉快捷入口服务区;详情页仅「概述 / 历史版本」两 Tab + 文件清单区,去掉安全验证/测评报告/效果预览/价格区。不挂 GitLab,技能数据一次性导入 SQLite,换服务器只迁移 DB 文件。

---

## 1. 架构

### 1.1 技术栈

| 层 | 选型 | 选型理由 |
|----|------|----------|
| 前端 | React 18 + Vite + TypeScript | SPA,对齐 skillhub |
| UI | Tailwind + @tailwindcss/typography | 原子类 + prose 渲染 SKILL.md |
| 路由 | react-router-dom v6 | |
| 状态 | React Query | 列表/详情缓存,无 zustand |
| Markdown | react-markdown + remark-gfm | 渲染 SKILL.md |
| 后端 | NestJS + TypeScript | 模块化/DI |
| ORM | Prisma | 一行连接串切库(SQLite→Postgres) |
| DB | SQLite(默认) | 单文件零运维,随目录迁移 |
| 搜索 | SQLite LIKE / Prisma `contains` | 轻量,无额外服务(未启用 FTS5,见 §6) |
| 打包下载 | archiver | 整目录流式 zip |
| 部署 | Docker Compose | 换服务器 `docker compose up`,不绑云厂商 |

### 1.2 数据流(DB 自包含)

```
skills/*/skill.json + SKILL.md   (一次性导入源)
        │  pnpm sync / 首次启动自动导入
        ▼
   SQLite (Prisma) ── FTS5 虚拟表
        │  REST  {code:0, data, message}
        ▼
   NestJS API (/api/...)
        │
        ▼
   React SPA (nginx 托管静态产物)
```

indexer 跑一次把 25 个 skill.json + SKILL.md 正文 + 目录文件清单写入 DB。之后 `skills/` 目录与 DB **半解耦**——不挂 GitLab、不依赖磁盘、无 webhook。改数据 = 改 skill.json 后重启 api 容器(启动即增量导入,见 §6)。

---

## 2. 项目结构（pnpm monorepo）

```
skill-market/
├── pnpm-workspace.yaml
├── package.json                 # 根 scripts: dev/build/sync
├── docker-compose.yml
├── .env.example
├── SPEC.md                      # 本文档
├── skills/                      # 现有 25 个 skill 数据(导入源,不动)
├── packages/
│   └── shared/                  # 前后端共享 TS 类型
│       └── src/types/skill.ts
├── apps/
│   ├── api/                     # NestJS 后端
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── skills/          # 列表/详情 controller+service+dto
│   │   │   ├── categories/
│   │   │   ├── showcase/
│   │   │   ├── indexer/         # skill.json → DB 导入服务
│   │   │   └── prisma/          # PrismaService
│   │   ├── prisma/schema.prisma
│   │   └── Dockerfile
│   └── web/                     # React + Vite 前端
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx
│       │   ├── api/client.ts    # fetch 封装
│       │   ├── pages/{Home,SkillList,SkillDetail}.tsx
│       │   ├── components/      # SkillCard/FilterBar/SortDropdown/Badge
│       │   └── lib/
│       ├── nginx.conf
│       └── Dockerfile
└── SKILLS整理.md / 技能市场改进思路.md   # 保留
```

---

## 3. 数据模型（Prisma schema）

```prisma
model Skill {
  id            String   @id @default(cuid())
  slug          String   @unique          // = skill.json.name
  displayName   String                    // display_name
  description   String                    // description
  descriptionEn String?                   // description_en (部分有)
  summary       String?  @default("")     // 详情页摘要
  version       String                    // version
  icon          String                    // icon (emoji 或 url)
  category      String                    // category (6 类)
  runtimeType   String                    // runtime_type: gateway_migrated_api|external_api|local
  source        String   @default("official") // = owner.type
  ownerName     String                    // = owner.name
  ownerVerified Boolean  @default(true)   // = owner.verified
  readmePath    String   @default("SKILL.md")
  envVars       Json?                     // env_vars[]
  dependencies  Json?                     // dependencies[]
  api           Json?                     // api{base_url,auth_type,endpoints,...}
  migration     Json?                     // migration{migrated_from,to,behavior_change,status}
  platform      Json?
  tags          Json?
  examples      Json?                     // examples[] (部分 skill.json 有)
  hot           Boolean  @default(false)
  installCount  Int      @default(0)      // install_count
  stars         Int      @default(0)      // 用户行为(DB 独有,初始 0)
  score         Int      @default(0)      // 综合分(见 3.2)
  billing       String   @default("free") // 派生: local→free, api→paid
  readme        String   @default("")     // SKILL.md 正文(indexer 导入,DB 自包含)
  files         Json?                     // 目录文件清单[{path,size,type}](indexer 遍历生成)
  sha           String?                   // skill.json 内容 hash(重跑 sync 判断是否需更新)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  versions      SkillVersion[]

  @@index([category])
  @@index([runtimeType])
  @@index([billing])
  @@index([score(sort: Desc)])
}

model SkillVersion {
  id        String   @id @default(cuid())
  skill     Skill    @relation(fields: [skillId], references: [id])
  skillId   String
  version   String
  changelog Json     // {changes:[], type, date}
  date      DateTime
  createdAt DateTime @default(now())

  @@index([skillId])
}

model Category {
  key       String   @id              // image_video / document / ...
  name      String                    // 中文名
  nameEn    String
  sortOrder Int      @default(0)
  level     Int      @default(1)
  active    Boolean  @default(true)
}
```

### 3.1 billing 派生规则

对齐 `SKILLS整理.md` 计费分类:
- `runtime_type=local` → `free`(18 个)
- `runtime_type=gateway_migrated_api` 或 `external_api` → `paid`(7 个计费技能)

实现 `deriveBilling(runtimeType, api)` 工具,indexer 导入时计算。

### 3.2 score 计算规则(简化版)

基础分 = `installCount × 1 + stars × 5 + (migration.status === "verified" ? 100 : 0) + (hot ? 50 : 0)`

### 3.3 搜索实现(未用 FTS5)

搜索走 Prisma `contains`(SQLite LIKE),`keyword` 命中 `slug` / `displayName` / `description` 任一即匹配(见 `skills.service.ts` list 的 `where.OR`)。原设计的 FTS5 虚拟表为预留,未落地——25 条数据量 LIKE 足够,避免维护虚拟表同步。

### 3.4 Category seed(6 类)

| key | name | nameEn | sortOrder |
|-----|------|--------|-----------|
| image_video | 图像视频 | Image & Video | 10 |
| document | 文档处理 | Document | 20 |
| code_debug | 代码调试 | Code & Debug | 30 |
| mail_communication | 邮件通信 | Mail & Communication | 40 |
| initialization | 初始化 | Initialization | 50 |
| system_config | 系统配置 | System Config | 60 |

---

## 4. API 设计

响应统一封装 `{code:0, data, message}`。

| 方法 | 路径 | 作用 |
|------|------|------|
| GET | `/api/skills` | 列表,query: `page,pageSize,sortBy,order,keyword,category,runtimeType,billing` |
| GET | `/api/v1/skills/:slug` | 详情,返回 `{skill, latestVersion, contentZhAvailable}` |
| GET | `/api/v1/categories` | 分类树 `{count, items}` |
| GET | `/api/v1/showcase/:type` | 首页榜单,`type=featured/top/hot/recommended` |
| GET | `/api/v1/skills/:slug/versions` | 版本历史 |
| GET | `/api/v1/skills/:slug/download` | 下载技能整目录 zip(GET 供 `<a download>` 触发),installCount +1 |

**`/skills` pageSize 上限**:500(配合「全部技能一页全量展示」,前端 `PAGE_SIZE=200`)。

**下载接口**:archiver 整目录流式 zip,`Content-Disposition: attachment; filename="<slug>.zip"`。`installCount` 异步自增(`prisma.update ... { increment: 1 }`.catch 不阻塞流)。仅校验 slug 存在 + `SKILLS_DIR/<slug>` 是目录,否则 404。

**sortBy 枚举**:`score`(默认) / `downloads` / `stars` / `rank` / `updated_at`

**列表响应**:`{code:0, data:{skills:[...], total, page, pageSize}}`

**详情响应**:`skill` 对象含上述全部字段(含 `readme` 正文、`files` 清单、`api`、`migration`、`envVars` 等);`latestVersion` 取 `versions` 最新一条;`contentZhAvailable` = `description` 非空。

---

## 5. 前端页面设计

### 5.1 全局布局
- **顶部导航仅两项**:首页 / 全部技能
- **无页脚快捷入口**:不建服务协议、隐私协议、建议反馈等跳转
- 配色(weppy.app 暖白系):主色暖橙红 `#FF5C28`、hover `#E0451A`;页底暖米白 `#FAF8F3`;卡片纯白 `#FFFFFF`;标题近黑 `#111111`、正文 `#3A3A3A`、弱化 `#8A8A8A`;边框 `#ECE9E2`
- 字体:`Plus Jakarta Sans` → `PingFang SC` → system-ui;标题用 `font-extrabold tracking-tight` 拉层级,正文默认 `ink-soft`
- 卡片圆角 16px、柔和双层阴影(`shadow-card` / hover `shadow-cardHover`)
- Tailwind 令牌见 `apps/web/tailwind.config.js`(`brand` / `ink{DEFAULT,soft,mute}` / `canvas` / `line` / `surface` / `rounded-card` / `shadow-card{,Hover}`)

### 5.2 首页 `/`
- Hero:暖橙 eyebrow 小标签(`OSPREY SKILL MARKET`,uppercase tracking-widest)+ 超大标题(`text-5xl/6xl font-extrabold`)+ 副标题 + 搜索框(搜索跳 `/skills?keyword=`)
- 榜单区:`/api/v1/showcase/top` 渲染 Top 技能卡(统一 `SectionHeader`:eyebrow + 大标题 + 可选右侧链接)
- 分类入口:6 个 category 卡片,点击带 `category` 参数跳列表页
- 推荐精选:`showcase/featured`
- section 间距 `py-16`/`py-20`,大留白
- **不出现**任何「快捷入口」服务区

### 5.3 列表页 `/skills`(导航的「全部技能」)
- 标题区:`全部技能` + 右侧搜索栏(`w-72`,回车/失焦提交写入 URL `keyword`,带 ✕ 清除)
- 排序下拉:`score`(默认) / `downloads` / `stars` / `rank` / `updated_at`
- 筛选 chip 组(暖中性未选中态 `bg-canvas border-line`,选中态 `bg-brand text-white`):
  - 运行方式:`本地运行` / `外网API` / `网关迁移`
  - 计费:`免费` / `计费`
  - 分类:全部 + 6 类
- 卡片网格 `grid-cols-1 sm:2 lg:3`(icon + displayName + description + runtime/billing 徽章 + installCount)
- **一页全量展示**:`PAGE_SIZE=200`,无分页/无加载更多;空状态提示

### 5.4 详情页 `/skills/:slug`(两 Tab + 右侧三板块)

左侧主区,**仅两个 Tab**:
- **概述**:开头一句功能概括(`description` 引言段,底部分隔线)+ 渲染 SKILL.md(剥掉 YAML front matter,`prose` 标准字号,代码块/表格各自横向滚动不撑破整页)
- **历史版本**:`/api/v1/skills/:slug/versions` 渲染 changelog 时间轴

> 不做 skillhub 的「效果预览」Tab、测评报告、安全验证整个右侧安全区。

右侧三个卡片(自上而下):
- **发送给你的 AI 安装**(提示词卡):模板 `请先检查是否已安装<此技能>,若未安装,请根据技能 skill-expansion 安装<此技能>技能。`,`<此技能>` 用 `displayName` 填充;复制按钮(HTTP 非 secure context 下 fallback `execCommand`)
- **下载**:`<a href="/api/v1/skills/:slug/download" download>`,点击后延迟刷新查询让后端 +1 落库
- **基础信息**:分类、运行方式、计费、版本、来源、更新时间、安装数(仅展示元数据,无价格区、无迁移验证区)

**文件清单区**(基础信息下方):展示该技能目录的文件树(`skill.files` 字段),纯展示不提供下载。

---

## 6. Indexer 导入机制

`apps/api/src/indexer/indexer.service.ts`:
1. 扫描 `skills/*/skill.json`(`SKILLS_DIR` 环境变量,默认项目根 `skills/`)
2. 解析 JSON → 映射 Prisma 模型 → upsert(按 slug)
3. **读取并写入 SKILL.md 正文**到 `skill.readme`(DB 自包含)
4. **生成文件清单**:遍历技能目录(递归,跳过 `node_modules`/`.git`/`dist`/`build`),记录 `{path, size, type}` 写入 `skill.files`
5. 同步 `SkillVersion`(changelog 数组,先 deleteMany 再 create)
6. `deriveBilling()` 计算 billing(`local→free`,API 类→`paid`)
7. 记录 `sha`(skill.json 内容 hash),**重跑时 sha 未变则跳过该 skill**(增量导入,幂等)

### 6.1 启动即增量导入(`onModuleInit`)
每次 api 容器启动都执行 `importAll()`,不判断 DB 是否为空。配合 sha-skip,未变更技能不重写,成本很低。

**运维含义**:加/改技能 = 改 `skills/<slug>/` → 重启 api 容器(`docker compose restart api`)。无需手动 `pnpm sync`、无需 build 镜像(skills 是 bind mount)。

### 6.2 下载数不抹零(增量保护)
`importOne` 中,`installCount` 计算规则:
- **已存在的技能**:保留 DB 真实计数(`existing.installCount`),不被 skill.json 的 `install_count` 覆盖
- **全新技能**:用 skill.json 的 `install_count ?? 0` 作 seed

upsert 的 `update` 分支**不写 `installCount`**(也不写 `stars`)——升级 skill.json 版本/内容不会丢失真实下载/收藏数。`hot`、`score`、`billing`、`readme`、`files` 等元数据仍随 skill.json 更新。

### 6.3 未实现项(与原 SPEC 的差异)
- **FTS5 虚拟表未启用**:搜索走 Prisma `contains`(LIKE),查询 `slug/displayName/description`。§3.3 的 FTS5 schema 为设计预留,未落地。
- **Category seed**:categories 由 indexer/seed 写入(见 3.4),非独立迁移脚本。

触发方式:
- 自动:api 容器启动时(`onModuleInit`,见 6.1)
- CLI:`pnpm sync`(手动重导,走 `apps/api/src/indexer/run.ts`)

---

## 7. 部署方案(Docker Compose,可移植)

`docker-compose.yml`:
```yaml
services:
  api:
    build: ./apps/api
    environment:
      - DATABASE_URL=file:/app/data/skill-market.db
      - SKILLS_DIR=/app/skills
    volumes:
      - ./skills:/app/skills:ro    # 导入源(首次导入后可去掉)
      - ./data:/app/data           # SQLite 持久化
    ports: ["3001:3001"]
  web:
    build: ./apps/web
    ports: ["8080:80"]
    depends_on: [api]
```

`apps/web/nginx.conf`:静态托管 `dist/` + `location /api { proxy_pass http://api:3001; }`。

**实际部署形态**(腾讯云 Ubuntu,119.45.250.95:8080):
- `docker-compose.yml` 关键点:`api` 卷 `./skills:/app/skills:ro`(bind mount,加技能无需 build)+ named volume `skill_market_data:/app/data`(SQLite 持久化);`web` 端口 `${WEB_PUBLIC_PORT:-8080}:80`
- api Dockerfile:多阶段构建,runner 装 `openssl`(Prisma 运行时探测 3.0.x 引擎需要),`entrypoint.sh` 先 `prisma db push` 建表再启动 `dist/main.js`
- 换服务器:`scp` 项目 + `docker compose up -d`(DB 已含全部数据)
- 切 Postgres:改 `DATABASE_URL` + `pnpm prisma migrate deploy`
- GitHub 仅作代码镜像(国内不可达),部署不依赖 Git

**可移植性保证**:
- 零云厂商依赖(无 EdgeOne/CDN/OSS/GitLab)
- SQLite 单文件随 `data/` 目录迁移
- 换服务器:`scp` 项目 + `docker compose up -d`(DB 已含全部数据)
- 切 Postgres:改 `.env` 的 `DATABASE_URL` + `pnpm prisma migrate deploy`
- 端口/路径全走 `.env`,不硬编码

---

## 8. 分阶段实施

| 阶段 | 目标 | 产出 | 验证 |
|------|------|------|------|
| **M0 脚手架** | monorepo 骨架 | pnpm workspace、apps/api+web 空壳、Dockerfile、docker-compose、.env | `pnpm dev` 前后端能起 |
| **M1 数据层** | 数据进库 | Prisma schema、indexer.service、seed categories、`pnpm sync` | `sync` 后 DB 有 25 条 skill,readme/files 有值,FTS 能搜 |
| **M2 后端 API** | 列表/详情/分类/榜单 | skills/categories/showcase controller + FTS5 搜索 | curl 各接口返回正确 `{code:0,data}` |
| **M3 前端** | 两页+详情通 | Home/SkillList/SkillDetail(两 Tab)+ 组件 + 布局 | 排序筛选生效、详情渲染 SKILL.md、文件清单显示 |
| **M4 部署** | 一键起 | docker-compose 跑通、nginx 反代 | `docker compose up` 后 8080 全功能可用 |

执行顺序:M0→M1→M2→M3→M4,每阶段验证通过再进下一阶段。

---

## 9. 验证方案

1. **M1**:`pnpm sync` → `pnpm prisma studio` 看到 25 条 skill;`readme` 非空;`files` 为清单数组;`billing` = 18 free + 7 paid
2. **M2**:`curl 'localhost:3001/api/skills?sortBy=score&pageSize=2'` 返回 `{code:0,data:{skills:[...],total:25}}`;`curl localhost:3001/api/v1/skills/comfyui-image-generation` 返回含 readme/files;`curl -O localhost:3001/api/v1/skills/comfyui-image-generation/download` 得到 zip 且 installCount +1
3. **M3**:列表页 sortBy=downloads 排序变化;筛选「网关迁移」剩 5 个;标题右侧搜索栏回车筛选生效;详情页概述 Tab 剥 YAML、渲染 SKILL.md、提示词可复制、下载触发 zip、文件清单显示
4. **M4**:`docker compose up -d` → 浏览器 `localhost:8080` 全功能可用;导航仅「首页/全部技能」;首页无快捷入口区;往 `skills/` 加目录后 `docker compose restart api` 新技能出现且不抹已有下载数;停服删容器重启数据仍在
