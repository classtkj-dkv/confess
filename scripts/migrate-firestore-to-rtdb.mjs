/**
 * Migrasi SATU KALI: Cloud Firestore → Firebase Realtime Database.
 * (File ini satu-satunya yang masih menyentuh Firestore; hapus setelah migrasi selesai.)
 *
 * Pakai:
 *   npm run migrate:firestore -- --dry-run     # hitung & validasi saja, tanpa menulis
 *   npm run migrate:firestore                  # backup JSON lalu tulis ke RTDB + verifikasi
 *
 * Butuh env: FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL,
 * FIREBASE_ADMIN_PRIVATE_KEY, NEXT_PUBLIC_FIREBASE_DATABASE_URL.
 * Firestore TIDAK dihapus/diubah sama sekali.
 */
import { writeFileSync } from "node:fs";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";
import { getFirestore } from "firebase-admin/firestore";

const DRY = process.argv.includes("--dry-run");

const need = (k) => {
  const v = process.env[k];
  if (!v) throw new Error(`Env ${k} belum diisi.`);
  return v;
};
const privateKey = need("FIREBASE_ADMIN_PRIVATE_KEY").replace(/\\n/g, "\n");
const app = initializeApp({
  credential: cert({
    projectId: need("FIREBASE_ADMIN_PROJECT_ID"),
    clientEmail: need("FIREBASE_ADMIN_CLIENT_EMAIL"),
    privateKey,
  }),
  databaseURL: need("NEXT_PUBLIC_FIREBASE_DATABASE_URL"),
});
const fs = getFirestore(app);
const rtdb = getDatabase(app);
const auth = getAuth(app);

/** Firestore Timestamp / Date / number → Unix ms. */
function ms(v) {
  if (typeof v === "number") return v;
  if (v && typeof v.toMillis === "function") return v.toMillis();
  if (v instanceof Date) return v.getTime();
  return 0;
}

/** Hapus nilai undefined/ Timestamp bersarang supaya aman untuk RTDB. */
function clean(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    out[k] = v && typeof v.toMillis === "function" ? v.toMillis() : v;
  }
  return out;
}

