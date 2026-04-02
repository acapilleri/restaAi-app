import { wantsNearbyRestaurantContext } from '../../src/chat/nearbyIntent';

describe('wantsNearbyRestaurantContext', () => {
  it('returns true for location + piazza phrasing', () => {
    expect(wantsNearbyRestaurantContext('Sono in piazza galatea a Catania')).toBe(true);
  });

  it('returns true for Just Eat', () => {
    expect(wantsNearbyRestaurantContext('Ordina su Just Eat vicino a me')).toBe(true);
  });

  it('returns false for generic chat', () => {
    expect(wantsNearbyRestaurantContext('Come stai oggi?')).toBe(false);
  });
});
