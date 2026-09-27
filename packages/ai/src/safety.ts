import type { CoachAnalysis } from "@athlete-coach/domain";
import type { CoachSafetyPolicy } from "@athlete-coach/application";
const rules = [
  {
    kind: "emergency" as const,
    pattern: /dor (forte|intensa) no peito|não consigo respirar|desmai/i,
    message:
      "Se os sintomas forem intensos ou houver risco imediato, procure um serviço de emergência agora. Não continue o treino.",
  },
  {
    kind: "acute_pain" as const,
    pattern: /dor aguda|dor forte/i,
    message:
      "Não é seguro orientar a continuidade do treino com dor aguda. Interrompa a atividade e procure avaliação profissional adequada.",
  },
  {
    kind: "possible_injury" as const,
    pattern: /rompi|rompimento|lesion(ei|ado)|estalo.*dor/i,
    message:
      "Não posso diagnosticar uma lesão. Suspenda o exercício envolvido e procure avaliação profissional.",
  },
  {
    kind: "severe_symptoms" as const,
    pattern: /convuls|confus(ão|o)|falta de ar|sangramento intenso/i,
    message:
      "Sintomas graves exigem avaliação urgente. Interrompa a atividade e procure atendimento apropriado.",
  },
  {
    kind: "medical_diagnosis" as const,
    pattern: /me diagnostique|qual (é|seria) meu diagnóstico|o que eu tenho/i,
    message:
      "Não posso fornecer diagnóstico médico. Procure avaliação de um profissional de saúde.",
  },
  {
    kind: "medication" as const,
    pattern: /medica(ção|mento)|remédio|dose|anti-inflamatório/i,
    message:
      "Não posso orientar uso ou alteração de medicação. Converse com médico ou farmacêutico.",
  },
  {
    kind: "extreme_weight_practice" as const,
    pattern: /perder .*kg.*(dia|semana)|jejum.*dias|desidratar|vomitar.*peso/i,
    message:
      "Práticas extremas de perda de peso podem ser perigosas. Procure orientação profissional individualizada.",
  },
  {
    kind: "eating_disorder" as const,
    pattern: /compulsão alimentar|anorexia|bulimia|induzir vômito/i,
    message:
      "Esse contexto merece apoio profissional qualificado. Não vou sugerir práticas alimentares potencialmente perigosas.",
  },
];
export class DeterministicCoachSafetyPolicy implements CoachSafetyPolicy {
  evaluateInput(text: string) {
    const matched = rules.filter((rule) => rule.pattern.test(text));
    return {
      flags: matched.map((rule) => ({
        kind: rule.kind,
        message: rule.message,
        blocksTrainingAdvice: true,
      })),
      blockProvider: matched.length > 0,
    };
  }
  evaluateOutput(analysis: CoachAnalysis): CoachAnalysis {
    const unsafe =
      /diagnóstico|você (rompeu|lesionou)|continue.*dor aguda|aumente.*dose/i.test(
        JSON.stringify(analysis),
      );
    return unsafe
      ? {
          ...analysis,
          summary:
            "A resposta foi limitada por segurança. Procure avaliação profissional antes de continuar.",
          observations: [],
          hypotheses: [],
          recommendations: [],
          safetyFlags: [
            ...analysis.safetyFlags,
            {
              kind: "medical_diagnosis",
              message: "Conteúdo potencialmente clínico foi bloqueado.",
              blocksTrainingAdvice: true,
            },
          ],
        }
      : analysis;
  }
}
