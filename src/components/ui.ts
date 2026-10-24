/** Shared Tailwind class names, themed by the section's CSS variables. */
export const ui = {
  page: "mx-auto max-w-2xl px-4 pb-[max(env(safe-area-inset-bottom),2rem)]",
  card: "rounded-2xl border border-line bg-surface p-4 shadow-sm",
  primary:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-brand px-5 font-semibold text-brand-ink shadow-sm active:opacity-80 disabled:opacity-50",
  secondary:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-line bg-surface px-5 font-semibold text-ink active:bg-line disabled:opacity-50",
  danger:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-danger/30 bg-surface px-5 font-semibold text-danger active:bg-danger/10",
  input:
    "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none",
  label: "mb-1 block text-sm font-medium text-muted",
  error: "rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger",
};
