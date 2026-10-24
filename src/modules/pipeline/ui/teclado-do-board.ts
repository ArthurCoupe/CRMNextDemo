import {
  KeyboardCode,
  type Active,
  type Announcements,
  type KeyboardCodes,
  type Over,
  type ScreenReaderInstructions,
} from "@dnd-kit/core";

export const TECLAS_DO_BOARD: KeyboardCodes = {
  start: [KeyboardCode.Space],
  cancel: [KeyboardCode.Esc],
  end: [KeyboardCode.Space, KeyboardCode.Tab],
};

export const INSTRUCOES_DO_BOARD: ScreenReaderInstructions = {
  draggable: `Para mover a oportunidade de estágio, aperte a barra de espaço.
Com a oportunidade levantada, use as setas esquerda e direita para escolher o estágio.
Aperte a barra de espaço de novo para soltar, ou Escape para cancelar.
Para abrir a ficha da oportunidade sem movê-la, aperte Enter.`,
};

export const ANUNCIOS_DO_BOARD: Announcements = {
  onDragStart: ({ active }) =>
    `${nome(active)} levantada. Use as setas esquerda e direita para escolher o estágio.`,
  onDragOver: ({ active, over }) =>
    over === null
      ? `${nome(active)} não está sobre nenhum estágio.`
      : `${nome(active)} está sobre ${rotulo(over)}.`,
  onDragEnd: ({ active, over }) =>
    over === null
      ? `${nome(active)} foi solta fora de um estágio e voltou para onde estava.`
      : `${nome(active)} foi solta em ${rotulo(over)}.`,
  onDragCancel: ({ active }) => `Movimento cancelado. ${nome(active)} voltou para onde estava.`,
};

function nome(active: Active): string {
  const dados = active.data.current;
  const valor = typeof dados?.nome === "string" ? dados.nome : null;
  return valor ?? "A oportunidade";
}

function rotulo(over: Over): string {
  const dados = over.data.current;
  return typeof dados?.nome === "string" ? dados.nome : "um estágio sem nome";
}
