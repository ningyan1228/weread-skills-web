# WeRead Skills Vercel Proxy

这是给 WeRead Skills Web 使用的 Vercel 免费代理函数。

## 部署

1. 在 Vercel 新建项目。
2. 上传或导入本目录 `vercel/weread-proxy`。
3. 部署完成后得到地址，例如：

```text
https://your-project.vercel.app/api/weread
```

4. 在 GitHub Pages 页面右上角“代理地址”填入这个地址，再填微信读书 API Key 测试连接。

## 测试

```powershell
Invoke-WebRequest "https://your-project.vercel.app/api/weread" -Method Options
```

缺 API Key 应返回 400：

```powershell
Invoke-WebRequest "https://your-project.vercel.app/api/weread" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"api_name":"/shelf/sync"}'
```

## 注意

- API Key 由浏览器发送到代理，代理只转发到微信读书 Skills 网关，不保存。
- 请先用国内手机网络不开 VPN 测试 Vercel 地址是否能访问。
