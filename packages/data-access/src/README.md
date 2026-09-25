# Data-access source

`generated/` é saída do Supabase CLI e não deve ser editada manualmente. `supabase/` contém a factory do SDK, não queries de UI. Organizar adapters futuros por contrato/capacidade; tipos gerados não se tornam tipos de domínio automaticamente e devem ser mapeados/validados nas fronteiras.
