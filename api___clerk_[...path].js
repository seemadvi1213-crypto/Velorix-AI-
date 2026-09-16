export default async function handler(req, res) {
  const secretKey = process.env.CLERK_SECRET_KEY;

  if (!secretKey) {
    return res.status(500).json({
      error: "CLERK_SECRET_KEY is not configured"
    });
  }

  const path = req.query.path;
  const clerkPath = Array.isArray(path)
    ? path.join("/")
    : path || "";

  const targetUrl = `https://frontend-api.clerk.dev/${clerkPath}`;

  try {
    const headers = new Headers();

    // Forward incoming headers
    for (const [key, value] of Object.entries(req.headers)) {
      if (value !== undefined && key.toLowerCase() !== "host") {
        headers.set(key, Array.isArray(value) ? value.join(", ") : value);
      }
    }

    // Required Clerk proxy headers
    headers.set(
      "Clerk-Proxy-Url",
      "https://velorix-ai-web.vercel.app/__clerk"
    );

    headers.set("Clerk-Secret-Key", secretKey);

    headers.set(
      "X-Forwarded-For",
      req.headers["x-forwarded-for"] ||
        req.socket?.remoteAddress ||
        ""
    );

    const method = req.method || "GET";

    let body;

    if (!["GET", "HEAD"].includes(method)) {
      if (typeof req.body === "string") {
        body = req.body;
      } else if (req.body !== undefined && req.body !== null) {
        body = JSON.stringify(req.body);
        if (!headers.has("Content-Type")) {
          headers.set("Content-Type", "application/json");
        }
      }
    }

    const response = await fetch(targetUrl, {
      method,
      headers,
      body,
      redirect: "manual"
    });

    // Forward response headers
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    const responseBody = Buffer.from(
      await response.arrayBuffer()
    );

    return res.status(response.status).send(responseBody);
  } catch (error) {
    console.error("Clerk proxy error:", error);

    return res.status(502).json({
      error: "Clerk proxy request failed"
    });
  }
                    }
