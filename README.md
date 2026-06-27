# WeRead Skills Web

微信读书 Skills 的轻量网页客户端。前端可部署到 GitHub Pages，微信读书 API 通过独立 HTTPS 代理转发，用户的 API Key 只保存在本地浏览器。

## 架构

```text
GitHub Pages 前端
  -> 代理地址（Vercel / Deno Deploy / Render / Cloudflare Worker / 其它 HTTPS 函数）
  -> WeRead Skills API
```

GitHub Pages 只能托管静态文件，不能直接做后端代理，所以必须配置一个代理地址。

## 代理选择

### 当前默认：Deno Deploy

目录：`deno-deploy/weread-proxy`

当前已通过手机关闭 VPN 测试的代理地址：

```text
https://weread-api.gjsx.uno/
```

这个地址已经写入 GitHub Pages Actions。重新部署 GitHub Pages 后，页面会自动隐藏“代理地址”输入框，普通用户只需要填写微信读书 API Key。

### 候选：Vercel

目录：`vercel/weread-proxy`

部署后代理地址通常是：

```text
https://你的项目.vercel.app/api/weread
```

建议先用手机关闭 VPN，在国内网络下打开并测试该地址。如果可访问，就可以在网页右上角“代理地址”填入它。

> 当前实测记录：`vercel.app` 在部分国内手机网络下可能超时不可达。如果手机不开 VPN 无法打开 Vercel 地址，不要把它内置为默认代理。

### 备用 1：其它 Deno Deploy 项目

目录：`deno-deploy/weread-proxy`

部署后代理地址通常是：

```text
https://你的项目.deno.dev
```

如果 Vercel 在国内网络不可达，再测试 Deno Deploy。

### 备用 2：Render

目录：`render/weread-proxy`

部署后代理地址通常是：

```text
https://你的项目.onrender.com/api/weread
```

Render 免费服务可能休眠，首次访问会慢一些，但它提供 HTTPS Web Service，可以作为第三候选。

### 可选：Cloudflare Worker

目录：`cloudflare-worker/weread-proxy`

Cloudflare 的 `workers.dev` 在国内网络可能不可用，不建议作为默认公开代理。

## 确认代理可用后隐藏代理输入框

如果某个代理已经通过国内手机不开 VPN 测试，可以把它写入 GitHub Actions：

```yaml
env:
  NEXT_PUBLIC_BASE_PATH: /weread-skills-web
  NEXT_PUBLIC_WEREAD_PROXY_URL: https://你的可用代理地址
```

重新部署 GitHub Pages 后，页面会自动隐藏“代理地址”输入框，普通用户只需要填写微信读书 API Key。

如果你测试出多个可用代理，也可以写成逗号分隔的候选列表：

```yaml
env:
  NEXT_PUBLIC_BASE_PATH: /weread-skills-web
  NEXT_PUBLIC_WEREAD_PROXY_URLS: https://vercel.example/api/weread,https://deno.example
```

页面会自动逐个自检，使用第一个可访问的代理。

## 代理测试

以 Vercel 为例：

```powershell
Invoke-WebRequest "https://你的项目.vercel.app/api/weread" -Method Options
```

缺 API Key 应返回 `400 缺少 API Key。`

```powershell
Invoke-WebRequest "https://你的项目.vercel.app/api/weread" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"api_name":"/shelf/sync"}'
```

## GitHub Pages

仓库名默认按 `weread-skills-web` 配置，Actions 会使用：

```text
NEXT_PUBLIC_BASE_PATH=/weread-skills-web
```

发布后访问：

```text
https://你的 GitHub 用户名.github.io/weread-skills-web/
```

## 本地验证

```powershell
node node_modules\typescript\bin\tsc --noEmit
$env:NEXT_PUBLIC_BASE_PATH="/weread-skills-web"
node node_modules\next\dist\bin\next build
```

## 安全说明

- 微信读书 API Key 不写入 GitHub，不写入代理环境变量。
- API Key 只保存在用户浏览器 `localStorage`。
- 代理只转发到微信读书 Skills 网关，不做通用转发。

