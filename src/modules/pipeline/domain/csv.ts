export interface CsvLido {
  readonly separador: "," | ";";
  readonly cabecalho: readonly string[];
  readonly linhas: ReadonlyArray<readonly string[]>;
}
export class CsvInvalido extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "CsvInvalido";
  }
}

export function detectarSeparador(primeiraLinha: string): "," | ";" {
  const virgulas = (primeiraLinha.match(/,/g) ?? []).length;
  const pontoEVirgulas = (primeiraLinha.match(/;/g) ?? []).length;
  return pontoEVirgulas > virgulas ? ";" : ",";
}

export function lerCsv(texto: string): CsvLido {
  const semBom = texto.startsWith("\uFEFF") ? texto.slice(1) : texto;
  const primeiraQuebra = semBom.search(/\r?\n/);
  const primeiraLinha = primeiraQuebra === -1 ? semBom : semBom.slice(0, primeiraQuebra);
  if (primeiraLinha.trim() === "") throw new CsvInvalido("O arquivo está vazio ou sem cabeçalho.");
  const separador = detectarSeparador(primeiraLinha);

  const registros: string[][] = [];
  let campo = "";
  let registro: string[] = [];
  let entreAspas = false;
  let linhaAtual = 1;
  let linhaAberturaAspas = 1;
  for (let i = 0; i < semBom.length; i++) {
    const c = semBom[i];
    if (entreAspas) {
      if (c === '"') {
        if (semBom[i + 1] === '"') {
          campo += '"';
          i++;
        } else {
          entreAspas = false;
        }
      } else if (c === "\r" && semBom[i + 1] === "\n") {
        // CRLF dentro de aspas: mantém só o \n, igual ao resto do arquivo.
      } else {
        if (c === "\n") linhaAtual++;
        campo += c;
      }
      continue;
    }
    if (c === '"' && campo === "") {
      entreAspas = true;
      linhaAberturaAspas = linhaAtual;
      continue;
    }
    if (c === '"') {
      campo += c;
      continue;
    }
    if (c === separador) {
      registro.push(campo);
      campo = "";
      continue;
    }
    if (c === "\r") continue;
    if (c === "\n") {
      linhaAtual++;
      registro.push(campo);
      registros.push(registro);
      registro = [];
      campo = "";
      continue;
    }
    campo += c;
  }
  if (entreAspas) {
    throw new CsvInvalido(`Aspas abertas na linha ${linhaAberturaAspas} não foram fechadas.`);
  }
  if (campo !== "" || registro.length > 0) {
    registro.push(campo);
    registros.push(registro);
  }

  const [cabecalho, ...corpo] = registros;
  if (!cabecalho) throw new CsvInvalido("O arquivo está vazio ou sem cabeçalho.");
  const linhas = corpo
    .map((campos, indice) => ({ campos, numero: indice + 2 }))
    .filter(({ campos }) => !(campos.length === 1 && campos[0].trim() === ""))
    .map(({ campos, numero }) => {
      if (campos.length > cabecalho.length)
        throw new CsvInvalido(
          `A linha ${numero} tem mais campos (${campos.length}) que o cabeçalho (${cabecalho.length}).`,
        );
      return [...campos, ...Array<string>(cabecalho.length - campos.length).fill("")];
    });
  return { separador, cabecalho: cabecalho.map((h) => h.trim()), linhas };
}
