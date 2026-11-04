import React from 'react';
import { Link } from 'react-router-dom';
import { Users, Zap, Armchair, ArrowRight, Check } from 'lucide-react';
import { getCourtImage } from '../utils/courtImages';

const CourtCard = ({ court, isSelected = false, onSelect = null, showBookAction = true }) => {
  const { imageUrl, defaultImage } = getCourtImage(court);

  return (
    <div
      className={`bg-white rounded-xl shadow-md overflow-hidden border transition-all duration-200 flex flex-col ${
        isSelected
          ? 'ring-2 ring-pickle-600 border-pickle-500 shadow-lg scale-[1.01]'
          : 'border-slate-100 hover:shadow-lg hover:-translate-y-0.5'
      } ${onSelect ? 'cursor-pointer' : ''}`}
    >
      {/* Image & Type Badge */}
      <div className="relative h-48 w-full bg-slate-100 overflow-hidden">
        <img
          src={imageUrl}
          alt={court.name}
          loading="lazy"
          width="960"
          height="700"
          className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
          onError={(e) => {
            if (e.currentTarget.getAttribute('src') !== defaultImage) {
              e.currentTarget.src = defaultImage;
            }
          }}
        />
        <div className="absolute top-3 left-3 flex gap-1.5 flex-wrap">
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
              court.court_type === 'indoor'
                ? 'bg-navy-600 text-white'
                : 'bg-pickle-600 text-white'
            }`}
          >
            {court.court_type}
          </span>
          {court.surface_type && (
            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-white/90 text-slate-700 backdrop-blur-sm">
              {court.surface_type.replace('_', ' ')}
            </span>
          )}
        </div>

        {isSelected && (
          <div className="absolute top-3 right-3 bg-pickle-600 text-white p-1.5 rounded-full shadow">
            <Check className="w-5 h-5 stroke-[3]" />
          </div>
        )}
      </div>

      {/* Card Content */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="text-lg font-bold text-navy-500 leading-snug">
              {court.name}
            </h3>
            <div className="text-right flex-shrink-0">
              <span className="text-lg font-black text-pickle-600">
                ₱{Number(court.price_per_hour || 0).toLocaleString()}
              </span>
              <span className="text-xs text-slate-500 block">/ hour</span>
            </div>
          </div>

          <p className="text-xs text-slate-600 line-clamp-2 mb-4 leading-relaxed">
            {court.description || 'Premium pickleball court built to tournament standards.'}
          </p>

          {/* Court Features / Amenities */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500 py-2.5 border-t border-b border-slate-100 mb-4">
            <div className="flex items-center gap-1.5" title={`Max ${court.max_players || 4} players`}>
              <Users className="w-4 h-4 text-slate-400" />
              <span>Max {court.max_players || 4}</span>
            </div>

            {Boolean(court.has_lighting) && (
              <div className="flex items-center gap-1.5 text-amber-600" title="Night Lighting available">
                <Zap className="w-4 h-4 fill-amber-500 text-amber-500" />
                <span>Lighting</span>
              </div>
            )}

            {Boolean(court.has_seating) && (
              <div className="flex items-center gap-1.5 text-navy-500" title="Spectator Seating available">
                <Armchair className="w-4 h-4" />
                <span>Seating</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Button */}
        {showBookAction && !onSelect && (
          <div className="flex items-center gap-2 pt-1">
            <Link
              to={`/courts/${court.id}`}
              aria-label={`View details for ${court.name}`}
              className="flex-1 text-center py-2 px-3 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors"
            >
              View details
            </Link>
            <Link
              to={`/book?courtId=${court.id}`}
              aria-label={`Reserve ${court.name}`}
              className="flex-1 btn-primary py-2 px-3 text-xs gap-1 font-semibold"
            >
              <span>Reserve</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        {onSelect && (
          <button
            type="button"
            onClick={() => onSelect(court)}
            aria-pressed={isSelected}
            className={`w-full py-2.5 px-3 rounded-lg text-xs font-bold transition-colors ${
              isSelected
                ? 'bg-pickle-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {isSelected ? 'Court Selected' : 'Select Court'}
          </button>
        )}
      </div>
    </div>
  );
};

export default CourtCard;

