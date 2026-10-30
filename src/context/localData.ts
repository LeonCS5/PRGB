// Everything PRGB keeps in this browser without an account: records/history (records.ts) and preferences,
// which include the local nickname. Export and erase always cover both, so nothing is left behind.
import { AUTH_STORAGE_KEY } from '../services/backend/supabaseClient';
import { clearRecords, exportLocalData } from '../services/records';
import { clearPreferences, readPreferences } from './preferences';

export const LOCAL_DATA_FILE_NAME = 'prgb-dados-locais.json';

export const buildLocalDataExport = (): string => {
  const records: unknown = JSON.parse(exportLocalData());
  return JSON.stringify({
    ...(typeof records === 'object' && records !== null ? records : {}),
    description: 'Preferências, apelido local, recordes pessoais e histórico de jogadas guardados neste navegador.',
    preferences: readPreferences()
  }, null, 2);
};

// The ranking session is not part of this: it is the only access to the account, so erasing it is the
// player's explicit choice (LocalDataControls)
export const clearLocalData = (): void => {
  clearRecords();
  clearPreferences();
};

// Reads the key directly: asking supabase-js would download it for players who never opened the ranking
export const hasRankingSession = (): boolean => {
  try {
    return localStorage.getItem(AUTH_STORAGE_KEY) !== null;
  } catch {
    return false;
  }
};

// The page reloads right after erasing; this session-only marker lets the next load confirm it
const CLEARED_MARKER = 'prgb:local-data-cleared';

export const markLocalDataCleared = (): void => {
  try {
    sessionStorage.setItem(CLEARED_MARKER, '1');
  } catch {
    // Without session storage the page just reloads without the confirmation.
  }
};

// Reads the marker once and removes it, so the confirmation shows on that load only
export const consumeLocalDataCleared = (): boolean => {
  try {
    const wasCleared = sessionStorage.getItem(CLEARED_MARKER) === '1';
    sessionStorage.removeItem(CLEARED_MARKER);
    return wasCleared;
  } catch {
    return false;
  }
};
