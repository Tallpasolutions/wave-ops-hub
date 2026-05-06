import { TenantLogo } from "@/components/ui/TenantLogo";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 flex flex-col items-center gap-6">
        <TenantLogo />
        <h1 className="text-4xl font-display font-bold text-center text-red">
          404 - Página Não Encontrada
        </h1>
        <p className="text-text-2 text-center max-w-lg font-body">
          A página que você tentou acessar não existe ou foi movida.
        </p>
        <Link 
          href="/" 
          className="mt-8 px-6 py-3 bg-line-strong hover:bg-line rounded-lg font-body font-medium transition-colors"
        >
          Voltar ao Início
        </Link>
      </div>
    </main>
  );
}
