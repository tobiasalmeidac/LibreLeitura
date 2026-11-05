import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  BookCopy,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Settings,
  UserCircle,
  Users,
  UsersRound,
} from "lucide-react";
import type { ReactNode } from "react";

import { Logo } from "@/components/Logo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth";

const itens = [
  { to: "/gestor", rotulo: "Painel", icone: LayoutDashboard, exato: true },
  { to: "/gestor/balcao", rotulo: "Balcão", icone: ArrowLeftRight },
  { to: "/gestor/emprestimos", rotulo: "Empréstimos", icone: ListChecks },
  { to: "/gestor/acervo", rotulo: "Acervo", icone: BookCopy },
  { to: "/gestor/leitores", rotulo: "Leitores", icone: Users },
  { to: "/gestor/equipe", rotulo: "Equipe", icone: UsersRound },
  { to: "/gestor/configuracoes", rotulo: "Configurações", icone: Settings },
  { to: "/meus-dados", rotulo: "Meus dados", icone: UserCircle },
] as const;

export function LayoutGestor({ children }: { children: ReactNode }) {
  const { usuario, sair } = useAuth();
  const navigate = useNavigate();
  const caminho = useRouterState({ select: (s) => s.location.pathname });

  async function aoSair() {
    await sair();
    navigate({ to: "/login" });
  }

  return (
    <SidebarProvider>
      <Sidebar collapsible="offcanvas">
        <SidebarHeader className="px-3 py-4">
          <Logo claro />
        </SidebarHeader>
        <SidebarSeparator />
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {itens.map((item) => {
                  const ativo =
                    "exato" in item && item.exato
                      ? caminho === item.to || caminho === `${item.to}/`
                      : caminho === item.to || caminho.startsWith(`${item.to}/`);
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton asChild isActive={ativo} className="h-9">
                        <Link to={item.to} aria-current={ativo ? "page" : undefined}>
                          <item.icone aria-hidden="true" />
                          <span>{item.rotulo}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="gap-2 p-3">
          {usuario && (
            <div className="rounded-md bg-sidebar-accent px-3 py-2 text-xs">
              <p className="truncate font-medium text-sidebar-accent-foreground">{usuario.nome}</p>
              <p className="truncate text-sidebar-foreground/70">{usuario.email}</p>
            </div>
          )}
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={aoSair} className="h-9">
                <LogOut aria-hidden="true" />
                <span>Sair</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="bg-background">
        <header className="sticky top-0 z-20 flex h-12 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur md:hidden">
          <SidebarTrigger />
          <span className="text-sm font-medium">LibreLeitura</span>
        </header>
        <main id="conteudo" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

export function CabecalhoPagina({ titulo, descricao, acoes }: { titulo: string; descricao?: string; acoes?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
        {descricao && <p className="mt-1 text-sm text-muted-foreground">{descricao}</p>}
      </div>
      {acoes && <div className="flex gap-2">{acoes}</div>}
    </div>
  );
}
