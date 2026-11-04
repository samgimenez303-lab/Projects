import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Wallet } from 'lucide-react';
import '../styles/footer-premium.css';

const footerLinks = [
  {
    title: 'Find your court',
    links: [
      ['Indoor courts', '/courts?type=indoor'],
      ['Outdoor courts', '/courts?type=outdoor'],
      ['Explore all courts', '/courts'],
    ],
  },
  {
    title: 'Make it happen',
    links: [
      ['Book a court', '/book'],
      ['My reservations', '/my-reservations'],
      ['About PickleBook', '/about'],
    ],
  },
];

export default function Footer() {
  return (
    <footer className="premium-footer">
      <div className="page-container">
        <div className="premium-footer-invitation">
          <div>
            <span className="premium-footer-eyebrow">SEE YOU ON COURT</span>
            <h2>Make time for a good game.</h2>
          </div>
          <Link to="/courts" className="premium-footer-cta">
            Find your court <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        </div>

        <div className="premium-footer-columns">
          <div className="premium-footer-note">
            <Link to="/" className="premium-footer-brand" aria-label="PickleBook home">
              <img src="/favicon.svg" alt="" width="36" height="36" />
              <span>PickleBook<span className="premium-footer-brand-dot">.</span></span>
            </Link>
            <p>A little less planning.<br />A lot more pickleball.</p>
          </div>

          {footerLinks.map(({ title, links }) => (
            <div className="premium-footer-link-group" key={title}>
              <h3>{title}</h3>
              <ul>
                {links.map(([label, to]) => (
                  <li key={to}><Link to={to}>{label}</Link></li>
                ))}
              </ul>
            </div>
          ))}

          <div className="premium-footer-help">
            <h3>Here to help</h3>
            <Link to="/contact" className="premium-footer-contact">
              Contact the team <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
            <p>Court hours and amenities are listed on each court's page.</p>
            <div className="premium-footer-payment">
              <Wallet size={16} aria-hidden="true" />
              <p>Cash or available GCash.<br /><span>Payments are verified by staff.</span></p>
            </div>
          </div>
        </div>

        <div className="premium-footer-wordmark" aria-hidden="true">PickleBook<span>.</span></div>

        <div className="premium-footer-bottom">
          <p>&copy; {new Date().getFullYear()} PickleBook. All rights reserved.</p>
          <p>More court time. More good times.</p>
        </div>
      </div>
    </footer>
  );
}
