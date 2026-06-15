export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 items-center justify-center bg-muted/40 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <span className="grid size-11 place-items-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">
            T
          </span>
          <h1 className="text-xl font-semibold">Talki</h1>
          <p className="text-sm text-muted-foreground">
            Practica tu voz y oratoria con coaching en vivo
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
