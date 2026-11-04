const remainingAt = (player, now) => {
  const remaining = Number(player.remaining_seconds);
  if (player.status !== 'running' || player.timer_started_at === null) return remaining;
  return Math.max(0, remaining - Math.max(0, now - Number(player.timer_started_at)) / 1000);
};

const serializePlayer = (row, now = Date.now()) => {
  const player = {
    id: Number(row.id), name: row.name, second_name: row.second_name ?? null,
    third_name: row.third_name ?? null, fourth_name: row.fourth_name ?? null,
    duration_seconds: Number(row.duration_seconds),
    remaining_seconds: Number(row.remaining_seconds),
    timer_started_at: row.timer_started_at === null ? null : Number(row.timer_started_at),
    status: row.status
  };
  // Expiry is derived from the saved timestamp, including after reloads or restarts.
  if (player.status === 'running' && remainingAt(player, now) <= 0) {
    player.status = 'finished';
    player.remaining_seconds = 0;
    player.timer_started_at = null;
  }
  return player;
};

const timerTransition = (row, action, durationMinutes, now = Date.now()) => {
  const player = serializePlayer(row, now);
  const conflict = (message) => Object.assign(new Error(message), { statusCode: 409 });
  if (action === 'start') {
    if (typeof player.second_name !== 'string' || !player.second_name.trim()) throw conflict('Add the second player name before starting this session.');
    if (player.status === 'running') throw conflict('This player timer is already running.');
    if (player.status === 'finished' || player.remaining_seconds <= 0) throw conflict('Reset this player timer before starting another session.');
    player.status = 'running';
    player.timer_started_at = now;
  } else if (action === 'pause') {
    if (player.status !== 'running') throw conflict('Only a running player timer can be paused.');
    player.remaining_seconds = Math.round(remainingAt(player, now) * 1000) / 1000;
    player.timer_started_at = null;
    player.status = player.remaining_seconds > 0 ? 'paused' : 'finished';
  } else if (action === 'reset') {
    if (durationMinutes !== undefined) player.duration_seconds = durationMinutes * 60;
    player.remaining_seconds = player.duration_seconds;
    player.timer_started_at = null;
    player.status = 'waiting';
  } else if (action === 'finish') {
    player.remaining_seconds = 0;
    player.timer_started_at = null;
    player.status = 'finished';
  }
  return player;
};

module.exports = { remainingAt, serializePlayer, timerTransition };
