# WeRead Proxy for Tencent Cloud Server

这个目录用于把微信读书 Skills 代理部署到腾讯云服务器。

目标域名：

```text
https://weread-api.gjsx.uno/
```

## 部署前准备

1. 在阿里云 DNS 增加 A 记录：
   - 主机记录：`weread-api`
   - 记录类型：`A`
   - 记录值：`43.128.149.75`

2. 等 DNS 生效后再启动/测试 HTTPS。

3. 确认服务器已有统一 nginx 网关，并且 Docker network `web` 已存在：

```bash
docker network ls | grep web
```

## 上传到服务器

把本目录放到服务器：

```text
~/projects/weread-proxy
```

最终结构：

```text
~/projects/
├── nginx
├── blog-proxy
├── weread-proxy
└── README.md
```

## 启动

```bash
cd ~/projects/weread-proxy
docker compose up -d --build
```

## 查看状态

```bash
docker ps
docker compose logs -f
```

## 停止

```bash
cd ~/projects/weread-proxy
docker compose down
```

## 测试

```bash
docker exec weread-proxy node -e "fetch('http://127.0.0.1:3000/health').then(r=>r.text()).then(console.log)"
curl https://weread-api.gjsx.uno/health
```

缺 API Key 测试：

```bash
curl -i -X POST https://weread-api.gjsx.uno/ \
  -H 'Content-Type: text/plain' \
  --data '{"api_name":"/shelf/sync"}'
```

应返回 `400` 和 `缺少 API Key。`。

## 安全说明

- 不需要在服务器保存微信读书 API Key。
- API Key 仍由用户在前端输入，并只保存在用户浏览器。
- 代理只转发到微信读书 Skills 网关，不做通用转发。
- 不要把 `.env` 上传到 GitHub。

