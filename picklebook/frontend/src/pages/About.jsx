import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, House, Sun, Wallet } from 'lucide-react';

const features = [
  [House, 'Indoor courts', 'Compare covered court options, surfaces, and amenities.'],
  [Sun, 'Outdoor courts', 'Find open-air spaces for your next rally with friends.'],
  [CalendarDays, 'Clear reservations', 'See available times and keep your bookings in one account.'],
  [Wallet, 'Payment tracking', 'Choose cash or available GCash and follow staff verification.'],
];

export default function About() {
  return (
    <div className="pb-20">
      <section className="page-banner">
        <div className="page-container">
          <span className="eyebrow text-pickle-300">ABOUT PICKLEBOOK</span>
          <h1>More time for<br /><span className="text-lime-200">the game you love.</span></h1>
          <p>A simpler way to bring players and courts together.</p>
        </div>
      </section>

      <section className="page-container section-space grid md:grid-cols-2 items-center gap-10 lg:gap-16">
        <div>
          <span className="eyebrow">OUR BACKGROUND</span>
          <h2 className="section-title">Great games start<br />with a simple plan.</h2>
          <p className="text-slate-600 text-base leading-relaxed mt-5">Coordinating a pickleball game should be easy. PickleBook brings court information, availability, reservations, and payment tracking into one place, so your group can spend more time playing.</p>
          <p className="text-slate-600 text-base leading-relaxed mt-4">Our focus is simple: indoor and outdoor court bookings. Browse your options, choose your time, and keep your reservation details close at hand.</p>
          <Link to="/courts" className="btn-primary gap-2 mt-6">Find a court <ArrowRight size={17} aria-hidden="true" /></Link>
        </div>
        <div className="relative">
          <img src="/court-indoor.svg" alt="Illustration of an indoor pickleball court" className="w-full rounded-3xl" width="960" height="700" />
          <span className="absolute bottom-5 left-5 bg-white rounded-xl px-5 py-4 font-bold text-navy-500 shadow-lg">One game. Two ways to play.</span>
        </div>
      </section>

      <section className="home-process section-space">
        <div className="page-container">
          <span className="eyebrow">MADE FOR YOUR NEXT MATCH</span>
          <h2 className="section-title mb-8">The details, taken care of.</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map(([Icon, title, text]) => (
              <div key={title} className="card">
                <Icon className="text-pickle-700 mb-4" size={25} aria-hidden="true" />
                <h3 className="font-bold mb-2">{title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="page-container pt-16 text-center">
        <span className="eyebrow">SEE YOU ON COURT</span>
        <h2 className="section-title">Your next rally is waiting.</h2>
        <p className="text-slate-600 mt-3 mb-6">Find the space. Set the time. Bring your people.</p>
        <Link to="/courts" className="btn-primary gap-2">Explore the courts <ArrowRight size={17} aria-hidden="true" /></Link>
      </section>
    </div>
  );
}
