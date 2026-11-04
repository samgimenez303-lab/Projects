export function remainingPlayerSeconds(player, serverNow = Date.now()) {
  const remaining = Number(player?.remaining_seconds);
  if (!Number.isFinite(remaining)) return 0;
  if (player?.status === 'finished') return 0;
  const started = Number(player?.timer_started_at);
  const elapsed = player?.status === 'running' && player?.timer_started_at !== null && Number.isFinite(started)
    ? Math.max(0, (serverNow - started) / 1000)
    : 0;
  return Math.max(0, Math.ceil(remaining - elapsed));
}

export function formatPlayerTimer(seconds) {
  const value = Math.max(0, Math.ceil(Number(seconds) || 0));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const remainder = value % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

export function playerTimerStatus(player, serverNow = Date.now()) {
  if (player?.status === 'finished' || (player?.status === 'running' && remainingPlayerSeconds(player, serverNow) === 0)) return 'finished';
  return player?.status || 'waiting';
}
