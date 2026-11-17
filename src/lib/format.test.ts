import { describe, expect, it } from 'vitest';
import { fmt, fmtDate, fmtSize, parseInstant, parseJsonArray } from './format';

describe('fmtSize', () => {
  it('байты, килобайты с одной цифрой после запятой, мегабайты', () => {
    expect(fmtSize(512)).toBe('512 Б');
    expect(fmtSize(2633)).toBe('2,6 КБ');
    expect(fmtSize(1112)).toBe('1,1 КБ');
    expect(fmtSize(50 * 1024 * 1024)).toBe('50 МБ');
    expect(fmtSize(null)).toBe('—');
  });
});

describe('parseInstant', () => {
  it('понимает время PostgreSQL со смещением без минут', () => {
    expect(parseInstant('2026-11-17 06:35:56+00').toISOString()).toBe('2026-11-17T06:35:56.000Z');
    expect(parseInstant('2026-11-17T06:35:56Z').toISOString()).toBe('2026-11-17T06:35:56.000Z');
    expect(parseInstant('2026-11-17 11:35:56.123+05').toISOString()).toBe('2026-11-17T06:35:56.123Z');
    // дата без времени не принимается за смещение
    expect(parseInstant('2026-11-17').toISOString()).toBe('2026-11-17T00:00:00.000Z');
  });
});

describe('fmt', () => {
  it('пустые значения показывает тире', () => {
    expect(fmt(null)).toBe('—');
    expect(fmt(undefined)).toBe('—');
    expect(fmt('')).toBe('—');
  });

  it('ноль — это значение, а не пустота', () => {
    expect(fmt(0)).toBe('0');
  });

  it('разделяет разряды', () => {
    // разделитель — неразрывный пробел, его вид зависит от версии ICU
    expect(fmt(1234567).replace(/\s/g, ' ')).toBe('1 234 567');
  });
});

describe('fmtDate', () => {
  it('переставляет части даты', () => {
    expect(fmtDate('2026-03-09')).toBe('09.03.2026');
  });

  it('отбрасывает время', () => {
    expect(fmtDate('2026-03-09T14:30:00Z')).toBe('09.03.2026');
  });

  it('пустое значение показывает тире', () => {
    expect(fmtDate(null)).toBe('—');
    expect(fmtDate(undefined)).toBe('—');
  });
});

describe('parseJsonArray', () => {
  it('разбирает массив', () => {
    expect(parseJsonArray<number>('[1,2]')).toEqual([1, 2]);
  });

  it('битые данные, не-массив и пустота дают пустой массив', () => {
    expect(parseJsonArray('{не json')).toEqual([]);
    expect(parseJsonArray('{"a":1}')).toEqual([]);
    expect(parseJsonArray(null)).toEqual([]);
  });
});
