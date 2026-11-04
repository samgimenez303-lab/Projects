import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { portalPathForRole } from '../utils/navigation';
import '../styles/home-premium.css';

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const isManagement = isAuthenticated && ['admin', 'staff'].includes(user?.role);
  const portalLabel = user?.role === 'admin' ? 'Open admin portal' : 'Open front desk';
  const courtsTarget = isManagement ? portalPathForRole(user.role) : isAuthenticated ? '/courts' : '/login';
  const courtsState = isAuthenticated ? undefined : { from: { pathname: '/courts' } };
  return (
    <div className="home-page club-home">
      <section className="club-hero" aria-labelledby="hero-title">
        <img
          className="club-hero-photo" src="/images/pickleball-club-hero.webp"
          alt="Pickleball players rallying on a green outdoor court at golden hour (concept image)"
          width="1672" height="941" fetchpriority="high"
        />
        <div className="club-hero-shade" />
        <div className="page-container club-hero-layout">
          <div className="club-scene">
            <div className="club-scene-tag"><span /> A LITTLE LESS PLANNING. A LOT MORE PLAY.</div>
            <div className="club-scene-caption">
              <span className="club-scene-line" />
              <p>Good friends.<br />Great rallies.</p>
              <span>MAKE ROOM FOR YOUR NEXT GAME.</span>
            </div>
          </div>

          <div className="club-hero-panel">
            <div className="club-panel-eyebrow"><span className="club-status-dot" /> YOUR NEXT GAME STARTS HERE</div>
            <h1 id="hero-title">Your court.<br />Your game.<br /><span>Your time.</span></h1>
            <p>Less time making plans. More time making that shot. Find your court, choose your time, and get back to the game you love.</p>
            <Link to={courtsTarget} state={courtsState} className="club-primary-button">{isManagement ? portalLabel : 'Get started'} <ArrowUpRight size={20} aria-hidden="true" /></Link>
            <Link to="/about" className="club-hero-learn">See how it works <ArrowRight size={15} aria-hidden="true" /></Link>
            <div className="club-hero-assurance"><span><Check size={14} aria-hidden="true" /> Clear hourly rates</span><span><Check size={14} aria-hidden="true" /> Easy reservations</span></div>
          </div>
        </div>
        <div className="page-container club-hero-bottom">
          <Link to={courtsTarget} state={courtsState}><span className="club-scroll-icon"><ArrowUpRight size={15} aria-hidden="true" /></span> {isManagement ? portalLabel.toUpperCase() : 'EXPLORE THE COURTS'}</Link>
          <span>LESS SCREEN TIME. MORE COURT TIME.</span>
        </div>
      </section>
    </div>
  );
}
