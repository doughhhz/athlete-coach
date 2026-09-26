# Personal Trainer por IA

Status: **canônico, conceitual**
Este documento não é o System Prompt definitivo.

## Papel

O Coach interpreta contexto estruturado, comunica padrões, levanta hipóteses, recomenda ações e acompanha seus resultados. Ele não é calculadora oficial, banco de dados, profissional clínico nem autoridade autônoma para alterar fatos e planos.

A Phase 7 não introduz IA. Derived Performance é calculada deterministicamente e poderá futuramente entrar no Context Builder com fórmula, versão, unidade e proveniência. O Coach não recalcula, reclassifica ou reescreve esses resultados.

## Pipeline

```text
Authenticated request
  -> AI Gateway
  -> Input Safety Gate
  -> Context Builder
  -> Coach Orchestrator
  -> deterministic tools / retrieval
  -> LLM Provider Adapter
  -> Output Schema Validation
  -> Output Safety Gate
  -> user-visible response + auditable metadata
```

Gates podem interromper, restringir contexto, solicitar confirmação ou devolver orientação segura sem chamar o LLM.

## Contratos conceituais

### AI Gateway

Autentica, autoriza, limita uso, aplica idempotência, correlaciona logs e seleciona o fluxo. Nunca aceita uma instrução do cliente como autorização para ler todo o histórico.

### Context Builder

Monta contexto mínimo para a finalidade declarada. Separa Raw, Derived e Coach Intelligence; inclui fontes, datas, unidades, versões e frescor; exclui dados sem consentimento ou sem relevância.

### Coach Orchestrator

Escolhe template/policy versionada, solicita ferramentas determinísticas e exige uma saída estruturada. Recomendações que mudam estratégia geram proposta para o Decision Ledger, não mutação direta.

### Safety Layer

Detecta sinais, limita escopo e impede conselhos incompatíveis com as regras de segurança. Regras críticas devem ser determinísticas quando possível; moderação do provider é defesa adicional, não única.

### Provider Adapter

Contrato interno aproximado: modelo/capacidades, mensagens estruturadas, tool calling, schema de saída, timeout, cancelamento, consumo e erros normalizados. O adapter Gemini fica apenas no backend.

## Athlete Dossier e memória

A memória longitudinal é curada, tipada, referenciada e revogável. Não enviar o dossier inteiro por padrão. Um novo aprendizado requer evidência e pode permanecer como hipótese até avaliação. Contradições não são resolvidas por sobrescrita silenciosa.

Memória deve distinguir:

- fato atual confirmado;
- histórico/snapshot;
- padrão derivado;
- observação do coach;
- hipótese não confirmada;
- decisão e resultado.

## Saídas e ações

Respostas futuras devem preferir schema validável com: resumo, evidências citadas por ID, interpretação, incertezas, recomendações, riscos/safety, perguntas necessárias e ação proposta. Texto livre é renderização, não contrato de negócio.

O modelo não executa diretamente mudanças irreversíveis. Ações propostas passam por validação de domínio, safety e, quando relevante, confirmação do usuário.

## Proveniência mínima

Registrar request/correlation ID, propósito, versão do contexto/policy/prompt, provider, modelo, parâmetros relevantes, IDs de evidência, resultado validado, safety outcome, latência e uso/custo disponível. Não persistir cadeia de pensamento nem dados sensíveis desnecessários.

## Avaliação futura

- grounding em evidências fornecidas;
- consistência com métricas determinísticas;
- utilidade e clareza;
- calibragem de incerteza;
- taxa de saída inválida;
- comportamento diante de sinais de risco;
- não invenção de dados;
- estabilidade suficiente entre providers.

Fixtures sintéticas e dados anonimizados devem anteceder testes com dados reais.

## Questões abertas

Modelo Gemini inicial, estratégia de custos, retenção pelo provider, regiões, streaming, embeddings/RAG, policy de consentimento, ciclos de memória e requisitos jurídicos. Nenhuma dessas escolhas está aprovada nesta fase.

## Dossier boundary before AI

Phase 8 não integra LLM. O futuro Personal AI recebe `AthleteTrainingDossier` versionado e futuramente drill-down específico de evidência; acesso irrestrito ao banco não é sua interface primária. Recomendações futuras exigem schema, validação determinística e aprovação humana/policy.
