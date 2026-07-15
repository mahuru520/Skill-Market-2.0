# 部署操作指南（远端服务器）

> 目标：把 skill-market 部署到你的远端 Linux 服务器，`docker compose up -d` 一键起。
> 产物：API（NestJS，3001）+ Web（nginx，80）两个容器，数据存 SQLite 单文件。

---

## 前置条件

远端服务器需具备：

1. **Linux**（Ubuntu/Debian/CentOS 均可），能 sudo
2. **Docker Engine** + **Docker Compose v2**（`docker compose` 子命令形式）
   - 安装：`curl -fsSL https://get.docker.com | sh`
   - 验证：`docker --version` && `docker compose version`
3. **Git**（用于拉代码，也可改用 scp 上传）
4. 开放端口：**80**（或你定的 WEB_PUBLIC_PORT）给外部访问；3001 仅容器内部通信，不必对外开放

> 服务器**不需要** Node.js、pnpm —— 构建全在 Docker 容器内完成。

---

## 方式 A：在服务器上构建（推荐，简单）

适合服务器配置尚可（≥2G 内存）、能直接拉到代码的场景。

### 1. 上传代码到服务器

把整个项目传到服务器（**排除 node_modules / data / dist**）：

```bash
# 本地执行：打包（不含依赖和构建产物）
cd /d/Project/skill-market
tar --exclude='node_modules' --exclude='data' --exclude='dist' --exclude='.git' \
    -czf skill-market.tar.gz .

# 上传到服务器
scp skill-market.tar.gz user@your-server:/opt/

# SSH 到服务器
ssh user@your-server
```

### 2. 解压并进入项目

```bash
sudo mkdir -p /opt/skill-market
sudo chown $USER:$USER /opt/skill-market
tar -xzf /opt/skill-market.tar.gz -C /opt/skill-market
cd /opt/skill-market
```

### 3. 配置环境变量

```bash
cp .env.example .env
# 按需修改 .env：
#   WEB_PUBLIC_PORT=8080   # 对外端口，80 需 sudo/已放行
# 也可不改，用默认值（web 暴露 8080）
```

### 4. 构建并启动

```bash
docker compose up -d --build
```

首次构建约 3–8 分钟（拉镜像 + pnpm install + nest/vite build）。

### 5. 验证

```bash
# 容器状态
docker compose ps

# API 健康
curl http://localhost:3001/api/skills?pageSize=1
# 期望: {"code":0,"data":{"skills":[...],"total":25,...}}

# Web 首页（通过 nginx 反代 API）
curl http://localhost:8080/api/v1/categories
# 期望: {"code":0,"data":{"count":6,"items":[...]}}
```

浏览器访问 `http://<服务器IP>:8080` —— 首页、全部技能、详情页应全部可用。

---

## 方式 B：本地构建镜像，传镜像到服务器

适合服务器内存小、构建慢，或网络拉 npm 包慢的场景。

### 1. 本地构建镜像

```bash
cd /d/Project/skill-market
docker build -f apps/api/Dockerfile -t skill-market-api:latest .
docker build -f apps/web/Dockerfile -t skill-market-web:latest .
```

### 2. 导出镜像

```bash
docker save skill-market-api:latest skill-market-web:latest \
    | gzip > skill-market-images.tar.gz
```

### 3. 上传并加载

```bash
scp skill-market-images.tar.gz user@your-server:/opt/
ssh user@your-server
docker load < /opt/skill-market-images.tar.gz
```

### 4. 上传 compose 配置 + skills 目录

compose 文件、skills 数据、nginx.conf 仍需在服务器上：

```bash
# 本地：单独打包配置类文件
tar --exclude='node_modules' --exclude='data' --exclude='dist' \
    -czf skill-market-config.tar.gz \
    docker-compose.yml .env.example skills/ apps/web/nginx.conf
scp skill-market-config.tar.gz user@your-server:/opt/
```

服务器：

```bash
sudo mkdir -p /opt/skill-market && sudo chown $USER:$USER /opt/skill-market
tar -xzf /opt/skill-market-config.tar.gz -C /opt/skill-market
cd /opt/skill-market
cp .env.example .env
```

### 5. 修改 compose 用本地镜像（不 build）

编辑 `docker-compose.yml`，把两个服务的 `build:` 块换成 `image:`：

```yaml
services:
  api:
    image: skill-market-api:latest      # 替换 build 块
    # ...其余不变
  web:
    image: skill-market-web:latest      # 替换 build 块
    # ...
```

### 6. 启动

```bash
docker compose up -d
```

验证同方式 A 第 5 步。

---

## 数据说明

- **SQLite 文件**：存在 Docker volume `skill_market_data`，映射到容器 `/app/data/skill-market.db`
- **首次启动自动导入**：API 容器启动时检测 DB 为空 → 自动扫描 `/app/skills` 导入 25 个技能
- **重新导入**（改了 skill.json 后）：
  ```bash
  docker compose exec api node apps/api/dist/indexer/run.js
  # 或进容器跑
  docker compose exec api sh -c "cd apps/api && node dist/indexer/run.js"
  ```
- **数据备份/迁移**：只需备份 volume
  ```bash
  docker compose cp api:/app/data ./data-backup
  # 或直接打包 volume 目录
  ```

---

## 换服务器迁移

整个项目无云厂商锁定，迁到新服务器：

1. 新机装 Docker
2. 拷贝项目目录（含 skills/）+ 备份的 data volume
3. `docker compose up -d`
4. 数据自动延续（SQLite 文件随 volume 迁移）

---

## 常用运维命令

```bash
cd /opt/skill-market

docker compose ps                # 查看容器状态
docker compose logs -f api       # 看 API 日志
docker compose logs -f web       # 看 nginx 日志
docker compose restart api       # 重启 API
docker compose down              # 停止并删容器（数据 volume 保留）
docker compose down -v           # 停止并删数据（慎用，会清空 DB）
docker compose up -d --build     # 改代码后重新构建启动
docker compose exec api sh       # 进 API 容器排查
```

---

## 反向代理到域名 + HTTPS（可选）

若要用域名 + HTTPS，在服务器前再加一层 nginx 或 Caddy 反代到 8080：

**Caddy 自动 HTTPS 示例**（最简）：

```bash
# 装 Caddy 后，/etc/caddy/Caddyfile:
skill.example.com {
    reverse_proxy localhost:8080
}
sudo systemctl reload caddy
```

此时 docker-compose 的 `WEB_PUBLIC_PORT` 保持 8080 即可，Caddy 统一接管 80/443。

---

## 故障排查

| 现象 | 排查 |
|------|------|
| `docker compose up` 卡在 pnpm install | 服务器网络慢，改用方式 B 本地构建传镜像 |
| API 容器起来但 `/api/skills` 报 500 | `docker compose logs api` 看是否 DB 未初始化；手动 `docker compose exec api node apps/api/dist/indexer/run.js` |
| Web 能开但接口 404/502 | nginx 反代目标 `api:3001` 解析失败，确认两个容器在同一 compose network（默认同 network 即可） |
| 改了 skill.json 但页面没变 | 跑重新导入命令（见上「重新导入」），前端可能需硬刷新 |
| 端口被占用 | 改 `.env` 的 `WEB_PUBLIC_PORT`，或 `docker-compose.yml` 里 web 的端口映射 |
