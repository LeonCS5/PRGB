# Arquivos de Colaboração para Agentes AI — PRGB

## Arquivos Criados

### 1. [`CLAUDE.md`](file:///c:/Users/chrys/Documents/PRGB/CLAUDE.md)
Guia completo para **Claude Code** e qualquer agente baseado em Claude. Inclui:
- Visão geral e propósito do projeto
- Stack tecnológica detalhada com versões
- Mapa de arquivos com contagem de linhas
- **Diagrama completo da cadeia DSP do TONE3000** (signal flow do áudio)
- Convenções de código (TypeScript, Tailwind, nomenclatura, idioma)
- 14 problemas conhecidos categorizados por prioridade (🔴🟡🟢)
- Regras obrigatórias, recomendadas e proibições
- Fluxo completo do usuário
- Glossário técnico

### 2. [`AGENTS.md`](file:///c:/Users/chrys/Documents/PRGB/AGENTS.md)
Guia universal para **Codex (OpenAI)**, **Claude**, **Cursor**, e qualquer outro agente. Formato mais enxuto e direto:
- Setup rápido (3 comandos)
- Mapa de arquivos com indicação de lixo removível
- Cadeia de áudio em ASCII art
- 10 regras invioláveis
- Backlog organizado com checkboxes
- Fluxo do usuário em diagrama
- Glossário

## Por que dois arquivos?

| Arquivo | Lido por | Formato |
|---|---|---|
| `CLAUDE.md` | Claude Code, Claude em IDEs | Detalhado, com diagramas e contexto profundo |
| `AGENTS.md` | Codex (OpenAI), Cursor, Windsurf, qualquer agente | Universal, mais conciso, foco em regras e setup |

> [!TIP]
> O `CLAUDE.md` é lido automaticamente pelo Claude Code ao abrir o repositório. O `AGENTS.md` é o padrão reconhecido pelo Codex/OpenAI e também por outros agentes.

## Diagnóstico Incluído

Os arquivos documentam **14 problemas reais** encontrados na análise do código:

| # | Problema | Severidade |
|---|---|---|
| 1 | `App.css` é lixo do template Vite (185 linhas não usadas) | Baixa |
| 2 | Assets legados em `src/assets/` | Baixa |
| 3 | Canvas não responsivo (hardcoded dimensions) | **Alta** |
| 4 | Estado monolítico em `App.tsx` | **Alta** |
| 5 | TONE3000 recriado a cada reconexão (causa clicks) | **Alta** |
| 6 | Sem tratamento de erros na UI | Média |
| 7 | stringEstimate/fretEstimate nunca populados | Média |
| 8 | Sem persistência (localStorage) | Média |
| 9 | Canvas performance (objects per frame) | Média |
| 10 | Zero testes | Baixa |
| 11 | Sem router | Baixa |
| 12 | Sem PWA | Baixa |
| 13 | Metrônomo impreciso | Baixa |
| 14 | Parser de tabs incompleto | Baixa |
