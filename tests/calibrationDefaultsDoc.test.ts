import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SFS_BANDS, SFS_TRS_SCALE } from '@/services/siteFocus/profile';
import { DEFAULT_PRI_THRESHOLD, DEFAULT_TRS_THRESHOLD } from '@/services/urlProtection/decide';
import { PAGE_MODULE_PROFILE } from '@/services/hss';

const doc = readFileSync('.github/CALIBRATION_DEFAULTS.md', 'utf8');

describe('calibration defaults document matches shipped constants (#52 #81 #72)', () => {
  it('states the SFS scale and bands', () => {
    expect(doc).toContain(`| TRS multiplier | ${SFS_TRS_SCALE} |`);
    expect(doc).toContain(`${SFS_BANDS.excellent} / ${SFS_BANDS.good} / ${SFS_BANDS.moderate} / ${SFS_BANDS.weak}`);
  });

  it('states the URL protection thresholds', () => {
    expect(doc).toContain(`TRS below ${DEFAULT_TRS_THRESHOLD}, PRI below ${DEFAULT_PRI_THRESHOLD}`);
  });

  it('states the page-module minimums', () => {
    expect(PAGE_MODULE_PROFILE).toEqual({ minScored: 3, sprsMinPages: 3 });
    expect(doc).toContain('at least 3');
  });
});
