import { useEffect, useState } from "react";

export function useDebounce<T>(valor: T, atrasoMs = 250): T {
  const [atrasado, setAtrasado] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setAtrasado(valor), atrasoMs);
    return () => clearTimeout(t);
  }, [valor, atrasoMs]);
  return atrasado;
}
