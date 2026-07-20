// finext-nextjs/theme/colorHelpers.test.ts
// Run with: node --test theme/colorHelpers.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Theme } from '@mui/material';
import { classifyVsiBand, getVsiColor } from './colorHelpers.ts';

// Minimal mock theme: only palette.trend is read by getVsiColor.
// Sentinel values make it trivial to assert which band was selected.
const mockTheme = {
    palette: {
        trend: {
            up: 'UP',
            down: 'DOWN',
            ref: 'REF',
            ceil: 'CEIL',
            floor: 'FLOOR',
        },
    },
} as unknown as Theme;

test('classifyVsiBand: boundaries map to the single source of truth (0.6/0.9/1.2/1.5)', () => {
    assert.equal(classifyVsiBand(0), 'ref'); // special case: 0 -> ref
    assert.equal(classifyVsiBand(0.59), 'floor');
    assert.equal(classifyVsiBand(0.6), 'down'); // >= 0.6
    assert.equal(classifyVsiBand(0.89), 'down');
    assert.equal(classifyVsiBand(0.9), 'ref'); // >= 0.9
    assert.equal(classifyVsiBand(1.19), 'ref');
    assert.equal(classifyVsiBand(1.2), 'up'); // >= 1.2
    assert.equal(classifyVsiBand(1.49), 'up');
    assert.equal(classifyVsiBand(1.5), 'ceil'); // >= 1.5
    assert.equal(classifyVsiBand(2.0), 'ceil');
});

test('classifyVsiBand: small positive below 0.6 is floor (not the 0 special case)', () => {
    assert.equal(classifyVsiBand(0.0001), 'floor');
});

test('getVsiColor: maps band -> theme.palette.trend consistently', () => {
    assert.equal(getVsiColor(0, mockTheme), 'REF');
    assert.equal(getVsiColor(0.59, mockTheme), 'FLOOR');
    assert.equal(getVsiColor(0.6, mockTheme), 'DOWN');
    assert.equal(getVsiColor(0.9, mockTheme), 'REF');
    assert.equal(getVsiColor(1.2, mockTheme), 'UP');
    assert.equal(getVsiColor(1.5, mockTheme), 'CEIL');
});

test('getVsiColor: result matches classifyVsiBand for every probe value', () => {
    const probes = [0, 0.3, 0.59, 0.6, 0.75, 0.89, 0.9, 1.0, 1.19, 1.2, 1.35, 1.49, 1.5, 3.0];
    for (const vsi of probes) {
        const band = classifyVsiBand(vsi);
        assert.equal(getVsiColor(vsi, mockTheme), mockTheme.palette.trend[band]);
    }
});
