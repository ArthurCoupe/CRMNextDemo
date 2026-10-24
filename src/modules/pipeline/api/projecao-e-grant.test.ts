import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DIRETORIO = join(process.cwd(), "supabase", "migrations");
const MODULOS = join(process.cwd(), "src", "modules");
const REPOSITORIO = join(
  process.cwd(),
  "src",
  "modules",
  "pipeline",
  "api",
  "pipeline.repository.ts",
);

const PRIVILEGIOS_RASTREADOS = ["select", "insert", "update"] as const;
type Privilegio = (typeof PRIVILEGIOS_RASTREADOS)[number];

const MEDIDO_NO_BANCO_2026_09_20: Readonly<Record<string, number>> = {
  "public.opportunities.select": 38,
  "public.opportunities.update": 33,
  "public.opportunities.insert": 27,
  "public.internal_tasks.update": 11,
  "public.internal_tasks.insert": 10,
  "public.notification_preferences.insert": 3,
  "public.notification_preferences.update": 2,
  "public.opportunity_events.insert": 3,
  "public.opportunity_events.update": 1,
  "public.onboarding_tasks.update": 1,
  "public.profiles.update": 6,
  "public.proposals.insert": 7,
  "public.proposals.update": 6,
  "public.proposal_items.insert": 3,
  "public.proposal_items.update": 4,
  "public.content_posts.insert": 8,
  "public.content_posts.update": 10,
  "public.clients.insert": 13,
  "public.clients.update": 15,
  "public.internal_task_participants.insert": 2,
  "public.internal_task_links.insert": 3,
  "public.internal_task_links.update": 2,
};

const SELECT_DE_OPPORTUNITIES_2026_09_02 = [
  "attribution_id",
  "business_unit",
  "campos",
  "channel",
  "contact_email",
  "contact_name",
  "contact_phone",
  "created_at",
  "em_nutricao",
  "estimated_value",
  "expected_fronts",
  "id",
  "landing_url",
  "lead_source",
  "motivo_id",
  "motivo_obs",
  "name",
  "next_followup_at",
  "nicho",
  "notes",
  "nutrir_ate",
  "owner_id",
  "pipeline_id",
  "r1_agendada_em",
  "r1_realizada_em",
  "r2_agendada_em",
  "r2_realizada_em",
  "referred_by",
  "segment",
  "stage",
  "stage_changed_at",
  "stage_id",
  "updated_at",
  "utm_campaign",
  "utm_content",
  "utm_medium",
  "utm_source",
  "utm_term",
];

const NAO_ENTENDIDOS_ACEITOS: ReadonlyArray<string> = [
  "financial/api/expenses.repository.ts → insert public.expenses: argumento não é objeto literal nem identificador: `paraLinha(dados)`",
  "financial/api/expenses.repository.ts → update public.expenses: argumento não é objeto literal nem identificador: `paraLinha(dados)`",
  "financial/api/payroll.repository.ts → insert public.payroll: argumento não é objeto literal nem identificador: `paraLinha(dados)`",
  "financial/api/payroll.repository.ts → update public.payroll: argumento não é objeto literal nem identificador: `paraLinha(dados)`",
  "meetings/api/meetings.repository.ts → insert public.meeting_attendees: argumento não é objeto literal nem identificador: `dados.participantes.map((profileId) => ({ meeting_id: data.i`",
  "meetings/api/meetings.repository.ts → insert public.meeting_attendees: argumento não é objeto literal nem identificador: `aInserir.map((profileId) => ({ meeting_id: id, profile_id: p`",
];

function soSqlExecutavel(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, " ")
    .replace(/\$\$[\s\S]*?\$\$/g, " ")
    .replace(/'(?:[^']|'')*'/g, " ' ' ");
}

function statementsDePrivilegio(sql: string): ReadonlyArray<string> {
  return (soSqlExecutavel(sql).match(/\b(?:grant|revoke)\b[^;]*;/gi) ?? []).map((t) =>
    t.replace(/\s+/g, " ").trim(),
  );
}

const STATEMENT_DE_TABELA =
  /^(grant|revoke)\s+([\s\S]+?)\s+on\s+(?:table\s+)?([a-z_][\w]*\.[a-z_][\w]*)\s+(to|from)\s+([\w\s,]+?)\s*;$/i;

