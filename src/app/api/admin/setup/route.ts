import type { NextRequest } from "next/server";
import { errorResponse } from "@/lib/security/apiHelpers";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One-time admin bootstrap: promotes a UID to admin using the shared secret
 * (ADMIN_SETUP_SECRET). Store the secret as a Vercel env var and keep it out
 * of client code. After setup, this endpoint can be disabled by clearing the
 * env var in production.
 */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const secret = process.env.ADMIN_SETUP_SECRET;
    if (!secret) {
      return Response.json(
        { error: "ADMIN_SETUP_SECRET tidak tersedia; bootstrap admin dikunci." },
        { status: 503 }
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Body tidak valid." }, { status: 400 });
    }
    const { secret: providedSecret, uid } = (body ?? {}) as {
      secret?: string;
      uid?: string;
    };

    if (
      typeof providedSecret !== "string" ||
      providedSecret.length !== secret.length ||
      !timingSafeEqual(providedSecret, secret)
    ) {
      return Response.json({ error: "Secret salah." }, { status: 403 });
    }
    if (typeof uid !== "string" || !/^[a-zA-Z0-9_-]{17,28}$/.test(uid)) {
      return Response.json({ error: "UID anonim tidak valid." }, { status: 400 });
    }

    const auth = getAdminAuth();
    auth.setCustomUserClaims(uid, { admin: true });
    await getAdminDb().collection("users").doc(uid).set(
      { uid, role: "admin", isBlocked: false, createdAt: Date.now() },
      { merge: true }
    );

    return Response.json({ ok: true, message: "UID ditetapkan sebagai admin." });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Constant-time compare without extra deps. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
