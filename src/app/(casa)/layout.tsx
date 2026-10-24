export default function CasaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-theme="casa" className="min-h-dvh bg-bg text-ink">
      {children}
    </div>
  );
}
