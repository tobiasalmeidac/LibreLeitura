import "@testing-library/jest-dom/vitest";

// Node 22+ expõe localStorage/sessionStorage globais experimentais (undefined sem --localstorage-file)
// que sobrepõem os do jsdom. Substituímos por um armazenamento em memória para os testes.
function criarArmazenamento(): Storage {
  const dados = new Map<string, string>();
  return {
    get length() {
      return dados.size;
    },
    clear: () => dados.clear(),
    getItem: (chave) => dados.get(chave) ?? null,
    key: (indice) => [...dados.keys()][indice] ?? null,
    removeItem: (chave) => void dados.delete(chave),
    setItem: (chave, valor) => void dados.set(chave, String(valor)),
  };
}
Object.defineProperty(globalThis, "localStorage", { value: criarArmazenamento(), configurable: true, writable: true });
Object.defineProperty(globalThis, "sessionStorage", { value: criarArmazenamento(), configurable: true, writable: true });

Object.defineProperty(window, "scrollTo", {
  writable: true,
  value: () => {},
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
