const http = require("node:http");

const WEREAD_GATEWAY = "https://i.weread.qq.com/api/agent/gateway";
const SKILL_VERSION = "1.0.3";
const PORT = Number(process.env.PORT || 3000);
const MAX_BODY_BYTES = 1024 * 1024;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400"
};

function sendJson(res, status, body) {
  res.writeHead(status, {
    ...corsHeaders,
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        reject(new Error("Request body too large."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function readJsonBody(req) {
  const text = await readBody(req);
  if (!text.trim()) return null;
  return JSON.parse(text);
}

function isHealthPath(url) {
  const path = new URL(url, "http://localhost").pathname;
  return path === "/" || path === "/health";
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  if (req.method === "GET" && isHealthPath(req.url || "/")) {
    sendJson(res, 200, {
      ok: true,
      service: "weread-proxy",
      runtime: "node-docker",
      message: "WeRead proxy is running. Use POST with apiKey and api_name."
    });
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { errcode: -1, message: "Only POST requests are supported." });
    return;
  }

  let payload;
  try {
    payload = await readJsonBody(req);
  } catch (error) {
    sendJson(res, 400, {
      errcode: -1,
      message: "Invalid JSON body.",
      details: error instanceof Error ? error.message : String(error)
    });
    return;
  }

  const { apiKey, api_name, skill_version: _ignored, ...params } = payload || {};

  if (!apiKey || typeof apiKey !== "string") {
    sendJson(res, 400, { errcode: -1, message: "缺少 API Key。" });
    return;
  }

  if (!api_name || typeof api_name !== "string") {
    sendJson(res, 400, { errcode: -1, message: "缺少 api_name。" });
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

    sendJson(res, upstream.status, data);
  } catch (error) {
    sendJson(res, 502, {
      errcode: -1,
      message: "无法连接微信读书 Skills 网关，请稍后重试。",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`weread-proxy listening on ${PORT}`);
});