const OBJETO_SEM_COLUNA =
  /\bon\s+(?:all\s+(?!tables\b)\w+\s+in\s+)?(?:function|procedure|routine|schema|sequence|database|type|domain|language|tablespace|foreign)\b/i;

const PAPEIS_CONHECIDOS: ReadonlySet<string> = new Set([
  "anon",
  "authenticated",
  "service_role",
  "postgres",
  "public",
  "authenticator",
  "dashboard_user",
  "supabase_admin",
  "supabase_auth_admin",
  "supabase_storage_admin",
]);

type AlcanceDeGrantee = "sim" | "nao" | "nao-modelavel";

function alcancaAuthenticated(verbo: string, listaDeGrantees: string): AlcanceDeGrantee {
  const grantees = listaDeGrantees
    .split(",")
    .map((g) => g.trim().toLowerCase())
    .filter((g) => g !== "");

  if (grantees.length === 0 || grantees.some((g) => !PAPEIS_CONHECIDOS.has(g))) {
    return "nao-modelavel";
  }

  if (grantees.includes("authenticated")) return "sim";
  return grantees.includes("public") && verbo.toLowerCase() === "grant" ? "sim" : "nao";
}

const REVOKES_DE_PUBLIC_ACEITOS: ReadonlyArray<string> = [
  "20260801021619_view_client_health.sql: revoke all on public.v_client_health from public, anon;",
  "20260924101000_c42_security_events.sql: revoke all on table private.security_events from public, anon, authenticated;",
  "20260924102000_c35_rate_limit_compartilhado.sql: revoke all on table private.rate_limits from public, anon, authenticated;",
  "20261007225844_folha_so_para_lista.sql: revoke all on table public.acesso_a_folha from public, anon, authenticated;",
];

const GRANTEE_ALCANCA_AUTHENTICATED = /\b(?:to|from)\b[^;]*\b(?:authenticated|public)\b/i;

const STATEMENT_DE_TODAS_AS_TABELAS =
  /^(grant|revoke)\s+([\s\S]+?)\s+on\s+all\s+tables\s+in\s+schema\s+([a-z_]\w*)\s+(to|from)\s+([\w\s,]+?)\s*;$/i;

type EfeitoDeTodasAsTabelas =
  | { readonly tipo: "ignorar" }
  | { readonly tipo: "restaura-tabela"; readonly privilegios: ReadonlyArray<Privilegio> }
  | { readonly tipo: "nao-modelavel"; readonly motivo: string };

function efeitoDeTodasAsTabelas(statement: string): EfeitoDeTodasAsTabelas | null {
  const casou = STATEMENT_DE_TODAS_AS_TABELAS.exec(statement);
  if (casou === null) return null;

  const [, verbo, listaDePrivilegios, schema, , listaDeGrantees] = casou;
  const alcance = alcancaAuthenticated(verbo, listaDeGrantees);
  if (alcance === "nao-modelavel") {
    return {
      tipo: "nao-modelavel",
      motivo:
        "lista de grantees com item que não é papel conhecido — provável sufixo " +
        `engolido pela captura (\`with grant option\`, \`granted by\`, \`group\`): "${listaDeGrantees}"`,
    };
  }
  if (alcance === "nao") return { tipo: "ignorar" };
  if (schema.toLowerCase() !== "public") return { tipo: "ignorar" };

  const privilegios = new Set<Privilegio>();
  for (const { privilegio } of fatiarPrivilegios(listaDePrivilegios)) {
    for (const p of PRIVILEGIOS_RASTREADOS) {
      if (privilegio === "all" || privilegio === p) privilegios.add(p);
    }
  }
  if (privilegios.size === 0) return { tipo: "ignorar" };

  if (verbo.toLowerCase() === "grant") {
    return { tipo: "restaura-tabela", privilegios: [...privilegios] };
  }
  return {
    tipo: "nao-modelavel",
    motivo:
      "`revoke ... on all tables in schema public from authenticated` tira o " +
      "privilégio de TODAS as tabelas, e o conjunto de tabelas do schema só o " +
      "banco conhece — este parser não tem como reconstruir o estado resultante",
  };
}

