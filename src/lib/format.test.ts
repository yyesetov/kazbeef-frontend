import { describe, expect, it } from 'vitest';
import { fmt, fmtDate, parseJsonArray } from './format';

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
