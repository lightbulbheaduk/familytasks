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

test('only the parent can create child accounts', () => {
  const state = makeParent();
  core.logout(state);
  assert.equal(core.addChild(state, { name: 'Jamie', pin: '2468' }), null);

  core.authenticate(state, 'parent', 'parent-pass');
  const child = core.addChild(state, { name: 'Jamie', pin: '2468' });
  core.authenticate(state, child.id, '2468');
  assert.equal(core.addChild(state, { name: 'Riley', pin: '1357' }), null);
  assert.equal(state.profiles.length, 2);
});

test('task history records new completions and reads legacy completion records', () => {
  const state = makeParent();
  const child = core.addChild(state, { name: 'Jamie', pin: '2468' });
  state.tasks.push(
    { id: 'legacy-recurring', profile: child.id, title: 'Read', completionHistory: [{ completedAt: 100 }] },
    { id: 'legacy-completed', profile: child.id, title: 'Tidy up', completed: true, completedAt: 200 }
  );
  const task = core.addTask(state, { title: 'Make bed', profile: child.id, targetAt: 1000 });
  task.startedAt = 300;
  core.authenticate(state, child.id, '2468');

  assert.equal(core.completeTask(state, task.id, 1000), true);
  assert.deepEqual(core.getTaskHistory(state, child.id), [
    { taskId: 'legacy-recurring', title: 'Read', groupTitle: null, completedAt: 100, points: 20, coins: 2 },
    { taskId: 'legacy-completed', title: 'Tidy up', groupTitle: null, completedAt: 200, points: 20, coins: 2 },
    { taskId: task.id, title: 'Make bed', groupTitle: null, completedAt: 1000, points: 20, coins: 2 }
  ]);
  core.authenticate(state, 'parent', 'parent-pass');
  assert.equal(core.removeTask(state, task.id), true);
  assert.equal(core.getTaskHistory(state, child.id).length, 3);
});

test('task stats summarize weekly wins, active days, streaks, and lifetime wins', () => {
  const state = makeParent();
  const child = core.addChild(state, { name: 'Jamie', pin: '2468' });
  const now = new Date(2026, 10, 15, 12).getTime();
  child.taskHistory = [
    { taskId: 'old-win', title: 'Read', completedAt: new Date(2026, 10, 1, 12).getTime(), points: 20 },
    { taskId: 'friday-win', title: 'Tidy up', completedAt: new Date(2026, 10, 13, 12).getTime(), points: 20 },
    { taskId: 'saturday-win', title: 'Make bed', completedAt: new Date(2026, 10, 14, 12).getTime(), points: 20 },
    { taskId: 'sunday-win', title: 'Brush teeth', completedAt: new Date(2026, 10, 15, 12).getTime(), points: 20 }
  ];

  assert.deepEqual(core.getTaskStats(state, child.id, now), {
    dailyWins: [
      { date: new Date(2026, 10, 9).getTime(), count: 0 },
      { date: new Date(2026, 10, 10).getTime(), count: 0 },
      { date: new Date(2026, 10, 11).getTime(), count: 0 },
      { date: new Date(2026, 10, 12).getTime(), count: 0 },
      { date: new Date(2026, 10, 13).getTime(), count: 1 },
      { date: new Date(2026, 10, 14).getTime(), count: 1 },
      { date: new Date(2026, 10, 15).getTime(), count: 1 }
    ],
    winsLast7Days: 3,
    pointsLast7Days: 60,
    activeDays: 3,
    currentStreak: 3,
    allTimeWins: 4
  });
});

test('parent can delete a child and their assigned tasks', () => {
  const state = makeParent();
  const child = core.addChild(state, { name: 'Jamie', pin: '2468' });
  const other = core.addChild(state, { name: 'Riley', pin: '1357' });
  state.tasks.push(
    { id: 'jamie-task', profile: child.id },
    { id: 'riley-task', profile: other.id }
  );

  assert.equal(core.removeChild(state, child.id), true);
  assert.deepEqual(state.profiles.map(profile => profile.id), ['parent', other.id]);
  assert.deepEqual(state.tasks.map(task => task.id), ['riley-task']);
  assert.equal(core.removeChild(state, 'parent'), false);
});

