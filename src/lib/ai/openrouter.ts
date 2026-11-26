/**
 * Klien OpenRouter (server only) dengan rotasi API key — dipisah per tugas AI:
 *
 *   "moderation"  = AI penilai confession (acc / revise / manual)
 *   "music"       = AI penyusun lirik & penaras musik di pemilih lagu
 *
 * Tiap tugas punya key & model sendiri, jadi kuota dan limit tidak saling
 * menabrak. Nama variabel environment per tugas = prefiks + akhiran:
 *
 * Moderasi (prefiks OPENROUTER, tetap kompatibel dengan versi lama):
 *   OPENROUTER_API_KEYS="sk-1,...,sk-5" / OPENROUTER_API_KEY_1..5 / OPENROUTER_API_KEY
 *   OPENROUTER_MODEL / OPENROUTER_FALLBACK_MODELS
 *
 * Musik (prefiks MUSIC_AI):
 *   MUSIC_AI_API_KEYS="sk-1,...,sk-5" / MUSIC_AI_API_KEY_1..5 / MUSIC_AI_API_KEY
 *   MUSIC_AI_MODEL / MUSIC_AI_FALLBACK_MODELS
 */
const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

const DEFAULT_MODERATION_MODEL = "anthropic/claude-sonnet-5.5";
const DEFAULT_MODERATION_FALLBACK = "anthropic/claude-sonnet-5";
const DEFAULT_MUSIC_MODEL = "openai/gpt-4.1-mini";
const DEFAULT_MUSIC_FALLBACK = "openai/gpt-4o-mini";

export type AiRole = "moderation" | "music";

export interface AiRoleSetup {
  /** Prefiks env, mis. "OPENROUTER" → OPENROUTER_API_KEYS. */
  env: string;
  defaultModel: string;
  defaultFallback: string;
}

const SETUPS: Record<AiRole, AiRoleSetup> = {
  moderation: {
    env: "OPENROUTER",
    defaultModel: DEFAULT_MODERATION_MODEL,
    defaultFallback: DEFAULT_MODERATION_FALLBACK,
  },
  music: {
    env: "MUSIC_AI",
    defaultModel: DEFAULT_MUSIC_MODEL,
    defaultFallback: DEFAULT_MUSIC_FALLBACK,
  },
};

function readKeys(setup: AiRoleSetup): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (raw: unknown) => {
    for (const part of String(raw ?? "").split(",")) {
      const key = part.trim();
      if (key && !seen.has(key)) {
        seen.add(key);
        out.push(key);
      }
    }
  };
  add(process.env[`${setup.env}_API_KEYS`]);
  for (const i of [1, 2, 3, 4, 5]) add(process.env[`${setup.env}_API_KEY_${i}`]);
  add(process.env[`${setup.env}_API_KEY`]);
  return out.slice(0, 5);
}

export interface AiRoleConfig {
  keys: string[];
  primary: string;
  fallbacks: string[];
}

export function roleSetup(role: AiRole): AiRoleConfig {
  const setup = SETUPS[role];
  const primary = (process.env[`${setup.env}_MODEL`] || setup.defaultModel).trim();
  const fallbacks = (process.env[`${setup.env}_FALLBACK_MODELS`] ?? setup.defaultFallback)
    .split(",")
    .map((m) => m.trim())
    .filter((m) => m && m !== primary);
  return { keys: readKeys(setup), primary, fallbacks };
}

/** Rotasi disimpan per tugas supaya key yang sehat dilayani bergantian. */
const rotate: Partial<Record<AiRole, number>> = {};

export interface ChatOk {
  text: string;
  model: string;
  /** Key ke-berapa yang berhasil (0-based). */
  keyIndex: number;
  ms: number;
}

export interface ChatOptions {
  system: string;
  user: string;
  maxTokens?: number;
  timeoutMs?: number;
  /** Batas TOTAL semua percobaan (ms). Dijaga di bawah maxDuration route supaya fungsi tidak dibunuh Vercel. */
  deadlineMs?: number;
  modelList?: string[];
  /** Ubah isi balasan model jadi teks mentah sebelum dikembalikan ke pemanggil. */
  extract?: (content: unknown) => string;
}

function extraText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((p) => (p && typeof p === "object" ? String((p as { text?: unknown }).text ?? "") : ""))
      .join("");
  }
  return "";
}

export interface RoleStatus {
  configured: boolean;
  keys: number;
  model: string;
  /** Prefiks env var yang dipakai tugas ini (mis. "MUSIC_AI"). */
  envPrefix: string;
}

export function roleStatus(role: AiRole): RoleStatus {
  const cfg = roleSetup(role);
  return {
    configured: cfg.keys.length > 0,
    keys: cfg.keys.length,
    model: cfg.primary,
    envPrefix: SETUPS[role].env,
  };
}

