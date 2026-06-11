# WeRead Skills Cloudflare Worker Proxy

这是给 GitHub Pages 前端使用的微信读书 Skills 代理。它只转发到微信读书 Skills 网关，不保存用户 API Key。

## 在 Cloudflare 控制台手动部署

1. 打开 Cloudflare Dashboard。
2. 进入 `Workers & Pages`。
3. 点击 `Create`，选择 `Worker`。
4. Worker 名称建议填：`weread-skills-proxy`。
5. 创建后进入编辑器，把 `src/index.js` 的全部内容复制进去。
6. 点击 `Deploy`。
7. 复制生成的地址，例如：

```text
https://weread-skills-proxy.<你的子域>.workers.dev
```

8. 打开 GitHub Pages 站点，在页面右上角“代理地址”里填入这个 Worker 地址。
9. 再输入微信读书 API Key，点击“测试连接”。

## 测试

OPTIONS 预检应返回 204：

```powershell
Invoke-WebRequest "https://你的worker.workers.dev" -Method Options
```

缺少 API Key 应返回 400：

```powershell
Invoke-WebRequest "https://你的worker.workers.dev" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"api_name":"/shelf/sync"}'
```

有效 API Key 应返回书架数据：

```powershell
Invoke-WebRequest "https://你的worker.workers.dev" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"apiKey":"wrk-你的key","api_name":"/shelf/sync"}'
```

## 注意

- API Key 只在浏览器和本次代理请求中出现，不写入 Cloudflare 环境变量。
- Worker 使用 `Access-Control-Allow-Origin: *`，方便 GitHub Pages 调用。
- 如果 Worker 地址以后变了，只需要在网页“代理地址”里重新填写，不需要重新部署 GitHub Pages。