test('children cannot delete profiles or tasks', () => {
  const state = makeParent();
  const child = core.addChild(state, { name: 'Jamie', pin: '2468' });
  const task = { id: 'task-1', profile: child.id };
  state.tasks.push(task);
  core.authenticate(state, child.id, '2468');

  assert.equal(core.removeChild(state, child.id), false);
  assert.equal(core.removeTask(state, task.id), false);
  assert.equal(state.profiles.length, 2);
  assert.equal(state.tasks.length, 1);
});

test('child accounts cannot create tasks', () => {
  const state = makeParent();
  const child = core.addChild(state, { name: 'Jamie', pin: '2468' });
  core.authenticate(state, child.id, '2468');
  assert.equal(core.addTask(state, { title: 'Brush teeth', profile: child.id }), null);
  assert.equal(core.addTaskGroup(state, { title: 'Routine', tasks: ['Brush teeth'], profile: child.id, targetAt: Date.now() }), null);
  assert.equal(state.tasks.length, 0);
});

test('parent can create tasks assigned to a child', () => {
  const state = makeParent();
  const child = core.addChild(state, { name: 'Jamie', pin: '2468' });
  assert.equal(core.addTask(state, { title: 'Missing target', profile: child.id }), null);
  const targetAt = Date.parse('2026-09-18T08:30:00');
  const task = core.addTask(state, { title: 'Brush teeth', profile: child.id, targetAt, recurrence: { frequency: 'weekly', interval: 1, daysOfWeek: [1, 2, 3, 4, 5] }, min: 2, type: 'recurring' });
  assert.equal(task.title, 'Brush teeth');
  assert.equal(task.completed, false);
  assert.equal(task.startedAt, null);
  assert.equal(task.completedAt, null);
  assert.equal(task.targetAt, targetAt);
  assert.equal(task.min, 2);
});

test('parent can delete a task', () => {
  const state = makeParent();
  const child = core.addChild(state, { name: 'Jamie', pin: '2468' });
  const task = core.addTask(state, { title: 'Brush teeth', profile: child.id, targetAt: Date.now() });

  assert.equal(core.removeTask(state, task.id), true);
  assert.equal(state.tasks.length, 0);
  assert.equal(core.removeTask(state, task.id), false);
});

test('only the assigned child can start and complete a task', () => {
  const state = makeParent();
  const child = core.addChild(state, { name: 'Jamie', pin: '2468' });
  const other = core.addChild(state, { name: 'Riley', pin: '1357' });
  const task = core.addTask(state, { title: 'Read', profile: child.id, targetAt: Date.now(), min: 0 });
  core.authenticate(state, other.id, '1357');
  assert.equal(core.startTask(state, task.id), false);
  core.authenticate(state, child.id, '2468');
  assert.equal(core.startTask(state, task.id), true);
  const startedAt = task.startedAt;
  const completedAt = startedAt + 1000;
  assert.equal(core.completeTask(state, task.id, completedAt), true);
  assert.equal(task.startedAt, startedAt);
  assert.equal(task.completedAt, completedAt);
  assert.equal(state.profiles.find(profile => profile.id === child.id).points, 20);
  assert.equal(state.profiles.find(profile => profile.id === child.id).coins, 2);
});

test('parent can authenticate a task action without switching profiles', () => {
  const state = makeParent();
  const child = core.addChild(state, { name: 'Jamie', pin: '2468' });
  const task = core.addTask(state, { title: 'Read', profile: child.id, targetAt: Date.now(), min: 0 });
  const parentId = state.activeProfile;
  assert.equal(core.authenticateTask(state, String(task.id), '0000'), null);
  const childId = core.authenticateTask(state, String(task.id), '2468');
  assert.equal(childId, child.id);
  assert.equal(core.startTask(state, String(task.id), childId), true);
  assert.equal(state.activeProfile, parentId);
});

