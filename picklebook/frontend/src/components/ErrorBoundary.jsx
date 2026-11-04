import React from 'react';

export default class ErrorBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) { console.error('Unable to render page:', error.message); }
  render() {
    if (this.state.failed) return <main className="min-h-screen bg-pickle-50 flex items-center justify-center px-6"><div className="card max-w-md text-center py-10"><img src="/favicon.svg" alt="" width="50" height="50" className="mx-auto mb-5" /><h1 className="text-2xl font-bold">Let’s try that again.</h1><p className="text-sm text-slate-600 leading-relaxed mt-4">This page couldn’t load. Refresh to reconnect and return to your court space.</p><button type="button" className="btn-primary mt-6" onClick={() => window.location.reload()}>Refresh page</button></div></main>;
    return this.props.children;
  }
}
