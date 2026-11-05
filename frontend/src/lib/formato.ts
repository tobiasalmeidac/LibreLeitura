const FUSO = "America/Sao_Paulo";

const formatadorData = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const formatadorIsoSP = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const formatadorNumero = new Intl.NumberFormat("pt-BR");

const SO_DATA = /^\d{4}-\d{2}-\d{2}$/;

/** Converte data ISO (com ou sem horário) em AAAA-MM-DD no fuso de São Paulo. */
export function diaSP(iso: string): string {
  if (SO_DATA.test(iso)) return iso;
  return formatadorIsoSP.format(new Date(iso));
}

/** Data de hoje (AAAA-MM-DD) no fuso de São Paulo. */
export function hojeSP(agora: Date = new Date()): string {
  return formatadorIsoSP.format(agora);
}

/** Formata uma data ISO como dd/mm/aaaa. */
export function formatarData(iso: string | null | undefined): string {
  if (!iso) return "—";
  if (SO_DATA.test(iso)) {
    const [a, m, d] = iso.split("-");
    return `${d}/${m}/${a}`;
  }
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "—";
  return formatadorData.format(data);
}

export function formatarNumero(n: number): string {
  return formatadorNumero.format(n);
}

/** Dias de diferença entre duas datas AAAA-MM-DD (b - a). */
export function diasEntre(a: string, b: string): number {
  const [ay = 0, am = 1, ad = 1] = a.split("-").map(Number);
  const [by = 0, bm = 1, bd = 1] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

export function pluralDias(n: number): string {
  return `${formatarNumero(n)} ${n === 1 ? "dia" : "dias"}`;
}
