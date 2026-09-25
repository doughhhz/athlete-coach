# Application

Casos de uso, comandos, consultas e portas que coordenam o domínio. Pode depender de `domain`, mas não de UI nem de adapters concretos.

A Phase 3 introduz portas específicas para Auth, atleta, perfil, objetivo, contexto/disponibilidade e peso; casos de uso com uma responsabilidade explícita; e schemas Zod compartilhados para entradas. Não existe repository genérico nem orquestração dentro de componentes React.
