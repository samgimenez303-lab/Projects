import React from 'react';

const LoadingSpinner = ({ size = 'md', message = '', fullScreen = false, color = 'pickle' }) => {
  const sizeMap = {
    sm: 'w-5 h-5 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
    xl: 'w-16 h-16 border-4',
  };

  const colorMap = {
    pickle: 'border-pickle-600 border-t-transparent',
    navy: 'border-navy-500 border-t-transparent',
    white: 'border-white border-t-transparent',
  };

  const spinner = (
    <div className="flex flex-col items-center justify-center gap-3">
      <div
        className={`${sizeMap[size] || sizeMap.md} ${
          colorMap[color] || colorMap.pickle
        } rounded-full animate-spin`}
      />
      {message && <p className="text-sm font-medium text-slate-600 animate-pulse">{message}</p>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
        {spinner}
      </div>
    );
  }

  return <div className="py-8 flex items-center justify-center">{spinner}</div>;
};

export default LoadingSpinner;

