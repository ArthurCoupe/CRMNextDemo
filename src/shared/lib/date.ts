const TZ = "America/Sao_Paulo";

const DATA_CIVIL = /^\d{4}-\d{2}-\d{2}$/;

const CIVIL_SP = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const DATA_PT = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ });

const DATA_HORA_PT = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ,
  dateStyle: "short",
  timeStyle: "short",
});

const MES_PT = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ,
  month: "long",
  year: "numeric",
});

const HORA_SP = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hour: "2-digit",
  hourCycle: "h23",
});

const HORA_MINUTO_SP = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export const DIAS_DA_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const;

export function todaySP(agora: Date = new Date()): string {
  return CIVIL_SP.format(agora);
}

export function horaSP(agora: Date = new Date()): number {
  return Number(HORA_SP.format(agora));
}

export function formatDate(valor: string | Date | null | undefined): string {
  if (valor === null || valor === undefined || valor === "") return "-";
  if (typeof valor === "string" && DATA_CIVIL.test(valor)) {
    const [ano, mes, dia] = valor.split("-");
    return `${dia}/${mes}/${ano}`;
  }
  return DATA_PT.format(new Date(valor));
}

export function formatDateTime(valor: string | Date | null | undefined): string {
  if (valor === null || valor === undefined || valor === "") return "-";
  return DATA_HORA_PT.format(new Date(valor));
}

export function formatMonth(valor: string | Date | null | undefined): string {
  if (valor === null || valor === undefined || valor === "") return "-";
  if (typeof valor === "string" && DATA_CIVIL.test(valor)) {
    return MES_PT.format(new Date(`${valor}T12:00:00Z`));
  }
  return MES_PT.format(new Date(valor));
}

export function ehDataCivil(valor: string): boolean {
  return DATA_CIVIL.test(valor);
}

const ANO_MINIMO = 2000;
const ANO_MAXIMO = 2100;

export function ehDataCivilPlausivel(valor: string): boolean {
  if (!ehDataCivil(valor)) return false;
  const ano = Number(valor.slice(0, 4));
  return ano >= ANO_MINIMO && ano <= ANO_MAXIMO;
}

function utcDaDataCivil(dataCivil: string): number {
  const [ano, mes, dia] = dataCivil.split("-").map(Number);
  return Date.UTC(ano, mes - 1, dia);
}

const MS_POR_DIA = 86_400_000;

export function daysOverdue(vencimento: string, agora: Date = new Date()): number {
  if (!DATA_CIVIL.test(vencimento)) return 0;
  const diff = (utcDaDataCivil(todaySP(agora)) - utcDaDataCivil(vencimento)) / MS_POR_DIA;
  return Math.max(0, diff);
}

export function isOverdue(vencimento: string, agora: Date = new Date()): boolean {
  return daysOverdue(vencimento, agora) > 0;
}

export function diasCivisAte(data: string, agora: Date = new Date()): number | null {
  if (data === "") return null;
  let civil: string;
  if (DATA_CIVIL.test(data)) {
    civil = data;
  } else {
    const instante = new Date(data);
    if (Number.isNaN(instante.getTime())) return null;
    civil = todaySP(instante);
  }
  return (utcDaDataCivil(civil) - utcDaDataCivil(todaySP(agora))) / MS_POR_DIA;
}

export function diasCivisDesde(data: string, agora: Date = new Date()): number | null {
  const ate = diasCivisAte(data, agora);
  if (ate === null) return null;
  return ate === 0 ? 0 : -ate;
}

export function somaDias(data: string, dias: number): string {
  if (!DATA_CIVIL.test(data)) return data;
  const alvo = new Date(utcDaDataCivil(data) + dias * MS_POR_DIA);
  return alvo.toISOString().slice(0, 10);
}

export function inicioDaSemanaSP(agora: Date = new Date()): string {
  const hoje = todaySP(agora);
  const diaDaSemana = new Date(utcDaDataCivil(hoje)).getUTCDay();
  return somaDias(hoje, -((diaDaSemana + 6) % 7));
}

export function horarioCurtoSP(instante: string, agora: Date = new Date()): string {
  const quando = new Date(instante);
  if (Number.isNaN(quando.getTime())) return "-";
  const hora = HORA_MINUTO_SP.format(quando);
  const dia = todaySP(quando);
  const distancia = Math.abs(utcDaDataCivil(dia) - utcDaDataCivil(todaySP(agora))) / MS_POR_DIA;
  if (distancia === 0) return hora;
  if (distancia <= 6) return `${DIAS_DA_SEMANA[new Date(utcDaDataCivil(dia)).getUTCDay()]} ${hora}`;
  return `${dia.slice(8, 10)}/${dia.slice(5, 7)} ${hora}`;
}

const HORA_DIGITADA = /^([01]\d|2[0-3]):[0-5]\d$/;

const PAREDE_SP = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function offsetDeSpEm(instanteMs: number): number {
  const partes = PAREDE_SP.formatToParts(new Date(instanteMs));
  const n = (tipo: Intl.DateTimeFormatPartTypes) =>
    Number(partes.find((p) => p.type === tipo)?.value);
  const paredeComoUtc = Date.UTC(
    n("year"),
    n("month") - 1,
    n("day"),
    n("hour"),
    n("minute"),
    n("second"),
  );
  return instanteMs - paredeComoUtc;
}

export function paraInstante(data: string, hora: string): string {
  if (!DATA_CIVIL.test(data)) throw new Error(`Data inválida: ${data}`);
  if (!HORA_DIGITADA.test(hora)) throw new Error(`Hora inválida: ${hora}`);

  const [ano, mes, dia] = data.split("-").map(Number);
  const diaCivil = new Date(Date.UTC(ano, mes - 1, dia));
  if (
    diaCivil.getUTCFullYear() !== ano ||
    diaCivil.getUTCMonth() !== mes - 1 ||
    diaCivil.getUTCDate() !== dia
  ) {
    throw new Error(`Data inválida: ${data}`);
  }

  const [h, m] = hora.split(":").map(Number);
  const comoUtc = Date.UTC(ano, mes - 1, dia, h, m);

  const candidato = comoUtc + offsetDeSpEm(comoUtc);
  return new Date(comoUtc + offsetDeSpEm(candidato)).toISOString();
}

export function dataEHoraSP(iso: string): { data: string; hora: string } {
  const partes = PAREDE_SP.formatToParts(new Date(iso));
  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((p) => p.type === tipo)?.value ?? "";
  return {
    data: `${valor("year")}-${valor("month")}-${valor("day")}`,
    hora: `${valor("hour")}:${valor("minute")}`,
  };
}
