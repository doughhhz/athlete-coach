/** Copy of the initial program flow (ADR-0119). Presentation only. */
export const INITIAL_PROGRAM_INTRO =
  "O Personal vai montar seu primeiro programa usando tudo o que você informou. Mais algumas perguntas deixam o programa mais seguro e mais seu.";
export const INITIAL_PROGRAM_GENERATING =
  "O Personal está montando seu programa. Isso pode levar até um minuto.";
export const EQUIPMENT_HINT =
  "Opcional. Se não informar, o Personal considera os equipamentos típicos do seu ambiente de treino.";
export const BASIC_TEMPLATE_NOTICE =
  "O modelo básico usa regras fixas do sistema e não é personalizado pelo Personal.";
export const DRAFT_NOTICE =
  "O programa é criado como rascunho: revise, edite se quiser e ative quando estiver de acordo.";

/** Errors after which the basic template may be offered (availability). */
const BASIC_FALLBACK_CODES = new Set([
  "program_provider_unavailable",
  "program_timeout",
  "program_invalid",
  "program_failed",
]);
export function canOfferBasicTemplate(code: string): boolean {
  return BASIC_FALLBACK_CODES.has(code);
}

export function initialProgramErrorMessage(
  code: string,
  reason: string | null,
): string {
  if (code === "program_blocked")
    return reason === "medical_restriction"
      ? "Você informou restrição médica para exercícios. Procure liberação profissional antes de iniciar um programa. Se quiser, você ainda pode montar um programa manualmente."
      : "Pelo que você descreveu, o recomendado é procurar avaliação profissional antes de iniciar um programa. Nenhum programa foi criado.";
  if (code === "program_prerequisite")
    return reason === "no_exercises"
      ? "Nenhum exercício do catálogo combina com os equipamentos informados. Revise os equipamentos e tente de novo."
      : "Conclua seu perfil antes de montar o programa.";
  if (code === "program_provider_unavailable" || code === "program_timeout")
    return "O Personal está indisponível agora. Tente de novo em instantes ou use o modelo básico do sistema.";
  if (code === "program_invalid")
    return "O Personal não conseguiu montar um programa dentro dos limites de segurança do sistema. Tente de novo ou use o modelo básico.";
  if (code === "rate_limited")
    return "Muitas tentativas seguidas. Aguarde um minuto e tente de novo.";
  return "Não foi possível montar o programa agora. Tente de novo.";
}
