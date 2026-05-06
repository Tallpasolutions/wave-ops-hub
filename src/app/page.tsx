import { TenantLogo } from "@/components/ui/TenantLogo";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm flex flex-col gap-8">
        <TenantLogo />
        <h1 className="text-4xl font-display font-bold text-center">
          Wave Ops Hub
        </h1>
        <p className="text-text-2 text-center max-w-lg font-body">
          Plataforma operacional multi-tenant para gestão de Ordens de Serviço,
          cálculo automático de pagamento de técnicos baseado em LPU e
          visualização de indicadores.
        </p>
      </div>
    </main>
  );
}
