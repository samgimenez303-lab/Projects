import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, Expand, Flag, Menu, Minimize, Pause, Pencil, Play, Plus, RefreshCw, RotateCcw, Settings2, Trash2, UserRound, Users, X } from 'lucide-react';
import { playersAPI } from '../services/api';
import { playerTimerStatus, remainingPlayerSeconds } from '../utils/playerTimer';
import { useSearchParams } from 'react-router-dom';
import useDialog from '../hooks/useDialog';
import '../styles/player-board.css';

const roster = player => [player?.name, player?.second_name, player?.third_name, player?.fourth_name].filter(value => typeof value === 'string' && value.trim());
const sessionName = player => roster(player).join(' & ') || 'New match';
const statusLabels = { waiting: 'Ready to play', running: 'Match in progress', paused: 'Match paused', finished: 'Session finished' };
const matchTime = seconds => [Math.floor(Math.max(0, Math.ceil(seconds)) / 3600), Math.floor(Math.max(0, Math.ceil(seconds)) % 3600 / 60), Math.max(0, Math.ceil(seconds)) % 60].map(part => String(part).padStart(2, '0')).join(':');

function PaddleMark() {
  return <svg className="match-brand-mark" viewBox="0 0 88 64" fill="none" aria-hidden="true"><g stroke="currentColor" strokeWidth="3.5" strokeLinejoin="round"><rect x="11" y="17" width="27" height="35" rx="10" transform="rotate(-38 11 17)" /><path d="m34 42 13 16" /><rect x="55" y="0" width="27" height="35" rx="10" transform="rotate(38 55 0)" /><path d="M54 42 42 57" /></g><circle cx="44" cy="14" r="12" fill="#b9f73b" /><g fill="#075537"><circle cx="41" cy="8" r="2" /><circle cx="49" cy="12" r="2" /><circle cx="39" cy="17" r="2" /><circle cx="46" cy="22" r="2" /></g></svg>;
}

