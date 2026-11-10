export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 select-none">
      <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-primary to-secondary text-white shadow-glow">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
          <path
            d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H12l-4.6 3.6A1 1 0 0 1 6 19.8V16H6.5A2.5 2.5 0 0 1 4 13.5v-8Z"
            fill="currentColor"
          />
        </svg>
      </span>
      {!compact && (
        <span className="text-lg font-extrabold tracking-tight text-ink">
          CONFESS
          <span className="text-primary">.</span>
        </span>
      )}
    </span>
  );
}
