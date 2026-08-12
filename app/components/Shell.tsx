import Link from "next/link";

export function Shell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="min-h-full">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-sm font-semibold tracking-tight text-teal-800">
            Agente de empleo
          </Link>
          <nav className="flex gap-4 text-sm text-stone-600">
            <Link href="/" className="hover:text-stone-900">
              Dashboard
            </Link>
            <Link href="/setup" className="hover:text-stone-900">
              Cargar datos
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-6 py-8">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">{title}</h1>
        {subtitle ? <p className="mt-1 text-stone-600">{subtitle}</p> : null}
        <div className="mt-6">{children}</div>
      </main>
    </div>
  );
}