function fatiarPrivilegios(lista: string): ReadonlyArray<{
  readonly privilegio: string;
  readonly colunas: ReadonlyArray<string> | null;
}> {
  const pedacos: string[] = [];
  let profundidade = 0;
  let atual = "";
  for (const caractere of lista) {
    if (caractere === "(") profundidade += 1;
    if (caractere === ")") profundidade -= 1;
    if (caractere === "," && profundidade === 0) {
      pedacos.push(atual);
      atual = "";
      continue;
    }
    atual += caractere;
  }
  pedacos.push(atual);

  const saida: Array<{ privilegio: string; colunas: ReadonlyArray<string> | null }> = [];
  for (const pedaco of pedacos) {
    const casou = /^\s*([a-z][a-z ]*?)\s*(?:\(([^)]*)\))?\s*$/i.exec(pedaco);
    if (casou === null) continue;
    const privilegio = casou[1]
      .toLowerCase()
      .replace(/\s+privileges$/, "")
      .trim();
    const colunas =
      casou[2] === undefined
        ? null
        : casou[2]
            .split(",")
            .map((c) => c.trim())
            .filter((c) => c !== "");
    saida.push({ privilegio, colunas });
  }
  return saida;
}

function grantsPorColuna(): ReadonlyMap<string, ReadonlySet<string>> {
  const estado = new Map<string, Set<string>>();

  const arquivos = readdirSync(DIRETORIO)
    .filter((nome) => nome.endsWith(".sql"))
    .sort();

  for (const arquivo of arquivos) {
    const sql = readFileSync(join(DIRETORIO, arquivo), "utf-8");
    for (const statement of statementsDePrivilegio(sql)) {
      if (OBJETO_SEM_COLUNA.test(statement)) continue;

      const todas = efeitoDeTodasAsTabelas(statement);
      if (todas !== null) {
        if (todas.tipo === "restaura-tabela") {
          for (const p of todas.privilegios) {
            for (const chave of [...estado.keys()]) {
              if (chave.endsWith(`.${p}`)) estado.delete(chave);
            }
          }
        }
        continue;
      }

      const casou = STATEMENT_DE_TABELA.exec(statement);
      if (casou === null) continue;

      const [, verbo, listaDePrivilegios, objeto, , listaDeGrantees] = casou;
      if (alcancaAuthenticated(verbo, listaDeGrantees) !== "sim") continue;

      const concedendo = verbo.toLowerCase() === "grant";

      for (const { privilegio, colunas } of fatiarPrivilegios(listaDePrivilegios)) {
        const alvos: ReadonlyArray<Privilegio> =
          privilegio === "all"
            ? PRIVILEGIOS_RASTREADOS
            : PRIVILEGIOS_RASTREADOS.filter((p) => p === privilegio);

        for (const alvo of alvos) {
          const chave = `${objeto.toLowerCase()}.${alvo}`;
          const atual = estado.get(chave);

          if (colunas === null) {
            if (concedendo) estado.delete(chave);
            else estado.set(chave, new Set());
            continue;
          }

          if (atual === undefined) continue;
          for (const coluna of colunas) {
            if (concedendo) atual.add(coluna);
            else atual.delete(coluna);
          }
        }
      }
    }
  }

  return estado;
}

function colunasDaProjecao(): ReadonlyArray<string> {
  const fonte = readFileSync(REPOSITORIO, "utf-8");

  const declaracao = /const\s+COLUNAS_DE_OPORTUNIDADE\s*=\s*([\s\S]*?);\s*\n/.exec(fonte);
  expect(
    declaracao,
    "Não achei `const COLUNAS_DE_OPORTUNIDADE = ...` em pipeline.repository.ts. " +
      "Se a projeção mudou de nome ou de forma (virou array, veio de outro " +
      "módulo), este portão parou de olhar para ela — ensine a forma nova aqui " +
      "antes de seguir, senão ele fica verde sem medir nada.",
  ).not.toBeNull();

  return declaracao![1]
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/"/g, "")
    .replace(/\+/g, " ")
    .replace(/[\w]+\s*\([^)]*\)/g, " ")
    .split(",")
    .map((parte) => parte.trim())
    .filter((parte) => parte !== "");
}

