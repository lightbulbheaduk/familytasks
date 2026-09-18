const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../core.js');

const makeParent = () => {
  const state = core.createEmptyState();
  assert.equal(core.setupParent(state, { name: 'Sam', password: 'parent-pass', initials: 'SA' }), true);
  return state;
};

test('new installs contain only an unfinished setup state', () => {
  const state = core.createEmptyState();
  assert.equal(state.setupComplete, false);
  assert.deepEqual(state.profiles, []);
  assert.deepEqual(state.tasks, []);
  assert.deepEqual(state.rewards, []);
});

test('parent setup requires a name and four-character password', () => {
  const state = core.createEmptyState();
  assert.equal(core.setupParent(state, { name: '', password: 'pass' }), false);
  assert.equal(core.setupParent(state, { name: 'Sam', password: '123' }), false);
  assert.equal(core.setupParent(state, { name: 'Sam', password: '1234' }), true);
  assert.equal(state.profiles[0].role, 'Parent profile');
  assert.equal(state.profiles[0].passwordHash, core.hashCredential('1234'));
  assert.equal(state.tasks.length, 0);
  assert.equal(state.rewards.length, 0);
});

test('parent credentials authenticate and incorrect credentials do not', () => {
  const state = makeParent();
  core.logout(state);
  assert.equal(core.authenticate(state, 'parent', 'wrong'), false);
  assert.equal(state.activeProfile, null);
  assert.equal(core.authenticate(state, 'parent', 'parent-pass'), true);
  assert.equal(state.activeProfile, 'parent');
});

test('parent can create child accounts with zero progress', () => {
  const state = makeParent();
  const child = core.addChild(state, { name: 'Jamie', pin: '2468', initials: 'JA' });
  assert.equal(child.role, 'Standard profile');
  assert.equal(child.points, 0);
  assert.equal(child.coins, 0);
  assert.equal(core.authenticate(state, child.id, '2468'), true);
  assert.equal(core.authenticate(state, child.id, '0000'), false);
});

test('child accounts cannot create tasks', () => {
  const state = makeParent();
  const child = core.addChild(state, { name: 'Jamie', pin: '2468' });
  core.authenticate(state, child.id, '2468');
  assert.equal(core.addTask(state, { title: 'Brush teeth', profile: child.id }), null);
  assert.equal(state.tasks.length, 0);
});

test('parent can create tasks assigned to a child', () => {
  const state = makeParent();
  const child = core.addChild(state, { name: 'Jamie', pin: '2468' });
  const task = core.addTask(state, { title: 'Brush teeth', profile: child.id, min: 2, type: 'recurring' });
  assert.equal(task.title, 'Brush teeth');
  assert.equal(task.completed, false);
  assert.equal(task.min, 2);
});

test('only the assigned child can start and complete a task', () => {
  const state = makeParent();
  const child = core.addChild(state, { name: 'Jamie', pin: '2468' });
  const other = core.addChild(state, { name: 'Riley', pin: '1357' });
  const task = core.addTask(state, { title: 'Read', profile: child.id, min: 0 });
  core.authenticate(state, other.id, '1357');
  assert.equal(core.startTask(state, task.id), false);
  core.authenticate(state, child.id, '2468');
  assert.equal(core.startTask(state, task.id), true);
  assert.equal(core.completeTask(state, task.id, task.startedAt), true);
  assert.equal(state.profiles.find(profile => profile.id === child.id).points, 20);
  assert.equal(state.profiles.find(profile => profile.id === child.id).coins, 2);
});

test('minimum duration prevents early completion', () => {
  const state = makeParent();
  const child = core.addChild(state, { name: 'Jamie', pin: '2468' });
  const task = core.addTask(state, { title: 'Brush teeth', profile: child.id, min: 2 });
  core.authenticate(state, child.id, '2468');
  core.startTask(state, task.id);
  assert.equal(core.completeTask(state, task.id, task.startedAt + 119999), false);
  assert.equal(core.completeTask(state, task.id, task.startedAt + 120000), true);
});