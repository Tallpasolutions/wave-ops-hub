export default function Check() {
  return (
    <main className="min-h-screen p-8 space-y-4">
      <h1 className="font-display text-3xl text-foreground">Heading display (Poppins)</h1>
      <p className="text-foreground">Body text padrão (Manrope) — deve ficar branco sobre fundo escuro Tallpa</p>
      <p className="text-muted-foreground font-mono">Texto monospace (JetBrains) — cor secundária</p>
      <div className="bg-card border border-border rounded-lg p-4 text-card-foreground">
        Card com semantic vars do shadcn — deve ficar #0A0F22 com border sutil
      </div>
      <div className="bg-cyan text-primary-foreground rounded-tallpa-md p-4 inline-block">
        Cyan Tallpa direto + rounded-tallpa-md
      </div>
    </main>
  );
}
