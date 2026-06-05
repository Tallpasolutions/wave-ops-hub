// Página de referência viva dos primitivos UI.
// Disponível apenas em desenvolvimento. NÃO usar em produção.
// Atualizar sempre que adicionar/modificar componentes em src/components/ui/.

import { notFound } from "next/navigation";
import { ComponentsDemo } from "./ComponentsDemo";

export const dynamic = 'force-dynamic'

export default function ComponentsDevPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }
  return <ComponentsDemo />;
}
