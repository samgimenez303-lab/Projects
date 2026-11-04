import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export default function NotFound() {
  return <div className="page-container py-20 text-center"><span className="eyebrow">404 / OUT OF BOUNDS</span><h1 className="text-3xl sm:text-5xl font-bold text-navy-500">This one landed<br />outside the court.</h1><p className="text-slate-500 text-sm mt-5 mb-7">We couldn’t find this page. Let’s get you back in the game.</p><Link className="btn-primary gap-2" to="/courts">Find your court <ArrowRight size={17} /></Link><Link to="/" className="text-link block mt-5">Back to home</Link></div>;
}
