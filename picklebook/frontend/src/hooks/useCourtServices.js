import { useEffect, useState } from 'react';
import { COURT_SERVICES } from '../data/courtServices';
import { servicesAPI } from '../services/api';

export default function useCourtServices() {
  const [services, setServices] = useState(COURT_SERVICES);

  useEffect(() => {
    let active = true;
    servicesAPI.getAll().then(({ data }) => {
      const listings = data?.data?.services;
      if (!active || !Array.isArray(listings)) return;
      setServices(COURT_SERVICES.map((defaults) => {
        const listing = listings.find((item) => item.category === defaults.category && Number(item.is_active) === 1);
        return {
          ...defaults,
          name: listing?.name || defaults.name,
          description: listing?.description || defaults.description,
        };
      }));
    }).catch(() => {
      // Keep category information available if the optional descriptions cannot load.
    });
    return () => { active = false; };
  }, []);

  return services;
}
