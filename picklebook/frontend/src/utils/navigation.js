export function portalPathForRole(role) {
  if (role === 'admin') return '/admin';
  if (role === 'staff') return '/staff';
  return '/dashboard';
}

export function loginDestination(role, returnLocation) {
  const pathname = returnLocation?.pathname;
  const safePath = typeof pathname === 'string' && pathname.startsWith('/') && !pathname.startsWith('//');
  if (!safePath) return portalPathForRole(role);
  const inPortal = role === 'admin'
    ? pathname === '/admin' || pathname?.startsWith('/admin/') || pathname === '/staff'
    : role === 'staff' ? pathname === '/staff' : true;

  return inPortal
    ? `${pathname}${returnLocation.search || ''}`
    : portalPathForRole(role);
}
