import { describe, expect, it } from 'vitest';
import { parseCapture } from './quickParse';

const TODAY = '2026-11-08'; // domingo

describe('parseCapture', () => {
  it.each([
    ['dentista amanhã às 15h', 'Dentista', '2026-11-09', '15:00'],
    ['Reunião hoje 9:30', 'Reunião', '2026-11-08', '09:30'],
    ['pagar boleto depois de amanhã', 'Pagar boleto', '2026-11-10', null],
    ['academia sexta 7h', 'Academia', '2026-11-13', '07:00'],
    ['ligar pro João na segunda as 10', 'Ligar pro João', '2026-11-09', '10:00'],
    ['domingo churrasco', 'Churrasco', '2026-11-15', null], // hoje é domingo → próximo
    ['entregar trabalho 12/11', 'Entregar trabalho', '2026-11-12', null],
    ['aniversário dia 05/01', 'Aniversário', '2027-01-05', null], // já passou neste ano
    ['prova 20/12/2026 às 19h30', 'Prova', '2026-12-20', '19:30'],
    ['comprar pão', 'Comprar pão', null, null],
  ])('"%s"', (input, title, date, time) => {
    expect(parseCapture(input, TODAY)).toEqual({ title, date, time });
  });

  it('ignora horários e datas inválidos', () => {
    expect(parseCapture('algo às 25h', TODAY)).toMatchObject({ time: null });
    expect(parseCapture('algo 31/02', TODAY)).toMatchObject({ date: null });
  });

  it('não confunde números soltos com horário', () => {
    expect(parseCapture('ler 20 páginas', TODAY)).toEqual({
      title: 'Ler 20 páginas',
      date: null,
      time: null,
    });
  });
});
