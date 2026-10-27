import { SongsterrApi, type NormalizedSongTab, type SongsterrMeta } from '../services/songsterrApi';

export const getAudioErrorMessage = (error: unknown): string => {
  const name = error instanceof Error ? error.name : '';
  switch (name) {
    case 'NotAllowedError':
      return 'Acesso ao microfone negado. Permita o uso do microfone nas configurações do navegador e tente novamente.';
    case 'NotFoundError':
      return 'Nenhuma entrada de áudio encontrada. Conecte sua interface ou microfone e tente novamente.';
    case 'NotReadableError':
      return 'Não foi possível acessar a entrada de áudio. Ela pode estar ocupada por outro aplicativo; feche-o e tente novamente.';
    case 'OverconstrainedError':
      return 'A entrada selecionada não atende à configuração de áudio. Escolha outro dispositivo nas configurações de áudio.';
    default:
      return 'Não foi possível iniciar o áudio. Confira a conexão da interface e as configurações de áudio do navegador.';
  }
};

export const getSongMetadata = async (songId: number): Promise<SongsterrMeta> => {
  let meta: SongsterrMeta;
  try {
    meta = await SongsterrApi.getSongMeta(songId);
  } catch {
    throw new Error('Não foi possível obter os dados da música no Songsterr. Verifique sua conexão e tente novamente.');
  }
  if (!Array.isArray(meta.tracks) || meta.tracks.length === 0) {
    throw new Error('Esta música não tem faixas disponíveis no Songsterr. Escolha outra música.');
  }
  return meta;
};

export const loadSongTrack = async (meta: SongsterrMeta, trackIndex: number): Promise<NormalizedSongTab> => {
  const track = meta.tracks[trackIndex];
  if (!track) throw new Error('A faixa selecionada não está mais disponível. Escolha outra faixa ou música.');
  let rawTab: unknown;
  try {
    rawTab = await SongsterrApi.getTrackTabJson(meta.songId, meta.revisionId, meta.image, track.partId);
  } catch {
    throw new Error('Não foi possível baixar a tablatura do Songsterr. Verifique sua conexão e tente novamente.');
  }
  if (!rawTab || typeof rawTab !== 'object' || !('measures' in rawTab) || !Array.isArray(rawTab.measures)) {
    throw new Error('A tablatura recebida é inválida. Escolha outra faixa ou música.');
  }
  let tab: NormalizedSongTab;
  try {
    tab = SongsterrApi.normalizeTab(rawTab, meta, trackIndex);
  } catch {
    throw new Error('A tablatura recebida é inválida. Escolha outra faixa ou música.');
  }
  if (tab.notes.length === 0) {
    throw new Error('Esta tablatura está vazia ou não contém notas para tocar. Escolha outra faixa ou música.');
  }
  if (!Number.isFinite(tab.totalDurationMs) || tab.totalDurationMs <= 0 ||
    !Number.isFinite(tab.initialBpm) || tab.initialBpm <= 0 ||
    !Array.isArray(tab.tuning) || tab.tuning.length === 0 || !tab.tuning.every(Number.isFinite) ||
    tab.notes.some((note) => !Number.isFinite(note.timeMs) || note.timeMs < 0 ||
      !Number.isFinite(note.durationMs) || note.durationMs < 0 || !Number.isFinite(note.freqHz) || note.freqHz <= 0 ||
      !Number.isInteger(note.string) || note.string < 1 || note.string > tab.stringCount ||
      !Number.isFinite(note.fret) || note.fret < 0)) {
    throw new Error('A tablatura contém notas ou tempos inválidos. Escolha outra faixa ou música.');
  }
  return tab;
};
