# Especificação do produto

Status: **canônico, nível conceitual**
Fase implementada mais recente: 4 — Exercise & Anatomy Knowledge Core

## Visão

Uma plataforma pessoal para iPhone que reúne planejamento e execução de treino, histórico corporal, recuperação, nutrição e inteligência longitudinal. O diferencial é um Personal Trainer por IA que conhece somente o contexto autorizado, explica suas recomendações e aprende com decisões e resultados registrados.

## Usuário e contexto inicial

O usuário inicial é um único atleta usando o próprio iPhone. Não se assume neste momento marketplace, relação treinador-cliente, uso familiar, comunidade ou operação multi-tenant comercial. O produto deve, porém, manter isolamento por usuário desde o modelo de segurança.

## Objetivos do usuário

- registrar uma sessão rapidamente e sem perder o foco;
- executar uma prescrição e comparar planejado versus realizado;
- acompanhar progressão, aderência, recuperação e tendências;
- receber análises explicáveis que utilizem histórico relevante;
- entender por que uma mudança foi sugerida e se funcionou;
- acompanhar alimentação sem misturar estimativas com fatos registrados;
- manter uma memória longitudinal controlável e auditável.

## Capacidades planejadas

1. Perfil do atleta, objetivos, disponibilidade, preferências e limitações.
2. Catálogo de exercícios, músculos, equipamentos, instruções e substituições.
3. Programas estruturados em blocos, semanas, dias e prescrições.
4. Workout Runner para séries, carga, repetições, RIR, descanso e notas.
5. Motor de performance para métricas, PRs, tendências e progressão.
6. Check-ins de sono, fadiga, dor muscular, energia, estresse e motivação.
7. Peso, medidas e progresso corporal.
8. Metas e histórico nutricional, alimentos, refeições, macros e calorias.
9. Coach IA para análises, hipóteses, recomendações e decisões.
10. Athlete Dossier e revisões pós-treino, semanais e mensais.
11. Integração futura e consentida com Apple Health/HealthKit.

## Experiência desejada

### Durante o treino

A ação principal fica acessível com uma mão. A última série serve de referência, valores são editáveis, o descanso é visível e falhas de rede não apagam trabalho. Alertas não bloqueiam ações comuns sem motivo de segurança.

### Fora do treino

O usuário encontra tendências e explicações antes de dados brutos extensos, mas consegue rastrear cada conclusão até suas evidências. Recomendações distinguem claramente proposta, decisão aceita e mudança efetivamente aplicada.

### Com a IA

A conversa não é a única interface nem a fonte oficial dos dados. A IA recebe contexto mínimo e estruturado, declara limitações, não inventa medições e não altera plano ou fatos sem um fluxo explícito de aceite.

## Resultados de produto a validar

- menor atrito para registrar uma sessão completa;
- alta integridade e recuperabilidade do histórico;
- entendimento das recomendações e confiança calibrada;
- capacidade de avaliar se mudanças estratégicas melhoraram métricas escolhidas;
- uso longitudinal sem sobrecarga de entrada de dados.

Metas numéricas ainda não foram definidas e não devem ser inventadas antes de pesquisa/uso real.

## Fora do escopo atual

UI final, prescrição automática, programa de treino, integração Gemini, aconselhamento clínico, HealthKit, analytics, nutrição detalhada e monetização.

## Estado após a Phase 1

Existe um shell mobile executável e navegável, sem capacidades de domínio. As cinco áreas provisórias são Hoje, Treino, Nutrição, Progresso e Personal. Cada tela declara explicitamente seu estado de placeholder; isso não implica que treino, nutrição, analytics ou IA estejam implementados.

## Estado após a Phase 3

O usuário pode criar conta e entrar por e-mail/senha, concluir onboarding, restaurar a sessão, editar dados fundamentais e acrescentar pesagens sem destruir o histórico. O app persiste nome preferido, nascimento, altura, timezone IANA, objetivo, experiência, rotina, duração, ambiente, disponibilidade, observações e preferências. Cada campo tem uso futuro identificado para personalização ou Training Engine; sexo, nutrição e informações de localização exata não são coletados.

Hoje apresenta somente saudação, objetivo e peso mais recente efetivamente persistidos. As demais áreas continuam declarando ausência de implementação; nenhum resultado fictício é tratado como real.

## Estado após a Phase 4

A tab Treino oferece uma biblioteca canônica de anatomia e 37 exercícios comuns, com nomes PT/EN, busca por nomes/aliases, filtros factuais, instruções originais, músculos, equipamentos e relações explícitas. Ausência de mídia é informada sem imagem simulada. O catálogo descreve movimentos e não prescreve séries, repetições, carga, intensidade, descanso ou progressão.

## Questões abertas

- nome e identidade visual do produto;
- idioma inicial da interface;
- estratégia offline e sincronização detalhada;
- unidades preferidas e suporte métrico/imperial;
- política de privacidade, retenção, exportação e exclusão;
- regras clínicas e locais de escalonamento;
- fontes e licenças para catálogo e mídia de exercícios/alimentos;
- métricas prioritárias e critérios de sucesso por fase.
