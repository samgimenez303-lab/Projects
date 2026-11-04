import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, House, Sun } from 'lucide-react';
import { getCourtService } from '../data/courtServices';

const ServiceCard = ({ service }) => {
  const defaults = getCourtService(service.category);
  if (!defaults) return null;
  const indoor = service.category === 'indoor';
  const Icon = indoor ? House : Sun;

  return (
    <article className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-xl">
      <div className="relative h-56 overflow-hidden bg-navy-800 sm:h-64">
        <img
          src={defaults.image_url}
          alt={indoor ? 'Illustration of a covered pickleball court' : 'Illustration of an outdoor pickleball court'}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        <span className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-bold capitalize text-navy-700 shadow-sm">
          <Icon className="h-4 w-4" aria-hidden="true" /> {service.category} courts
        </span>
      </div>
      <div className="p-6 sm:p-8">
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-pickle-700">{defaults.eyebrow}</p>
        <h2 className="text-2xl font-bold tracking-tight text-navy-700">{service.name || defaults.name}</h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">{service.description || defaults.description}</p>
        <ul className="my-6 space-y-3">
          {defaults.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2.5 text-sm text-slate-700">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-pickle-700" aria-hidden="true" />{feature}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-5">
          <p className="text-xs leading-5 text-slate-500">Rates vary by court.<br />See the full price before you book.</p>
          <Link to={`/courts?type=${service.category}`} className="inline-flex items-center gap-2 text-sm font-bold text-pickle-700 hover:text-pickle-800">
            Explore {service.category} <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
};

export default ServiceCard;
