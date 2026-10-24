# LowCode Platform

基于 **React 18 + Ant Design 6** + **Alibaba Lowcode Engine 1.3.4** 的低代码平台：工作台由组件中心、设计中心、产物中心组成，设计中心拖拽生成表单页与列表页，保存草稿后在产物中心预览、渲染和发布。

组件中心的表单与表格都是用 React 18 + antd 6 实现的物料（`packages/materials-react`），构建成 UMD（`LcMaterials`）供引擎模拟器与运行时共用同一份实现；设计器编排层沿用 lowcode-engine（依赖其自带的 React 16 环境与 `react15-polyfill`），与宿主 React 通过 webpack externals 共享全局实例。物料元数据、表单/列表引擎与运行时业务能力均为框架无关的 TypeScript，可脱离 React 单测与复用。

> 历史说明：项目早期版本使用 Lit 3 + Shoelace 自定义元素实现物料，已整体迁移到 React + antd；
> 若看到 `tagName`（如 `lc-page`）字段，它现在只作为物料关键字用于设计器识别与搜索。

## 目录

```
apps/
  studio/          三中心工作台（Webpack 5 + React 18 + antd 6 + 引擎 UMD）
    centers/       组件中心、产物中心
    shell/         三段式工作台导航与设计器顶栏
  runtime/         发布页运行器（Vite + React 18 + @alilc/lowcode-react-renderer）
  server/          平台服务（Fastify 5 + node:sqlite）
packages/
  schema/          ProjectSchema 与业务配置类型
  shared/          工具函数、事件常量
  page-runtime/    DataClient / FormController / PageController（纯 TS）
  materials/       物料 metadata（组件名、属性、设置器、代码片段）
  materials-react/ React + antd 物料实现、componentsMap、UMD 产物
tools/             assets 构建、演示数据、浏览器冒烟脚本（共用 smoke-utils.mjs）
```

## 快速开始

要求：Node.js **≥ 24**（服务端使用内置 `node:sqlite`）、pnpm 11。

```bash
pnpm install
pnpm vendor          # 首次：下载引擎/React/Shoelace 等 UMD 到 apps/studio/public/vendor
```

一键启动开发环境（后端、设计器、运行时预览）：

```bash
pnpm dev
```

也可以分别启动三个进程：

```bash
pnpm dev:server      # Fastify :3000
pnpm dev:studio      # 设计器 :5173（/api 代理到 :3000）
pnpm dev:runtime     # 运行时 :5174（/api 代理到 :3000）
```

> 设计器的「预览」按钮依赖 `:5174` 运行时服务；只启动 `dev:studio` 时预览页会无法访问。

初始化演示页面（用户表单 + 用户管理列表）：

```bash
node tools/seed-demo.mjs
# 输出 runtime url，例如 http://127.0.0.1:3000/runtime/?page=page_xxx
```

打开：

- 组件中心：<http://127.0.0.1:5173/?center=components>
- 设计中心：<http://127.0.0.1:5173/?center=designer&pageId=page_home>
- 产物中心：<http://127.0.0.1:5173/?center=artifacts>
- 演示列表运行时：seed 脚本输出的地址
- 预览模式：在运行时 URL 追加 `&preview=1`，读取草稿；`&version=n` 读取指定发布版本

### 三中心工作台

- **组件中心**：从物料元数据生成目录，可直接看到表单、表格、布局等真实 antd 组件预览，并进入设计中心。
- **设计中心**：使用 Lowcode Engine 拖拽编排组件、配置属性与事件，导出完整 `ProjectSchema`。
- **产物中心**：聚合所有应用下的页面产物；页面仅有草稿时可预览，发布后可渲染正式版本，也可继续发布新版本。保存草稿使用 `PUT /api/pages/:pageId/draft`，发布使用 `POST /api/pages/:pageId/publish`。

### 保存 / 发布

顶栏按钮：

- **新建 / 删除**：在当前应用下创建页面（名称、标识、表单/列表类型）或删除当前页面及其全部版本；应用至少保留一个页面。
- **版本**：查看发布历史（版本号、发布时间、物料版本），可将当前发布版本回滚到任意历史版本；回滚只切换指针，不删除版本。
- **保存**：`PUT /api/pages/:pageId/draft`，写入当前设计器导出的完整 schema。
- **发布**：保存后 `POST /api/pages/:pageId/publish`，生成不可变版本快照并切换运行时版本；发布记录同时保存当前物料版本（如 `0.1.0+ffde3fb1`），便于追溯。
- **预览**：保存草稿后打开运行时预览（草稿依赖的抽屉表单也读取草稿版本）。
- **自动保存**：编辑后 2s 防抖写入草稿，持续编辑时最长 30s 强制保存一次；失败 10s 后重试。页面级 URL 参数 `?autosave=0` 可关闭（冒烟脚本均使用该参数，避免测试改动写入草稿）。

## 生产构建

```bash
pnpm build           # materials UMD + assets.json + studio + runtime
pnpm start           # :3000，同域托管 studio 与 /runtime/
```

产物位置：

- `apps/studio/dist` → `/`
- `apps/runtime/dist` → `/runtime/`
- 物料 UMD / assets：`apps/studio/public/vendor`、`apps/studio/public/assets`

## 服务端配置

