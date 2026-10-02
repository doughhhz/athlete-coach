export type TabDefinition = {
  accessibilityLabel: string;
  /** Ionicons glyph (outline style, design 2026-10-01). */
  icon: string;
  label: string;
  route: "index" | "treino" | "nutricao" | "progresso" | "personal";
};

export const tabDefinitions: readonly TabDefinition[] = [
  {
    route: "index",
    label: "Hoje",
    icon: "home-outline",
    accessibilityLabel: "Abrir a área Hoje",
  },
  {
    route: "treino",
    icon: "barbell-outline",
    label: "Treino",
    accessibilityLabel: "Abrir a área Treino",
  },
  {
    route: "nutricao",
    icon: "restaurant-outline",
    label: "Nutrição",
    accessibilityLabel: "Abrir a área Nutrição",
  },
  {
    route: "progresso",
    icon: "stats-chart-outline",
    label: "Progresso",
    accessibilityLabel: "Abrir a área Progresso",
  },
  {
    route: "personal",
    icon: "person-outline",
    label: "Personal",
    accessibilityLabel: "Abrir a área Personal",
  },
];
