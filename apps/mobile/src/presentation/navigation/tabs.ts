export type TabDefinition = {
  accessibilityLabel: string;
  label: string;
  route: "index" | "treino" | "nutricao" | "progresso" | "personal";
};

export const tabDefinitions: readonly TabDefinition[] = [
  { route: "index", label: "Hoje", accessibilityLabel: "Abrir a área Hoje" },
  {
    route: "treino",
    label: "Treino",
    accessibilityLabel: "Abrir a área Treino",
  },
  {
    route: "nutricao",
    label: "Nutrição",
    accessibilityLabel: "Abrir a área Nutrição",
  },
  {
    route: "progresso",
    label: "Progresso",
    accessibilityLabel: "Abrir a área Progresso",
  },
  {
    route: "personal",
    label: "Personal",
    accessibilityLabel: "Abrir a área Personal",
  },
];