| 环境变量 | 默认值 | 说明 |
|---|---|---|
| `HOST` / `PORT` | `127.0.0.1` / `3000` | 监听地址 |
| `DB_FILE` | `apps/server/data/lowcode.db` | SQLite 文件（自动建目录/建表） |
| `STUDIO_TOKEN` | 空 | 设置后写接口要求 `Authorization: Bearer <token>`；设计器会读取 `localStorage['lc-studio-token']` |
| `ALLOW_PRIVATE_DATASOURCE` | `0` | `1` 时允许代理到内网地址（仅开发用） |
| `DATASOURCE_ALLOWED_HOSTS` | 空 | 逗号分隔的代理域名白名单，支持 `*.example.com` |
| `DATASOURCE_MAX_BYTES` | `5MB` | 上游响应体上限 |
| `STUDIO_DIR` / `RUNTIME_DIR` | `apps/*/dist` | 静态产物目录 |

## API

```
GET    /healthz
GET    /api/artifacts
GET    /api/apps
POST   /api/apps                                  { name, slug }
GET    /api/apps/:appIdOrSlug/pages
POST   /api/apps/:appId/pages                     { name, slug, type }
GET    /api/pages/:pageId
PUT    /api/pages/:pageId/draft                   { schema }
POST   /api/pages/:pageId/publish                 { schema?, assetsVersion? }
GET    /api/pages/:pageId/versions
GET    /api/pages/:pageId/versions/:version
POST   /api/pages/:pageId/rollback/:version
GET    /api/runtime/:appSlug/:pageSlug            ?preview=1 | ?version=n
GET    /api/runtime/pages/:pageId                 ?preview=1 | ?version=n
POST   /api/datasource/proxy                      { datasourceId?, url, method, params, body }
GET    /api/mock/users                           开发演示数据
```

数据源代理默认拒绝 loopback/内网/链路本地地址，禁止重定向，限制超时与响应大小；`/api/mock/*` 为平台内置 mock，允许相对路径。

## 验证

```bash
pnpm test            # 单元测试 + 服务端集成测试（24 项）
pnpm typecheck
pnpm check:materials # 物料 metadata / componentsMap / assets.json 三方一致
pnpm e2e             # 串行运行全部 14 个浏览器冒烟（需先启动三个 dev 进程）
pnpm e2e dirty autosave   # 按名称过滤
node tools/centers-smoke.mjs                  # 三中心导航、组件预览、产物操作
node tools/save-publish-smoke.mjs              # 设计器加载草稿 → 保存 → 发布 → 运行时读取同版本
node tools/runtime-smoke.mjs                   # 列表加载/查询/新建抽屉/编辑回填
node tools/dirty-smoke.mjs                     # 编辑后切换页面的未保存确认
node tools/autosave-smoke.mjs                  # 自动保存草稿（结束后还原）
node tools/page-management-smoke.mjs           # 新建/删除页面
node tools/versions-smoke.mjs                  # 版本历史与回滚（结束后还原发布指针）
node tools/setter-smoke.mjs                    # 自定义设置器
node tools/form-smoke.mjs                      # 运行时：必填校验/联动隐藏与恢复/提交成功（写草稿后还原）
node tools/list-smoke.mjs                      # 设计态：示例数据渲染、行操作提示、不发请求
node tools/list-live-smoke.mjs                 # 运行时全链路：请求参数/查询/分页/排序/行删除
```

冒烟脚本是**断言型**的：任一断言失败会抛出异常并以非 0 退出码结束（`pnpm e2e` 据此汇总）。
公共启动、按钮文案匹配（antd 会在两个中文字符间插入空格）、抽屉状态读取等工具在 `tools/smoke-utils.mjs`。
默认使用 `/Applications/Google Chrome.app`，可用 `CHROME_PATH` 指定其他 Chrome 可执行文件。如果修改了物料源码，
需要先 `pnpm build:materials` 让设计器画布用到的 `lc-materials.umd.js` 重新生成。

冒烟脚本默认连接 `127.0.0.1:5173`（设计器）、`:5174`（运行时）、`:3000`（服务端），可用 `STUDIO_URL` / `RUNTIME_URL` / `API_URL` 覆盖；生产模式下：

```bash
STUDIO_URL=http://127.0.0.1:3000 \
RUNTIME_URL=http://127.0.0.1:3000/runtime \
API_URL=http://127.0.0.1:3000 \
pnpm e2e save-publish runtime
```

## 里程碑

- **M0** 骨架、引擎启动、assets 管线 ✅
- **M1** 表单物料、校验、联动、自定义设置器 ✅
- **M2** 列表页、查询/分页/排序/选择、行操作、抽屉表单 ✅
- **M3** 草稿/发布/版本、SQLite 持久化、运行时应用、数据源代理 ✅
- **M4** 自动保存、页面管理 UI、物料版本哈希、物料一致性校验、E2E 套件与文档 ✅
- **M5** 组件中心、产物中心、三中心统一工作台与产物 API ✅
- **M6** 物料由 Lit + Shoelace 迁移到 React 18 + antd 6；修复运行时抽屉表单链路（FormBridge 注入 + 行数据回填）、查询条件下发、页面级 rowActions 渲染，冒烟脚本改为真实断言 ✅

## 已知限制

- 表单页复用 `Page` 根物料（渲染为 LcPage 外壳）；独立 `LcFormPage` 尚未拆分。
- 抽屉表单复用主页面渲染器；编辑态的请求方法需由表单 schema 自身配置。
- 运行时使用 React 18 的 legacy `ReactDOM.render`（渲染器生态尚未切换到 `createRoot`），控制台会出现对应的迁移告警。
- 设计器中，模拟器画布内的交互（如表格勾选）受引擎选中层影响，行为与真实运行时不完全一致；交互类断言请放在运行时冒烟（`runtime-smoke` / `list-live-smoke`）里。
- 引擎内部仍有少量 React 警告（UndoRedo setState、SVG `class`、PageRenderer key），不影响功能。
