import React from 'react';
import PlayerBoard from '../components/PlayerBoard';

export default function AdminPlayers() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-wider text-pickle-600">Live floor management</p>
        <h1 className="text-2xl sm:text-3xl font-black text-navy-500 mt-1">Players &amp; timers</h1>
        <p className="text-sm text-slate-500 mt-2">Set the players, start the match, and take it fullscreen. Up to four players share each timer.</p>
      </header>
      <PlayerBoard />
    </div>
  );
}
