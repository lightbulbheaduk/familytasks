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
    const parent = { id: 'parent', name: name.trim(), role: 'Parent profile', initials: (initials || name.slice(0, 2)).toUpperCase(), color, passwordHash: hashCredential(password), points: 0, coins: 0, streak: 0, taskHistory: [] };
    state.setupComplete = true;
    state.parentId = parent.id;
    state.activeProfile = parent.id;
    state.profiles = [parent];
    return true;
  };

  const addChild = (state, { name, pin, initials, color = 'sage' }) => {
    if (!state.setupComplete || !canManage(state) || state.profiles.length === 0 || !name.trim() || pin.length < 4) return null;
    const id = `${name.toLowerCase().replace(/\W+/g, '-')}-${Date.now()}`;
    const child = { id, name: name.trim(), role: 'Standard profile', initials: (initials || name.slice(0, 2)).toUpperCase(), color, pinHash: hashCredential(pin), points: 0, coins: 0, streak: 0, taskHistory: [] };
    state.profiles.push(child);
    return child;
  };
  const removeChild = (state, profileId) => {
    const child = state.profiles.find(profile => profile.id === profileId && profile.role !== 'Parent profile');
    if (!canManage(state) || !child) return false;
    state.profiles = state.profiles.filter(profile => profile.id !== profileId);
    state.tasks = state.tasks.filter(task => task.profile !== profileId);
    if (state.activeProfile === profileId) state.activeProfile = null;
    return true;
  };

  const authenticate = (state, profileId, credential) => {
    const profile = state.profiles.find(item => item.id === profileId);
    if (!profile) return false;
    const expected = profile.role === 'Parent profile' ? profile.passwordHash : profile.pinHash;
    if (expected !== hashCredential(credential)) return false;
    state.activeProfile = profileId;
    return true;
  };
  const authenticateTask = (state, taskId, credential) => {
    const task = state.tasks.find(item => String(item.id) === String(taskId));
    const profile = task && state.profiles.find(item => item.id === task.profile);
    if (!profile) return null;
    const expected = profile.role === 'Parent profile' ? profile.passwordHash : profile.pinHash;
    return expected === hashCredential(credential) ? profile.id : null;
  };

  const logout = state => { state.activeProfile = null; };
  const isParent = (state, profileId = state.activeProfile) => Boolean(profileId && profileId === state.parentId);
  const canManage = (state, profileId = state.activeProfile) => isParent(state, profileId);
  const canComplete = (state, task, profileId = state.activeProfile) => Boolean(state.profiles.some(profile => profile.id === profileId && profile.id === task.profile));
  const getTaskHistory = (state, profileId) => {
    const profile = state.profiles.find(item => item.id === profileId);
    if (!profile) return [];
    const history = new Map();
    const addEntry = entry => {
      if (!entry || !Number.isFinite(entry.completedAt)) return;
      const key = `${String(entry.taskId)}:${entry.completedAt}`;
      if (!history.has(key)) history.set(key, entry);
    };
    (Array.isArray(profile.taskHistory) ? profile.taskHistory : []).forEach(addEntry);
    state.tasks.filter(task => task.profile === profileId).forEach(task => {
      (task.completionHistory || []).forEach(entry => addEntry({
        taskId: task.id,
        title: task.title,
        groupTitle: task.groupTitle || null,
        completedAt: entry.completedAt,
        points: 20,
        coins: 2
      }));
      if (task.completed) addEntry({
        taskId: task.id,
        title: task.title,
        groupTitle: task.groupTitle || null,
        completedAt: task.completedAt,
        points: 20,
        coins: 2
      });
    });
    return [...history.values()].sort((first, second) => first.completedAt - second.completedAt);
  };
  const getTaskStats = (state, profileId, now = Date.now()) => {
    const history = getTaskHistory(state, profileId)
      .filter(entry => entry.completedAt <= now);
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - 6);
    const dateKey = date => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    const dailyWins = Array.from({ length:7 }, (_, index) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + index);
      const key = dateKey(date);
      return {
        date: date.getTime(),
        count: history.filter(entry => dateKey(new Date(entry.completedAt)) === key).length
      };
    });
    const weekHistory = history.filter(entry => entry.completedAt >= weekStart.getTime());
    const activeDateKeys = new Set(history.map(entry => dateKey(new Date(entry.completedAt))));
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    let streakDate = activeDateKeys.has(dateKey(today)) ? new Date(today) : activeDateKeys.has(dateKey(yesterday)) ? yesterday : null;
    let currentStreak = 0;
    while (streakDate && activeDateKeys.has(dateKey(streakDate))) {
      currentStreak += 1;
      streakDate.setDate(streakDate.getDate() - 1);
    }
    return {
      dailyWins,
      winsLast7Days: weekHistory.length,
      pointsLast7Days: weekHistory.reduce((sum, entry) => sum + (Number.isFinite(entry.points) ? entry.points : 20), 0),
      activeDays: dailyWins.filter(day => day.count > 0).length,
      currentStreak,
      allTimeWins: history.length
    };
  };
  const isTaskAvailable = (task, now = Date.now()) => {
    if (!task.recurrence || !Number.isFinite(task.targetAt)) return true;
    const target = new Date(task.targetAt);
    const current = new Date(now);
    return target.getFullYear() < current.getFullYear() || (target.getFullYear() === current.getFullYear() && (target.getMonth() < current.getMonth() || (target.getMonth() === current.getMonth() && target.getDate() <= current.getDate())));
  };
  const validRecurrence = recurrence => recurrence && ['daily', 'weekly'].includes(recurrence.frequency) && Number.isInteger(recurrence.interval) && recurrence.interval > 0 && Array.isArray(recurrence.daysOfWeek) && recurrence.daysOfWeek.every(day => Number.isInteger(day) && day >= 0 && day <= 6) && (recurrence.frequency === 'daily' || recurrence.daysOfWeek.length > 0);
  const nextTarget = (targetAt, recurrence) => {
    if (recurrence.frequency === 'daily') {
      const next = new Date(targetAt);
      next.setDate(next.getDate() + recurrence.interval);
      return next.getTime();
    }
    const date = new Date(targetAt);
    const days = [...recurrence.daysOfWeek].sort((first, second) => first - second);
    const weekdayOffset = (date.getDay() + 6) % 7;
    for (let offset = 1; offset <= 7 * recurrence.interval + 7; offset += 1) {
      const candidate = new Date(targetAt);
      candidate.setDate(date.getDate() + offset);
      const weekOffset = Math.floor((weekdayOffset + offset) / 7);
      const isScheduledWeek = recurrence.interval === 1 ? weekOffset >= 0 : weekOffset > 0 && weekOffset % recurrence.interval === 0;
      if (isScheduledWeek && days.includes(candidate.getDay())) return candidate.getTime();
    }
    return date.getTime() + 7 * recurrence.interval * 86400000;
  };

  const addTask = (state, task) => {
    if (!canManage(state) || !task.title.trim() || !task.profile || !Number.isFinite(task.targetAt) || (task.notBeforeAt != null && (!Number.isFinite(task.notBeforeAt) || task.notBeforeAt > task.targetAt)) || (task.recurrence && !validRecurrence(task.recurrence))) return null;
    const created = { id: task.id || Date.now(), subtitle: task.subtitle || 'Added today', icon: task.icon || 'home', tag: task.tag || 'Ad hoc', due: task.due || 'Today', targetAt: null, notBeforeAt: null, recurrence: null, completionHistory: [], completed: false, startedAt: null, completedAt: null, min: Number(task.min) || 0, ...task };
    state.tasks.unshift(created);
    return created;
  };
  const removeTask = (state, taskId) => {
    if (!canManage(state)) return false;
    const taskIndex = state.tasks.findIndex(task => String(task.id) === String(taskId));
    if (taskIndex < 0) return false;
    const owner = state.profiles.find(profile => profile.id === state.tasks[taskIndex].profile);
    if (owner) owner.taskHistory = getTaskHistory(state, owner.id);
    state.tasks.splice(taskIndex, 1);
    return true;
  };

  const addTaskGroup = (state, { title, tasks, profile, targetAt, notBeforeAt = null, recurrence = null, min = 0 }) => {
    if (!canManage(state) || !title.trim() || !profile || !Number.isFinite(targetAt) || (notBeforeAt != null && (!Number.isFinite(notBeforeAt) || notBeforeAt > targetAt)) || !Array.isArray(tasks) || (recurrence && !validRecurrence(recurrence))) return null;
    const entries = tasks.map(task => typeof task === 'string' ? { title: task, min: 0 } : task).filter(task => task && typeof task.title === 'string' && task.title.trim());
    if (!entries.length) return null;
    const groupId = `group-${Date.now()}`;
    const created = entries.map((entry, index) => ({
      id: `${groupId}-${index}`,
      title: entry.title.trim(),
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
      min: Number(entry.min ?? min) || 0
    }));
    state.tasks.unshift(...created);
    return created;
  };

  const startTask = (state, taskId, profileId = state.activeProfile, now = Date.now()) => {
    const task = state.tasks.find(item => String(item.id) === String(taskId));
    if (!task || !canComplete(state, task, profileId) || task.completed || task.startedAt || !isTaskAvailable(task, now) || (Number.isFinite(task.notBeforeAt) && now < task.notBeforeAt)) return false;
    task.startedAt = now;
    return true;
  };

  const completeTask = (state, taskId, now = Date.now(), profileId = state.activeProfile) => {
    const task = state.tasks.find(item => String(item.id) === String(taskId));
    if (!task || !canComplete(state, task, profileId) || task.completed || !task.startedAt || (Number.isFinite(task.notBeforeAt) && now < task.notBeforeAt) || now - task.startedAt < task.min * 60000) return false;
    const owner = state.profiles.find(profile => profile.id === task.profile);
    if (!owner) return false;
    if (!Array.isArray(owner.taskHistory)) owner.taskHistory = getTaskHistory(state, owner.id);
    task.completed = true;
    task.completedAt = now;
    owner.taskHistory.push({ taskId: task.id, title: task.title, groupTitle: task.groupTitle || null, completedAt: now, points: 20, coins: 2 });
    if (task.recurrence) task.completionHistory = [...(task.completionHistory || []), { startedAt: task.startedAt, completedAt: now }];
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

  return { hashCredential, createEmptyState, setupParent, addChild, removeChild, authenticate, authenticateTask, logout, isParent, canManage, canComplete, getTaskHistory, getTaskStats, isTaskAvailable, addTask, removeTask, addTaskGroup, startTask, completeTask };
});