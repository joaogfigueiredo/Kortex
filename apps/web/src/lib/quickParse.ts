import { addDaysStr, parseDateStr, toDateStr } from './dates';

export interface ParsedCapture {
  /** Texto sem as expressões de data/hora reconhecidas. */
  title: string;
  date: string | null; // YYYY-MM-DD
  time: string | null; // HH:mm
}

const WEEKDAYS: Record<string, number> = {
  domingo: 0,
  segunda: 1,
  'segunda-feira': 1,
  terca: 2,
  'terca-feira': 2,
  quarta: 3,
  'quarta-feira': 3,
  quinta: 4,
  'quinta-feira': 4,
  sexta: 5,
  'sexta-feira': 5,
  sabado: 6,
};

const strip = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/**
 * Lê data/hora em português de um texto livre:
 * "hoje", "amanhã", "depois de amanhã", dias da semana ("sexta", "na segunda"),
 * "12/11", "12/11/2026", horários "15h", "15h30", "15:30", "às 9".
 * Ex.: "dentista amanhã às 15h" → { title: "Dentista", date: <amanhã>, time: "15:00" }
 */
export function parseCapture(input: string, today: string): ParsedCapture {
  let text = ` ${input.trim()} `;
  let date: string | null = null;
  let time: string | null = null;

  const take = (re: RegExp, fn: (m: RegExpExecArray) => boolean) => {
    const m = re.exec(strip(text));
    if (m && fn(m)) {
      // remove o trecho reconhecido usando as mesmas posições no texto original
      text = text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length);
    }
  };

  // Horário: "às 15h30", "as 9", "15h", "15:30", "15 h"
  take(
    /\s(?:a?s\s+)?(\d{1,2})(?:\s?h\s?(\d{2})?|:(\d{2}))(?=\s)|\s(?:a?s)\s+(\d{1,2})(?=\s)/u,
    (m) => {
      const h = Number(m[1] ?? m[4]);
      const min = Number(m[2] ?? m[3] ?? 0);
      if (h > 23 || min > 59) return false;
      time = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
      return true;
    },
  );

  // Data relativa
  take(/\s(depois de amanha|amanha|hoje)(?=\s)/u, (m) => {
    date = m[1] === 'hoje' ? today : addDaysStr(today, m[1] === 'amanha' ? 1 : 2);
    return true;
  });

  // Dia da semana: próxima ocorrência (hoje não conta; "sexta" numa sexta = próxima)
  if (!date)
    take(
      /\s(?:(?:na|no|nesta|neste|proxima|proximo)\s+)?(domingo|segunda(?:-feira)?|terca(?:-feira)?|quarta(?:-feira)?|quinta(?:-feira)?|sexta(?:-feira)?|sabado)(?=\s)/u,
      (m) => {
        const target = WEEKDAYS[m[1]!]!;
        const cur = parseDateStr(today).getDay();
        date = addDaysStr(today, (target - cur + 7) % 7 || 7);
        return true;
      },
    );

  // Data explícita: "12/11" ou "12/11/2026" (sem ano = próxima ocorrência)
  if (!date)
    take(/\s(?:dia\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?=\s)/u, (m) => {
      const d = Number(m[1]);
      const mo = Number(m[2]);
      if (d < 1 || d > 31 || mo < 1 || mo > 12) return false;
      const ty = parseDateStr(today).getFullYear();
      let y = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : ty;
      const candidate = new Date(y, mo - 1, d, 12);
      if (candidate.getMonth() !== mo - 1) return false; // 31/02 etc.
      if (!m[3] && toDateStr(candidate) < today) y += 1;
      date = toDateStr(new Date(y, mo - 1, d, 12));
      return true;
    });

  const title = text.replace(/\s{2,}/g, ' ').trim();
  return { title: title ? title[0]!.toUpperCase() + title.slice(1) : '', date, time };
}
