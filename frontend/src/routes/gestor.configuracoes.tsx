import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { AlertaErro, CampoTexto } from "@/components/Campos";
import { CarregandoLinhas, EstadoErro } from "@/components/Estados";
import { CabecalhoPagina } from "@/components/layout/LayoutGestor";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api, type Configuracao } from "@/lib/api";
import { aplicarErrosDaApi } from "@/lib/formularios";

export const Route = createFileRoute("/gestor/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — LibreLeitura" },
      { name: "description", content: "Prazo padrão, limites de empréstimo e janela de aviso de vencimento." },
      { property: "og:title", content: "Configurações — LibreLeitura" },
      { property: "og:description", content: "Prazo padrão, limites de empréstimo e janela de aviso de vencimento." },
    ],
  }),
  component: Configuracoes,
});

const numeroEntre = (min: number, max: number, rotulo: string) =>
  z
    .string()
    .refine((v) => /^\d+$/.test(v.trim()) && Number(v) >= min && Number(v) <= max, `${rotulo} deve estar entre ${min} e ${max}.`);

const esquema = z.object({
  prazoPadraoDias: numeroEntre(1, 365, "O prazo"),
  maxEmprestimosPorLeitor: numeroEntre(1, 50, "O limite"),
  bloquearLeitorComAtraso: z.boolean(),
  diasAvisoVencimento: numeroEntre(0, 30, "A janela de aviso"),
});
type Dados = z.infer<typeof esquema>;

// Campos da API (422) → campos do formulário.
const CAMPOS_API: Record<string, keyof Dados> = {
  prazo_padrao_dias: "prazoPadraoDias",
  max_emprestimos_por_leitor: "maxEmprestimosPorLeitor",
  bloquear_leitor_com_atraso: "bloquearLeitorComAtraso",
  dias_aviso_vencimento: "diasAvisoVencimento",
};

function Configuracoes() {
  const consulta = useQuery({ queryKey: ["configuracao"], queryFn: api.configuracao.obter });

  return (
    <div className="max-w-2xl space-y-6">
      <CabecalhoPagina titulo="Configurações" descricao="Valem para todos os empréstimos registrados a partir de agora." />
      {consulta.isPending ? (
        <CarregandoLinhas rotulo="Carregando configurações" linhas={4} />
      ) : consulta.isError ? (
        <EstadoErro erro={consulta.error} onTentarNovamente={() => consulta.refetch()} />
      ) : (
        <FormConfiguracao inicial={consulta.data} />
      )}
    </div>
  );
}

function FormConfiguracao({ inicial }: { inicial: Configuracao }) {
  const queryClient = useQueryClient();
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const valores = (c: Configuracao): Dados => ({
    prazoPadraoDias: String(c.prazo_padrao_dias),
    maxEmprestimosPorLeitor: String(c.max_emprestimos_por_leitor),
    bloquearLeitorComAtraso: c.bloquear_leitor_com_atraso,
    diasAvisoVencimento: String(c.dias_aviso_vencimento),
  });

  const form = useForm<Dados>({ resolver: zodResolver(esquema), defaultValues: valores(inicial) });
  const { errors, isDirty } = form.formState;

  useEffect(() => {
    form.reset(valores(inicial));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicial]);

  const salvar = useMutation({
    mutationFn: (d: Dados) =>
      api.configuracao.atualizar({
        prazo_padrao_dias: Number(d.prazoPadraoDias),
        max_emprestimos_por_leitor: Number(d.maxEmprestimosPorLeitor),
        bloquear_leitor_com_atraso: d.bloquearLeitorComAtraso,
        dias_aviso_vencimento: Number(d.diasAvisoVencimento),
      }),
    onSuccess: (c) => {
      toast.success("Configurações salvas");
      setErroGeral(null);
      queryClient.setQueryData(["configuracao"], c);
      form.reset(valores(c));
    },
    onError: (e) => setErroGeral(aplicarErrosDaApi(e, form.setError, CAMPOS_API)),
  });

  return (
    <form className="space-y-6 rounded-lg border bg-card p-5 shadow-card" onSubmit={form.handleSubmit((d) => salvar.mutate(d))} noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <CampoTexto
          id="cfg-prazo"
          rotulo="Prazo padrão (dias)"
          inputMode="numeric"
          dica="Quantos dias o leitor tem para devolver, contados a partir da retirada."
          {...form.register("prazoPadraoDias")}
          erro={errors.prazoPadraoDias?.message}
        />
        <CampoTexto
          id="cfg-maximo"
          rotulo="Máximo de empréstimos por leitor"
          inputMode="numeric"
          {...form.register("maxEmprestimosPorLeitor")}
          erro={errors.maxEmprestimosPorLeitor?.message}
        />
        <CampoTexto
          id="cfg-aviso"
          rotulo="Aviso de vencimento (dias antes)"
          inputMode="numeric"
          dica="Empréstimos que vencem dentro desta janela aparecem como 'a vencer'."
          {...form.register("diasAvisoVencimento")}
          erro={errors.diasAvisoVencimento?.message}
        />
      </div>

      <div className="flex items-start justify-between gap-4 rounded-md border p-4">
        <div className="space-y-1">
          <Label htmlFor="cfg-bloqueio">Bloquear leitor com atraso</Label>
          <p className="text-sm text-muted-foreground">Impede novos empréstimos para quem tem algum item atrasado.</p>
        </div>
        <Switch
          id="cfg-bloqueio"
          checked={form.watch("bloquearLeitorComAtraso")}
          onCheckedChange={(v) => form.setValue("bloquearLeitorComAtraso", v, { shouldDirty: true })}
        />
      </div>

      <AlertaErro mensagem={erroGeral} />

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" disabled={!isDirty || salvar.isPending} onClick={() => form.reset(valores(inicial))}>
          Desfazer
        </Button>
        <Button type="submit" disabled={!isDirty || salvar.isPending}>
          {salvar.isPending ? "Salvando…" : "Salvar configurações"}
        </Button>
      </div>
    </form>
  );
}