function RosterDialog({ editor, busy, onClose, onSave }) {
  const id = useId();
  const initial = editor.player;
  const [names, setNames] = useState([initial?.name || '', initial?.second_name || '', initial?.third_name || '', initial?.fourth_name || '']);
  const [count, setCount] = useState(initial?.fourth_name ? 4 : initial?.third_name ? 3 : 2);
  const [minutes, setMinutes] = useState(String((initial?.duration_seconds || 3600) / 60));
  const dialogRef = useDialog(true, onClose, busy);
  const isRoster = ['create', 'names'].includes(editor.type);
  const title = { create: 'Set up your match', names: 'Edit players', reset: 'Reset match timer', remove: 'Remove session' }[editor.type];
  const removeSlot = index => { setNames(current => [...current.slice(0, index), ...current.slice(index + 1), '']); setCount(current => current - 1); };
  return <div className="match-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <div ref={dialogRef} className="match-dialog" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} tabIndex={-1}>
      <div className="match-dialog-heading"><div><span className="match-dialog-eyebrow">PICKLEBOOK MATCH CONTROL</span><h3 id={`${id}-title`}>{title}</h3></div><button type="button" className="match-dialog-close" onClick={onClose} disabled={busy} aria-label="Close match settings"><X size={20} /></button></div>
      <form onSubmit={async event => {
        event.preventDefault();
        if (await onSave(editor, { name: names[0].trim(), second_name: names[1].trim(), third_name: count > 2 ? names[2].trim() : null, fourth_name: count > 3 ? names[3].trim() : null, duration_minutes: Number(minutes) })) onClose();
      }}>
        {isRoster && <><p className="match-dialog-copy">Two to four players. One shared timer. No court reservation needed.</p><div className="match-roster-fields">{names.slice(0, count).map((name, index) => <div className="match-roster-field" key={index}><label htmlFor={`${id}-player-${index + 1}`}>Player {index + 1} name <span>Team {index % 2 + 1}</span></label><div><input id={`${id}-player-${index + 1}`} name={['name', 'second_name', 'third_name', 'fourth_name'][index]} value={name} onChange={event => setNames(current => current.map((value, position) => position === index ? event.target.value : value))} placeholder={`Enter player ${index + 1} name`} maxLength={100} required pattern=".*\S.*" disabled={busy} autoComplete="off" />{index > 1 && <button type="button" disabled={busy} onClick={() => removeSlot(index)} aria-label={`Remove player ${index + 1}`}><X size={17} /></button>}</div></div>)}</div><div className="match-roster-add"><button type="button" className="match-dialog-secondary" disabled={busy || count >= 4} onClick={() => setCount(current => Math.min(4, current + 1))}><Plus size={15} />Add player</button><span>{count} / 4 players{count === 4 ? ' · Maximum reached' : ''}</span></div></>}
        {['create', 'reset'].includes(editor.type) && <div className="match-duration-field"><label htmlFor={`${id}-minutes`}>Session length <span>minutes</span></label><input id={`${id}-minutes`} name="duration_minutes" type="number" min={1} max={720} step={1} value={minutes} onChange={event => setMinutes(event.target.value)} required disabled={busy} />{editor.type === 'reset' && <p className="match-dialog-copy">This returns the countdown to the selected duration. Start it when the players are ready.</p>}</div>}
        {editor.type === 'names' && <p className="match-dialog-copy">The timer keeps its remaining time when names are saved.</p>}
        {editor.type === 'remove' && <p className="match-dialog-copy">Remove the session for <strong>{sessionName(initial)}</strong> from the active list?</p>}
        <div className="match-dialog-actions"><button type="button" className="match-dialog-secondary" disabled={busy} onClick={onClose}>Cancel</button><button type="submit" className={`match-dialog-primary ${editor.type === 'remove' ? 'match-dialog-danger' : ''}`} disabled={busy || (isRoster && names.slice(0, count).some(value => !value.trim()))}>{busy ? 'Saving…' : { create: 'Create session', names: 'Save names', reset: 'Reset timer', remove: 'Remove session' }[editor.type]}</button></div>
      </form>
    </div>
  </div>;
}

function TeamPanel({ names, team, doubles }) {
  return <div className="match-player-panel"><div className="match-player-panel-top">{doubles ? <Users size={30} strokeWidth={2.4} /> : <UserRound size={31} strokeWidth={2.4} />}<span>{doubles ? `TEAM ${team}` : `PLAYER ${team}`}</span></div><div className="match-player-panel-names">{names.length ? names.map((name, index) => <span key={index} data-testid="match-player-name">{name}</span>) : <span className="match-player-placeholder">PLAYER {team}</span>}</div></div>;
}

