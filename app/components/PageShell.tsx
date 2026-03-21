// app/components/PageShell.tsx
// Enveloppe commune pour toutes les pages secondaires

interface PageShellProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  wide?: boolean; // grilles de cartes
}

export default function PageShell({ title, subtitle, children, wide = false }: PageShellProps) {
  return (
    <div className={`min-h-screen bg-[#0d0d18] ${wide ? "px-6 md:px-10" : "max-w-4xl mx-auto px-6"} pt-28 pb-20`}>
      {(title || subtitle) && (
        <div className="text-center mb-12">
          {title && (
            <h1 className="font-['Outfit'] font-black text-[clamp(2.2rem,6vw,4rem)] leading-none tracking-tight text-[#F1EBDB] mb-3">
              {title}
            </h1>
          )}
          {subtitle && (
            <p className="text-[#F1EBDB]/35 font-light text-[0.78rem] tracking-[3px] uppercase">
              {subtitle}
            </p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}