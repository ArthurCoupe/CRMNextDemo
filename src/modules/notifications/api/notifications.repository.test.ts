import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  NENHUM_DADO,
  UMA_LINHA,
  ZERO_LINHAS,
  type ChamadaRegistrada,
  type RespostaFalsa,
} from "@/test/supabase-falso";

let respostas: readonly RespostaFalsa[] = [UMA_LINHA];
let chamadas: ChamadaRegistrada[] = [];

function proximaResposta(): RespostaFalsa {
  const [primeira, ...resto] = respostas;
  if (primeira === undefined) {
    throw new Error("o teste não preparou resposta para esta consulta");
  }
  if (resto.length > 0) respostas = resto;
  return primeira;
}

vi.mock("@/integrations/supabase/client.v2", async () => {
  const { clienteFalso } = await import("@/test/supabase-falso");
  return {
    supabaseV2: clienteFalso(
      () => proximaResposta(),
      (chamada) => chamadas.push(chamada),
    ),
  };
});

const { definirPreferencia } = await import("./notifications.repository");

const PESSOA = "5b4e1d73-8a02-4c95-b6f1-9e3a7d2c0b48";
const TIPO = "tarefa_vencida";

const RECUSA = "Não foi possível salvar a preferência.";

const CONFLITO_DE_CHAVE: RespostaFalsa = {
  data: null,
  error: {
    message: "duplicate key value violates unique constraint",
    details: "",
    hint: "",
    code: "23505",
  },
};

const desligar = () => definirPreferencia(PESSOA, TIPO, false);

const metodos = () => chamadas.map((chamada) => chamada.metodo);

describe("write barrado pela RLS volta zero linha, e o repositório recusa com a mensagem certa", () => {
  beforeEach(() => {
    respostas = [UMA_LINHA];
    chamadas = [];
  });

  describe("a guarda do insert", () => {
    it("lança quando a RLS devolve lista vazia", async () => {
      respostas = [ZERO_LINHAS];

      await expect(desligar()).rejects.toThrow(RECUSA);
      expect(metodos()).toContain("insert");
      expect(metodos()).not.toContain("update");
    });

    it("lança igual quando o PostgREST devolve data null", async () => {
      respostas = [NENHUM_DADO];

      await expect(desligar()).rejects.toThrow(RECUSA);
      expect(metodos()).not.toContain("update");
    });

    it("passa quando a linha volta — o positivo ao lado do negativo", async () => {
      respostas = [UMA_LINHA];

      await expect(desligar()).resolves.toBeUndefined();
      expect(metodos()).toContain("insert");
    });
  });

  describe("a guarda do update, atrás do 23505", () => {
    it("lança quando a RLS devolve lista vazia", async () => {
      respostas = [CONFLITO_DE_CHAVE, ZERO_LINHAS];

      await expect(desligar()).rejects.toThrow(RECUSA);
      expect(metodos()).toContain("update");
    });

    it("lança igual quando o PostgREST devolve data null", async () => {
      respostas = [CONFLITO_DE_CHAVE, NENHUM_DADO];

      await expect(desligar()).rejects.toThrow(RECUSA);
      expect(metodos()).toContain("update");
    });

    it("passa quando a linha volta — o positivo ao lado do negativo", async () => {
      respostas = [CONFLITO_DE_CHAVE, UMA_LINHA];

      await expect(desligar()).resolves.toBeUndefined();
      expect(metodos()).toContain("update");
    });
  });
});