function repositoriosDeModulo(): ReadonlyArray<string> {
  const encontrados: string[] = [];
  for (const modulo of readdirSync(MODULOS)) {
    const api = join(MODULOS, modulo, "api");
    try {
      if (!statSync(api).isDirectory()) continue;
    } catch {
      continue;
    }
    for (const arquivo of readdirSync(api)) {
      if (!arquivo.endsWith(".ts") || arquivo.endsWith(".test.ts")) continue;
      encontrados.push(join(api, arquivo));
    }
  }
  return encontrados.sort();
}

function fimDoTrecho(fonte: string, abre: number, pararNaVirgula: boolean): number {
  let profundidade = 0;
  let aspas: string | null = null;
  for (let i = abre; i < fonte.length; i += 1) {
    const c = fonte[i];
    if (aspas !== null) {
      if (c === "\\") i += 1;
      else if (c === aspas) aspas = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      aspas = c;
      continue;
    }
    if (c === "(" || c === "[" || c === "{") profundidade += 1;
    else if (c === ")" || c === "]" || c === "}") {
      profundidade -= 1;
      if (profundidade === 0) return i;
    } else if (pararNaVirgula && c === "," && profundidade === 1) return i;
  }
  return -1;
}

function argumentoBalanceado(fonte: string, abre: number): string | null {
  const fim = fimDoTrecho(fonte, abre, true);
  return fim === -1 ? null : fonte.slice(abre + 1, fim).trim();
}

function blocoBalanceado(fonte: string, abre: number): string | null {
  const fim = fimDoTrecho(fonte, abre, false);
  return fim === -1 ? null : fonte.slice(abre, fim + 1);
}

function achatarNoNivelDasChaves(literal: string): string {
  const NIVEL_DAS_CHAVES = literal.trimStart().startsWith("[") ? 2 : 1;
  let profundidade = 0;
  let aspas: string | null = null;
  let plano = "";
  for (let i = 0; i < literal.length; i += 1) {
    const c = literal[i];
    if (aspas !== null) {
      if (c === "\\") i += 1;
      else if (c === aspas) aspas = null;
      plano += " ";
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      aspas = c;
      plano += " ";
      continue;
    }
    if (c === "(" || c === "[" || c === "{") {
      profundidade += 1;
      plano += " ";
      continue;
    }
    if (c === ")" || c === "]" || c === "}") {
      profundidade -= 1;
      plano += " ";
      continue;
    }
    plano += profundidade === NIVEL_DAS_CHAVES ? c : " ";
  }
  return plano;
}

function chavesDoObjeto(literal: string): ReadonlyArray<string> {
  const plano = achatarNoNivelDasChaves(literal);
  return [
    ...[...plano.matchAll(/(?:^|,)\s*"?([A-Za-z_]\w*)"?\s*:/g)].map((m) => m[1]),
    ...[...plano.matchAll(/(?:^|,)\s*([A-Za-z_]\w*)\s*(?=,|$)/g)].map((m) => m[1]),
  ];
}

function espalhamentosDoObjeto(literal: string): ReadonlyArray<string> {
  return [...achatarNoNivelDasChaves(literal).matchAll(/\.\.\.\s*([A-Za-z_]\w*)/g)].map(
    (m) => m[1],
  );
}

export interface EscritaDeRepositorio {
  readonly arquivo: string;
  readonly tabela: string;
  readonly privilegio: Privilegio;
  readonly colunas: ReadonlyArray<string>;
}

