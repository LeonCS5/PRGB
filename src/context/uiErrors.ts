import { LEGAL_CONTACT } from '../content/legal';
import { toRankingError, type RankingErrorCode } from '../services/backend/rankingApi';
import { RoomError, type RoomErrorCode } from '../services/backend/roomChannel';
import { NICKNAME_ERROR_MESSAGES } from '../services/nickname';
import { SongsterrApi, type NormalizedSongTab, type SongsterrMeta } from '../services/songsterrApi';

const RANKING_ERROR_MESSAGES: Record<RankingErrorCode, string> = {
  not_configured: 'O ranking não está disponível neste site.',
  network: 'Sem conexão com o ranking. Verifique sua internet e tente novamente.',
  unknown: 'Não foi possível falar com o ranking agora. Tente novamente em instantes.',
  not_authenticated: 'Sua sessão do ranking não vale mais. Entre no ranking de novo para continuar.',
  invalid_input: 'O ranking recusou os dados enviados. Recarregue a página e tente novamente.',
  rate_limited: 'Muitas tentativas em pouco tempo. Espere alguns minutos e tente de novo.',
  consent_required: 'Para entrar no ranking, confirme sua idade e aceite os termos.',
  nickname_invalid: NICKNAME_ERROR_MESSAGES.chars,
  nickname_blocked: NICKNAME_ERROR_MESSAGES.offensive,
  nickname_taken: 'Esse apelido já está em uso.',
  profile_exists: 'Este navegador já tem uma conta no ranking.',
  profile_required: 'Entre no ranking para continuar.',
  part_unregistered: 'Esta faixa ainda não entrou no ranking. Tente novamente.',
  revision_mismatch: 'A tablatura desta música mudou no Songsterr. Recarregue a música e tente de novo.',
  session_invalid: 'O ranking não encontrou esta partida. Toque de novo para valer.',
  session_too_short: 'A partida durou menos que a música, por isso não entrou no ranking.',
  session_expired: 'A partida ficou aberta por mais de 2 horas e expirou. Toque de novo para valer.',
  already_submitted: 'Esta jogada já foi enviada ao ranking.',
  score_implausible: `O servidor recusou esta pontuação porque ela não combina com a música. Se foi engano, peça a revisão pelo e-mail ${LEGAL_CONTACT.email}.`,
  empty_run: 'Nenhuma nota foi acertada nesta jogada, por isso ela não entrou no ranking.',
  song_not_found: 'O Songsterr não encontrou esta música.',
  part_not_found: 'O Songsterr não encontrou esta faixa.',
  songsterr_unavailable: 'O Songsterr não respondeu agora. Tente novamente em instantes.',
  tab_invalid: 'Esta tablatura não pode entrar no ranking.',
  tab_empty: 'Esta faixa não tem notas para pontuar, por isso não pode entrar no ranking.'
};

export const getRankingErrorMessage = (error: unknown): string => RANKING_ERROR_MESSAGES[toRankingError(error).code];

const ROOM_ERROR_MESSAGES: Record<RoomErrorCode, string> = {
  not_configured: 'A funcionalidade online não está disponível neste site.',
  not_authenticated: 'Sua sessão expirou. Entre no ranking de novo para continuar.',
  profile_required: 'Para jogar online, você precisa de uma conta no ranking.',
  rate_limited: 'Muitas tentativas em pouco tempo. Espere alguns minutos e tente de novo.',
  network: 'Sem conexão com o servidor. Verifique sua internet e tente novamente.',
  room_full: 'Esta sala já está ocupada por dois jogadores.',
  room_not_found: 'Sala não encontrada. Confirme o código com seu parceiro.',
  invalid_code: 'Código inválido. Use os 6 caracteres exatos do código da sala.',
  invalid_message: 'Mensagem inválida. Recarregue a página e tente novamente.',
  room_closed: 'A sala foi encerrada. Crie ou entre em uma nova sala.',
};

export const getRoomErrorMessage = (error: unknown): string => {
  if (error instanceof RoomError) return ROOM_ERROR_MESSAGES[error.code];
  return ROOM_ERROR_MESSAGES.network;
};

export const getRoomErrorByCode = (code: RoomErrorCode): string => ROOM_ERROR_MESSAGES[code];

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
