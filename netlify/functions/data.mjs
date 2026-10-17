import { getStore } from "@netlify/blobs";

/*
  Rôles (variables d'environnement Netlify) :
  - ACCESS_CODE : code d'équipe (staff médical)  -> lecture/écriture des arrêts, cartons…
  - ADMIN_CODE  : code administration (comptable) -> salaires / IJ (clé "ij") en lecture/écriture,
                  arrêts en LECTURE SEULE, sans diagnostic ni note.
  Un utilisateur qui possède les deux codes (direction) a tous les droits.
  Le code est transmis dans l'en-tête x-access-code (connexion) et, pour l'onglet IJ,
  dans x-admin-code.
*/
const PRIVATE_KEYS = ["ij"];

export default async (req) => {
  const ACCESS = process.env.ACCESS_CODE || "";
  const ADMIN = process.env.ADMIN_CODE || "";
  const a = req.headers.get("x-access-code") || "";
  const b = req.headers.get("x-admin-code") || "";

  const isStaff = !ACCESS || (a && a === ACCESS);
  const isCompta = !!ADMIN && ((a && a === ADMIN) || (b && b === ADMIN));
  const role = isStaff ? "staff" : (isCompta ? "compta" : null);
  if (!role) return new Response("Forbidden", { status: 403 });

  const url = new URL(req.url);
  const key = (url.searchParams.get("key") || "default").replace(/[^a-z0-9_-]/gi, "");
  const store = getStore({ name: "club-data", consistency: "strong" });
  const headers = { "x-role": role + (isCompta && isStaff ? "+admin" : "") };

  // Compartiment salaires / IJ : code administration obligatoire
  if (PRIVATE_KEYS.includes(key) && !isCompta) {
    return new Response("Forbidden", { status: 403, headers });
  }

  try {
    if (req.method === "GET") {
      let data = await store.get(key, { type: "json" });
      // Profil administration seul : arrêts sans données médicales détaillées
      if (!isStaff && key === "medical" && data && Array.isArray(data.arrets)) {
        data = { ...data, arrets: data.arrets.map(x => ({ ...x, detail: "", note: "" })) };
      }
      return Response.json(data ?? null, { headers });
    }
    if (req.method === "POST" || req.method === "PUT") {
      if (!isStaff && !PRIVATE_KEYS.includes(key)) {
        return new Response("Lecture seule", { status: 405, headers });
      }
      const body = await req.json();
      await store.setJSON(key, body);
      return Response.json({ ok: true }, { headers });
    }
    return new Response("Method not allowed", { status: 405, headers });
  } catch (e) {
    return new Response("Server error: " + e.message, { status: 500, headers });
  }
};

export const config = { path: "/api/data" };