function escritasDosRepositorios(): {
  readonly escritas: ReadonlyArray<EscritaDeRepositorio>;
  readonly naoEntendidos: ReadonlyArray<string>;
} {
  const saida: EscritaDeRepositorio[] = [];
  const naoEntendidos: string[] = [];

  for (const caminho of repositoriosDeModulo()) {
    const fonte = readFileSync(caminho, "utf-8")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/\/\/[^\n]*/g, " ");
    const arquivo = caminho.slice(MODULOS.length + 1).replace(/\\/g, "/");

    for (const encontro of fonte.matchAll(/\.from\(\s*"([\w]+)"\s*\)/g)) {
      const tabela = `public.${encontro[1]}`;
      const resto = fonte.slice(encontro.index + encontro[0].length);
      const operacao = /^[\s\S]*?\.(insert|update|upsert|select|delete|rpc)\s*\(/.exec(resto);
      if (operacao === null) continue;
      const metodo = operacao[1];
      if (metodo !== "insert" && metodo !== "update" && metodo !== "upsert") continue;

      const argumento = argumentoBalanceado(resto, operacao[0].length - 1);
      if (argumento === null) {
        naoEntendidos.push(`${arquivo} → ${metodo} ${tabela}: chamada não fecha`);
        continue;
      }

      const { colunas, problema } = colunasDoArgumento(fonte, argumento);
      if (problema !== null) {
        naoEntendidos.push(`${arquivo} → ${metodo} ${tabela}: ${problema}`);
      }

      const privilegios: ReadonlyArray<Privilegio> =
        metodo === "upsert" ? ["insert", "update"] : [metodo];
      for (const privilegio of privilegios) {
        saida.push({ arquivo, tabela, privilegio, colunas });
      }
    }
  }

  return { escritas: saida, naoEntendidos: [...new Set(naoEntendidos)].sort() };
}

function colunasDoArgumento(
  fonte: string,
  argumento: string,
  visitados: Set<string> = new Set(),
): { readonly colunas: ReadonlyArray<string>; readonly problema: string | null } {
  const texto = argumento.trim();

  if (texto.startsWith("{") || texto.startsWith("[")) {
    const colunas = [...chavesDoObjeto(texto)];
    for (const espalhado of espalhamentosDoObjeto(texto)) {
      const dentro = colunasDoArgumento(fonte, espalhado, visitados);
      colunas.push(...dentro.colunas);
      if (dentro.problema !== null) {
        return { colunas, problema: `espalhamento \`...${espalhado}\` — ${dentro.problema}` };
      }
    }
    return {
      colunas,
      problema: colunas.length === 0 ? "payload literal rendeu zero chave" : null,
    };
  }

  const identificador = /^([A-Za-z_]\w*)$/.exec(texto);
  if (identificador === null) {
    return {
      colunas: [],
      problema: `argumento não é objeto literal nem identificador: \`${texto
        .replace(/\s+/g, " ")
        .slice(0, 60)}\``,
    };
  }
  const nome = identificador[1];
  if (visitados.has(nome)) {
    return { colunas: [], problema: `identificador \`${nome}\` se referencia em ciclo` };
  }
  visitados.add(nome);

  const colunas = [...atribuicoesNaVariavel(fonte, nome)];
  const inicializador = inicializadorDaVariavel(fonte, nome);
  if (inicializador !== null) {
    const dentro = colunasDoArgumento(fonte, inicializador, visitados);
    colunas.push(...dentro.colunas);
    if (dentro.problema !== null && colunas.length === 0) {
      return { colunas, problema: `inicializador de \`${nome}\` — ${dentro.problema}` };
    }
  }
  return {
    colunas,
    problema:
      colunas.length === 0
        ? `identificador \`${nome}\` não tem inicializador literal nem atribuição \`${nome}.<coluna> =\` neste arquivo`
        : null,
  };
}

function atribuicoesNaVariavel(fonte: string, nome: string): ReadonlyArray<string> {
  return [...fonte.matchAll(new RegExp(`\\b${nome}\\.(\\w+)\\s*=(?!=)`, "g"))].map((m) => m[1]);
}

function inicializadorDaVariavel(fonte: string, nome: string): string | null {
  const declaracao = new RegExp(`\\b(?:const|let|var)\\s+${nome}\\s*(?::[^=]{0,300})?=\\s*`, "g");
  for (const encontro of fonte.matchAll(declaracao)) {
    const inicio = encontro.index + encontro[0].length;
    if (fonte[inicio] !== "{" && fonte[inicio] !== "[") continue;
    const bloco = blocoBalanceado(fonte, inicio);
    if (bloco !== null) return bloco;
  }
  return null;
}

