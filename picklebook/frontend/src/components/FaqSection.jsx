import React, { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowUpRight, ChevronDown } from 'lucide-react';
import '../styles/faq.css';

const questions = [
  {
    question: 'How do I reserve a court?',
    answer: 'Explore the courts, choose your preferred space, and select an available date and time. Sign in or create an account to save your reservation and follow its status.',
  },
  {
    question: 'Can I choose an indoor or outdoor court?',
    answer: 'Yes. Filter by indoor or outdoor courts, then compare surfaces, amenities, hourly rates, and schedules before booking.',
  },
  {
    question: 'Do I need an account to book?',
    answer: 'You can browse courts without signing in. An account is required to save a reservation, view your bookings, and follow payment updates.',
  },
  {
    question: 'What payment options are available?',
    answer: 'Pay cash at the counter before your session, or use GCash when the facility has it configured. For GCash, transfer in your GCash app and submit the transaction reference. Payment is marked paid after staff verifies it.',
  },
  {
    question: 'Should I bring my own equipment?',
    answer: 'Yes. Bring your pickleball paddle and balls, comfortable sportswear, court shoes, and water for your session.',
  },
  {
    question: 'What if I need to cancel my reservation?',
    answer: 'Open My Reservations and select your booking to request cancellation. Eligibility follows the facility’s cancellation policy. Contact the team with your booking reference for payment, refund, or adjustment questions.',
  },
];

export default function FaqSection({ ready = true }) {
  const sectionRef = useRef(null);
  const headingRef = useRef(null);
  const { hash, key } = useLocation();

  useEffect(() => {
    if (hash !== '#faqs' || !ready) return undefined;
    const frame = window.requestAnimationFrame(() => {
      sectionRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
      headingRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [hash, key, ready]);

  return (
    <section ref={sectionRef} id="faqs" className="page-container booking-faq" aria-labelledby="faqs-title">
      <div className="booking-faq-intro">
        <span className="booking-faq-eyebrow">BEFORE THE FIRST SERVE</span>
        <h2 ref={headingRef} id="faqs-title" tabIndex={-1}>Frequently asked<br />questions.</h2>
        <p>A few things to know before you go. Find the details, then get back to planning your next game.</p>
        <Link to="/contact" className="booking-faq-contact">Still have a question? Talk to us <ArrowUpRight size={17} aria-hidden="true" /></Link>
      </div>
      <div className="booking-faq-list">
        {questions.map(({ question, answer }) => (
          <details key={question} className="booking-faq-item">
            <summary>{question}<span className="booking-faq-toggle"><ChevronDown size={17} aria-hidden="true" /></span></summary>
            <p>{answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
