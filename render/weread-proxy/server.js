import http from "node:http";

const WEREAD_GATEWAY = "https://i.weread.qq.com/api/agent/gateway";
const SKILL_VERSION = "1.0.3";
const PORT = Number(process.env.PORT || 3000);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400"
};

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    ...corsHeaders,
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(body));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        request.destroy();
        reject(new Error("请求体过大。"));
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, corsHeaders);
    response.end();
    return;
  }

  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  if (url.pathname !== "/" && url.pathname !== "/api/weread") {
    sendJson(response, 404, { errcode: -1, message: "接口不存在。" });
    return;
  }

  if (request.method === "GET") {
    sendJson(response, 200, {
      ok: true,
      service: "weread-proxy",
      runtime: "render",
      message: "WeRead proxy is running. Use POST with apiKey and api_name."
    });
    return;
  }

  if (request.method !== "POST") {
    sendJson(response, 405, { errcode: -1, message: "只支持 POST 请求。" });
    return;
  }

  let payload;
  try {
    const rawBody = await readBody(request);
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    sendJson(response, 400, { errcode: -1, message: "请求体不是有效 JSON。" });
    return;
  }

  const { apiKey, api_name, skill_version: _ignored, ...params } = payload || {};

  if (!apiKey || typeof apiKey !== "string") {
    sendJson(response, 400, { errcode: -1, message: "缺少 API Key。" });
    return;
  }

  if (!api_name || typeof api_name !== "string") {
    sendJson(response, 400, { errcode: -1, message: "缺少 api_name。" });
    return;
  }

  try {
    const upstream = await fetch(WEREAD_GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        api_name,
        ...params,
        skill_version: SKILL_VERSION
      })
    });

    const text = await upstream.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }

    sendJson(response, upstream.status, data);
  } catch (error) {
    sendJson(response, 502, {
      errcode: -1,
      message: "无法连接微信读书 Skills 网关，请稍后重试。",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

server.listen(PORT, () => {
  console.log(`WeRead proxy listening on ${PORT}`);
});