describe("grant por coluna versus o que o código toca", () => {
  it("o parser reconstrói exatamente o que o banco tinha em 02/09/2026", () => {
    const calculado = grantsPorColuna();

    const porColuna = [...calculado.entries()].filter(([, colunas]) => colunas.size > 0);

    expect(
      porColuna.map(([chave]) => chave).sort(),
      "Mudou o conjunto de pares (tabela, privilégio) com grant por COLUNA. " +
        "Se foi migration nova, atualize MEDIDO_NO_BANCO_2026_09_20 com a " +
        "medição do banco e a data. Se não foi, o parser está errado.",
    ).toEqual(Object.keys(MEDIDO_NO_BANCO_2026_09_20).sort());

    const contagens = Object.fromEntries(
      porColuna.map(([chave, colunas]) => [chave, colunas.size]),
    );
    expect(contagens).toEqual(MEDIDO_NO_BANCO_2026_09_20);

    expect([...calculado.get("public.opportunities.select")!].sort()).toEqual(
      [...SELECT_DE_OPPORTUNITIES_2026_09_02].sort(),
    );
  });

  it("toda coluna de COLUNAS_DE_OPORTUNIDADE tem SELECT para authenticated", () => {
    const projetadas = colunasDaProjecao();

    expect(projetadas.length).toBeGreaterThan(20);
    expect(projetadas).toEqual(expect.arrayContaining(["id", "stage", "r1_agendada_em"]));

    const concedidas = grantsPorColuna().get("public.opportunities.select");
    expect(concedidas, "O SELECT de opportunities voltou a ser grant de TABELA.").toBeDefined();

    const semGrant = projetadas.filter((coluna) => !concedidas!.has(coluna));

    expect(
      semGrant,
      `Estas colunas estão em COLUNAS_DE_OPORTUNIDADE e não receberam ` +
        `\`grant select\` em nenhuma migration. Em produção isso é ` +
        `42501 permission denied e o board do Pipeline não carrega para ` +
        `NINGUÉM. Acrescente-as a um \`grant select (...) on ` +
        `public.opportunities to authenticated\` na mesma migration que criou ` +
        `as colunas.`,
    ).toEqual([]);
  });

  it("todo payload de insert/update dos repositórios tem grant de coluna", () => {
    const { escritas } = escritasDosRepositorios();

    expect(escritas.length).toBeGreaterThan(8);
    expect(
      escritas.map((e) => `${e.tabela}.${e.privilegio}`),
      "A varredura de payloads parou de enxergar escritas conhecidas.",
    ).toEqual(
      expect.arrayContaining([
        "public.internal_tasks.insert",
        "public.opportunity_events.insert",
        "public.opportunities.update",
        "public.onboarding_tasks.update",
      ]),
    );
    const nutricao = escritas.find(
      (e) => e.tabela === "public.opportunities" && e.colunas.includes("em_nutricao"),
    );
    expect(
      nutricao,
      "O payload por variável (`.update(payload)`) sumiu da extração.",
    ).toBeDefined();

    const literal = escritas.find(
      (e) => e.tabela === "public.internal_tasks" && e.privilegio === "insert",
    );
    expect(
      literal?.colunas ?? [],
      "O payload LITERAL (`.insert({ ... })`) parou de render colunas — o " +
        "portão volta a conferir zero escritas sem reprovar nada.",
    ).toContain("title");

    const shorthand = escritas.find(
      (e) => e.tabela === "public.notification_preferences" && e.privilegio === "insert",
    );
    expect(
      shorthand?.colunas ?? [],
      "O property shorthand (`{ ..., tipo, ... }`) parou de render coluna.",
    ).toContain("tipo");

    const concedidas = grantsPorColuna();
    const faltando: string[] = [];

    for (const escrita of escritas) {
      const permitidas = concedidas.get(`${escrita.tabela}.${escrita.privilegio}`);
      if (permitidas === undefined) continue;
      for (const coluna of escrita.colunas) {
        if (!permitidas.has(coluna)) {
          faltando.push(`${escrita.arquivo} → ${escrita.privilegio} ${escrita.tabela}.${coluna}`);
        }
      }
    }

    expect(
      faltando,
      `Estas colunas são escritas pelo repositório e NÃO estão no \`grant ` +
        `insert/update (...)\` de nenhuma migration. A tabela está em regime de ` +
        `privilégio por COLUNA, então \`add column\` não concedeu nada: em ` +
        `produção isso é 42501 permission denied e a operação inteira falha ` +
        `para todo usuário logado. Acrescente as colunas ao grant na mesma ` +
        `migration que as criou.`,
    ).toEqual([]);
  });

  it("nenhum call site de escrita fica sem extração em silêncio", () => {
    const { naoEntendidos } = escritasDosRepositorios();

    expect(
      naoEntendidos,
      "A extração de payload encontrou uma forma que não resolve. Ou ensine a " +
        "forma a `colunasDoArgumento`, ou acrescente o call site a " +
        "`NAO_ENTENDIDOS_ACEITOS` COM a justificativa escrita — nunca deixe " +
        "devolver `[]` em silêncio.",
    ).toEqual([...NAO_ENTENDIDOS_ACEITOS].sort());
  });

  it("nenhum statement de privilégio de tabela escapa do parser", () => {
    const naoReconhecidos: string[] = [];

    for (const arquivo of readdirSync(DIRETORIO)
      .filter((n) => n.endsWith(".sql"))
      .sort()) {
      const sql = readFileSync(join(DIRETORIO, arquivo), "utf-8");
      for (const statement of statementsDePrivilegio(sql)) {
        if (OBJETO_SEM_COLUNA.test(statement)) continue;

        const todas = efeitoDeTodasAsTabelas(statement);
        if (todas !== null) {
          if (todas.tipo === "nao-modelavel") {
            naoReconhecidos.push(`${arquivo}: ${todas.motivo} :: ${statement.slice(0, 160)}`);
          }
          continue;
        }

        const relevante =
          /\b(?:select|insert|update|all)\b/i.test(statement) &&
          GRANTEE_ALCANCA_AUTHENTICATED.test(statement);
        if (!relevante) continue;

        const casou = STATEMENT_DE_TABELA.exec(statement);
        if (casou === null) {
          naoReconhecidos.push(`${arquivo}: ${statement.slice(0, 160)}`);
          continue;
        }

        const [, verbo, listaDePrivilegios, , , listaDeGrantees] = casou;

        if (alcancaAuthenticated(verbo, listaDeGrantees) === "nao-modelavel") {
          naoReconhecidos.push(
            `${arquivo}: grantees não modeláveis ("${listaDeGrantees}") :: ${statement.slice(0, 120)}`,
          );
          continue;
        }

        const grantees = listaDeGrantees.split(",").map((g) => g.trim().toLowerCase());
        const rastreado = fatiarPrivilegios(listaDePrivilegios).some(
          ({ privilegio }) =>
            privilegio === "all" ||
            (PRIVILEGIOS_RASTREADOS as ReadonlyArray<string>).includes(privilegio),
        );
        if (verbo.toLowerCase() === "revoke" && grantees.includes("public") && rastreado) {
          const linha = `${arquivo}: ${statement}`;
          if (!REVOKES_DE_PUBLIC_ACEITOS.includes(linha)) {
            naoReconhecidos.push(
              `${arquivo}: revoke de privilégio rastreado FROM public, e este parser trata ` +
                `isso como no-op — se a tabela tinha sido exposta por um \`grant ... to public\`, ` +
                `o modelo fica MAIS ABERTO que o banco. Confira e declare em ` +
                `REVOKES_DE_PUBLIC_ACEITOS :: ${statement.slice(0, 120)}`,
            );
          }
        }
      }
    }

    expect(
      naoReconhecidos,
      "Apareceu uma forma de grant/revoke que este parser não conhece. " +
        "Ignorá-la faria o portão medir um conjunto que não existe no banco — " +
        "ensine a forma nova ao parser antes de seguir.",
    ).toEqual([]);
  });
});

