# Docker Compose 规范

> 编排 java-admin dev 依赖服务（MySQL / Redis / Nacos / Adminer）。**java-admin app 自身不在 compose 中**——用 `mvn spring-boot:run` 跑（dev 模式跑在 host 上，便于看日志、改代码热重载）。

---

## 1. 选型

| 服务    | 镜像                 | 版本     | 用途                                 |
| ------- | -------------------- | -------- | ------------------------------------ |
| MySQL   | `mysql:8.4`          | 8.4      | 主库                                 |
| Redis   | `redis:7-alpine`     | 7-alpine | 缓存 + Sa-Token 持久化               |
| Nacos   | `nacos/nacos-server` | 2.4.3    | 配置中心（**默认**启动；本地 Nacos） |
| Adminer | `adminer:latest`     | 4.x      | DB 可视化（可选，Q11 决策默认含）    |

**jar/java-admin-app 自身不在 compose 中**——用 `mvn spring-boot:run` 跑 dev profile。

---

## 2. 端口策略（**4000 段**）

> 避开 80xx/3306/6379/8848 等常见 dev 冲突。

| 服务                     | 容器内端口 | host 端口                                |
| ------------------------ | ---------- | ---------------------------------------- |
| java-admin app（自己跑） | 8080       | **4080**                                 |
| MySQL                    | 3306       | **4336**                                 |
| Redis                    | 6379       | **4379**                                 |
| Nacos HTTP               | 8848       | **4848**                                 |
| Nacos gRPC               | 9848       | **5848**（**Nacos 强约束 = HTTP+1000**） |
| Adminer                  | 8080       | **4081**                                 |

---

## 3. 文件结构

```
backend/java-admin/deploy/
├── docker-compose.yml          # 服务编排
├── .env                        # 真实环境变量（**gitignore**）
├── .env.example                # 模板（提交到 git）
├── fix-docker-desktop-commit-failed.sh   # 排查脚本
└── README.md                   # 启动 / 故障排查
```

---

## 4. docker-compose.yml 模板

```yaml
services:
  mysql:
    image: mysql:8.4
    container_name: java-admin-mysql
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD:-123456}
      MYSQL_DATABASE: ${MYSQL_DATABASE:-javaadmin_dev}
      TZ: Asia/Shanghai
    ports:
      - "${MYSQL_PORT:-4336}:3306"
    volumes:
      - mysql_data:/var/lib/mysql
    command: --default-authentication-plugin=caching_sha2_password
    healthcheck:
      test:
        [
          "CMD",
          "mysqladmin",
          "ping",
          "-h",
          "127.0.0.1",
          "-uroot",
          "-p${MYSQL_ROOT_PASSWORD:-123456}",
        ]
      interval: 5s
      timeout: 3s
      retries: 10

  redis:
    image: redis:7-alpine
    container_name: java-admin-redis
    restart: unless-stopped
    command: ["redis-server", "--requirepass", "${REDIS_PASSWORD:-123456}"]
    ports:
      - "${REDIS_PORT:-4379}:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD:-123456}", "ping"]
      interval: 5s
      timeout: 3s
      retries: 10

  nacos:
    image: nacos/nacos-server:v2.4.3
    container_name: java-admin-nacos
    restart: unless-stopped
    environment:
      MODE: standalone
      JVM_XMS: 512m
      JVM_XMX: 512m
      JVM_XMN: 256m
      SPRING_DATASOURCE_PLATFORM: mysql
      NACOS_AUTH_ENABLE: "true"
      NACOS_AUTH_TOKEN: SecretKey012345678901234567890123456789012345678901234567890123456789
      NACOS_AUTH_IDENTITY_KEY: nacos
      NACOS_AUTH_IDENTITY_VALUE: nacos
      TZ: Asia/Shanghai
    ports:
      - "${NACOS_PORT:-4848}:8848"
      - "${NACOS_GRPC_PORT:-5848}:9848"
    depends_on:
      mysql:
        condition: service_healthy
    volumes:
      - nacos_data:/home/nacos/data
    healthcheck:
      test:
        ["CMD-SHELL", "wget -q -O - http://127.0.0.1:8848/nacos/actuator/health/liveness || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 12

  adminer:
    image: adminer:latest
    container_name: java-admin-adminer
    restart: unless-stopped
    ports:
      - "${ADMINER_PORT:-4081}:8080"
    environment:
      ADMINER_DEFAULT_SERVER: ${MYSQL_HOST:-mysql}
    depends_on:
      mysql:
        condition: service_healthy

volumes:
  mysql_data:
  redis_data:
  nacos_data:
```

---

## 5. .env.example 模板