export interface ChatDetail {
  ok: ChatOk | null;
  error: string;
  /** Lama total panggilan (ms), juga saat gagal. */
  ms: number;
}

/**
 * Satu panggilan chat untuk satu tugas AI. Tiap key dicoba satu kali
 * (fallback model otomatis di provider lewat `models`). Bila 2+ key terisi,
 * urutan mulainya dirotasi supaya key pertama tidak terus menanggung beban.
 */
export async function openRouterChat(role: AiRole, opts: ChatOptions): Promise<ChatDetail> {
  const t0 = Date.now();
  const { keys, primary, fallbacks } = roleSetup(role);
  if (keys.length === 0) {
    const prefix = SETUPS[role].env;
    return {
      ok: null,
      ms: 0,
      error: `API key AI ${role} belum diisi di environment (${prefix}_API_KEYS atau ${prefix}_API_KEY_1).`,
    };
  }

  const models = (opts.modelList ?? [primary, ...fallbacks]).filter(Boolean).slice(0, 3);
  const start = keys.length > 1 ? (rotate[role] ?? 0) % keys.length : 0;
  const perTry = opts.timeoutMs ?? 12000;

  // Urutan percobaan: tiap key sekali; bila hanya 1 key, coba 2x (error jaringan/5xx sering sesaat).
  const order: number[] = [];
  for (let n = 0; n < keys.length; n++) order.push((start + n) % keys.length);
  if (keys.length === 1) order.push(0);
  // Tanpa deadlineMs: perilaku lama (tiap percobaan boleh pakai timeoutMs penuh).
  const deadline = t0 + (opts.deadlineMs ?? perTry * order.length);

  let last = "";
  for (let n = 0; n < order.length; n++) {
    const keyIndex = order[n];
    const remaining = deadline - Date.now();
    if (remaining < 1500) {
      last = last || "Waktu habis sebelum AI sempat membalas.";
      break;
    }
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${keys[keyIndex]}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://confess.app",
          "X-Title": "CONFESS",
        },
        body: JSON.stringify({
          model: models[0],
          // Fallback model otomatis di sisi OpenRouter bila model utama error/limit.
          ...(models.length > 1 ? { models } : {}),
          max_tokens: opts.maxTokens ?? 300,
          // Model 5.x punya mode berpikir adaptif: tanpa ini token "berpikir" bisa
          // menghabiskan max_tokens sehingga jawaban kosong / JSON terpotong.
          ...(role === "moderation" ? { reasoning: { enabled: false, exclude: true } } : {}),
          messages: [
            { role: "system", content: opts.system },
            { role: "user", content: opts.user },
          ],
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(Math.min(perTry, remaining)),
      });
      if (!res.ok) {
        const body = (await res.text().catch(() => "")).slice(0, 200);
        const hint =
          res.status === 400
            ? " (permintaan ditolak — cek ID model / parameter)"
            : res.status === 401
              ? " (API key salah/tidak aktif)"
              : res.status === 402
                ? " (kredit OpenRouter habis)"
                : res.status === 404
                  ? " (ID model tidak ditemukan)"
                  : res.status === 429
                    ? " (kena batas permintaan)"
                    : "";
        last = `OpenRouter HTTP ${res.status}${hint}: ${body}`;
        continue; // key ini bermasalah → coba key berikutnya
      }
      const data = (await res.json()) as {
        model?: string;
        error?: { message?: string };
        choices?: { finish_reason?: string; message?: { content?: unknown } }[];
      };
      if (data.error) {
        last = `OpenRouter: ${String(data.error.message ?? "error")}`.slice(0, 220);
        continue;
      }
      const choice = data.choices?.[0];
      const text = (opts.extract ?? extraText)(choice?.message?.content);
      if (!text.trim()) {
        last = `Jawaban AI kosong (finish_reason: ${choice?.finish_reason ?? "?"}, model: ${data.model ?? models[0]}).`;
        continue;
      }
      rotate[role] = keyIndex + 1; // key ini sehat → panggilan berikut mulai dari key lain
      return {
        ok: { text, model: String(data.model ?? models[0]), keyIndex, ms: Date.now() - t0 },
        error: "",
        ms: Date.now() - t0,
      };
    } catch (err) {
      last =
        (err as { name?: string }).name === "TimeoutError"
          ? `AI tidak membalas dalam ${Math.round(perTry / 1000)} detik.`
          : `Gagal menghubungi OpenRouter: ${String(err).slice(0, 120)}`;
    }
  }
  return { ok: null, error: last, ms: Date.now() - t0 };
}