async function readAll(name) {
  const snap = await fs.collection(name).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

const publicConfession = (id, c) => ({
  id,
  message: String(c.message ?? ""),
  messageLower: String(c.messageLower ?? String(c.message ?? "").toLowerCase()),
  category: String(c.category ?? "random"),
  createdAt: ms(c.createdAt),
  likesCount: Number(c.likesCount ?? 0),
  commentsCount: Number(c.commentsCount ?? 0),
});

async function main() {
  console.log(DRY ? "== DRY RUN (tidak menulis apa pun) ==" : "== MIGRASI ==");

  const [confessions, comments, reactions, reports, users, settingsDocs] = await Promise.all([
    readAll("confessions"),
    readAll("comments"),
    readAll("reactions"),
    readAll("reports"),
    readAll("users"),
    readAll("settings"),
  ]);

  const before = {
    confessions: confessions.length,
    comments: comments.length,
    reactions: reactions.length,
    reports: reports.length,
    users: users.length,
  };
  console.table(before);

  // ---- Backup JSON (sebelum menulis) ----
  if (!DRY) {
    const file = `backup-firestore-${Date.now()}.json`;
    writeFileSync(
      file,
      JSON.stringify({ confessions, comments, reactions, reports, users, settingsDocs }, (k, v) =>
        v && typeof v.toMillis === "function" ? v.toMillis() : v, 2)
    );
    console.log(`Backup tersimpan: ${file}  (SIMPAN file ini!)`);
  }

  const updates = {};
  const publishedIds = new Set();

  for (const c of confessions) {
    const rec = clean({
      id: c.id,
      message: String(c.message ?? ""),
      messageLower: String(c.messageLower ?? String(c.message ?? "").toLowerCase()),
      category: String(c.category ?? "random"),
      authorUid: String(c.authorUid ?? ""),
      status: ["PENDING", "PUBLISHED", "REJECTED"].includes(c.status) ? c.status : "PENDING",
      likesCount: Number(c.likesCount ?? 0),
      commentsCount: Number(c.commentsCount ?? 0),
      createdAt: ms(c.createdAt),
      updatedAt: ms(c.updatedAt) || ms(c.createdAt),
    });
    updates[`confessions/${c.id}`] = rec;
    if (rec.status === "PUBLISHED") {
      publishedIds.add(c.id);
      updates[`public/confessions/${c.id}`] = publicConfession(c.id, rec);
    }
  }

  let visibleComments = 0;
  for (const c of comments) {
    const rec = clean({
      id: c.id,
      confessionId: String(c.confessionId ?? ""),
      authorUid: String(c.authorUid ?? ""),
      message: String(c.message ?? ""),
      status: c.status === "HIDDEN" ? "HIDDEN" : "VISIBLE",
      createdAt: ms(c.createdAt),
    });
    updates[`comments/${c.id}`] = rec;
    if (rec.status === "VISIBLE" && publishedIds.has(rec.confessionId)) {
      visibleComments++;
      updates[`public/comments/${rec.confessionId}/${c.id}`] = {
        id: c.id,
        confessionId: rec.confessionId,
        message: rec.message,
        createdAt: rec.createdAt,
      };
    }
  }

  let reactionsWritten = 0;
  for (const r of reactions) {
    const cid = String(r.confessionId ?? "");
    const uid = String(r.userUid ?? "");
    if (!cid || !uid) continue;
    reactionsWritten++;
    updates[`reactions/${cid}/${uid}`] = { type: r.type ?? "like", createdAt: ms(r.createdAt) };
  }

  for (const r of reports) {
    updates[`reports/${r.id}`] = clean({
      id: r.id,
      confessionId: String(r.confessionId ?? ""),
      reporterUid: String(r.reporterUid ?? ""),
      reason: String(r.reason ?? ""),
      detail: String(r.detail ?? ""),
      status: ["OPEN", "RESOLVED", "DISMISSED"].includes(r.status) ? r.status : "OPEN",
      createdAt: ms(r.createdAt),
    });
  }

  // Users + email dari Auth. Role staff → set Custom Claim (otorisasi) + profil DB.
  const claimTargets = [];
  const emailByUid = new Map();
  for (let i = 0; i < users.length; i += 100) {
    const chunk = users.slice(i, i + 100).map((u) => ({ uid: u.id }));
    try {
      const res = await auth.getUsers(chunk);
      res.users.forEach((u) => emailByUid.set(u.uid, u.email ?? ""));
    } catch (e) {
      console.warn("getUsers gagal untuk satu batch:", e.message);
    }
  }
  for (const u of users) {
    const role = ["owner", "admin", "moderator"].includes(u.role) ? u.role : "user";
    const created = ms(u.createdAt) || Date.now();
    updates[`users/${u.id}`] = {
      uid: u.id,
      email: emailByUid.get(u.id) ?? "",
      displayName: String(u.displayName ?? ""),
      role,
      status: u.isBlocked === true ? "blocked" : "active",
      isBlocked: u.isBlocked === true,
      createdAt: created,
      updatedAt: Date.now(),
    };
    if (role !== "user" && emailByUid.get(u.id)) claimTargets.push({ uid: u.id, role });
  }

  // Settings: settings/app (Firestore) → settings/general (RTDB)
  const old = settingsDocs.find((d) => d.id === "app") ?? {};
  updates["settings/general"] = {
    websiteName: "CONFESS",
    announcement: String(old.announcement ?? ""),
    maintenanceMode: old.maintenanceMode === true,
    allowComments: old.allowComments !== false,
    allowConfessions: true,
    maxConfessionLength: 1000,
    dailySubmissionLimit: 5,
    updatedAt: Date.now(),
  };

  console.log(
    `Rencana tulis: ${Object.keys(updates).length} path | published=${publishedIds.size} | komentar tampil=${visibleComments} | reaksi=${reactionsWritten} | claim staff=${claimTargets.length}`
  );
  if (DRY) {
    console.log("Dry run selesai. Jalankan tanpa --dry-run untuk menulis.");
    return;
  }

  // Tulis per 400 path agar aman terhadap batas ukuran request.
  const entries = Object.entries(updates);
  for (let i = 0; i < entries.length; i += 400) {
    await rtdb.ref().update(Object.fromEntries(entries.slice(i, i + 400)));
    process.stdout.write(`\rDitulis ${Math.min(i + 400, entries.length)}/${entries.length}`);
  }
  console.log();

  for (const t of claimTargets) {
    const u = await auth.getUser(t.uid);
    await auth.setCustomUserClaims(t.uid, { ...(u.customClaims ?? {}), role: t.role });
    console.log(`Claim role=${t.role} → ${t.uid}`);
  }

  // ---- Verifikasi jumlah ----
  const count = async (p) => (await rtdb.ref(p).get()).numChildren();
  const after = {
    confessions: await count("confessions"),
    comments: await count("comments"),
    reactions: (await rtdb.ref("reactions").get()).val()
      ? Object.values((await rtdb.ref("reactions").get()).val()).reduce((n, v) => n + Object.keys(v).length, 0)
      : 0,
    reports: await count("reports"),
    users: await count("users"),
  };
  console.table({ firestore: before, rtdb: after });
  const ok = Object.keys(before).every((k) => before[k] === after[k] || (k === "reactions" && after[k] === reactionsWritten));
  if (!ok) {
    console.error("❌ Jumlah data TIDAK cocok. Jangan hapus Firestore. Periksa backup & log di atas.");
    process.exit(1);
  }
  console.log("✅ Migrasi terverifikasi. Firestore TIDAK dihapus — hapus manual setelah kamu yakin.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
