import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

import { mensagemDoErro } from "@/components/Estados";

import { ApiError } from "./api";

/**
 * Associa erros de validação (422) da API aos campos do formulário.
 * `mapa` traduz o nome do campo na API para o nome no formulário.
 * Retorna a mensagem geral a exibir (ou null se tudo foi associado a campos).
 */
export function aplicarErrosDaApi<T extends FieldValues>(
  erro: unknown,
  setError: UseFormSetError<T>,
  mapa: Record<string, Path<T>>,
): string | null {
  if (!(erro instanceof ApiError)) return mensagemDoErro(erro);
  let algum = false;
  for (const [campoApi, msg] of Object.entries(erro.campos)) {
    const campo = mapa[campoApi];
    if (campo) {
      setError(campo, { type: "api", message: msg });
      algum = true;
    }
  }
  return algum ? null : erro.message;
}
