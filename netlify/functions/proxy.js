exports.handler = async function(event) {
  const targetUrl = event.queryStringParameters.url;

  if (!targetUrl) {
    return { statusCode: 400, body: "Missing target URL" };
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "kevins-personal-reddit-client/2.0.0 (by /u/developer)",
        "Accept": "application/json",
      },
    });

    const data = await response.text();

    return {
      statusCode: response.status,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: data,
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};