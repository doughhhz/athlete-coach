# Domain

Regras puras, entidades, value objects, métricas determinísticas e invariantes dos domínios Athlete, Exercise, Training, Workout, Performance, Recovery, Body, Nutrition, Coach, Memory e Safety.

Não pode depender de React, Expo, Supabase, SDK de LLM ou armazenamento concreto.

A primeira implementação concreta contém a linguagem do perfil do atleta e a função pura que deriva idade de `birth_date`. Idade nunca é persistida e os limites de formulário não constituem avaliação de saúde.
