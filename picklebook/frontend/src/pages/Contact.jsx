import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Clock, Mail, MapPin, Phone, Send } from 'lucide-react';
import { adminAPI, contactAPI } from '../services/api';
import { useNotification } from '../context/NotificationContext';

export default function Contact() {
  const { showSuccess, showError } = useNotification();
  const [settings, setSettings] = useState(null);
  const [settingsError, setSettingsError] = useState(false);
  const [settingsReload, setSettingsReload] = useState(0);
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => {
    let active = true;
    setSettingsError(false);
    adminAPI.getSettings().then((response) => {
      const data = response.data?.data?.map;
      if (!data || typeof data !== 'object') throw new Error('Contact information is unavailable.');
      if (active) setSettings(data);
    }).catch(() => { if (active) setSettingsError(true); });
    return () => { active = false; };
  }, [settingsReload]);
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const response = await contactAPI.submit(Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim()])));
      if (!response.data?.success) throw new Error('Your inquiry could not be saved. Please try again.');
      setSubmitted(true); setForm({ name: '', email: '', phone: '', subject: '', message: '' });
      showSuccess('Your inquiry has been received.');
    } catch (err) { showError(err.message || 'Unable to send your inquiry. Please try again.'); }
    finally { setSubmitting(false); }
  };
  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const contacts = [
    { label: 'Visit the facility', key: 'business_address', icon: MapPin },
    { label: 'Call the team', key: 'business_phone', icon: Phone },
    { label: 'Email us', key: 'business_email', icon: Mail },
  ];
  return <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-12">
    <header className="max-w-2xl"><p className="text-xs uppercase tracking-[0.2em] text-pickle-600 font-bold">Here for your next game</p><h1 className="text-4xl sm:text-5xl font-black mt-3">Let’s talk court time.</h1><p className="text-sm sm:text-base text-slate-500 mt-4 leading-relaxed">Questions about an indoor or outdoor court, your reservation or a payment? Send the team a message and include your booking reference if you have one.</p></header>
    <div className="grid lg:grid-cols-[360px_1fr] gap-6 items-start"><aside className="card bg-navy-900 text-white p-6 sm:p-8 space-y-7"><div><p className="text-pickle-300 text-xs font-bold uppercase tracking-widest">PickleBook</p><h2 className="text-2xl text-white font-bold mt-2">See you on court.</h2></div>{settingsError ? <div className="text-sm text-white/70"><p>Contact details could not be loaded. You can still send an inquiry using this form.</p><button className="text-pickle-300 underline mt-3" onClick={() => setSettingsReload((value) => value + 1)}>Reload contact details</button></div> : !settings ? <p className="text-sm text-white/60" role="status">Loading facility information…</p> : contacts.map((item) => <div key={item.key} className="flex items-start gap-3"><item.icon className="w-5 h-5 text-pickle-300 flex-shrink-0 mt-0.5" /><div><p className="text-sm font-semibold">{item.label}</p><p className="text-sm text-white/60 mt-1 break-words">{settings[item.key] || 'Contact the team using this form.'}</p></div></div>)}<div className="pt-6 border-t border-white/10 flex items-start gap-3"><Clock className="w-5 h-5 text-pickle-300 flex-shrink-0" /><div><p className="text-sm font-semibold">Planning your session?</p><p className="text-xs leading-relaxed text-white/60 mt-2">Opening hours and available slots are shown for each court and date.</p><Link to="/courts" className="inline-block text-sm font-semibold text-pickle-300 underline underline-offset-4 mt-3">Check court availability</Link></div></div></aside>
      <section className="card p-6 sm:p-8"><h2 className="text-2xl font-bold">Send a message</h2><p className="text-sm text-slate-500 mt-2 mb-6">We’ll use your email address to follow up on your inquiry.</p>{submitted ? <div className="rounded-xl p-6 bg-emerald-50 border border-emerald-200 text-center space-y-3" role="status"><CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" /><h3 className="text-xl font-bold text-emerald-900">Message received.</h3><p className="text-sm text-emerald-800">Your inquiry has been saved for the facility team to review.</p><button className="btn-outline text-sm" onClick={() => setSubmitted(false)}>Send another inquiry</button></div> : <form onSubmit={handleSubmit} className="space-y-5"><div className="grid sm:grid-cols-2 gap-4"><div><label htmlFor="contact-name" className="form-label">Full name</label><input id="contact-name" name="name" autoComplete="name" maxLength={100} required className="form-input" value={form.name} onChange={update} placeholder="Your name" /></div><div><label htmlFor="contact-email" className="form-label">Email address</label><input id="contact-email" name="email" type="email" autoComplete="email" maxLength={255} required className="form-input" value={form.email} onChange={update} placeholder="you@example.com" /></div></div><div><label htmlFor="contact-phone" className="form-label">Phone <span className="text-slate-400 font-normal">(optional)</span></label><input id="contact-phone" name="phone" type="tel" autoComplete="tel" maxLength={20} className="form-input" value={form.phone} onChange={update} placeholder="Your contact number" /></div><div><label htmlFor="contact-subject" className="form-label">Subject</label><input id="contact-subject" name="subject" maxLength={255} required className="form-input" value={form.subject} onChange={update} placeholder="e.g. Question about my outdoor booking" /></div><div><label htmlFor="contact-message" className="form-label">Your message</label><textarea id="contact-message" name="message" rows={5} minLength={5} maxLength={2000} required className="form-input" value={form.message} onChange={update} placeholder="Include your reservation reference if this is about an existing booking." /></div><button type="submit" disabled={submitting} className="btn-primary text-sm gap-2"><Send className="w-4 h-4" />{submitting ? 'Sending…' : 'Send inquiry'}</button></form>}</section>
    </div>
  </div>;
}
