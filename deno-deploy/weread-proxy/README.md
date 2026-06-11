# WeRead Skills Deno Deploy Proxy

这是给 WeRead Skills Web 使用的 Deno Deploy 备用代理。

## 部署

1. 打开 Deno Deploy，新建项目。
2. 上传或粘贴 `main.js`。
3. 部署完成后得到地址，例如：

```text
https://your-project.deno.dev
```

4. 在 GitHub Pages 页面右上角“代理地址”填入这个地址，再填微信读书 API Key 测试连接。

## 测试

```powershell
Invoke-WebRequest "https://your-project.deno.dev" -Method Options
```

缺 API Key 应返回 400：

```powershell
Invoke-WebRequest "https://your-project.deno.dev" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"api_name":"/shelf/sync"}'
```

## 注意

- API Key 由浏览器发送到代理，代理只转发到微信读书 Skills 网关，不保存。
- 如果 Vercel 在国内不可达，再测试 Deno Deploy。
