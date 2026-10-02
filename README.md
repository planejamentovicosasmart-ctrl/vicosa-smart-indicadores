# Central de Indicadores — Viçosa SMART

Sistema web para gestão, pesquisa, auditoria e geração de relatórios dos indicadores municipais das ABNT NBR ISO 37120, ISO 37122 e ISO 37123.

## Base canônica

A base oficial do sistema é formada somente por indicadores pertencentes às três normas:

- ISO 37120: **127 indicadores**
- ISO 37122: **79 indicadores**
- ISO 37123: **63 indicadores**
- Total: **269 indicadores**

Fontes de entrada reconciliadas em 02/10/2026:

- `37120.csv`, `37122.csv` e `37123.csv`: indicadores que a Geterr **não encontrou**;
- `geterr_encontrado.csv`: indicadores encontrados pela Geterr, filtrados para manter somente itens pertencentes às normas;
- `Indicadores_ABNT - 37120.csv`: levantamentos feitos pelo Viçosa SMART, tratados como **candidatos para auditoria**, não como dados automaticamente validados.

Resumo da reconciliação:

- Geterr encontrou **81 indicadores das normas**;
- Geterr não encontrou **188**;
- o Viçosa SMART trabalhou 22 indicadores da ISO 37120: 14 candidatos completos para auditoria, 6 parciais e 2 ainda sem dado.

A fonte estruturada atual fica em `data/canonical-sources.json`.

## Indicadores auxiliares

A guia **Indicadores auxiliares** não importa mais indicadores genéricos da Geterr.

Ela é gerada dinamicamente a partir dos **numeradores e denominadores dos próprios indicadores ABNT**. Componentes com o mesmo texto aparecem uma única vez e mostram todos os indicadores em que são utilizados.

## Agente de pesquisa e auditoria

O agente trabalha em dois fluxos:

1. **Pesquisar lacunas** — indicadores sem dados ou parciais;
2. **Auditar candidatos** — dados levantados pelo Viçosa SMART que ainda precisam de conferência.

Dentro de cada indicador também existe um **Copiloto de pesquisa**. O usuário pode informar uma pista, URL, órgão ou observação e pedir ao agente para pesquisar/auditar aquele indicador especificamente.

O agente nunca homologa um dado automaticamente:

`Pesquisa/Auditoria → Descoberta/Evidência → Revisão humana → Aprovação ou rejeição → Base validada`

## Áreas do sistema

- Visão Geral
- Indicadores ABNT
- Indicadores Auxiliares
- Agente de Pesquisa
- Descobertas
- Fontes e Evidências
- Relatórios

## Relatórios

A guia **Relatórios** consulta os 269 indicadores e permite exportar CSV ou imprimir/salvar em PDF, com código, indicador, status, numerador, denominador, anos, fontes, URLs e resultado.

## Tecnologias

- React + Vite
- Node.js + Express
- PostgreSQL + Prisma
- OpenAI Responses API com pesquisa web
- Tavily como fallback opcional
- Neon para PostgreSQL
- Render para hospedagem

## Rodar localmente

Para testar somente a interface:

```bash
cd client
npm install
npm run dev
```

Para o sistema completo:

```bash
npm run install:all
npm run db:push
npm run seed
npm run build
npm start
```

## Variáveis principais

```text
DATABASE_URL=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.6-sol
TAVILY_API_KEY=
AGENT_MAX_INDICATORS=8
BASIC_AUTH_USER=vicosasmart
BASIC_AUTH_PASSWORD=
```

Nunca publique `.env`, senhas ou chaves de API no GitHub.

## Estrutura

```text
client/                    React + Vite
server/                    Express + Prisma + agente
data/canonical-sources.json fonte canônica reconciliada
data/seed.gz.b64.part*.txt metadados detalhados já existentes (fórmulas/componentes)
render.yaml                configuração de deploy
```
