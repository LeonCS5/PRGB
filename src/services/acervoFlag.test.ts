import { afterEach, describe, expect, it, vi } from 'vitest';
import { isAcervoEnabled } from './acervoFlag';

afterEach(() => vi.unstubAllEnvs());

describe('isAcervoEnabled', () => {
  it.each([
    [undefined, true], ['', true], ['true', true], ['false', false], [' false ', false], ['FALSE', true]
  ])('with %s returns %s', (value, expected) => {
    vi.stubEnv('VITE_ACERVO_ENABLED', value);
    expect(isAcervoEnabled()).toBe(expected);
  });
});

// Render the entry points without a browser or external services.
vi.mock('../context/ranking', () => ({ useRanking: () => ({ isConfigured: false }) }));
vi.mock('../context/AudioSessionContext', () => ({ useAudioSession: () => ({ isAudioRunning: false }) }));
vi.mock('../context/useRoom', () => ({ useRoom: () => ({
  state: { phase: 'lobby', role: 'host', song: null, myPartId: null, localStartTimeMs: null, myNickname: 'Jogador' },
  controller: {},
}) }));

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HeaderNav, TabBar } from '../components/SiteNav';
import { SongSearchModal } from '../components/SongSearchModal';
import { RoomModal } from '../components/RoomModal';

const noop = () => undefined;

describe('acervo entry points', () => {
  it.each([HeaderNav, TabBar])('keeps music navigation (the PRGB repertoire) with the catalog off, with exercises and audio order', (component) => {
    const props = { isAudioRunning: false, onExercises: noop, onSearch: noop, onAudio: noop, onRanking: noop };
    vi.stubEnv('VITE_ACERVO_ENABLED', 'true');
    expect(renderToStaticMarkup(createElement(component, props))).toContain('Músicas');
    vi.stubEnv('VITE_ACERVO_ENABLED', 'false');
    const html = renderToStaticMarkup(createElement(component, props));
    expect(html).toContain('Músicas');
    expect(html).toContain('Exercícios');
    expect(html).toContain('Ranking');
    if (component === TabBar) expect(html.indexOf('Conectar')).toBeLessThan(html.indexOf('Ranking'));
  });

  it('blocks the search modal even when a caller requests it', () => {
    const props = { isOpen: true, onClose: noop, onSelectSong: noop };
    vi.stubEnv('VITE_ACERVO_ENABLED', 'false');
    expect(renderToStaticMarkup(createElement(SongSearchModal, props))).toBe('');
    vi.stubEnv('VITE_ACERVO_ENABLED', 'true');
    const html = renderToStaticMarkup(createElement(SongSearchModal, props));
    expect(html).toContain('Acervo experimental:');
    expect(html).toContain('sem licença do PRGB');
    expect(html.indexOf('<form')).toBeLessThan(html.indexOf('Acervo experimental:'));
  });

  it('keeps demo and exercise selection in the online lobby with search disabled', () => {
    vi.stubEnv('VITE_ACERVO_ENABLED', 'false');
    const html = renderToStaticMarkup(createElement(RoomModal, { isOpen: true, onClose: noop, onStartGame: noop }));
    expect(html).not.toContain('Escolher música</button>');
    expect(html).toContain('Exercício demo');
    expect(html).toContain('Exercícios do PRGB');
    expect(html).toContain('<optgroup');
    vi.stubEnv('VITE_ACERVO_ENABLED', 'true');
    expect(renderToStaticMarkup(createElement(RoomModal, { isOpen: true, onClose: noop, onStartGame: noop }))).toContain('Escolher música</button>');
  });
});
