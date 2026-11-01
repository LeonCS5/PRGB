import React, { createContext, useContext, useMemo, useState } from 'react';

export interface ModalsValue {
  isSearchOpen: boolean;
  isSettingsOpen: boolean;
  isAmpRackOpen: boolean;
  isFeedbackOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setAmpRackOpen: (open: boolean) => void;
  setFeedbackOpen: (open: boolean) => void;
}

const ModalsContext = createContext<ModalsValue | null>(null);

export const ModalsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSearchOpen, setSearchOpen] = useState(false);
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [isAmpRackOpen, setAmpRackOpen] = useState(false);
  const [isFeedbackOpen, setFeedbackOpen] = useState(false);

  const value = useMemo(
    () => ({ isSearchOpen, isSettingsOpen, isAmpRackOpen, isFeedbackOpen, setSearchOpen, setSettingsOpen, setAmpRackOpen, setFeedbackOpen }),
    [isSearchOpen, isSettingsOpen, isAmpRackOpen, isFeedbackOpen]
  );

  return <ModalsContext.Provider value={value}>{children}</ModalsContext.Provider>;
};

export const useModals = (): ModalsValue => {
  const ctx = useContext(ModalsContext);
  if (!ctx) throw new Error('useModals must be used within ModalsProvider');
  return ctx;
};
