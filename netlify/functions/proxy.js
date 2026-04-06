// In-memory token cache survives warm Lambda restarts.
var cachedToken  = null;
var tokenExpires = 0;

async function getAppToken() {
  var id     = process.env.REDDIT_CLIENT_ID;
  var secret = process.env.REDDIT_CLIENT_SECRET;
  if (!id || !secret) return null;

  if (cachedToken && Date.now() < tokenExpires) return cachedToken;

  var creds = Buffer.from(id + ":" + secret).toString("base64");
  var res   = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      "Authorization": "Basic " + creds,
      "User-Agent":    "android:com.personal.redditapp:v1.0.0 (by /u/kevin101681)",
      "Content-Type":  "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    console.error("[PROXY] Token fetch failed:", res.status);
    return null;
  }

  var data    = await res.json();
  cachedToken = data.access_token;
  // Expire the cached copy 90 s before Reddit does, to avoid using a stale token.
  tokenExpires = Date.now() + (data.expires_in - 90) * 1000;
  return cachedToken;
}

exports.handler = async function (event) {
  var targetUrl = event.queryStringParameters && event.queryStringParameters.url;

  if (!targetUrl) {
    return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: "Missing ?url= parameter" }) };
  }

  var parsed;
  try { parsed = new URL(targetUrl); }
  catch (e) {
    return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: "Invalid URL" }) };
  }

  var allowed = ["www.reddit.com", "reddit.com", "oauth.reddit.com", "api.reddit.com"];
  if (!allowed.includes(parsed.hostname)) {
    return { statusCode: 403, headers: cors(), body: JSON.stringify({ error: "Forbidden domain" }) };
  }

  // Prefer authenticated OAuth path (bypasses Cloudflare datacenter blocks).
  // Falls back to direct www.reddit.com fetch when env vars are absent.
  var token = await getAppToken();

  var fetchUrl = targetUrl;
  var headers  = {
    "User-Agent":      "android:com.personal.redditapp:v1.0.0 (by /u/kevin101681)",
    "Accept":          "application/json",
    "Accept-Language": "en-US,en;q=0.9",
  };

  if (token) {
    // Route through oauth.reddit.com — no Cloudflare challenge, higher rate limit.
    fetchUrl = targetUrl.replace("https://www.reddit.com", "https://oauth.reddit.com")
                        .replace("https://reddit.com",     "https://oauth.reddit.com");
    headers["Authorization"] = "Bearer " + token;
  }

  console.log("[PROXY]", token ? "OAuth" : "unauthenticated", "->", fetchUrl);

  var res;
  try {
    res = await fetch(fetchUrl, { headers: headers });
  } catch (err) {
    console.error("[PROXY] fetch error:", err.message);
    return { statusCode: 502, headers: cors(), body: JSON.stringify({ error: "Upstream fetch failed: " + err.message }) };
  }

  if (!res.ok) {
    console.error("[PROXY] Reddit returned", res.status);
    return { statusCode: 502, headers: cors(), body: JSON.stringify({ error: "Reddit returned HTTP " + res.status }) };
  }

  var ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    var preview = (await res.text()).slice(0, 200);
    console.error("[PROXY] Non-JSON from Reddit:", ct, preview);
    return { statusCode: 502, headers: cors(), body: JSON.stringify({ error: "Reddit returned non-JSON (" + ct + ")" }) };
  }

  var body = await res.text();
  return { statusCode: 200, headers: cors(), body: body };
};

function cors() {
  return {
    "Content-Type":                "application/json",
    "Access-Control-Allow-Origin": "*",
  };
}