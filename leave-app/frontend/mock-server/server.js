const http = require("http");
const { URL } = require("url");

const PORT = process.env.PORT || 8080;
const DEV_TOKEN = "dev-token-123";

let users = [
  {
    id: "u1",
    email: "alice@example.com",
    role: "admin",
    allowances: { sick: 10, annual: 14, casual: 7 },
  },
  {
    id: "u2",
    email: "bob@example.com",
    role: "user",
    allowances: { sick: 5, annual: 10, casual: 5 },
  },
];

let leaves = [
  {
    id: "L1",
    userId: "u2",
    userEmail: "bob@example.com",
    type: "annual",
    startDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10)
      .toISOString()
      .slice(0, 10),
    endDate: new Date(Date.now() - 1000 * 60 * 60 * 8)
      .toISOString()
      .slice(0, 10),
    reason: "Vacation",
    status: "approved",
    createdAt: new Date().toISOString(),
  },
];

let holidays = [
  {
    id: "h1",
    date: "2026-01-01",
    name: "New Year's Day",
  },
  {
    id: "h2",
    date: "2026-04-14",
    name: "Sinhala & Tamil New Year",
  },
];

function sendJSON(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(data);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let buf = "";
    req.on("data", (chunk) => (buf += chunk));
    req.on("end", () => {
      if (!buf) return resolve(null);
      try {
        resolve(JSON.parse(buf));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function authOK(req) {
  const a = req.headers["authorization"] || "";
  if (!a.startsWith("Bearer ")) return false;
  const token = a.slice("Bearer ".length);
  // Allow any token in dev, but accept dev token specifically for mock behaviours
  return !!token;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  console.log(
    `[mock-server] ${req.method} ${url.pathname} - Host: ${req.headers.host}`,
  );
  // Basic CORS for local dev
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") return sendJSON(res, 204, {});

  // Only handle /api/*
  if (!url.pathname.startsWith("/api")) {
    sendJSON(res, 404, { error: "Not found" });
    return;
  }

  // simple routing
  const parts = url.pathname
    .replace(/^\/api\/?/, "")
    .split("/")
    .filter(Boolean);

  try {
    // debug log of path parts
    const partsDebug = url.pathname
      .replace(/^\/api\/?/, "")
      .split("/")
      .filter(Boolean);
    if (partsDebug.length) console.log("[mock-server] parts:", partsDebug);
    if (parts.length === 1 && parts[0] === "me" && req.method === "GET") {
      if (!authOK(req)) return sendJSON(res, 401, { error: "Unauthorized" });
      // return first user as current
      return sendJSON(res, 200, users[0]);
    }

    if (parts.length === 1 && parts[0] === "users" && req.method === "GET") {
      if (!authOK(req)) return sendJSON(res, 401, { error: "Unauthorized" });
      return sendJSON(res, 200, users);
    }

    if (
      parts.length === 2 &&
      parts[0] === "admin" &&
      parts[1] === "allowances" &&
      req.method === "PUT"
    ) {
      if (!authOK(req)) return sendJSON(res, 401, { error: "Unauthorized" });
      const body = await parseBody(req);
      users = users.map((u) => ({ ...u, allowances: body }));
      return sendJSON(res, 204, {});
    }

    if (parts.length === 1 && parts[0] === "holidays" && req.method === "GET") {
      // GET /api/holidays
      if (!authOK(req)) return sendJSON(res, 401, { error: "Unauthorized" });
      return sendJSON(res, 200, holidays);
    }

    if (parts[0] === "leaves") {
      // GET /api/leaves
      if (parts.length === 1 && req.method === "GET") {
        if (!authOK(req)) return sendJSON(res, 401, { error: "Unauthorized" });
        return sendJSON(res, 200, leaves);
      }

      // POST /api/leaves
      if (parts.length === 1 && req.method === "POST") {
        if (!authOK(req)) return sendJSON(res, 401, { error: "Unauthorized" });
        const body = await parseBody(req);
        const id = "m" + Math.random().toString(36).slice(2, 9);
        const user = users.find((u) => u.role === "user") || users[0];
        const newLeave = {
          id,
          userId: user.id,
          userEmail: user.email,
          status: "pending",
          createdAt: new Date().toISOString(),
          ...body,
        };
        leaves.push(newLeave);
        return sendJSON(res, 201, newLeave);
      }

      // routes with id
      const id = parts[1];
      if (id && parts.length >= 2) {
        const idx = leaves.findIndex((l) => l.id === id);
        if (req.method === "PUT" && parts.length === 2) {
          if (!authOK(req))
            return sendJSON(res, 401, { error: "Unauthorized" });
          const body = await parseBody(req);
          if (idx === -1) return sendJSON(res, 404, { error: "Not found" });
          leaves[idx] = { ...leaves[idx], ...body };
          return sendJSON(res, 200, leaves[idx]);
        }

        if (req.method === "DELETE" && parts.length === 2) {
          if (!authOK(req))
            return sendJSON(res, 401, { error: "Unauthorized" });
          if (idx === -1) return sendJSON(res, 404, { error: "Not found" });
          leaves.splice(idx, 1);
          return sendJSON(res, 204, {});
        }

        if (
          parts.length === 3 &&
          req.method === "POST" &&
          parts[2] === "approve"
        ) {
          if (!authOK(req))
            return sendJSON(res, 401, { error: "Unauthorized" });
          if (idx === -1) return sendJSON(res, 404, { error: "Not found" });
          const body = await parseBody(req);
          leaves[idx].status = "approved";
          leaves[idx].approverComment = body?.comment;
          return sendJSON(res, 200, leaves[idx]);
        }

        if (
          parts.length === 3 &&
          req.method === "POST" &&
          parts[2] === "reject"
        ) {
          if (!authOK(req))
            return sendJSON(res, 401, { error: "Unauthorized" });
          if (idx === -1) return sendJSON(res, 404, { error: "Not found" });
          const body = await parseBody(req);
          leaves[idx].status = "rejected";
          leaves[idx].approverComment = body?.comment;
          return sendJSON(res, 200, leaves[idx]);
        }
      }
    }

    sendJSON(res, 404, { error: "Not found" });
  } catch (err) {
    console.error("mock-server error", err);
    sendJSON(res, 500, {
      error: String(err && err.message ? err.message : err),
    });
  }
});

server.listen(PORT, () => {
  console.log(`Mock API server running on http://localhost:${PORT}`);
});
