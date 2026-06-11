const WEREAD_GATEWAY = "https://i.weread.qq.com/api/agent/gateway";
const SKILL_VERSION = "1.0.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

async function readJsonBody(request) {
  const text = await request.text();
  if (!text.trim()) {
    return null;
  }
  return JSON.parse(text);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method === "GET") {
    return jsonResponse({
      ok: true,
      service: "weread-proxy",
      runtime: "deno-deploy",
      message: "WeRead proxy is running. Use POST with apiKey and api_name."
    });
  }

  if (request.method !== "POST") {
    return jsonResponse({ errcode: -1, message: "Only POST requests are supported." }, 405);
  }

  let payload;
  try {
    payload = await readJsonBody(request);
  } catch {
    return jsonResponse({ errcode: -1, message: "Invalid JSON body." }, 400);
  }

  const { apiKey, api_name, skill_version: _ignored, ...params } = payload || {};

  if (!apiKey || typeof apiKey !== "string") {
    return jsonResponse({ errcode: -1, message: "Missing API Key." }, 400);
  }

  if (!api_name || typeof api_name !== "string") {
    return jsonResponse({ errcode: -1, message: "Missing api_name." }, 400);
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
        message: "Unable to connect to WeRead Skills gateway. Please retry later.",
        details: error instanceof Error ? error.message : String(error)
      },
      502
    );
  }
});
