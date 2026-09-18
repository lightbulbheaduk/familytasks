(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.DaymarkCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const hashCredential = value => {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16);
  };

  const createEmptyState = () => ({
    setupComplete: false,
    activeProfile: null,
    parentId: null,
    profiles: [],
    tasks: [],
    rewards: []
  });

  const setupParent = (state, { name, password, initials, color = 'lavender' }) => {
    if (state.setupComplete || !name.trim() || password.length < 4) return false;
    const parent = { id: 'parent', name: name.trim(), role: 'Parent profile', initials: (initials || name.slice(0, 2)).toUpperCase(), color, passwordHash: hashCredential(password), points: 0, coins: 0, streak: 0 };
    state.setupComplete = true;
    state.parentId = parent.id;
    state.activeProfile = parent.id;
    state.profiles = [parent];
    return true;
  };

  const addChild = (state, { name, pin, initials, color = 'sage' }) => {
    if (!state.setupComplete || state.profiles.length === 0 || !name.trim() || pin.length < 4) return null;
    const id = `${name.toLowerCase().replace(/\W+/g, '-')}-${Date.now()}`;
    const child = { id, name: name.trim(), role: 'Standard profile', initials: (initials || name.slice(0, 2)).toUpperCase(), color, pinHash: hashCredential(pin), points: 0, coins: 0, streak: 0 };
    state.profiles.push(child);
    return child;
  };

  const authenticate = (state, profileId, credential) => {
    const profile = state.profiles.find(item => item.id === profileId);
    if (!profile) return false;
    const expected = profile.role === 'Parent profile' ? profile.passwordHash : profile.pinHash;
    if (expected !== hashCredential(credential)) return false;
    state.activeProfile = profileId;
    return true;
  };

  const logout = state => { state.activeProfile = null; };
  const isParent = (state, profileId = state.activeProfile) => Boolean(profileId && profileId === state.parentId);
  const canManage = (state, profileId = state.activeProfile) => isParent(state, profileId);
  const canComplete = (state, task) => Boolean(state.profiles.some(profile => profile.id === state.activeProfile && profile.id === task.profile));
  const isTaskAvailable = (task, now = Date.now()) => {
    if (!task.recurrence || !Number.isFinite(task.targetAt)) return true;
    const target = new Date(task.targetAt);
    const current = new Date(now);
    return target.getFullYear() < current.getFullYear() || (target.getFullYear() === current.getFullYear() && (target.getMonth() < current.getMonth() || (target.getMonth() === current.getMonth() && target.getDate() <= current.getDate())));
  };
  const validRecurrence = recurrence => recurrence && ['daily', 'weekly'].includes(recurrence.frequency) && Number.isInteger(recurrence.interval) && recurrence.interval > 0 && Array.isArray(recurrence.daysOfWeek) && recurrence.daysOfWeek.length > 0 && recurrence.daysOfWeek.every(day => Number.isInteger(day) && day >= 0 && day <= 6);
  const nextTarget = (targetAt, recurrence) => {
    if (recurrence.frequency === 'daily') return targetAt + recurrence.interval * 86400000;
    const date = new Date(targetAt);
    const days = [...recurrence.daysOfWeek].sort((first, second) => first - second);
    for (let offset = 1; offset <= 7 * recurrence.interval; offset += 1) {
      const candidate = new Date(targetAt + offset * 86400000);
      if (days.includes(candidate.getDay())) return candidate.getTime();
    }
    return date.getTime() + 7 * recurrence.interval * 86400000;
  };

  const addTask = (state, task) => {
    if (!canManage(state) || !task.title.trim() || !task.profile || !Number.isFinite(task.targetAt) || (task.notBeforeAt != null && (!Number.isFinite(task.notBeforeAt) || task.notBeforeAt > task.targetAt)) || (task.recurrence && !validRecurrence(task.recurrence))) return null;
    const created = { id: task.id || Date.now(), subtitle: task.subtitle || 'Added today', icon: task.icon || 'home', tag: task.tag || 'Ad hoc', due: task.due || 'Today', targetAt: null, notBeforeAt: null, recurrence: null, completionHistory: [], completed: false, startedAt: null, completedAt: null, min: Number(task.min) || 0, ...task };
    state.tasks.unshift(created);
    return created;
  };

  const addTaskGroup = (state, { title, tasks, profile, targetAt, notBeforeAt = null, recurrence = null, min = 0 }) => {
    if (!canManage(state) || !title.trim() || !profile || !Number.isFinite(targetAt) || (notBeforeAt != null && (!Number.isFinite(notBeforeAt) || notBeforeAt > targetAt)) || !Array.isArray(tasks) || (recurrence && !validRecurrence(recurrence))) return null;
    const titles = tasks.map(task => task.trim()).filter(Boolean);
    if (!titles.length) return null;
    const groupId = `group-${Date.now()}`;
    const created = titles.map((taskTitle, index) => ({
      id: `${groupId}-${index}`,
      title: taskTitle,
      subtitle: `${title.trim()} routine`,
      type: 'group',
      icon: 'home',
      tag: 'Routine',
      profile,
      groupId,
      groupTitle: title.trim(),
      targetAt,
      notBeforeAt,
      recurrence,
      completed: false,
      startedAt: null,
      completedAt: null,
      completionHistory: [],
      min: Number(min) || 0
    }));
    state.tasks.unshift(...created);
    return created;
  };

  const startTask = (state, taskId) => {
    const task = state.tasks.find(item => item.id === taskId);
    if (!task || !canComplete(state, task) || task.completed || task.startedAt || (Number.isFinite(task.notBeforeAt) && Date.now() < task.notBeforeAt)) return false;
    task.startedAt = Date.now();
    return true;
  };

  const completeTask = (state, taskId, now = Date.now()) => {
    const task = state.tasks.find(item => item.id === taskId);
    if (!task || !canComplete(state, task) || task.completed || !task.startedAt || (Number.isFinite(task.notBeforeAt) && now < task.notBeforeAt) || now - task.startedAt < task.min * 60000) return false;
    task.completed = true;
    task.completedAt = now;
    if (task.recurrence) task.completionHistory = [...(task.completionHistory || []), { startedAt: task.startedAt, completedAt: now }];
    const owner = state.profiles.find(profile => profile.id === task.profile);
    owner.points += 20;
    owner.coins += 2;
    if (task.recurrence) {
      const group = task.groupId ? state.tasks.filter(item => item.groupId === task.groupId) : [task];
      if (group.every(item => item.completed)) {
        const upcomingTarget = nextTarget(task.targetAt, task.recurrence);
        group.forEach(item => {
          item.completed = false;
          item.startedAt = null;
          item.completedAt = null;
          item.targetAt = upcomingTarget;
          if (Number.isFinite(item.notBeforeAt)) item.notBeforeAt = nextTarget(item.notBeforeAt, item.recurrence);
        });
      }
    }
    return true;
  };

  return { hashCredential, createEmptyState, setupParent, addChild, authenticate, logout, isParent, canManage, canComplete, isTaskAvailable, addTask, addTaskGroup, startTask, completeTask };
});