import { Loader2, Search } from "lucide-react";
import { useEffect, useId, useState, type KeyboardEvent, type ReactNode, type Ref } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface Props<T> {
  id: string;
  rotulo: string;
  valor: string;
  onValor: (texto: string) => void;
  opcoes: T[];
  chave: (o: T) => string;
  renderOpcao: (o: T) => ReactNode;
  onSelecionar: (o: T) => void;
  /** Enter: por padrão seleciona a opção destacada. */
  onEnter?: (texto: string, destacada: T | undefined) => void;
  onEsc?: () => void;
  carregando?: boolean;
  mensagemVazia?: string;
  erro?: string | null;
  placeholder?: string;
  dica?: ReactNode;
  disabled?: boolean;
  autoFocus?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  inputClassName?: string;
}

/** Campo de busca com lista de sugestões, navegável por teclado (setas, Enter, Esc). */
export function Autocomplete<T>({
  id,
  rotulo,
  valor,
  onValor,
  opcoes,
  chave,
  renderOpcao,
  onSelecionar,
  onEnter,
  onEsc,
  carregando,
  mensagemVazia = "Nenhum resultado",
  erro,
  placeholder,
  dica,
  disabled,
  autoFocus,
  inputRef,
  inputClassName,
}: Props<T>) {
  const listaId = useId();
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const temTexto = valor.trim().length > 0;
  const mostrarLista = aberto && temTexto && !disabled;

  useEffect(() => setAtivo(0), [opcoes]);

  function selecionar(o: T) {
    onSelecionar(o);
    setAberto(false);
  }

  function aoTeclar(ev: KeyboardEvent<HTMLInputElement>) {
    if (ev.key === "ArrowDown") {
      ev.preventDefault();
      setAberto(true);
      setAtivo((a) => Math.min(a + 1, Math.max(opcoes.length - 1, 0)));
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault();
      setAtivo((a) => Math.max(a - 1, 0));
    } else if (ev.key === "Enter") {
      ev.preventDefault();
      const destacada = opcoes[ativo];
      if (onEnter) {
        onEnter(valor, destacada);
        setAberto(false);
      } else if (destacada) {
        selecionar(destacada);
      }
    } else if (ev.key === "Escape") {
      ev.preventDefault();
      setAberto(false);
      onEsc?.();
    }
  }

  const ativoId = mostrarLista && opcoes[ativo] ? `${listaId}-${ativo}` : undefined;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{rotulo}</Label>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          ref={inputRef}
          id={id}
          role="combobox"
          aria-expanded={mostrarLista}
          aria-controls={listaId}
          aria-autocomplete="list"
          aria-activedescendant={ativoId}
          aria-invalid={!!erro}
          aria-describedby={dica ? `${id}-dica` : undefined}
          autoComplete="off"
          spellCheck={false}
          autoFocus={autoFocus}
          disabled={disabled}
          placeholder={placeholder}
          value={valor}
          className={cn("pl-9", inputClassName)}
          onChange={(e) => {
            onValor(e.target.value);
            setAberto(true);
          }}
          onFocus={() => setAberto(true)}
          onBlur={() => setAberto(false)}
          onKeyDown={aoTeclar}
        />
        {carregando && (
          <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden="true" />
        )}
        {mostrarLista && (
          <ul
            id={listaId}
            role="listbox"
            aria-label={rotulo}
            className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
          >
            {erro ? (
              <li className="px-3 py-2 text-sm text-danger-strong">{erro}</li>
            ) : opcoes.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">{carregando ? "Buscando…" : mensagemVazia}</li>
            ) : (
              opcoes.map((o, i) => (
                <li
                  key={chave(o)}
                  id={`${listaId}-${i}`}
                  role="option"
                  aria-selected={i === ativo}
                  className={cn(
                    "cursor-pointer rounded-sm px-3 py-2 text-sm",
                    i === ativo ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                  )}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selecionar(o);
                  }}
                  onMouseEnter={() => setAtivo(i)}
                >
                  {renderOpcao(o)}
                </li>
              ))
            )}
          </ul>
        )}
      </div>
      {dica && (
        <p id={`${id}-dica`} className="text-xs text-muted-foreground">
          {dica}
        </p>
      )}
    </div>
  );
}
