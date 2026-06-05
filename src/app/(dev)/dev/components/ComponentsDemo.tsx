"use client";

// Página de referência viva dos primitivos UI.
// Disponível apenas em desenvolvimento. NÃO usar em produção.
// Atualizar sempre que adicionar/modificar componentes em src/components/ui/.

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const demoSchema = z.object({
  email: z.string().email("Email inválido"),
  role: z.string().min(1, "Selecione um papel"),
});

type DemoFormValues = z.infer<typeof demoSchema>;

const TABLE_ROWS = [
  {
    os: "OS-2024-001",
    tecnico: "Marcos Silva",
    status: "Finalizado",
    valor: "R$ 120,00",
  },
  {
    os: "OS-2024-002",
    tecnico: "Ana Costa",
    status: "Improdutiva",
    valor: "R$ 30,00",
  },
  {
    os: "OS-2024-003",
    tecnico: "Pedro Lima",
    status: "Pendente",
    valor: "—",
  },
  {
    os: "OS-2024-004",
    tecnico: "Julia Ramos",
    status: "Finalizado",
    valor: "R$ 85,00",
  },
  {
    os: "OS-2024-005",
    tecnico: "Carlos Neves",
    status: "Finalizado",
    valor: "R$ 150,00",
  },
];

export function ComponentsDemo() {
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState<DemoFormValues | null>(null);

  const form = useForm<DemoFormValues>({
    resolver: zodResolver(demoSchema),
    defaultValues: { email: "", role: "" },
  });

  function onSubmit(values: DemoFormValues) {
    setSubmitted(values);
  }

  function simulateLoading() {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 2000);
  }

  return (
    <main className="min-h-screen px-8 py-12">
      <div className="mx-auto max-w-4xl space-y-12">
        <header>
          <h1 className="font-display text-3xl font-bold text-foreground">
            Primitivos UI
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            shadcn/ui · estilo new-york · tokens Tallpa · dark-only
          </p>
        </header>

        <Separator />

        {/* ── Button ── */}
        <section className="space-y-4">
          <h2 className="font-display text-lg font-semibold">Button</h2>
          <div className="flex flex-wrap gap-3">
            <Button>Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
            <Button variant="destructive">Destructive</Button>
            <Button disabled>Disabled</Button>
            <Button onClick={simulateLoading} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Carregando
                </>
              ) : (
                "Loading (clique)"
              )}
            </Button>
            <Button size="sm">Small</Button>
            <Button size="lg">Large</Button>
            <Button size="icon" aria-label="chevron">
              <ChevronDown size={16} />
            </Button>
          </div>
        </section>

        <Separator />

        {/* ── Input + Label ── */}
        <section className="space-y-4">
          <h2 className="font-display text-lg font-semibold">Input + Label</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="input-default">Email</Label>
              <Input
                id="input-default"
                type="email"
                placeholder="usuario@tallpa.com.br"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="input-disabled">Desabilitado</Label>
              <Input
                id="input-disabled"
                placeholder="Não editável"
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="input-error" className="text-destructive">
                Com erro
              </Label>
              <Input
                id="input-error"
                placeholder="Campo inválido"
                aria-invalid
                className="border-destructive focus-visible:ring-destructive"
              />
            </div>
          </div>
        </section>

        <Separator />

        {/* ── Badge ── */}
        <section className="space-y-4">
          <h2 className="font-display text-lg font-semibold">Badge</h2>
          <div className="flex flex-wrap gap-2">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="destructive">Destructive</Badge>
          </div>
        </section>

        <Separator />

        {/* ── Separator ── */}
        <section className="space-y-4">
          <h2 className="font-display text-lg font-semibold">Separator</h2>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Horizontal</p>
            <Separator />
          </div>
          <div className="flex h-8 items-center gap-4">
            <span className="text-sm text-muted-foreground">Vertical:</span>
            <span className="text-sm">Item A</span>
            <Separator orientation="vertical" />
            <span className="text-sm">Item B</span>
            <Separator orientation="vertical" />
            <span className="text-sm">Item C</span>
          </div>
        </section>

        <Separator />

        {/* ── Card ── */}
        <section className="space-y-4">
          <h2 className="font-display text-lg font-semibold">Card</h2>
          <Card className="max-w-sm">
            <CardHeader>
              <CardTitle>KPI de exemplo</CardTitle>
              <CardDescription>Ordens de serviço no mês</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="font-display text-4xl font-bold text-cyan">857</p>
            </CardContent>
            <CardFooter>
              <Badge variant="secondary">28,6 / dia</Badge>
            </CardFooter>
          </Card>
        </section>

        <Separator />

        {/* ── DropdownMenu ── */}
        <section className="space-y-4">
          <h2 className="font-display text-lg font-semibold">DropdownMenu</h2>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                Ações <ChevronDown size={14} className="ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Gerenciar OS</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Ver detalhes</DropdownMenuItem>
              <DropdownMenuItem>Editar</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive">
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </section>

        <Separator />

        {/* ── Table ── */}
        <section className="space-y-4">
          <h2 className="font-display text-lg font-semibold">Table</h2>
          <Table>
            <TableCaption>5 últimas ordens de serviço</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>OS</TableHead>
                <TableHead>Técnico</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {TABLE_ROWS.map((row) => (
                <TableRow key={row.os}>
                  <TableCell className="font-mono text-sm">{row.os}</TableCell>
                  <TableCell>{row.tecnico}</TableCell>
                  <TableCell>{row.status}</TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {row.valor}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>

        <Separator />

        {/* ── Form + Select (react-hook-form + Zod) ── */}
        <section className="space-y-4">
          <h2 className="font-display text-lg font-semibold">
            Form + Select (react-hook-form + Zod)
          </h2>
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>Adicionar usuário</CardTitle>
              <CardDescription>2 campos validados por Zod.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-6"
                >
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="usuario@tallpa.com.br"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Email corporativo do usuário.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Papel</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione um papel" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="tenant_owner">Owner</SelectItem>
                            <SelectItem value="tenant_manager">
                              Manager
                            </SelectItem>
                            <SelectItem value="tenant_technician">
                              Técnico
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full">
                    Salvar
                  </Button>
                </form>
              </Form>
            </CardContent>
            {submitted && (
              <CardFooter>
                <pre className="w-full overflow-auto rounded-md bg-muted p-3 font-mono text-xs text-muted-foreground">
                  {JSON.stringify(submitted, null, 2)}
                </pre>
              </CardFooter>
            )}
          </Card>
        </section>
      </div>
    </main>
  );
}