test('parent can create a task group with one shared target time', () => {
  const state = makeParent();
  const child = core.addChild(state, { name: 'Jamie', pin: '2468' });
  const targetAt = Date.parse('2026-09-18T08:30:00');
  const tasks = core.addTaskGroup(state, { title: 'Morning routine', tasks: ['Get dressed', 'Brush hair', 'Brush teeth'], profile: child.id, targetAt, recurrence: { frequency: 'weekly', interval: 1, daysOfWeek: [1, 2, 3, 4, 5] } });
  assert.equal(tasks.length, 3);
  assert.deepEqual(tasks.map(task => task.title), ['Get dressed', 'Brush hair', 'Brush teeth']);
  assert.equal(new Set(tasks.map(task => task.groupId)).size, 1);
  assert.equal(new Set(tasks.map(task => task.targetAt)).size, 1);
  assert.equal(tasks[0].groupTitle, 'Morning routine');
  core.authenticate(state, child.id, '2468');
  assert.equal(core.startTask(state, tasks[0].id), true);
  assert.equal(core.completeTask(state, tasks[0].id, tasks[0].startedAt), true);
});

test('daily recurring groups do not require selected weekdays', () => {
  const state = makeParent();
  const child = core.addChild(state, { name: 'Jamie', pin: '2468' });
  const targetAt = Date.parse('2026-09-18T08:30:00');
  const tasks = core.addTaskGroup(state, {
    title: 'Morning routine',
    tasks: ['Get dressed', 'Brush teeth'],
    profile: child.id,
    targetAt,
    recurrence: { frequency: 'daily', interval: 1, daysOfWeek: [] }
  });

  assert.equal(tasks.length, 2);
  core.authenticate(state, child.id, '2468');
  tasks.forEach(task => {
    core.startTask(state, task.id);
    core.completeTask(state, task.id, task.startedAt);
  });
  assert.equal(tasks.every(task => task.targetAt === targetAt + 86400000), true);
});

test('recurring groups advance together after every child task is complete', () => {
  const state = makeParent();
  const child = core.addChild(state, { name: 'Jamie', pin: '2468' });
  const targetAt = Date.parse('2026-09-18T08:30:00');
  const tasks = core.addTaskGroup(state, { title: 'Morning routine', tasks: ['Get dressed', 'Brush teeth'], profile: child.id, targetAt, recurrence: { frequency: 'weekly', interval: 1, daysOfWeek: [5] } });
  core.authenticate(state, child.id, '2468');
  tasks.forEach(task => { core.startTask(state, task.id); core.completeTask(state, task.id, task.startedAt); });
  assert.equal(tasks.every(task => !task.completed), true);
  assert.equal(tasks.every(task => task.targetAt === Date.parse('2026-09-25T08:30:00')), true);
});

test('weekly recurrence intervals skip the inactive weeks', () => {
  const state = makeParent();
  const child = core.addChild(state, { name: 'Jamie', pin: '2468' });
  const targetAt = Date.parse('2026-09-18T08:30:00');
  const task = core.addTask(state, {
    title: 'Vacuum',
    profile: child.id,
    targetAt,
    recurrence: { frequency: 'weekly', interval: 2, daysOfWeek: [5] }
  });
  task.startedAt = targetAt;
  core.authenticate(state, child.id, '2468');

  assert.equal(core.completeTask(state, task.id, targetAt + 1000), true);
  assert.equal(task.targetAt, Date.parse('2026-10-02T08:30:00'));
});

test('weekly recurring groups require at least one selected weekday', () => {
  const state = makeParent();
  const child = core.addChild(state, { name: 'Jamie', pin: '2468' });

  assert.equal(core.addTaskGroup(state, {
    title: 'Morning routine',
    tasks: ['Get dressed'],
    profile: child.id,
    targetAt: Date.now(),
    recurrence: { frequency: 'weekly', interval: 1, daysOfWeek: [] }
  }), null);
});

