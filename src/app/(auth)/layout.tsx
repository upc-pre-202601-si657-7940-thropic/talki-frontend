import { Video } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-background via-background to-background">
      {/* Gradientes radiales de fondo */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(at_20%_30%,oklch(0.8_0.15_280)_0px,transparent_50%),radial-gradient(at_80%_20%,oklch(0.8_0.12_200)_0px,transparent_50%),radial-gradient(at_50%_80%,oklch(0.8_0.13_340)_0px,transparent_50%)]" />

      {/* Orbes flotantes */}
      <div className="pointer-events-none absolute -top-32 -left-32 size-96 rounded-full bg-primary/40 blur-[80px] animate-float [animation-delay:0s]" />
      <div className="pointer-events-none absolute top-1/4 -right-24 size-80 rounded-full bg-secondary/60 blur-[80px] animate-float [animation-delay:7s]" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 size-72 rounded-full bg-accent/50 blur-[80px] animate-float [animation-delay:14s]" />

      <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-sm flex flex-col items-center">
          {/* Logo */}
          <div className="mb-8 flex items-center gap-3">
            <div className="flex items-center justify-center size-12 rounded-xl bg-gradient-to-br from-primary to-orange-400 shadow-lg">
              <Video className="size-6 text-white" />
            </div>
            <span className="text-3xl font-bold bg-gradient-to-r from-primary to-orange-400 bg-clip-text text-transparent">
              Talki
            </span>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
