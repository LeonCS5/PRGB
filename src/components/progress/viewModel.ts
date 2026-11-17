// Pure helpers for the "Meu progresso" screen: what to show, from the saved progress and a given instant.
import { DEMO_SONG_ID } from '../../services/demoSong';
import { isExerciseSongId } from '../../services/exerciseIds';
import { findExercisePart } from '../../services/exercises';
import { isRepertoireSongId } from '../../services/songIds';
import { findSongInfo } from '../../services/songs';
import { MAX_STARS, MIN_DAY_MS, weekStartOf, type ContentProgress, type Progress } from '../../services/progress';

export const CONTENT_PAGE_SIZE = 30;

const DAY_LABELS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'] as const;
const DAY_NAMES = ['segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado', 'domingo'] as const;

export interface WeekDay {
  key: string;
  label: string;
  name: string;
  done: boolean;
  isToday: boolean;
}

const pad = (value: number): string => String(value).padStart(2, '0');

// Monday to Sunday of the week of `now`, built from date parts so a daylight-saving change never shifts a day
export function weekDays(progress: Progress, now: number): WeekDay[] {
  const weekStart = weekStartOf(now);
  const [year, month, day] = weekStart.split('-').map(Number);
  const played = progress.weeks[weekStart] ?? {};
  const today = new Date(now);
  const todayKey = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  return DAY_LABELS.map((label, index) => {
    const date = new Date(year, month - 1, day + index);
    const key = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    return { key, label, name: DAY_NAMES[index], done: (played[key] ?? 0) >= MIN_DAY_MS, isToday: key === todayKey };
  });
}

export interface PlayedContent {
  key: string;
  songId: number;
  partId: number;
  content: ContentProgress;
}

// Most recently played first; ties break by key so the order is stable
export function playedContents(progress: Progress): PlayedContent[] {
  return Object.entries(progress.contents)
    .map(([key, content]) => {
      const [songId, partId] = key.split(':').map(Number);
      return { key, songId, partId, content };
    })
    .sort((a, b) => b.content.lastPlayedAt - a.content.lastPlayedAt || (a.key < b.key ? -1 : 1));
}

export function contentTitle(songId: number, partId: number): string {
  if (songId === DEMO_SONG_ID) return 'Pentatônica em Lá menor';
  if (isExerciseSongId(songId)) return findExercisePart(songId, partId)?.tab.title ?? 'Exercício';
  if (isRepertoireSongId(songId)) return findSongInfo(songId)?.info.title ?? 'Peça do repertório';
  return 'Conteúdo do PRGB';
}

export const plural = (count: number, one: string, many: string): string => (count === 1 ? one : many);

export const starsText = (stars: number): string =>
  stars === 0 ? 'Sem estrelas ainda' : `${stars} de ${MAX_STARS} estrelas`;

export const formatDate = (ms: number): string => new Date(ms).toLocaleDateString('pt-BR');

export const hasProgress = (progress: Progress): boolean =>
  progress.totals.runs > 0 || Object.keys(progress.contents).length > 0 || Object.keys(progress.achievements).length > 0;
