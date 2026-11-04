const WalkInPlayer = require('../models/WalkInPlayer');
const { sendResponse } = require('../utils/helpers');

const validName = (value) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 100;
const optionalName = (value) => value === undefined || value === null ? null : typeof value === 'string' ? value.trim() || null : value;
const sessionNames = (body) => {
  if (Object.keys(body).some((key) => !['name', 'second_name', 'third_name', 'fourth_name', 'duration_minutes'].includes(key))) {
    return { error: 'Use the four player name fields only. A session supports a maximum of 4 players.' };
  }
  if (!validName(body.name) || !validName(body.second_name)) return { error: 'Enter the first two player names, each between 1 and 100 characters.' };
  const thirdName = optionalName(body.third_name);
  const fourthName = optionalName(body.fourth_name);
  if ((thirdName !== null && !validName(thirdName)) || (fourthName !== null && !validName(fourthName))) {
    return { error: 'Each optional player name must be between 1 and 100 characters.' };
  }
  if (fourthName !== null && thirdName === null) return { error: 'Add player 3 before player 4.' };
  return { name: body.name.trim(), secondName: body.second_name.trim(), thirdName, fourthName };
};
const validDuration = (value) => typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 720;
const validId = (value) => /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value));
const invalid = (res, message) => sendResponse(res, 400, { success: false, message });
const failure = (res, error, fallback) => {
  const missingSchema = ['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR'].includes(error.code);
  const statusCode = error.statusCode || (missingSchema ? 503 : 500);
  if (statusCode === 500) console.error(fallback, error);
  return sendResponse(res, statusCode, {
    success: false,
    message: missingSchema ? 'Player management needs a database upgrade. Run npm run db:migrate:players from backend.' : error.statusCode ? error.message : fallback
  });
};

const getPlayers = async (req, res) => {
  try {
    return sendResponse(res, 200, { data: await WalkInPlayer.findAll() });
  } catch (error) { return failure(res, error, 'Failed to load players.'); }
};

const addPlayer = async (req, res) => {
  const body = req.body || {};
  const names = sessionNames(body);
  if (names.error) return invalid(res, names.error);
  const { duration_minutes: durationMinutes = 60 } = body;
  if (!validDuration(durationMinutes)) return invalid(res, 'Timer duration must be a whole number from 1 to 720 minutes.');
  try {
    const player = await WalkInPlayer.create({ ...names, durationMinutes, createdBy: req.user.id });
    return sendResponse(res, 201, { message: 'Player session added.', data: { player, server_now: Date.now() } });
  } catch (error) { return failure(res, error, 'Failed to add the player.'); }
};

const renamePlayer = async (req, res) => {
  if (!validId(req.params.id)) return invalid(res, 'Choose a valid player.');
  const names = sessionNames(req.body || {});
  if (names.error) return invalid(res, names.error);
  try {
    const player = await WalkInPlayer.rename(Number(req.params.id), names);
    return sendResponse(res, 200, { message: 'Player names updated.', data: { player, server_now: Date.now() } });
  } catch (error) { return failure(res, error, 'Failed to update the player name.'); }
};

const removePlayer = async (req, res) => {
  if (!validId(req.params.id)) return invalid(res, 'Choose a valid player.');
  try {
    await WalkInPlayer.archive(Number(req.params.id));
    return sendResponse(res, 200, { message: 'Player removed from the list.' });
  } catch (error) { return failure(res, error, 'Failed to remove the player.'); }
};

const controlTimer = async (req, res) => {
  if (!validId(req.params.id)) return invalid(res, 'Choose a valid player.');
  const { action, duration_minutes: durationMinutes } = req.body || {};
  if (!['start', 'pause', 'reset', 'finish'].includes(action)) return invalid(res, 'Choose start, pause, reset, or finish for the timer.');
  if (durationMinutes !== undefined && (action !== 'reset' || !validDuration(durationMinutes))) {
    return invalid(res, 'A whole number from 1 to 720 minutes can be set when resetting the timer.');
  }
  try {
    const player = await WalkInPlayer.updateTimer(Number(req.params.id), action, durationMinutes);
    return sendResponse(res, 200, { message: 'Player timer updated.', data: { player, server_now: Date.now() } });
  } catch (error) { return failure(res, error, 'Failed to update the player timer.'); }
};

module.exports = { getPlayers, addPlayer, renamePlayer, removePlayer, controlTimer };