describe("`public` é pseudo-role e alcança `authenticated`", () => {
  it("grant TO public alcança, e grant TO authenticated também", () => {
    expect(alcancaAuthenticated("grant", "public")).toBe("sim");
    expect(alcancaAuthenticated("grant", "authenticated")).toBe("sim");
    expect(alcancaAuthenticated("grant", "anon, public")).toBe("sim");
  });

  it("🔴 revoke FROM public NÃO alcança — e não é esquecimento, é a assimetria do Postgres", () => {
    expect(alcancaAuthenticated("revoke", "public")).toBe("nao");
    expect(alcancaAuthenticated("revoke", "authenticated")).toBe("sim");
  });

  it("papel que não alcança ninguém logado continua fora", () => {
    expect(alcancaAuthenticated("grant", "anon")).toBe("nao");
    expect(alcancaAuthenticated("grant", "service_role, anon")).toBe("nao");
    expect(alcancaAuthenticated("grant", "service_role, anon, public")).toBe("sim");
  });

  it("`PUBLIC` em maiúscula e com espaço sobrando alcança igual", () => {
    expect(alcancaAuthenticated("GRANT", "  PUBLIC  ")).toBe("sim");
    expect(alcancaAuthenticated("Grant", " anon ,  Public ")).toBe("sim");
  });

  it("🔴 sufixo depois do grantee é NAO-MODELAVEL, nunca um `nao` silencioso", () => {
    expect(alcancaAuthenticated("grant", "authenticated with grant option")).toBe("nao-modelavel");
    expect(alcancaAuthenticated("grant", "public with grant option")).toBe("nao-modelavel");
    expect(alcancaAuthenticated("grant", "group authenticated")).toBe("nao-modelavel");
    expect(alcancaAuthenticated("revoke", "authenticated cascade")).toBe("nao-modelavel");
    expect(alcancaAuthenticated("grant", "authenticated granted by postgres")).toBe(
      "nao-modelavel",
    );
    expect(alcancaAuthenticated("grant", "authenticated")).toBe("sim");
    expect(alcancaAuthenticated("revoke", "authenticated")).toBe("sim");
  });

  it("lista vazia é nao-modelavel, não `nao`", () => {
    expect(alcancaAuthenticated("grant", "")).toBe("nao-modelavel");
    expect(alcancaAuthenticated("grant", "   ")).toBe("nao-modelavel");
  });

  it("🔴 papel desconhecido grita em vez de ser ignorado", () => {
    expect(alcancaAuthenticated("grant", "crm_leitor")).toBe("nao-modelavel");
    expect(alcancaAuthenticated("grant", "authenticated, crm_leitor")).toBe("nao-modelavel");
    expect(alcancaAuthenticated("grant", "service_role")).toBe("nao");
  });

  it("todo papel de PAPEIS_CONHECIDOS é aceito sozinho", () => {
    expect(PAPEIS_CONHECIDOS.size).toBeGreaterThanOrEqual(10);
    for (const papel of PAPEIS_CONHECIDOS) {
      expect(alcancaAuthenticated("grant", papel)).not.toBe("nao-modelavel");
    }
  });

  it("o filtro textual do teste 4 exige o grantee DEPOIS do to/from", () => {
    expect(
      GRANTEE_ALCANCA_AUTHENTICATED.test("grant select on public.opportunities to public;"),
    ).toBe(true);
    expect(
      GRANTEE_ALCANCA_AUTHENTICATED.test("grant select on public.opportunities to authenticated;"),
    ).toBe(true);
    expect(
      GRANTEE_ALCANCA_AUTHENTICATED.test("grant select on public.opportunities to anon;"),
    ).toBe(false);
  });

  it("🔴 o statement perigoso é reconhecido pelo parser de tabela", () => {
    const perigoso = "grant select on public.opportunities to public;";
    expect(OBJETO_SEM_COLUNA.test(perigoso)).toBe(false);
    const casou = STATEMENT_DE_TABELA.exec(perigoso);
    expect(casou).not.toBeNull();
    expect(alcancaAuthenticated(casou![1], casou![5])).toBe("sim");
  });

  it("🔴 a dispensa de revoke-from-public é a lista real, não um catch-all", () => {
    expect(REVOKES_DE_PUBLIC_ACEITOS).toHaveLength(4);
    for (const linha of REVOKES_DE_PUBLIC_ACEITOS) {
      expect(linha).toMatch(/^\d{14}_[\w.]+\.sql: revoke .+;$/);
    }
  });
});
