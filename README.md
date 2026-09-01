# Central de Indicadores — Viçosa SMART

Sistema web para gestão, pesquisa, validação e acompanhamento de indicadores municipais das ABNT NBR ISO 37120, ISO 37122 e ISO 37123.

## Base inicial

- 129 indicadores ABNT importados da planilha fornecida.
- 386 indicadores/registros auxiliares importados do CSV fornecido.
- Dados oficiais e descobertas do agente ficam separados.

## Principais áreas

- Visão Geral
- Indicadores ABNT
- Indicadores Auxiliares
- Agente de Pesquisa
- Descobertas do Agente
- Fontes e Evidências

## Regra de segurança do agente

O agente nunca altera a base oficial diretamente.

Fluxo obrigatório:

`Pesquisa → Descoberta → Revisão humana → Aguardando validação → Validação → Base oficial`

## Tecnologias

- React + Vite
- Node.js + Express
- PostgreSQL
- Prisma
- OpenAI Responses API + Web Search para o agente
- Tavily como fallback opcional
- Preparado para Neon + Render

## Testar somente a interface, sem banco

Entre em `client`:

```bash
cd client
npm install
npm run dev
```

Abra:

```text
http://localhost:5173/?demo=1
```

O modo demonstração usa os dados locais e não tenta acessar banco de dados.

## Rodar o sistema completo localmente

### Windows — forma mais simples

Na raiz do projeto:

```powershell
powershell -ExecutionPolicy Bypass -File .\CONFIGURAR_WINDOWS.ps1
```

O configurador pedirá a `DATABASE_URL` do Neon e, opcionalmente, a `OPENAI_API_KEY`.

Depois da primeira configuração, execute:

```text
INICIAR_WINDOWS.bat
```

ou:

```bash
npm start
```

Abra:

```text
http://localhost:3000
```

### Manual

1. Configure `server/.env` a partir de `server/.env.example`.
2. Instale as dependências:

```bash
npm run install:all
```

3. Prepare o banco:

```bash
npm run db:push
npm run seed
```

4. Gere o frontend:

```bash
npm run build
```

5. Inicie:

```bash
npm start
```

## Variáveis de ambiente

```text
DATABASE_URL=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.6-luna
TAVILY_API_KEY=
AGENT_MAX_INDICATORS=8
BASIC_AUTH_USER=vicosasmart
BASIC_AUTH_PASSWORD=
PORT=3000
NODE_ENV=production
```

Nunca envie `.env` ou chaves reais para o GitHub.

## Agente de pesquisa

O agente analisa indicadores incompletos, separa numerador e denominador, pesquisa fontes públicas e cria descobertas candidatas.

Prioriza fontes como:

- Prefeitura de Viçosa
- SAAE Viçosa
- IBGE / SIDRA
- SINISA
- dados.gov.br
- DATASUS
- INEP
- SICONFI
- ANATEL
- ANEEL
- TSE
- Governo de Minas Gerais
- UFV

Toda descoberta fica na caixa de entrada até revisão humana.

## Neon

1. Crie um projeto PostgreSQL no Neon.
2. Copie a connection string.
3. Use a string em `DATABASE_URL`.
4. Rode `npm run db:push` e `npm run seed` na primeira configuração.

## Render

O projeto inclui `render.yaml` com:

- Web Service para a aplicação
- Cron Job diário para o agente
- execução do agente às 09:00 UTC, equivalente a 06:00 em Brasília quando UTC-3

No Render:

1. New → Blueprint
2. Conecte o repositório GitHub
3. Selecione o `render.yaml`
4. Configure os secrets
5. Faça o deploy

## Estrutura

```text
vicosa-smart-indicadores/
├─ client/
│  ├─ public/seed.gz.b64.part*.txt
│  └─ src/
├─ server/
│  ├─ prisma/
│  ├─ scripts/
│  └─ src/
├─ data/
│  └─ seed.gz.b64.part*.txt
├─ render.yaml
├─ CONFIGURAR_WINDOWS.ps1
├─ INICIAR_WINDOWS.bat
├─ ARQUITETURA.md
└─ PUBLICAR_GITHUB.md
```

## Observação

O modo demonstração é apenas visual. Para pesquisa real do agente, persistência de dados, validação e histórico, utilize o sistema completo com PostgreSQL configurado.

## Relatórios para compartilhamento / Geterr

O sistema possui a guia **Relatórios**. Ela consolida somente dados da base oficial e permite:

- filtrar por ISO 37120, 37122 ou 37123;
- gerar relatório com indicadores que já possuem algum dado encontrado;
- limitar a completos/validados, parciais ou indicadores com resultado final;
- pesquisar por indicador, código ou fonte;
- baixar **CSV compatível com Excel**, com numerador, denominador, anos, fontes, URLs, valor final e observações;
- usar **Imprimir / PDF** para gerar uma versão técnica em PDF pelo navegador.

Descobertas do agente que ainda não passaram pela validação humana **não entram** no relatório oficial.


## Base inicial no repositório

Para evitar arquivos binários e duplicações grandes no GitHub, a base inicial normalizada é versionada em partes compactadas (`seed.gz.b64.part*.txt`). O seed do servidor e o modo demonstração reconstroem automaticamente os 129 indicadores ABNT e os 386 registros auxiliares. As planilhas originais ficam fora do repositório e podem ser mantidas como evidência/arquivo-fonte.