```bash
# MySQL
MYSQL_HOST=mysql
MYSQL_PORT=4336
MYSQL_ROOT_PASSWORD=123456
MYSQL_DATABASE=javaadmin_dev

# Redis
REDIS_PORT=4379
REDIS_PASSWORD=123456

# Nacos
NACOS_PORT=4848
NACOS_GRPC_PORT=5848

# Adminer
ADMINER_PORT=4081

# App（自己跑，参考值）
APP_PORT=4080

# Nacos 启用开关
NACOS_CONFIG_ENABLED=false
```

**实际 .env 在 .gitignore 中**（含真实密码）。

---

## 6. 启动流程

```bash
cd backend/java-admin/deploy
cp .env.example .env
docker compose up -d

# 等待 health check 通过（约 30s）
docker compose ps

# 验证
mysql -h 127.0.0.1 -P 4336 -uroot -p123456 -e "SHOW DATABASES"
redis-cli -h 127.0.0.1 -p 4379 -a 123456 ping
open http://127.0.0.1:4848/nacos  # nacos/nacos
```

---

## 7. 故障排查

### 7.1 Docker Desktop macOS: `commit failed: unexpected commit digest`

**症状**：

```
failed to register layer: commit failed: unexpected commit digest
Error response from daemon
```

**根因**：Docker Desktop 缓存损坏（macOS 上偶发，常见于长时间运行后）。

**修复**：

```bash
# 1. 杀干净
pkill -9 -f "java-admin-api.jar"

# 2. 重启 Docker Desktop
osascript -e 'quit app "Docker"'
sleep 5
open -a Docker

# 3. 等待启动完成（约 30s）
docker info | grep "Server Version"

# 4. 重试
docker compose up -d

# 一键脚本：deploy/fix-docker-desktop-commit-failed.sh
```

### 7.2 Nacos gRPC 端口冲突

**症状**：`Nacos client connect to server ... failed` / `9848 port not available`

**根因**：Nacos 强约束 gRPC 端口 = HTTP+1000。如果改 HTTP 端口到非 8848，gRPC 端口**必须**同步改。

**修复**：host 端口 5848 = 4848 + 1000（保留）。

### 7.3 Redis 无密码时 Lettuce 发空密码

**症状**：

```
io.lettuce.core.RedisCommandExecutionException: ERR AUTH <password> called without a password
```

**根因**：`password: ${REDIS_PASSWORD:}` 解析为 `""`，Lettuce 仍发 AUTH 空密码被 Redis 拒绝。

**修复（任选一）**：

- `password: ${REDIS_PASSWORD:#{null}}`（**SpEL 解析为 null**，不发 AUTH）
- 给 dev Redis 设密码（**推荐**：本项目统一 123456）

### 7.4 dev 启动顺序

```
docker compose up -d    # 起依赖（不依赖 java-admin 自身）
mvn spring-boot:run     # java-admin 跑在 host
```

不要把 java-admin 自身加进 compose（`mvn spring-boot:run` 看 log 方便，dev-tools 也能热重载）。

---

## 8. 常见错误（防回归）

| 错误                                                    | 现象             | 规避                                        |
| ------------------------------------------------------- | ---------------- | ------------------------------------------- |
| 端口冲突（与 80xx/3306/6379/8848 重叠）                 | 启动失败         | **4000 段**                                 |
| Nacos HTTP 改了 gRPC 没改                               | gRPC 报错        | gRPC 强约束 HTTP+1000                       |
| `restart: always` 失败后**自动重启失败容器**            | 坏状态反复重启   | 用 `unless-stopped`                         |
| `volumes:` 没设                                         | 数据丢失         | 至少 mysql_data / redis_data                |
| 把 java-admin app 自身加进 compose                      | dev 启动绕开 mvn | 显式注释"不在 compose 中"                   |
| `.env` 提交到 git                                       | 密码泄露         | `.gitignore` 配 `.env`，提交 `.env.example` |
| `depends_on: mysql` **没** `condition: service_healthy` | 容器起顺序无序   | 加 `condition: service_healthy`             |

---

## 9. 不在范围内

- ❌ java-admin app 自身（用 mvn 跑）
- ❌ Kubernetes / Helm（dev 用 compose 就够）
- ❌ 多节点 / Cluster 模式
- ❌ Prometheus / Grafana 监控
- ❌ TLS / HTTPS（dev 走 plain）

---

**本文件由 AI 在 2026-06-14 任务 `06-14-java-admin-backend` 中首次落盘；多次迭代后定稿。**
**AI 后续写代码前必须先读本文件，并在 `implement.jsonl` 中登记。**
