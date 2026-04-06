const https = require("https");
const http  = require("http");

exports.handler = async function (event) {
  const targetUrl = event.queryStringParameters && event.queryStringParameters.url;

  if (!targetUrl) {
    return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: "Missing ?url= parameter" }) };
  }

  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch (e) {
    return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: "Invalid URL" }) };
  }

  const allowed = ["www.reddit.com", "reddit.com", "oauth.reddit.com"];
  if (!allowed.includes(parsed.hostname)) {
    return { statusCode: 403, headers: cors(), body: JSON.stringify({ error: "Forbidden domain" }) };
  }

  var result = await new Promise(function(resolve, reject) {
    const lib = parsed.protocol === "https:" ? https : http;
    const req = lib.get(
      targetUrl,
      {
        headers: {
          "User-Agent": "android:com.personal.redditapp:v1.0.0 (by /u/kevin101681)",
          "Accept":     "application/json",
        },
      },
      function(res) {
        const chunks = [];
        res.on("data", function(c) { chunks.push(c); });
        res.on("end",  function() {
          resolve({ statusCode: res.statusCode, contentType: res.headers["content-type"] || "", body: Buffer.concat(chunks).toString("utf8") });
        });
      }
    );
    req.on("error", reject);
  });

  // Reddit returned a non-200 status (rate-limit, block, etc.)
  if (result.statusCode !== 200) {
    return {
      statusCode: 502,
      headers: cors(),
      body: JSON.stringify({ error: "Reddit returned HTTP " + result.statusCode }),
    };
  }

  // Reddit returned HTML instead of JSON (IP block / Cloudflare challenge page)
  if (!result.contentType.includes("application/json")) {
    return {
      statusCode: 502,
      headers: cors(),
      body: JSON.stringify({ error: "Reddit returned non-JSON (likely IP-blocked): " + result.contentType }),
    };
  }

  return {
    statusCode: 200,
    headers: cors(),
    body: result.body,
  };
};

function cors() {
  return {
    "Content-Type":                "application/json",
    "Access-Control-Allow-Origin": "*",
  };
}