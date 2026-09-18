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

  const addTask = (state, task) => {
    if (!canManage(state) || !task.title.trim() || !task.profile) return null;
    const created = { id: task.id || Date.now(), subtitle: task.subtitle || 'Added today', icon: task.icon || 'home', tag: task.tag || 'Ad hoc', due: task.due || 'Today', completed: false, startedAt: null, min: Number(task.min) || 0, ...task };
    state.tasks.unshift(created);
    return created;
  };

  const startTask = (state, taskId) => {
    const task = state.tasks.find(item => item.id === taskId);
    if (!task || !canComplete(state, task) || task.completed || task.startedAt) return false;
    task.startedAt = Date.now();
    return true;
  };

  const completeTask = (state, taskId, now = Date.now()) => {
    const task = state.tasks.find(item => item.id === taskId);
    if (!task || !canComplete(state, task) || task.completed || !task.startedAt || now - task.startedAt < task.min * 60000) return false;
    task.completed = true;
    task.startedAt = null;
    const owner = state.profiles.find(profile => profile.id === task.profile);
    owner.points += 20;
    owner.coins += 2;
    return true;
  };

  return { hashCredential, createEmptyState, setupParent, addChild, authenticate, logout, isParent, canManage, canComplete, addTask, startTask, completeTask };
});