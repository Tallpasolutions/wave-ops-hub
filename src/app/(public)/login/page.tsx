import { TenantLogo } from "@/components/ui/TenantLogo";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-[400px] rounded-xl border border-line bg-bg-1 p-8 shadow-card flex flex-col items-center gap-6 relative overflow-hidden">
        {/* Glow effect topo do card */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-grad opacity-70" />
        
        <TenantLogo />
        
        <div className="text-center">
          <h1 className="text-2xl font-display font-bold">Acesso ao Hub</h1>
          <p className="text-text-2 text-sm mt-1">Entre com suas credenciais para continuar</p>
        </div>

        <form className="w-full flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-semibold uppercase tracking-[1.5px] text-text-3">
              E-mail
            </label>
            <input 
              type="email" 
              placeholder="seu@email.com"
              className="w-full bg-[#0D1530] border border-line rounded-md px-4 py-2.5 text-sm outline-none focus:border-cyan transition-colors"
            />
          </div>
          
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-semibold uppercase tracking-[1.5px] text-text-3">
              Senha
            </label>
            <input 
              type="password" 
              placeholder="••••••••"
              className="w-full bg-[#0D1530] border border-line rounded-md px-4 py-2.5 text-sm outline-none focus:border-cyan transition-colors"
            />
          </div>

          <button 
            type="button"
            className="mt-4 w-full bg-grad text-[#051127] font-bold py-3 rounded-lg text-sm hover:opacity-90 transition-opacity"
          >
            Entrar na plataforma
          </button>
        </form>
      </div>
    </main>
  );
}
