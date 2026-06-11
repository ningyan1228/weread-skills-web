# WeRead Skills Render Proxy

这是给 WeRead Skills Web 使用的 Render 备用代理。它是一个最小 Node HTTP 服务，不依赖 Express。

## 部署

1. 在 Render 新建 Web Service。
2. 上传或连接本目录 `render/weread-proxy`。
3. Build Command 留空或使用：

```text
npm install
```

4. Start Command 使用：

```text
npm start
```

5. 部署完成后得到地址，例如：

```text
https://your-project.onrender.com/api/weread
```

6. 在 GitHub Pages 页面右上角“代理地址”填入这个地址，再填微信读书 API Key 测试连接。

## 测试

```powershell
Invoke-WebRequest "https://your-project.onrender.com/api/weread" -Method Options
```

缺 API Key 应返回 400：

```powershell
Invoke-WebRequest "https://your-project.onrender.com/api/weread" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"api_name":"/shelf/sync"}'
```

## 注意

- Render 免费服务可能休眠，首次访问会慢一些。
- API Key 由浏览器发送到代理，代理只转发到微信读书 Skills 网关，不保存。
