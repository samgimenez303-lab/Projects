import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

export default function Services() {
  const { search, hash } = useLocation();

  return <Navigate to={{ pathname: '/courts', search, hash }} replace />;
}
