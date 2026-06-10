const WEREAD_GATEWAY = "https://i.weread.qq.com/api/agent/gateway";
const SKILL_VERSION = "1.0.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400"
};

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8"
    },
    body: JSON.stringify(body)
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: ""
    };
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { errcode: -1, message: "\u53ea\u652f\u6301 POST \u8bf7\u6c42\u3002" });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return jsonResponse(400, { errcode: -1, message: "\u8bf7\u6c42\u4f53\u4e0d\u662f\u6709\u6548 JSON\u3002" });
  }

  const { apiKey, api_name, skill_version: _ignored, ...params } = payload;

  if (!apiKey || typeof apiKey !== "string") {
    return jsonResponse(400, { errcode: -1, message: "\u7f3a\u5c11 API Key\u3002" });
  }

  if (!api_name || typeof api_name !== "string") {
    return jsonResponse(400, { errcode: -1, message: "\u7f3a\u5c11 api_name\u3002" });
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
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }

    return jsonResponse(upstream.status, data);
  } catch (error) {
    return jsonResponse(502, {
      errcode: -1,
      message: "\u65e0\u6cd5\u8fde\u63a5\u5fae\u4fe1\u8bfb\u4e66 Skills \u7f51\u5173\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002",
      details: error instanceof Error ? error.message : String(error)
    });
  }
};
