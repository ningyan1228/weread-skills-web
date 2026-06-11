const WEREAD_GATEWAY = "https://i.weread.qq.com/api/agent/gateway";
const SKILL_VERSION = "1.0.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400"
};

function sendJson(response, statusCode, body) {
  response.status(statusCode);
  Object.entries({
    ...corsHeaders,
    "Content-Type": "application/json; charset=utf-8"
  }).forEach(([key, value]) => response.setHeader(key, value));
  response.end(JSON.stringify(body));
}

export default async function handler(request, response) {
  Object.entries(corsHeaders).forEach(([key, value]) => response.setHeader(key, value));

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  if (request.method !== "POST") {
    sendJson(response, 405, { errcode: -1, message: "只支持 POST 请求。" });
    return;
  }

  let payload;
  try {
    payload = typeof request.body === "string" ? JSON.parse(request.body || "{}") : request.body || {};
  } catch {
    sendJson(response, 400, { errcode: -1, message: "请求体不是有效 JSON。" });
    return;
  }
  const { apiKey, api_name, skill_version: _ignored, ...params } = payload;

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
}
