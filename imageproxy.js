/* ===== VELORIX PART 1 START — api/api.js (Image Proxy) =====
   POST /api/api
   body: { prompt, provider, key, model? }
   provider: "together" | "fal" | "replicate"
   returns: { ok:true, url:"..." } या { ok:false, error:"..." }
============================================================= */

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: false, error: "POST only" }));
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (e) {
      body = {};
    }
  }
  if (!body || typeof body !== "object") {
    body = {};
  }

  var prompt = String(body.prompt || "").trim();
  var provider = String(body.provider || "together").toLowerCase();
  var key = String(body.key || "").trim();
  var model = body.model ? String(body.model) : "";

  if (!prompt) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: false, error: "prompt missing" }));
  }
  if (!key) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: false, error: "key missing" }));
  }

  try {
    var url = null;

    if (provider === "together" || provider === "tgp") {
      url = await genTogether(prompt, key, model);
    } else if (provider === "fal") {
      url = await genFal(prompt, key, model);
    } else if (provider === "replicate" || provider === "repl") {
      url = await genReplicate(prompt, key, model);
    } else {
      /* unknown → try together then fail */
      try {
        url = await genTogether(prompt, key, model);
      } catch (e1) {
        try {
          url = await genFal(prompt, key, model);
        } catch (e2) {
          url = await genReplicate(prompt, key, model);
        }
      }
    }

    if (!url) {
      res.statusCode = 502;
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify({ ok: false, error: "no image url" }));
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: true, url: url, provider: provider }));
  } catch (err) {
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json");
    return res.end(
      JSON.stringify({
        ok: false,
        error: (err && err.message) || "proxy failed",
        provider: provider
      })
    );
  }
};

async function genTogether(prompt, key, model) {
  var mod = model || "black-forest-labs/FLUX.1-schnell-Free";
  var r = await fetch("https://api.together.xyz/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + key,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: mod,
      prompt: prompt,
      width: 1024,
      height: 1024,
      n: 1
    })
  });
  var t = await r.text();
  var j = {};
  try {
    j = JSON.parse(t);
  } catch (e) {}
  if (!r.ok) {
    throw new Error(
      "Together " + r.status + ": " + (j.error && (j.error.message || j.error) || t).toString().slice(0, 180)
    );
  }
  var url =
    (j.data && j.data[0] && (j.data[0].url || j.data[0].b64_json)) ||
    null;
  if (url && String(url).indexOf("http") !== 0 && String(url).length > 100) {
    url = "data:image/png;base64," + url;
  }
  if (!url) throw new Error("Together: empty");
  return url;
}

async function genFal(prompt, key, model) {
  var path = model || "fal-ai/flux/schnell";
  var r = await fetch("https://fal.run/" + path, {
    method: "POST",
    headers: {
      Authorization: "Key " + key,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      prompt: prompt,
      image_size: "square_hd",
      num_images: 1
    })
  });
  var t = await r.text();
  var j = {};
  try {
    j = JSON.parse(t);
  } catch (e) {}
  if (!r.ok) {
    throw new Error(
      "fal " + r.status + ": " + (j.detail || j.message || t).toString().slice(0, 180)
    );
  }
  var url =
    (j.images && j.images[0] && j.images[0].url) ||
    (j.image && j.image.url) ||
    null;
  if (!url) throw new Error("fal: empty");
  return url;
}

async function genReplicate(prompt, key, model) {
  var versionModel =
    model ||
    "black-forest-labs/flux-schnell";
  /* create prediction */
  var r = await fetch("https://api.replicate.com/v1/models/" + versionModel + "/predictions", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
      Prefer: "wait=60"
    },
    body: JSON.stringify({
      input: {
        prompt: prompt,
        num_outputs: 1,
        aspect_ratio: "1:1",
        output_format: "webp"
      }
    })
  });
  var t = await r.text();
  var j = {};
  try {
    j = JSON.parse(t);
  } catch (e) {}
  if (!r.ok) {
    throw new Error(
      "Replicate " + r.status + ": " + (j.detail || j.title || t).toString().slice(0, 180)
    );
  }

  /* Prefer: wait may return output directly */
  if (j.output) {
    var out = j.output;
    if (Array.isArray(out) && out[0]) return out[0];
    if (typeof out === "string") return out;
  }

  /* poll if needed */
  var getUrl = j.urls && j.urls.get;
  if (!getUrl) throw new Error("Replicate: no output");
  for (var i = 0; i < 30; i++) {
    await sleep(2000);
    var r2 = await fetch(getUrl, {
      headers: { Authorization: "Bearer " + key }
    });
    var t2 = await r2.text();
    var j2 = {};
    try {
      j2 = JSON.parse(t2);
    } catch (e) {}
    if (j2.status === "succeeded" && j2.output) {
      var o = j2.output;
      if (Array.isArray(o) && o[0]) return o[0];
      if (typeof o === "string") return o;
    }
    if (j2.status === "failed" || j2.status === "canceled") {
      throw new Error("Replicate: " + (j2.error || j2.status));
    }
  }
  throw new Error("Replicate: timeout");
}

function sleep(ms) {
  return new Promise(function (r) {
    setTimeout(r, ms);
  });
}

/* ===== PART 1 END — api/api.js ===== */
/* NEXT PART 2: create.html → fetch("/api/api") instead of direct Together/fal/Replicate */