export default function PlayerBoard() {
  const id = useId();
  const [searchParams, setSearchParams] = useSearchParams();
  const [players, setPlayers] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [clockOffset, setClockOffset] = useState(0);
  const [clock, setClock] = useState(Date.now());
  const [editor, setEditor] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const stageRef = useRef(null);
  const fullscreenButtonRef = useRef(null);
  const mounted = useRef(false);
  const inFlight = useRef(false);
  const mutating = useRef(false);
  const revision = useRef(0);
  useEffect(() => {
    if (searchParams.get('create') !== '1') return;
    setEditor({ type: 'create', player: null });
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('create');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);
  const syncClock = value => { if (Number.isFinite(Number(value))) setClockOffset(Number(value) - Date.now()); setClock(Date.now()); };
  const fetchPlayers = useCallback(async () => {
    if (!mounted.current || inFlight.current || mutating.current) return;
    inFlight.current = true;
    const requestRevision = ++revision.current;
    setRefreshing(true);
    try {
      const response = await playersAPI.getAll();
      const data = response.data?.data;
      if (!Array.isArray(data?.players) || !Number.isFinite(Number(data.server_now))) throw new Error('The session list could not be read.');
      if (mounted.current && revision.current === requestRevision) {
        setPlayers(data.players);
        setSelectedId(current => data.players.some(player => player.id === current) ? current : data.players[0]?.id ?? null);
        syncClock(data.server_now); setFetchError('');
      }
    } catch (error) { if (mounted.current && revision.current === requestRevision) setFetchError(error.message || 'Unable to load sessions.'); }
    finally { inFlight.current = false; if (mounted.current) { setLoading(false); setRefreshing(false); } if (mounted.current && revision.current !== requestRevision && !mutating.current) fetchPlayers(); }
  }, []);
  useEffect(() => {
    mounted.current = true; fetchPlayers();
    const refreshVisible = () => { if (document.visibilityState !== 'hidden') fetchPlayers(); };
    const poll = window.setInterval(refreshVisible, 15000), tick = window.setInterval(() => setClock(Date.now()), 1000);
    window.addEventListener('focus', refreshVisible); document.addEventListener('visibilitychange', refreshVisible);
    return () => { mounted.current = false; revision.current += 1; window.clearInterval(poll); window.clearInterval(tick); window.removeEventListener('focus', refreshVisible); document.removeEventListener('visibilitychange', refreshVisible); };
  }, [fetchPlayers]);
  useEffect(() => { const sync = () => setNativeFullscreen(document.fullscreenElement === stageRef.current); document.addEventListener('fullscreenchange', sync); return () => document.removeEventListener('fullscreenchange', sync); }, []);
  useEffect(() => {
    if (!nativeFullscreen || editor) return undefined;
    const exitOnEscape = event => {
      if (event.key === 'Escape' && document.fullscreenElement === stageRef.current) {
        document.exitFullscreen().catch(() => {});
      }
    };
    document.addEventListener('keydown', exitOnEscape);
    return () => document.removeEventListener('keydown', exitOnEscape);
  }, [nativeFullscreen, editor]);
  useEffect(() => {
    if (!expanded) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    fullscreenButtonRef.current?.focus();
    return () => { document.body.style.overflow = previousOverflow; };
  }, [expanded]);
  useEffect(() => {
    if (!expanded) return undefined;
    const handleKey = event => {
      if (editor) return;
      if (event.key === 'Escape') { setExpanded(false); fullscreenButtonRef.current?.focus(); }
      if (event.key !== 'Tab') return;
      const controls = [...stageRef.current.querySelectorAll('button:not(:disabled), select:not(:disabled), input:not(:disabled), [tabindex="0"]')], first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [expanded, editor]);
  const toggleFullscreen = async () => {
    if (expanded) { setExpanded(false); return; }
    if (document.fullscreenElement === stageRef.current) { try { await document.exitFullscreen(); } catch { setActionError('Use Escape to leave fullscreen.'); } return; }
    if (!stageRef.current?.requestFullscreen) { setExpanded(true); return; }
    try { await stageRef.current.requestFullscreen(); } catch { if (mounted.current) setExpanded(true); }
  };
  const mutate = async (operation, message, options = {}) => {
    if (mutating.current || !mounted.current) return false;
    mutating.current = true; revision.current += 1; setBusy(true); setActionError(''); setNotice('');
    let success = false;
    try {
      const response = await operation(); if (!mounted.current) return false;
      if (options.removeId !== undefined) setPlayers(current => current.filter(player => player.id !== options.removeId));
      else {
        const data = response.data?.data;
        if (!data?.player?.id || !Number.isFinite(Number(data.server_now))) throw new Error('The saved session could not be read. Refresh the session list before trying again.');
        setPlayers(current => current.some(player => player.id === data.player.id) ? current.map(player => player.id === data.player.id ? data.player : player) : [data.player, ...current]);
        if (options.select) setSelectedId(data.player.id); syncClock(data.server_now);
      }
      setNotice(message); success = true;
    } catch (error) { if (mounted.current) setActionError(error.message || 'This change could not be saved.'); }
    finally { mutating.current = false; if (mounted.current) setBusy(false); if (!success) fetchPlayers(); }
    return success;
  };
  const selected = players.find(player => player.id === selectedId) || players[0] || null;
  const now = clock + clockOffset, status = selected ? playerTimerStatus(selected, now) : 'waiting', names = roster(selected);
  const leftNames = [selected?.name, selected?.third_name].filter(Boolean), rightNames = [selected?.second_name, selected?.fourth_name].filter(Boolean);
  const hasBothNames = Boolean(selected?.name?.trim() && selected?.second_name?.trim()), isFullscreen = nativeFullscreen || expanded;
  const remaining = selected ? remainingPlayerSeconds(selected, now) : 0;
  const openEditor = type => { setActionError(''); setMenuOpen(false); setEditor({ type, player: type === 'create' ? null : selected }); };
  const timerAction = action => mutate(() => playersAPI.timer(selected.id, action), 'Match timer updated.');
  const saveEditor = (currentEditor, payload) => {
    if (currentEditor.type === 'create') return mutate(() => playersAPI.create(payload), 'Match session created.', { select: true });
    if (currentEditor.type === 'names') { const { duration_minutes, ...rosterPayload } = payload; return mutate(() => playersAPI.update(currentEditor.player.id, rosterPayload), 'Player names saved.'); }
    if (currentEditor.type === 'reset') return mutate(() => playersAPI.timer(currentEditor.player.id, 'reset', payload.duration_minutes), 'Match timer reset.');
    return mutate(() => playersAPI.remove(currentEditor.player.id), 'Session removed.', { removeId: currentEditor.player.id });
  };
  return <section className="player-board" aria-labelledby={`${id}-heading`}>
    <div className="player-board-toolbar"><div><h2 id={`${id}-heading`}>Match control</h2><p>Up to 4 players · One shared timer</p></div><div className="player-board-toolbar-actions"><label className="player-board-session-select"><span className="sr-only">Select session</span><select aria-label="Select session" value={selected?.id || ''} onChange={event => setSelectedId(Number(event.target.value))} disabled={busy || !players.length}>{!players.length && <option value="">No active sessions</option>}{players.map(player => <option key={player.id} value={player.id}>{sessionName(player)}</option>)}</select><ChevronDown size={15} /></label><button type="button" className="player-board-refresh" onClick={fetchPlayers} disabled={refreshing || busy} aria-label="Refresh players"><RefreshCw size={17} className={refreshing ? 'animate-spin' : ''} /></button><button type="button" className="player-board-new" onClick={() => openEditor('create')} disabled={busy || loading}><Plus size={17} />Create session</button></div></div>
    <div ref={stageRef} className={`match-stage ${expanded ? 'match-stage-expanded' : ''}`} data-testid="match-display" data-player-count={names.length} tabIndex={-1}>
      <div className="match-corner match-corner-left" aria-hidden="true" /><div className="match-corner match-corner-right" aria-hidden="true" />
      <div className="match-topline"><button type="button" className="match-square-button" aria-label="Manage sessions" aria-expanded={menuOpen} onClick={() => setMenuOpen(value => !value)}><Menu size={24} /></button><div className="match-brand"><PaddleMark /><div><span>PICKLEBALL</span><i aria-hidden="true" /></div></div><div className="match-top-actions"><button type="button" className="match-square-button match-settings-button" aria-label="Edit players" disabled={!selected || busy} onClick={() => openEditor('names')}><Settings2 size={23} /></button><button ref={fullscreenButtonRef} type="button" className="match-square-button" onClick={toggleFullscreen} aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen match display'}>{isFullscreen ? <Minimize size={23} /> : <Expand size={23} />}</button></div></div>
      {menuOpen && <div className="match-session-menu"><div><strong>Your match sessions</strong><button type="button" aria-label="Close session menu" onClick={() => setMenuOpen(false)}><X size={19} /></button></div><label htmlFor={`${id}-menu-session`}>Select session</label><select id={`${id}-menu-session`} value={selected?.id || ''} onChange={event => { setSelectedId(Number(event.target.value)); setMenuOpen(false); }} disabled={busy || !players.length}>{!players.length && <option value="">No active sessions</option>}{players.map(player => <option key={player.id} value={player.id}>{sessionName(player)}</option>)}</select><button type="button" className="match-dialog-primary" onClick={() => openEditor('create')} disabled={busy || loading}><Plus size={16} />Create session</button>{selected && <button type="button" className="match-menu-remove" onClick={() => openEditor('remove')} disabled={busy}><Trash2 size={15} />Remove session</button>}</div>}
      <div className="match-kicker"><span /><strong>PICKLEBALL MATCH</strong><span /></div>
      <div className="match-versus"><span title={leftNames.join(' + ')}>{leftNames.length ? leftNames.join(' + ') : 'PLAYER 1'}</span><b>VS</b><span title={rightNames.join(' + ')}>{rightNames.length ? rightNames.join(' + ') : 'PLAYER 2'}</span></div>
      <div className="match-arena"><TeamPanel names={leftNames} team={1} doubles={names.length > 2} /><div className="match-clock-column"><div className={`match-clock ${status === 'finished' ? 'match-clock-finished' : ''}`}><div className="match-clock-heading"><span /><strong>MATCH TIMER</strong><span /></div><p role="timer" aria-label={selected ? `Time remaining for ${sessionName(selected)}` : 'Match time remaining'}>{matchTime(remaining)}</p></div><span className={`match-status match-status-${status}`}><i />{loading ? 'Loading sessions…' : selected ? statusLabels[status] : 'Your next match starts here'}</span>{!selected && !loading && <button type="button" className="match-empty-create" onClick={() => openEditor('create')}>Create your first session<Plus size={16} /></button>}{selected && !hasBothNames && <button type="button" className="match-empty-create" onClick={() => openEditor('names')}>Add second player<Pencil size={15} /></button>}</div><TeamPanel names={rightNames} team={2} doubles={names.length > 2} /></div>
      <div className="match-control-row"><button type="button" className="match-round-button" disabled={!selected || busy} onClick={() => openEditor('reset')} aria-label="Reset timer" title="Reset timer"><RotateCcw size={25} /></button><button type="button" className="match-play-button" disabled={!selected || busy || status === 'finished' || (status !== 'running' && !hasBothNames)} onClick={() => timerAction(status === 'running' ? 'pause' : 'start')} aria-label={status === 'running' ? 'Pause timer' : status === 'paused' ? 'Resume timer' : 'Start timer'}>{status === 'running' ? <Pause size={29} fill="currentColor" /> : <Play size={28} fill="currentColor" />}<span>{status === 'running' ? 'PAUSE' : status === 'paused' ? 'RESUME' : 'START MATCH'}</span></button><button type="button" className="match-round-button" disabled={!selected || busy || status === 'finished'} onClick={() => timerAction('finish')} aria-label="Finish session" title="Finish session"><Flag size={24} /></button></div>
      <div className="match-bottomline"><span><Users size={13} />{names.length} / 4 PLAYERS</span><span>{selected ? `${selected.duration_seconds / 60} MIN SESSION` : 'NO RESERVATION REQUIRED'}</span><button type="button" disabled={!selected || busy} onClick={() => openEditor('names')}><Pencil size={13} />EDIT PLAYERS</button></div>
      {(fetchError || actionError) && <div role="alert" className="match-error"><span>{actionError || fetchError}</span>{fetchError && <button type="button" onClick={fetchPlayers} disabled={busy || refreshing}>Try again</button>}<button type="button" aria-label="Dismiss match error" onClick={() => { setActionError(''); setFetchError(''); }}><X size={16} /></button></div>}
      {editor && <RosterDialog key={`${editor.type}-${editor.player?.id || 'new'}`} editor={editor} busy={busy} onClose={() => setEditor(null)} onSave={saveEditor} />}
      <span className="sr-only" role="status">{notice}</span>
    </div>
    <p className="player-board-note"><span>{players.length} saved {players.length === 1 ? 'session' : 'sessions'}</span><span>Shared with admin &amp; front desk. Timers keep running when this page is closed.</span></p>
  </section>;
}
