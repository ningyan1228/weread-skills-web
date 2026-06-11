const WEREAD_GATEWAY = "https://i.weread.qq.com/api/agent/gateway";
const SKILL_VERSION = "1.0.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400"
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return jsonResponse({ errcode: -1, message: "只支持 POST 请求。" }, 405);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse({ errcode: -1, message: "请求体必须是 JSON。" }, 400);
    }

    const { apiKey, api_name, skill_version: _skillVersion, ...params } = payload || {};

    if (!apiKey || typeof apiKey !== "string") {
      return jsonResponse({ errcode: -1, message: "缺少 API Key。" }, 400);
    }

    if (!api_name || typeof api_name !== "string") {
      return jsonResponse({ errcode: -1, message: "缺少 api_name。" }, 400);
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

      return jsonResponse(data, upstream.status);
    } catch (error) {
      return jsonResponse(
        {
          errcode: -1,
          message: "无法连接微信读书 Skills 网关，请稍后重试。",
          details: error instanceof Error ? error.message : String(error)
        },
        502
      );
    }
  }
};
