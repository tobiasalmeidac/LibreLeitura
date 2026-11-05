import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { api, MENSAGEM_SESSAO_EXPIRADA, renovarSessao, sessao, type Usuario } from "./api";

type Estado = "carregando" | "anonimo" | "autenticado";

interface AuthContexto {
  estado: Estado;
  usuario: Usuario | null;
  /** Aviso para a tela de login (ex.: "Sua sessão expirou"). */
  aviso: string | null;
  entrar: (email: string, senha: string) => Promise<Usuario>;
  sair: () => Promise<void>;
  limparAviso: () => void;
}

const Contexto = createContext<AuthContexto | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [estado, setEstado] = useState<Estado>("carregando");
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // Restaura a sessão ao recarregar: o token não sobrevive ao reload (fica só em memória),
  // então usamos o cookie de refresh para obter um novo e depois GET /usuarios/me.
  useEffect(() => {
    let ativo = true;
    (async () => {
      const renovou = await renovarSessao();
      if (!renovou) {
        if (ativo) setEstado("anonimo");
        return;
      }
      try {
        const eu = await api.usuarios.me();
        if (!ativo) return;
        setUsuario(eu);
        setEstado("autenticado");
      } catch {
        sessao.limpar();
        if (ativo) setEstado("anonimo");
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    sessao.aoExpirar(() => {
      setUsuario(null);
      setEstado("anonimo");
      setAviso(MENSAGEM_SESSAO_EXPIRADA);
      queryClient.clear();
    });
    return () => sessao.aoExpirar(null);
  }, [queryClient]);

  const entrar = useCallback(
    async (email: string, senha: string) => {
      const r = await api.auth.login(email, senha);
      queryClient.clear();
      setUsuario(r.usuario);
      setEstado("autenticado");
      setAviso(null);
      return r.usuario;
    },
    [queryClient],
  );

  const sair = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      // Mesmo que a API falhe, a sessão local é encerrada.
    }
    sessao.limpar();
    queryClient.clear();
    setUsuario(null);
    setEstado("anonimo");
  }, [queryClient]);

  const limparAviso = useCallback(() => setAviso(null), []);

  const valor = useMemo(
    () => ({ estado, usuario, aviso, entrar, sair, limparAviso }),
    [estado, usuario, aviso, entrar, sair, limparAviso],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useAuth(): AuthContexto {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useAuth precisa estar dentro de AuthProvider");
  return ctx;
}

/** Versão tolerante para telas que podem renderizar fora do provedor (ex.: 404). */
export function useAuthOpcional(): AuthContexto | null {
  return useContext(Contexto);
}
