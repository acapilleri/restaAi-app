import { parseProfileHints } from '../../src/onboarding/parseProfileHints';
import { ONBOARDING_MENU_CHIP, ONBOARDING_YC_STEPS } from '../../src/onboarding/stepsYc';

describe('parseProfileHints', () => {
  it('parses chip esempio mockup', () => {
    const p = parseProfileHints('45 anni, 178 cm, 98 kg, obiettivo 85 kg');
    expect(p.age).toBe(45);
    expect(p.height_cm).toBe(178);
    expect(p.current_weight_kg).toBe(98);
    expect(p.goal_weight_kg).toBe(85);
  });

  it('handles comma decimals', () => {
    const p = parseProfileHints('30 anni, 170 cm, 80,5 kg, obiettivo 72,5 kg');
    expect(p.age).toBe(30);
    expect(p.goal_weight_kg).toBeCloseTo(72.5);
    expect(p.current_weight_kg).toBeCloseTo(80.5);
  });

  it('returns empty for non numerici', () => {
    expect(parseProfileHints('Inserisco i dati')).toEqual({});
  });
});

describe('onboarding YC steps', () => {
  it('ha 4 step e ultimo include chip menù', () => {
    expect(ONBOARDING_YC_STEPS).toHaveLength(4);
    expect(ONBOARDING_YC_STEPS[3].chips).toContain(ONBOARDING_MENU_CHIP);
  });

  it('step 1 ha extract per system chip dopo risposta a step 0', () => {
    expect(ONBOARDING_YC_STEPS[0].extract).toBeNull();
    expect(ONBOARDING_YC_STEPS[1].extract).toContain('Problema riconosciuto');
  });
});
