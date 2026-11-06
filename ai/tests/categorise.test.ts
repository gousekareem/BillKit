import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { categorise, predictWithModel, resetCategoriserModelCache, type ExportedTfidfModel } from '../src/categorise.ts';
import { layoutOf } from './helpers.ts';

const cat = (lines: string[], merchant: string | null = lines[0] ?? null) => categorise({ layout: layoutOf(lines), merchantName: merchant, useStatisticalModel: false });

describe('rule-based categorisation', () => {
  it('suggests Food for restaurants with food items', () => {
    const r = cat(['ANNAPURNA RESTAURANT', 'Table 4', 'Item|Amount', 'Masala Dosa|80.00', 'Filter Coffee|30.00', 'Total|110.00']);
    expect(r.value).toBe('Food');
    expect(r.status).toBe('suggested');
    expect(r.reasons.join(' ')).toMatch(/restaurant/i);
  });
  it('suggests Groceries for supermarkets', () => {
    expect(cat(['HAPPY SUPERMARKET', 'Item Qty|Amount', 'Toor Dal 1kg|160.00', 'Rice 5kg|400.00', 'Total|560.00']).value).toBe('Groceries');
  });
  it('suggests Utilities with a subcategory for electricity bills', () => {
    const r = cat(['STATE POWER CORP', 'Electricity Bill', 'Units Consumed: 120 kWh', 'Amount Payable|900.00']);
    expect(r.value).toBe('Utilities');
    expect(r.subcategory).toBe('Electricity');
  });
  it('recognises known merchants from the lexicon', () => {
    expect(cat(['DMART', 'Total|300.00']).reasons.join(' ')).toMatch(/DMart/);
  });
  it('abstains (Unknown) when evidence is weak', () => {
    const r = cat(['ABC ENTERPRISES', 'Total|300.00']);
    expect(r.value).toBeNull();
    expect(r.status).toBe('unknown');
    expect(r.review).toBe('missing');
  });
  it('confidence is heuristic, not calibrated', () => {
    expect(cat(['ANNAPURNA RESTAURANT', 'Masala Dosa|80.00', 'Total|80.00']).confidenceKind).toBe('heuristic');
  });
});

describe('exported statistical model', () => {
  const model: ExportedTfidfModel = {
    format: 'billkit-tfidf-logreg/1', version: 'test-1', classes: ['Food', 'Groceries', 'Utilities'],
    vocabulary: { biryani: 0, rice: 1, electricity: 2 }, idf: [1, 1, 1],
    coef: [[3, 0, 0], [0, 3, 0], [0, 0, 3]], intercept: [0, 0, 0], ngramRange: [1, 1], analyzer: 'word', lowercase: true, trainedOn: 'unit-test',
  };
  it('reproduces softmax over TF-IDF features', () => {
    const p = predictWithModel(model, 'Chicken Biryani');
    expect(Object.entries(p).sort((a, b) => b[1] - a[1])[0]![0]).toBe('Food');
    expect(Object.values(p).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
  });
  afterEach(() => {
    delete process.env.BILLKIT_MODELS_DIR;
    resetCategoriserModelCache();
  });
  it('is loaded from the model registry and combined with rules', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bk-models-'));
    fs.writeFileSync(path.join(dir, 'm.json'), JSON.stringify(model));
    fs.writeFileSync(path.join(dir, 'registry.json'), JSON.stringify({ active: { categoriser: 'm.json' } }));
    process.env.BILLKIT_MODELS_DIR = dir;
    resetCategoriserModelCache();
    const r = categorise({ layout: layoutOf(['QUICK BITES', 'Item|Amount', 'Biryani|200.00', 'Total|200.00']), merchantName: 'QUICK BITES' });
    expect(r.source).toBe('combined');
    expect(r.reasons.join(' ')).toMatch(/Statistical model test-1/);
  });
});
