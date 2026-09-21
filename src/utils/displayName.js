export const displayName = (user = {}) => {
  const name = [user.first_name || user.firstName, user.last_name || user.lastName].filter(Boolean).join(' ').trim();
  const username = String(user.username || '').trim();
  if (name && !name.includes('@')) return name;
  if (username && !username.includes('@')) return username;
  return (username || String(user.email || '')).split('@')[0] || 'Learner';
};
export const experienceProgress = (experience) => {
  const value = Number(experience);
  return Number.isFinite(value) ? ((Math.max(0, value) % 1000) / 1000) * 100 : 0;
};
