// Everything PRGB keeps in this browser without an account: records/history (records.ts) and preferences,
// which include the local nickname. Export and erase always cover both, so nothing is left behind.
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

export const clearLocalData = (): void => {
  clearRecords();
  clearPreferences();
};
