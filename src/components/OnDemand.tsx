import React, { Suspense, useState } from 'react';

interface OnDemandProps {
  open: boolean;
  children: React.ReactNode;
}

// Mounts lazy children only once they were asked for, then keeps them mounted (so they keep their own state)
export const OnDemand: React.FC<OnDemandProps> = ({ open, children }) => {
  const [seen, setSeen] = useState(open);
  if (open && !seen) setSeen(true);
  return seen ? <Suspense fallback={null}>{children}</Suspense> : null;
};
