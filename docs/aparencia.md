# Aparência (personalização visual): arquitetura e contrato

Fonte única para quem implementa uma parte. Tipos em `src/appearance/types.ts`, padrões em `defaults.ts`.

## Princípio
O tema Original com os padrões deve ser **idêntico** ao PRGB anterior. Tudo é só visual: nada toca áudio, detecção, pontuação, tempo ou ranking. O que for pesado no canvas se simplifica ou se desliga.

## Como cada configuração chega à tela
| Configuração | Mecanismo | Quem aplica |
|---|---|---|
| Tema (cores) | variáveis CSS em `<html>` que sobrescrevem as escalas `ink-*`, `amp-*`, `signal-*` (já existe em `services/themes.ts`, a mover para `src/appearance/themes.ts`); `data-theme="<id>"` (ausente no Original) | `appearance/apply.ts` |
| Estilo de componentes | `data-ui="soft\|sharp\|arcade"` em `<html>`; no CSS, `--radius-*` do Tailwind por `[data-ui]` (as classes `rounded-*` já usam essas variáveis) | `index.css` |
| Tipografia | `data-font="modern\|technical\|expressive"`; CSS redefine `--font-sans`, `--font-display`, `--font-mono` | `index.css` + fontes locais em `public/fonts` |
| Fundo | `data-bg="solid\|gradient\|grid\|ambient"` no `<html>`; CSS estático (sem animação, sem filtro) | `index.css` |
| Efeitos decorativos desligados | `data-effects="off"` quando `reduceEffects` ou `prefers-reduced-motion` | `apply.ts` |
| Notas, cordas, efeitos de gameplay | o canvas lê `GameplayAppearance` (hook `useGameplayAppearance`) uma vez por mudança, nunca por quadro do React | `practiceLanes.ts`, `PracticeGame.tsx`, `FreePlay.tsx` |

## Persistência
Chave `prgb:appearance:v1` no `localStorage`, validada campo a campo (valor inválido volta ao padrão, versão desconhecida nunca derruba). Aplicada **antes da primeira pintura** por um script externo `public/appearance-boot.js` (a CSP não aceita script inline), que só aplica atributos e variáveis. Entra no export e na exclusão de dados locais (`localData.ts`), na Política (`legal.ts`) e é limpa por "Restaurar padrões".

## Regras
- Cores do gameplay (cordas, jogadores, acerto/quase/erro, linha de acerto) têm tokens próprios (`--color-string-*`, `--color-player-*`, `--color-play-signal`, `hit`, `near`, `miss`). Tema nenhum os altera; só o esquema de cordas (Original/Vibrant/Pastel) escolhe outro conjunto, sempre na ordem das cordas.
- Acerto e erro nunca dependem só de cor (texto/forma já existem; efeitos não os substituem).
- Sem biblioteca nova. Fontes novas só locais, em woff2, só os pesos usados.
- `prefers-reduced-motion` e `reduceEffects` desligam efeitos animados e glow.
- Sem flash estroboscópico: nenhum efeito pisca mais de 3 vezes por segundo nem muda a luminância da tela inteira de forma brusca.
- UI em pt-BR, tokens PRGB, alvos de 44 px, foco visível, teclado.

## Estado da implementação (o que existe)
- **Núcleo** (`src/appearance/`): `types.ts` e `defaults.ts` (contrato), `validate.ts` (leitura campo a campo; versão mais nova nunca derruba), `themes.ts` e `presets.ts`, `apply.ts` (plano de atributos e variáveis no `<html>`), `useAppearance.ts` (store externo com `useAppearance`, `useGameplayAppearance`, `setAppearance`, `applyPreset`, `resetAppearance`, `exportAppearance`, `clearAppearance`), `bootScript.ts` + `public/appearance-boot.js` (pintura antes do React).
- **Reduzir efeitos**: `toGameplayAppearance` zera glow das cordas e os cinco efeitos quando `reduceEffects` ou `prefers-reduced-motion` valem; `apply.ts` põe `data-effects="off"`. O HUD usa o mesmo resultado, então não há caminho em que o brilho apareça com movimento reduzido.
- **Brilho do COMBO no HUD** (`GameHud.tsx` + `hudGlow.ts`): com `effects.comboGlow`, o número do COMBO ganha um `text-shadow` na cor `signal-400`, de alpha até 0,3 (mesmo teto do canvas, escalado pela intensidade), crescendo com `comboGlowTarget(combo)` e com transição de 500 ms. Não cria estado por quadro: o HUD já re-renderiza quando o placar muda e o estilo é só calculado.
- **Dados locais**: `buildLocalDataExport` inclui `appearance` (`{ version, settings }` ou `null`); `clearLocalData` chama `clearAppearance()`, que remove a chave (mesmo de versão mais nova), volta o estado ao padrão e reaplica o `<html>` na hora (atributos `data-*` removidos ou redefinidos e variáveis do tema retiradas). A tela ainda recarrega em seguida (`LocalDataControls`), e o script de boot, sem chave salva, aplica o Original. A Política (`dados-no-navegador`) e `CONSENT_COPY.localDataDescription` citam a aparência; `LEGAL_VERSION` não muda, porque nada sai do dispositivo.
- **Offline** (`vite.config.ts`): entram no precache as fontes IBM Plex (tipografia "technical") e os chunks lazy do próprio conteúdo, reconhecidos pelo caminho do código-fonte: `src/content/songs/*`, `components/RepertoireLibrary`, `components/AppearanceScreen*` e `components/appearance/*`. Ficam de fora, de propósito, o cliente Supabase e o motor neural (`assets/nam-*`).
- **Não verificado**: as telas no navegador real, Firefox, Safari e celulares; a regra de cache para o chunk da tela de Aparência (ela só será provada quando o chunk existir no build).
