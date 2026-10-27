import React, { createContext, useContext, useMemo, useState } from 'react';

export interface ModalsValue {
  isSearchOpen: boolean;
  isSettingsOpen: boolean;
  isTone3000RackOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setTone3000RackOpen: (open: boolean) => void;
}

const ModalsContext = createContext<ModalsValue | null>(null);

export const ModalsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSearchOpen, setSearchOpen] = useState(false);
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [isTone3000RackOpen, setTone3000RackOpen] = useState(false);

  const value = useMemo(
    () => ({ isSearchOpen, isSettingsOpen, isTone3000RackOpen, setSearchOpen, setSettingsOpen, setTone3000RackOpen }),
    [isSearchOpen, isSettingsOpen, isTone3000RackOpen]
  );

  return <ModalsContext.Provider value={value}>{children}</ModalsContext.Provider>;
};

export const useModals = (): ModalsValue => {
  const ctx = useContext(ModalsContext);
  if (!ctx) throw new Error('useModals must be used within ModalsProvider');
  return ctx;
};
