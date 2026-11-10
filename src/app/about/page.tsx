import type { Metadata } from "next";
import Link from "next/link";
import { REPORT_REASONS } from "@/lib/categories";
import { Icon } from "@/components/ui/Icon";

export const metadata: Metadata = {
  title: "Tentang",
  description:
    "Tujuan CONFESS, aturan komunitas, dan kebijakan privasi lingkungan sekolah.",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <h1 className="page-title">Tentang CONFESS</h1>
        <p className="page-lead mt-2 max-w-2xl">
          CONFESS adalah ruang berbagi cerita anonim untuk satu lingkungan
          sekolah — tempat mengulurkan perasaan, opini, atau pengalaman tanpa
          takut dihakimi.
        </p>
      </header>

      <section className="card p-6 sm:p-7" aria-labelledby="tujuan">
        <h2 id="tujuan" className="flex items-center gap-2 text-base font-bold text-ink"><Icon name="target" className="h-4 w-4 text-primary" />Tujuan</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted">
          <li>
            Menjadi ruang berbagi cerita yang jujur di antara warga sekolah.
          </li>
          <li>
            Memberikan aman untuk ekspresi perasaan tanpa risiko bongkar
            identitas.
          </li>
          <li>
            Membangun budaya berbagi yang sehat lewat moderasi yang konsisten.
          </li>
        </ul>
      </section>

      <section className="card p-6 sm:p-7" aria-labelledby="aturan">
        <h2 id="aturan" className="flex items-center gap-2 text-base font-bold text-ink"><Icon name="book" className="h-4 w-4 text-primary" />Aturan komunitas</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted">
          <li>Confession melewati moderasi sebelum tampil publik.</li>
          <li>Maksimal 5 confession per akun per hari.</li>
          <li>Maksimal 10 komentar per akun per jam.</li>
          <li>Tidak boleh diisi konten bullying, pelecehan maupun ancaman.</li>
          <li>Jangan taruh tautan mencurigakan atau halaman berbayar.</li>
          <li>Semua interaksi didukung otentikasi anonim Firebase.</li>
        </ul>
      </section>

      <section className="card p-6 sm:p-7" aria-labelledby="lapor">
        <h2 id="lapor" className="flex items-center gap-2 text-base font-bold text-ink"><Icon name="flag" className="h-4 w-4 text-primary" />Hal yang bisa dilaporkan</h2>
        <p className="mt-2 text-sm text-muted">
          Setiap confession memiliki tombol laporan. Alasan yang tersedia:
        </p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {REPORT_REASONS.map((r) => (
            <li key={r.id} className="badge">{r.label}</li>
          ))}
        </ul>
      </section>

      <section className="card p-6 sm:p-7" aria-labelledby="privasi">
        <h2 id="privasi" className="flex items-center gap-2 text-base font-bold text-ink"><Icon name="lock" className="h-4 w-4 text-primary" />Kebijakan privasi</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted">
          <li>Tidak butuh email — akun anonim dibuat otomatis di belakang layar.</li>
          <li>
            UID anonim hanya dipakai untuk membatasi jumlah pengiriman dan
            mencegah spam. Tidak pernah tampil publik.
          </li>
          <li>Data identitas anonim tidak boleh ditampilkan maupun dibongkar.</li>
          <li>Tim moderasi melihat konten, bukan identitas komentator biasa.</li>
          <li>Koneksi dienkripsi HTTPS end-to-end.</li>
        </ul>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link href="/confess" className="btn-primary">Tulis confession</Link>
        <Link href="/feed" className="btn-ghost">Buka feed</Link>
      </div>
    </div>
  );
}
