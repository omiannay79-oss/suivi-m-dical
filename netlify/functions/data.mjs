import { getStore } from "@netlify/blobs";

export default async (req) => {
  const required = process.env.ACCESS_CODE;
  if (required) {
    const provided = req.headers.get("x-access-code");
    if (provided !== required) {
      return new Response("Forbidden", { status: 403 });
    }
  }

  const url = new URL(req.url);
  const key = (url.searchParams.get("key") || "default").replace(/[^a-z0-9_-]/gi, "");
  const store = getStore({ name: "club-data", consistency: "strong" });

  try {
    if (req.method === "GET") {
      const data = await store.get(key, { type: "json" });
      return Response.json(data ?? null);
    }
    if (req.method === "POST" || req.method === "PUT") {
      const body = await req.json();
      await store.setJSON(key, body);
      return Response.json({ ok: true });
    }
    return new Response("Method not allowed", { status: 405 });
  } catch (e) {
    return new Response("Server error: " + e.message, { status: 500 });
  }
};

export const config = { path: "/api/data" };