test('group tasks can have different minimum durations', () => {
  const state = makeParent();
  const child = core.addChild(state, { name: 'Jamie', pin: '2468' });
  const tasks = core.addTaskGroup(state, { title: 'Morning routine', tasks: [{ title: 'Get dressed', min: 0 }, { title: 'Brush teeth', min: 2 }], profile: child.id, targetAt: Date.now() + 3600000, recurrence: { frequency: 'weekly', interval: 1, daysOfWeek: [5] } });
  assert.deepEqual(tasks.map(task => task.min), [0, 2]);
});

test('minimum duration prevents early completion', () => {
  const state = makeParent();
  const child = core.addChild(state, { name: 'Jamie', pin: '2468' });
  const task = core.addTask(state, { title: 'Brush teeth', profile: child.id, targetAt: Date.now(), min: 2 });
  core.authenticate(state, child.id, '2468');
  core.startTask(state, task.id);
  assert.equal(core.completeTask(state, task.id, task.startedAt + 119999), false);
  assert.equal(core.completeTask(state, task.id, task.startedAt + 120000), true);
});

test('recurring tasks preserve completion history and advance to the next occurrence', () => {
  const state = makeParent();
  const child = core.addChild(state, { name: 'Jamie', pin: '2468' });
  const targetAt = Date.parse('2026-09-18T08:30:00');
  const task = core.addTask(state, { title: 'Vacuum', profile: child.id, targetAt, recurrence: { frequency: 'weekly', interval: 1, daysOfWeek: [5] }, min: 0, type: 'recurring' });
  core.authenticate(state, child.id, '2468');
  core.startTask(state, task.id);
  const completedAt = task.startedAt + 1000;
  assert.equal(core.completeTask(state, task.id, completedAt), true);
  assert.equal(task.completed, false);
  assert.equal(task.targetAt, Date.parse('2026-09-25T08:30:00'));
  assert.deepEqual(task.completionHistory, [{ startedAt: completedAt - 1000, completedAt }]);
});

test('recurring tasks are unavailable until their target calendar day', () => {
  const targetAt = Date.parse('2026-09-19T08:30:00');
  const task = { recurrence: { frequency: 'weekly', interval: 1, daysOfWeek: [6] }, targetAt };
  assert.equal(core.isTaskAvailable(task, Date.parse('2026-09-18T23:59:59')), false);
  assert.equal(core.isTaskAvailable(task, Date.parse('2026-09-19T00:00:00')), true);
});

test('tasks cannot start before their not-before time', () => {
  const state = makeParent();
  const child = core.addChild(state, { name: 'Jamie', pin: '2468' });
  const notBeforeAt = Date.now();
  const task = core.addTask(state, { title: 'Wake up', profile: child.id, targetAt: notBeforeAt + 3600000, notBeforeAt });
  core.authenticate(state, child.id, '2468');
  assert.equal(core.startTask(state, task.id, child.id, notBeforeAt - 1), false);
  assert.equal(core.startTask(state, task.id, child.id, notBeforeAt), true);
});

test('recurring tasks cannot start before their target calendar day', () => {
  const state = makeParent();
  const child = core.addChild(state, { name: 'Jamie', pin: '2468' });
  const targetAt = Date.parse('2026-09-19T08:30:00');
  const task = core.addTask(state, {
    title: 'Vacuum',
    profile: child.id,
    targetAt,
    recurrence: { frequency: 'weekly', interval: 1, daysOfWeek: [6] }
  });
  core.authenticate(state, child.id, '2468');

  assert.equal(core.startTask(state, task.id, child.id, Date.parse('2026-09-18T23:59:59')), false);
  assert.equal(core.startTask(state, task.id, child.id, Date.parse('2026-09-19T00:00:00')), true);
});