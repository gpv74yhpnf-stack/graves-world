import test from 'node:test';
import assert from 'node:assert/strict';
import { TOWN_RESIDENTS } from '../src/worldgen/town-life.mjs';

test('the town has distinct fictional residents with stable local routes', () => {
  assert.ok(TOWN_RESIDENTS.length >= 5);
  assert.equal(new Set(TOWN_RESIDENTS.map(person => person.id)).size, TOWN_RESIDENTS.length);
  assert.equal(new Set(TOWN_RESIDENTS.map(person => person.name)).size, TOWN_RESIDENTS.length);

  const allowedProps = new Set(['lantern', 'book', 'flower', 'satchel', 'scroll']);
  for (const person of TOWN_RESIDENTS) {
    assert.ok(Object.isFrozen(person));
    assert.ok(Object.isFrozen(person.route));
    assert.ok(person.name.length > 0 && person.role.length > 0);
    assert.ok(allowedProps.has(person.prop));
    assert.ok(Number.isSafeInteger(person.robe) && person.robe >= 0 && person.robe <= 0xffffff);
    assert.ok(Number.isSafeInteger(person.accent) && person.accent >= 0 && person.accent <= 0xffffff);
    assert.ok(person.route.length >= 4);
    assert.ok(Object.isFrozen(person.route[0]));
    for (const point of person.route) {
      assert.ok(Number.isFinite(point.x) && Number.isFinite(point.z));
      assert.ok(Math.hypot(point.x, point.z) < 34, `${person.name} should stay on the authored flat town floor`);
    }
  }
});
