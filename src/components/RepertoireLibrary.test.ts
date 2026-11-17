import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SONG_CATALOG } from '../content/songs';
import { ORIGINAL_COMPOSER } from '../services/songs';
import { isAcervoEnabled } from '../services/acervoFlag';
import { getPersonalBest, type RunResult } from '../services/records';
import { songSongId } from '../services/songIds';
import { RepertoireLibrary } from './RepertoireLibrary';
import { HeaderNav, TabBar } from './SiteNav';

vi.mock('../services/acervoFlag', () => ({ isAcervoEnabled: vi.fn(() => false) }));
vi.mock('../services/records', () => ({ getPersonalBest: vi.fn(() => null) }));

const render = () => renderToStaticMarkup(createElement(RepertoireLibrary, { onPlay: vi.fn(), onSearch: vi.fn(), onExit: vi.fn() }));

afterEach(() => vi.clearAllMocks());

describe('RepertoireLibrary', () => {
  it('marks the pieces nobody has played yet as under review', () => {
    const html = renderToStaticMarkup(createElement(RepertoireLibrary, { onPlay: () => undefined, onSearch: () => undefined, onExit: () => undefined }));
    const pending = SONG_CATALOG.filter(({ info }) => info.reviewed !== true).length;
    expect(html.split('Em revisão').length - 1).toBe(pending);
    expect(pending).toBeLessThan(SONG_CATALOG.length);
  });

  it('lists metadata without loading scores or offering ranking', () => {
    const loads = SONG_CATALOG.map((entry) => vi.spyOn(entry, 'load'));
    const html = render();
    expect(html).toContain('Repertório do PRGB');
    expect(html).toContain('Domínio público e originais — arranjo PRGB');
    for (const { info } of SONG_CATALOG) {
      expect(html).toContain(info.title);
      expect(html).toContain(info.composer);
      expect(html).toContain(info.composerDeathYear === null ? (info.composer === ORIGINAL_COMPOSER ? 'Obra original do PRGB' : 'Melodia tradicional, domínio público') : `Falecimento do compositor: ${info.composerDeathYear}`);
      expect(html).toContain(`Nível ${info.level} de 3 · ${info.bpm} bpm`);
      for (const part of info.parts) expect(html).toContain(`Tocar ${info.title} — ${part.name}`);
    }
    expect(html).not.toContain('ranking');
    loads.forEach((load) => { expect(load).not.toHaveBeenCalled(); load.mockRestore(); });
  });

  it('keeps repertoire available when the external catalog is disabled', () => {
    vi.mocked(isAcervoEnabled).mockReturnValue(false);
    expect(render()).not.toContain('Buscar no acervo');
    expect(render()).toContain('Tocar Melodia');
  });

  it('offers the external catalog only when enabled', () => {
    vi.mocked(isAcervoEnabled).mockReturnValue(true);
    expect(render()).toContain('Buscar no acervo (experimental)');
    vi.mocked(isAcervoEnabled).mockReturnValue(false);
  });

  it('shows personal points at their saved speed using repertoire ids', () => {
    const songId = songSongId(SONG_CATALOG[0].info.code, SONG_CATALOG[0].info.parts[0].code);
    const best: RunResult = { songId, partId: 0, title: 'Ode à Alegria', artist: 'Beethoven', trackName: 'Melodia', score: 1234, accuracy: 90, maxCombo: 5, perfect: 4, good: 1, miss: 0, speed: 0.75, mode: 'solo', playedAt: '2026-11-16T12:00:00.000Z' };
    vi.mocked(getPersonalBest).mockImplementation((id, partId, speed) => id === songId && partId === 0 && speed === 0.75 ? best : null);
    expect(render()).toContain('Recorde a 0,75×: 1.234 pontos');
    expect(getPersonalBest).toHaveBeenCalledWith(songId, 0, 1);
    vi.mocked(getPersonalBest).mockReturnValue(null);
    expect(render()).not.toContain('Recorde a');
  });
});

describe('repertoire navigation', () => {
  it.each([HeaderNav, TabBar])('keeps the music entry with the external catalog disabled', (Nav) => {
    vi.mocked(isAcervoEnabled).mockReturnValue(false);
    const html = renderToStaticMarkup(createElement(Nav, { isAudioRunning: false, onExercises: vi.fn(), onRepertoire: vi.fn(), onSearch: null, onAudio: vi.fn(), onRanking: null }));
    expect(html).toContain('Repertório</button>');
  });
});
