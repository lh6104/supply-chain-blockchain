'use client';

import { ReactNode } from 'react';
import { RoleProvider } from '@/hooks/useRole';
import { WalletProvider } from '@/contexts/WalletContext';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <WalletProvider>
      <RoleProvider>
        {children}
      </RoleProvider>
    </WalletProvider>
  );
}
