# Motor de nutrição

Status: **canônico, arquitetura futura**

## Escopo planejado

Metas nutricionais, catálogo de alimentos, porções, refeições, registro diário, calorias, macros, tendências e análises contextuais. O módulo não fornecerá tratamento clínico nem substituirá nutricionista em situações médicas.

## Princípios

- quantidade consumida e alimento escolhido são Raw Data do usuário/importação;
- nutrientes por porção podem vir de fontes externas, rótulos ou estimativa e exigem proveniência;
- totais, médias e desvios são Derived Data calculados pelo sistema;
- comentários e sugestões são Coach Intelligence;
- estimativa nunca é apresentada como medição precisa;
- unidade, densidade, porção e base (cru/cozido, por 100 g/porção) são explícitas.

## Modelo conceitual

`NutritionGoal` define metas e vigência. `Food` descreve item e fonte. `Serving` define conversão. `Meal` agrupa `FoodLogEntry`. `NutritionSummary` calcula totais por janela. Histórico não deve ser recalculado com nova composição de alimento sem política/versionamento explícito.

## Cálculos futuros

Energia e macros consumidos; aderência às faixas; médias móveis; distribuição por refeição; tendências. Metas e tolerâncias precisam de decisão explícita. A IA não soma macros nem estima compensações quando dados determinísticos existem.

## Safety

Fluxos devem reconhecer contexto médico declarado, comportamentos potencialmente perigosos e solicitações inadequadas. O produto não prescreve dietas terapêuticas, não incentiva restrição extrema e orienta apoio profissional quando indicado. Regras e linguagem serão revisadas por especialista antes de produção.

## Dependências e riscos

Antes de implementar: definir fonte/licença de alimentos, localidade e unidades, política de edição histórica, privacidade, limites do Coach, qualidade de dados, funcionamento offline e relação entre gasto energético estimado e recomendações.

## Boundary com o Personal na Phase 9

O Personal pode oferecer conhecimento geral e deve declarar ausência de contexto nutricional individual. Não inventa calorias, macros ou dieta e não implementa este motor.

Na Phase 10, `CoachProposal` não possui actions nutricionais. Propostas de calorias, macros, dieta, medicação, perda extrema de peso ou adaptações clínicas não podem ser materializadas como revisão de treino.
