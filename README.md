# Central de Indicadores — Viçosa SMART

Sistema web para gestão, pesquisa, validação e geração de relatórios dos indicadores municipais das ABNT NBR ISO 37120, ISO 37122 e ISO 37123.

## Base inicial

- 129 indicadores ABNT importados da base de trabalho.
- 386 registros de indicadores auxiliares.
- Dados oficiais e descobertas do agente ficam em camadas separadas.

## Áreas do sistema

- Visão Geral
- Indicadores ABNT
- Indicadores Auxiliares
- Agente de Pesquisa
- Descobertas do Agente
- Fontes e Evidências
- Relatórios

## Segurança do agente

O agente atua como pesquisador e nunca altera diretamente a base oficial.

`Pesquisa → Descoberta → Revisão humana → Aguardando validação → Validação → Base oficial`

Descobertas ainda não validadas não entram nos relatórios oficiais.

## Relatórios / Geterr

A guia **Relatórios** permite filtrar os indicadores por norma e situação e gerar:

- CSV compatível com Excel, contendo código, indicador, numerador, denominador, anos, fontes, URLs, resultado, unidade e observações;
- versão para impressão ou salvamento em PDF.

Consulte `RELATORIOS.md` para detalhes.

## Tecnologias

- React + Vite
- Node.js + Express
- PostgreSQL + Prisma
- OpenAI Responses API com pesquisa web
- Tavily como fallback opcional
- Neon para PostgreSQL
- Render para hospedagem e execução diária do agente

## Testar somente a interface

```bash
cd client
npm install
npm run dev
```

Abra `http://localhost:5173/?demo=1`.

O modo demonstração funciona sem banco de dados e utiliza a base inicial compactada do projeto.

## Rodar o sistema completo

No Windows, a forma mais simples é:

```powershell
powershell -ExecutionPolicy Bypass -File .\CONFIGURAR_WINDOWS.ps1
```

Ou configure manualmente `server/.env` a partir de `server/.env.example` e execute:

```bash
npm run install:all
npm run db:push
npm run seed
npm run build
npm start
```

Depois abra `http://localhost:3000`.

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
client/       React + Vite
server/       Express + Prisma + agente
data/         base inicial compactada
render.yaml   deploy do serviço e cron diário
```

A base inicial é armazenada em `seed.gz.b64.part*.txt`; o servidor e o modo demonstração reconstroem automaticamente os 129 indicadores ABNT e os 386 registros auxiliares.

Consulte também `ARQUITETURA.md` para as regras de validação e auditoria do agente.
