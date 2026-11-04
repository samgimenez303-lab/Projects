import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

const StatsCard = ({
  title,
  value,
  icon: Icon,
  change,
  changeType = 'positive',
  color = 'pickle',
  subtitle,
}) => {
  const colorStyles = {
    pickle: {
      bg: 'bg-pickle-50',
      text: 'text-pickle-600',
      border: 'border-pickle-100',
    },
    navy: {
      bg: 'bg-navy-50',
      text: 'text-navy-500',
      border: 'border-navy-100',
    },
    accent: {
      bg: 'bg-amber-50',
      text: 'text-amber-600',
      border: 'border-amber-100',
    },
    rose: {
      bg: 'bg-rose-50',
      text: 'text-rose-600',
      border: 'border-rose-100',
    },
  };

  const currentTheme = colorStyles[color] || colorStyles.pickle;

  return (
    <div className="card hover:shadow-lg transition-all duration-200 p-6 flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {title}
          </span>
          <h3 className="text-2xl sm:text-3xl font-black text-slate-800 mt-1 font-display tracking-tight">
            {value}
          </h3>
        </div>
        {Icon && (
          <div className={`p-3 rounded-xl ${currentTheme.bg} ${currentTheme.text} border ${currentTheme.border}`}>
            <Icon className="w-6 h-6" />
          </div>
        )}
      </div>

      {(change || subtitle) && (
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          {change && (
            <span
              className={`inline-flex items-center gap-1 font-semibold ${
                changeType === 'positive'
                  ? 'text-emerald-600'
                  : changeType === 'negative'
                  ? 'text-rose-600'
                  : 'text-slate-500'
              }`}
            >
              {changeType === 'positive' ? (
                <TrendingUp className="w-3.5 h-3.5" />
              ) : changeType === 'negative' ? (
                <TrendingDown className="w-3.5 h-3.5" />
              ) : null}
              {change}
            </span>
          )}
          {subtitle && <span className="text-slate-400 truncate">{subtitle}</span>}
        </div>
      )}
    </div>
  );
};

export default StatsCard;

