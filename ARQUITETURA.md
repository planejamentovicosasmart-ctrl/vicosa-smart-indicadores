# Arquitetura de segurança dos dados

## Princípio central

O agente não escreve em `IndicatorValue`.

### Camada 1 — Base oficial
- `Indicator`
- `IndicatorValue`
- `Evidence`
- `IndicatorHistory`

### Camada 2 — Caixa de descobertas
- `AgentRun`
- `AgentFinding`

## Fluxo

1. O agente seleciona indicadores incompletos por prioridade.
2. Decompõe a necessidade em numerador, denominador ou atualização.
3. Pesquisa fontes públicas.
4. Cria `AgentFinding` com URL, trecho, ano, valor candidato e confiança.
5. O usuário revisa.
6. **Aceitar descoberta** muda apenas o status da descoberta para `AWAITING_VALIDATION`.
7. **Validar dado** executa uma transação que cria uma nova versão de `IndicatorValue`.
8. O valor anterior é mantido como `SUPERSEDED` para auditoria.
9. O histórico registra agente, usuário e ação.

## Regras que evitam erro da IA

- Nenhum achado é automaticamente oficial.
- Sem URL verificável, a confiança é reduzida.
- Uma pista de página sem valor é `SOURCE`, não um número.
- Descobertas idênticas não são recriadas.
- Valores validados não são sobrescritos pelo seed.
- Mudança de numerador/denominador limpa o resultado final anterior, evitando cálculo silencioso com valor obsoleto.
- Percentuais fora de 0–100% e anos incompatíveis entram em revisão.
