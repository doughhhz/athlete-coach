-- Canonical, original and non-personal Phase 4 knowledge seed.
-- UUIDs are internal identities. No provider identifier is used as a domain key.

insert into public.body_regions (id, slug, name_en, name_pt) values
('10000000-0000-4000-8000-000000000001', 'upper-body', 'Upper body', 'Membros superiores'),
('10000000-0000-4000-8000-000000000002', 'lower-body', 'Lower body', 'Membros inferiores'),
('10000000-0000-4000-8000-000000000003', 'trunk', 'Trunk', 'Tronco')
on conflict (id) do nothing;

insert into public.muscle_groups (id, body_region_id, slug, name_en, name_pt) values
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','chest','Chest','Peitoral'),
('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','back','Back','Costas'),
('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','shoulders','Shoulders','Ombros'),
('20000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001','biceps','Biceps','Bíceps'),
('20000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000001','triceps','Triceps','Tríceps'),
('20000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000002','quadriceps','Quadriceps','Quadríceps'),
('20000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000002','hamstrings','Hamstrings','Posteriores de coxa'),
('20000000-0000-4000-8000-000000000008','10000000-0000-4000-8000-000000000002','glutes','Glutes','Glúteos'),
('20000000-0000-4000-8000-000000000009','10000000-0000-4000-8000-000000000002','calves','Calves','Panturrilhas'),
('20000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000003','core','Core','Core')
on conflict (id) do nothing;

insert into public.muscles (id, muscle_group_id, slug, name_en, name_pt, anatomical_name) values
('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','pectoralis-major-clavicular','Pectoralis major, clavicular portion','Peitoral maior, porção clavicular','Musculus pectoralis major, pars clavicularis'),
('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','pectoralis-major-sternocostal','Pectoralis major, sternocostal portion','Peitoral maior, porção esternocostal','Musculus pectoralis major, pars sternocostalis'),
('30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000002','latissimus-dorsi','Latissimus dorsi','Latíssimo do dorso','Musculus latissimus dorsi'),
('30000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000002','trapezius-middle','Middle trapezius','Trapézio médio','Musculus trapezius, pars transversa'),
('30000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000002','rhomboids','Rhomboids','Romboides','Musculi rhomboidei'),
('30000000-0000-4000-8000-000000000006','20000000-0000-4000-8000-000000000003','anterior-deltoid','Anterior deltoid','Deltoide anterior','Musculus deltoideus, pars clavicularis'),
('30000000-0000-4000-8000-000000000007','20000000-0000-4000-8000-000000000003','lateral-deltoid','Lateral deltoid','Deltoide lateral','Musculus deltoideus, pars acromialis'),
('30000000-0000-4000-8000-000000000008','20000000-0000-4000-8000-000000000003','posterior-deltoid','Posterior deltoid','Deltoide posterior','Musculus deltoideus, pars spinalis'),
('30000000-0000-4000-8000-000000000009','20000000-0000-4000-8000-000000000004','biceps-brachii','Biceps brachii','Bíceps braquial','Musculus biceps brachii'),
('30000000-0000-4000-8000-000000000010','20000000-0000-4000-8000-000000000004','brachialis','Brachialis','Braquial','Musculus brachialis'),
('30000000-0000-4000-8000-000000000011','20000000-0000-4000-8000-000000000005','triceps-brachii','Triceps brachii','Tríceps braquial','Musculus triceps brachii'),
('30000000-0000-4000-8000-000000000012','20000000-0000-4000-8000-000000000006','rectus-femoris','Rectus femoris','Reto femoral','Musculus rectus femoris'),
('30000000-0000-4000-8000-000000000013','20000000-0000-4000-8000-000000000006','vastus-lateralis','Vastus lateralis','Vasto lateral','Musculus vastus lateralis'),
('30000000-0000-4000-8000-000000000014','20000000-0000-4000-8000-000000000006','vastus-medialis','Vastus medialis','Vasto medial','Musculus vastus medialis'),
('30000000-0000-4000-8000-000000000015','20000000-0000-4000-8000-000000000006','vastus-intermedius','Vastus intermedius','Vasto intermédio','Musculus vastus intermedius'),
('30000000-0000-4000-8000-000000000016','20000000-0000-4000-8000-000000000007','biceps-femoris','Biceps femoris','Bíceps femoral','Musculus biceps femoris'),
('30000000-0000-4000-8000-000000000017','20000000-0000-4000-8000-000000000007','semitendinosus-semimembranosus','Medial hamstrings','Posteriores mediais','Musculi semitendinosus et semimembranosus'),
('30000000-0000-4000-8000-000000000018','20000000-0000-4000-8000-000000000008','gluteus-maximus','Gluteus maximus','Glúteo máximo','Musculus gluteus maximus'),
('30000000-0000-4000-8000-000000000019','20000000-0000-4000-8000-000000000008','gluteus-medius','Gluteus medius','Glúteo médio','Musculus gluteus medius'),
('30000000-0000-4000-8000-000000000020','20000000-0000-4000-8000-000000000009','gastrocnemius','Gastrocnemius','Gastrocnêmio','Musculus gastrocnemius'),
('30000000-0000-4000-8000-000000000021','20000000-0000-4000-8000-000000000009','soleus','Soleus','Sóleo','Musculus soleus'),
('30000000-0000-4000-8000-000000000022','20000000-0000-4000-8000-000000000010','rectus-abdominis','Rectus abdominis','Reto abdominal','Musculus rectus abdominis'),
('30000000-0000-4000-8000-000000000023','20000000-0000-4000-8000-000000000010','obliques','Obliques','Oblíquos','Musculi obliqui abdominis'),
('30000000-0000-4000-8000-000000000024','20000000-0000-4000-8000-000000000010','erector-spinae','Erector spinae','Eretores da espinha','Musculus erector spinae')
on conflict (id) do nothing;

insert into public.equipment (id, slug, name_en, name_pt) values
('40000000-0000-4000-8000-000000000001','bodyweight','Bodyweight','Peso corporal'),
('40000000-0000-4000-8000-000000000002','barbell','Barbell','Barra'),
('40000000-0000-4000-8000-000000000003','dumbbell','Dumbbell','Halter'),
('40000000-0000-4000-8000-000000000004','cable','Cable','Cabo'),
('40000000-0000-4000-8000-000000000005','plate-loaded-machine','Plate-loaded machine','Máquina com anilhas'),
('40000000-0000-4000-8000-000000000006','selectorized-machine','Selectorized machine','Máquina com placas'),
('40000000-0000-4000-8000-000000000007','smith-machine','Smith machine','Máquina Smith'),
('40000000-0000-4000-8000-000000000008','resistance-band','Resistance band','Faixa elástica'),
('40000000-0000-4000-8000-000000000009','kettlebell','Kettlebell','Kettlebell'),
('40000000-0000-4000-8000-000000000010','bench','Bench','Banco'),
('40000000-0000-4000-8000-000000000011','pullup-bar','Pull-up bar','Barra fixa'),
('40000000-0000-4000-8000-000000000012','landmine','Landmine','Landmine'),
('40000000-0000-4000-8000-000000000013','ez-bar','EZ bar','Barra W'),
('40000000-0000-4000-8000-000000000014','other','Other','Outro')
on conflict (id) do nothing;

with exercise_seed(sequence, slug, name_pt, name_en, description, movement, mechanics, laterality, difficulty) as (values
(1,'barbell-bench-press','Supino reto com barra','Barbell bench press','Empurrada horizontal com barra realizada em banco plano.','horizontal_push','compound','bilateral','intermediate'),
(2,'dumbbell-bench-press','Supino reto com halteres','Dumbbell bench press','Empurrada horizontal com halteres em banco plano.','horizontal_push','compound','bilateral','beginner'),
(3,'incline-dumbbell-press','Supino inclinado com halteres','Incline dumbbell press','Empurrada em banco inclinado com maior participação da porção clavicular do peitoral.','horizontal_push','compound','bilateral','intermediate'),
(4,'push-up','Flexão de braços','Push-up','Empurrada horizontal em cadeia fechada usando o peso corporal.','horizontal_push','compound','bilateral','beginner'),
(5,'cable-chest-fly','Crucifixo no cabo','Cable chest fly','Adução horizontal dos ombros com resistência do cabo.','horizontal_push','isolation','bilateral','beginner'),
(6,'lat-pulldown','Puxada alta','Lat pulldown','Puxada vertical em máquina de cabos.','vertical_pull','compound','bilateral','beginner'),
(7,'pull-up','Barra fixa','Pull-up','Puxada vertical do corpo em barra fixa.','vertical_pull','compound','bilateral','intermediate'),
(8,'barbell-bent-over-row','Remada curvada com barra','Barbell bent-over row','Puxada horizontal com o tronco inclinado e barra livre.','horizontal_pull','compound','bilateral','intermediate'),
(9,'seated-cable-row','Remada sentada no cabo','Seated cable row','Puxada horizontal sentada com resistência do cabo.','horizontal_pull','compound','bilateral','beginner'),
(10,'one-arm-dumbbell-row','Remada unilateral com halter','One-arm dumbbell row','Puxada horizontal unilateral apoiada em banco.','horizontal_pull','compound','unilateral','beginner'),
(11,'barbell-overhead-press','Desenvolvimento com barra','Barbell overhead press','Empurrada vertical em pé com barra.','vertical_push','compound','bilateral','intermediate'),
(12,'seated-dumbbell-shoulder-press','Desenvolvimento sentado com halteres','Seated dumbbell shoulder press','Empurrada vertical sentada com halteres.','vertical_push','compound','bilateral','beginner'),
(13,'dumbbell-lateral-raise','Elevação lateral com halteres','Dumbbell lateral raise','Abdução dos ombros com halteres.','shoulder_abduction','isolation','bilateral','beginner'),
(14,'cable-face-pull','Face pull no cabo','Cable face pull','Puxada do cabo em direção ao rosto com rotação externa dos ombros.','horizontal_pull','compound','bilateral','beginner'),
(15,'barbell-curl','Rosca direta com barra','Barbell curl','Flexão bilateral dos cotovelos com barra.','elbow_flexion','isolation','bilateral','beginner'),
(16,'alternating-dumbbell-curl','Rosca alternada com halteres','Alternating dumbbell curl','Flexão alternada dos cotovelos com halteres.','elbow_flexion','isolation','alternating','beginner'),
(17,'dumbbell-hammer-curl','Rosca martelo com halteres','Dumbbell hammer curl','Flexão dos cotovelos com pegada neutra.','elbow_flexion','isolation','bilateral','beginner'),
(18,'cable-triceps-pushdown','Tríceps na polia','Cable triceps pushdown','Extensão dos cotovelos em cabo alto.','elbow_extension','isolation','bilateral','beginner'),
(19,'ez-bar-lying-triceps-extension','Tríceps testa com barra W','EZ-bar lying triceps extension','Extensão dos cotovelos deitado com barra W.','elbow_extension','isolation','bilateral','intermediate'),
(20,'bench-dip','Mergulho no banco','Bench dip','Extensão dos cotovelos com apoio posterior em banco.','elbow_extension','compound','bilateral','intermediate'),
(21,'barbell-back-squat','Agachamento livre com barra','Barbell back squat','Agachamento bilateral com barra apoiada nas costas.','squat','compound','bilateral','intermediate'),
(22,'leg-press','Leg press','Leg press','Extensão combinada de quadris e joelhos em máquina inclinada.','squat','compound','bilateral','beginner'),
(23,'leg-extension','Cadeira extensora','Leg extension','Extensão dos joelhos em máquina.','knee_extension','isolation','bilateral','beginner'),
(24,'bulgarian-split-squat','Agachamento búlgaro','Bulgarian split squat','Agachamento unilateral com o pé traseiro elevado.','lunge','compound','unilateral','intermediate'),
(25,'smith-machine-squat','Agachamento no Smith','Smith machine squat','Agachamento bilateral guiado pela máquina Smith.','squat','compound','bilateral','beginner'),
(26,'barbell-romanian-deadlift','Levantamento terra romeno com barra','Barbell Romanian deadlift','Dobradiça de quadril com barra e joelhos levemente flexionados.','hinge','compound','bilateral','intermediate'),
(27,'seated-leg-curl','Mesa flexora sentada','Seated leg curl','Flexão dos joelhos em máquina sentada.','knee_flexion','isolation','bilateral','beginner'),
(28,'barbell-hip-thrust','Elevação pélvica com barra','Barbell hip thrust','Extensão de quadril com as costas apoiadas em banco.','hinge','compound','bilateral','intermediate'),
(29,'bodyweight-glute-bridge','Ponte de glúteos','Bodyweight glute bridge','Extensão de quadril no solo usando o peso corporal.','hinge','compound','bilateral','beginner'),
(30,'standing-calf-raise','Elevação de panturrilha em pé','Standing calf raise','Flexão plantar dos tornozelos em pé.','calf_raise','isolation','bilateral','beginner'),
(31,'seated-calf-raise','Elevação de panturrilha sentada','Seated calf raise','Flexão plantar dos tornozelos com joelhos flexionados.','calf_raise','isolation','bilateral','beginner'),
(32,'front-plank','Prancha frontal','Front plank','Sustentação do tronco contra extensão usando o peso corporal.','anti_extension','isolation','bilateral','beginner'),
(33,'dead-bug','Dead bug','Dead bug','Movimento alternado de membros mantendo o tronco estável.','anti_extension','isolation','alternating','beginner'),
(34,'cable-crunch','Abdominal no cabo','Cable crunch','Flexão do tronco contra resistência do cabo.','trunk_flexion','isolation','bilateral','beginner'),
(35,'pallof-press','Pallof press','Pallof press','Resistência à rotação do tronco com cabo.','anti_rotation','isolation','bilateral','beginner'),
(36,'back-extension','Extensão lombar no banco','Back extension','Extensão controlada do tronco em banco próprio.','trunk_extension','compound','bilateral','beginner'),
(37,'dumbbell-farmer-carry','Caminhada do fazendeiro com halteres','Dumbbell farmer carry','Caminhada com halteres ao lado do corpo e tronco estável.','carry','compound','bilateral','beginner'))
insert into public.exercises (id, slug, name_pt, name_en, short_description_pt, movement_pattern, mechanics, laterality, difficulty)
select ('50000000-0000-4000-8000-' || lpad(sequence::text,12,'0'))::uuid, slug, name_pt, name_en, description, movement, mechanics, laterality, difficulty
from exercise_seed on conflict (id) do nothing;

insert into public.exercise_aliases (id, exercise_id, language, alias)
select md5('alias-pt-'||slug)::uuid,id,'pt',replace(name_pt,' com ',' ') from public.exercises
union all select md5('alias-en-'||slug)::uuid,id,'en',replace(name_en,'dumbbell ','DB ') from public.exercises
on conflict do nothing;

with a(exercise_slug,muscle_slug,role,sort_order) as (values
('barbell-bench-press','pectoralis-major-sternocostal','primary',1),('barbell-bench-press','triceps-brachii','secondary',1),('barbell-bench-press','anterior-deltoid','secondary',2),
('dumbbell-bench-press','pectoralis-major-sternocostal','primary',1),('dumbbell-bench-press','triceps-brachii','secondary',1),
('incline-dumbbell-press','pectoralis-major-clavicular','primary',1),('incline-dumbbell-press','anterior-deltoid','secondary',1),
('push-up','pectoralis-major-sternocostal','primary',1),('push-up','triceps-brachii','secondary',1),('cable-chest-fly','pectoralis-major-sternocostal','primary',1),
('lat-pulldown','latissimus-dorsi','primary',1),('lat-pulldown','biceps-brachii','secondary',1),('pull-up','latissimus-dorsi','primary',1),('pull-up','biceps-brachii','secondary',1),
('barbell-bent-over-row','latissimus-dorsi','primary',1),('barbell-bent-over-row','trapezius-middle','primary',2),('barbell-bent-over-row','erector-spinae','stabilizer',1),
('seated-cable-row','trapezius-middle','primary',1),('seated-cable-row','latissimus-dorsi','secondary',1),('one-arm-dumbbell-row','latissimus-dorsi','primary',1),('one-arm-dumbbell-row','rhomboids','secondary',1),
('barbell-overhead-press','anterior-deltoid','primary',1),('barbell-overhead-press','triceps-brachii','secondary',1),('seated-dumbbell-shoulder-press','anterior-deltoid','primary',1),
('dumbbell-lateral-raise','lateral-deltoid','primary',1),('cable-face-pull','posterior-deltoid','primary',1),('cable-face-pull','trapezius-middle','secondary',1),
('barbell-curl','biceps-brachii','primary',1),('alternating-dumbbell-curl','biceps-brachii','primary',1),('dumbbell-hammer-curl','brachialis','primary',1),('dumbbell-hammer-curl','biceps-brachii','secondary',1),
('cable-triceps-pushdown','triceps-brachii','primary',1),('ez-bar-lying-triceps-extension','triceps-brachii','primary',1),('bench-dip','triceps-brachii','primary',1),('bench-dip','pectoralis-major-sternocostal','secondary',1),
('barbell-back-squat','vastus-lateralis','primary',1),('barbell-back-squat','gluteus-maximus','primary',2),('barbell-back-squat','erector-spinae','stabilizer',1),
('leg-press','vastus-lateralis','primary',1),('leg-press','gluteus-maximus','secondary',1),('leg-extension','rectus-femoris','primary',1),('leg-extension','vastus-medialis','primary',2),
('bulgarian-split-squat','gluteus-maximus','primary',1),('bulgarian-split-squat','vastus-lateralis','primary',2),('bulgarian-split-squat','gluteus-medius','stabilizer',1),
('smith-machine-squat','vastus-lateralis','primary',1),('smith-machine-squat','gluteus-maximus','secondary',1),
('barbell-romanian-deadlift','biceps-femoris','primary',1),('barbell-romanian-deadlift','semitendinosus-semimembranosus','primary',2),('barbell-romanian-deadlift','gluteus-maximus','secondary',1),
('seated-leg-curl','biceps-femoris','primary',1),('seated-leg-curl','semitendinosus-semimembranosus','primary',2),('barbell-hip-thrust','gluteus-maximus','primary',1),('bodyweight-glute-bridge','gluteus-maximus','primary',1),
('standing-calf-raise','gastrocnemius','primary',1),('standing-calf-raise','soleus','secondary',1),('seated-calf-raise','soleus','primary',1),
('front-plank','rectus-abdominis','primary',1),('front-plank','obliques','stabilizer',1),('dead-bug','rectus-abdominis','primary',1),('dead-bug','obliques','stabilizer',1),
('cable-crunch','rectus-abdominis','primary',1),('pallof-press','obliques','primary',1),('back-extension','erector-spinae','primary',1),('back-extension','gluteus-maximus','secondary',1),
('dumbbell-farmer-carry','trapezius-middle','primary',1),('dumbbell-farmer-carry','obliques','stabilizer',1))
insert into public.exercise_muscles (exercise_id,muscle_id,role,sort_order)
select e.id,m.id,a.role,a.sort_order from a join public.exercises e on e.slug=a.exercise_slug join public.muscles m on m.slug=a.muscle_slug on conflict do nothing;

with a(exercise_slug,equipment_slug,is_primary) as (values
('barbell-bench-press','barbell',true),('barbell-bench-press','bench',false),('dumbbell-bench-press','dumbbell',true),('dumbbell-bench-press','bench',false),
('incline-dumbbell-press','dumbbell',true),('incline-dumbbell-press','bench',false),('push-up','bodyweight',true),('cable-chest-fly','cable',true),
('lat-pulldown','selectorized-machine',true),('pull-up','pullup-bar',true),('pull-up','bodyweight',false),('barbell-bent-over-row','barbell',true),
('seated-cable-row','cable',true),('one-arm-dumbbell-row','dumbbell',true),('one-arm-dumbbell-row','bench',false),('barbell-overhead-press','barbell',true),
('seated-dumbbell-shoulder-press','dumbbell',true),('seated-dumbbell-shoulder-press','bench',false),('dumbbell-lateral-raise','dumbbell',true),('cable-face-pull','cable',true),
('barbell-curl','barbell',true),('alternating-dumbbell-curl','dumbbell',true),('dumbbell-hammer-curl','dumbbell',true),('cable-triceps-pushdown','cable',true),
('ez-bar-lying-triceps-extension','ez-bar',true),('ez-bar-lying-triceps-extension','bench',false),('bench-dip','bench',true),('bench-dip','bodyweight',false),
('barbell-back-squat','barbell',true),('leg-press','plate-loaded-machine',true),('leg-extension','selectorized-machine',true),('bulgarian-split-squat','dumbbell',true),('bulgarian-split-squat','bench',false),
('smith-machine-squat','smith-machine',true),('barbell-romanian-deadlift','barbell',true),('seated-leg-curl','selectorized-machine',true),('barbell-hip-thrust','barbell',true),('barbell-hip-thrust','bench',false),
('bodyweight-glute-bridge','bodyweight',true),('standing-calf-raise','selectorized-machine',true),('seated-calf-raise','plate-loaded-machine',true),('front-plank','bodyweight',true),
('dead-bug','bodyweight',true),('cable-crunch','cable',true),('pallof-press','cable',true),('back-extension','other',true),('dumbbell-farmer-carry','dumbbell',true))
insert into public.exercise_equipment (exercise_id,equipment_id,is_primary)
select e.id,eq.id,a.is_primary from a join public.exercises e on e.slug=a.exercise_slug join public.equipment eq on eq.slug=a.equipment_slug on conflict do nothing;

-- Original concise instructions describe the movement, never a prescription.
insert into public.exercise_instruction_steps (id,exercise_id,section,sort_order,content_pt)
select md5(e.slug||'-setup-1')::uuid,e.id,'setup',1,case when e.laterality='unilateral' then 'Organize o apoio e alinhe o lado que iniciará o movimento.' else 'Ajuste o equipamento e adote uma posição estável antes de iniciar.' end from public.exercises e
union all select md5(e.slug||'-execution-1')::uuid,e.id,'execution',1,'Execute o padrão descrito de forma controlada, mantendo as articulações alinhadas e sem usar impulso.' from public.exercises e
union all select md5(e.slug||'-breathing-1')::uuid,e.id,'breathing_cue',1,'Respire sem prender o ar por tempo desnecessário e mantenha o tronco organizado durante o movimento.' from public.exercises e
union all select md5(e.slug||'-mistake-1')::uuid,e.id,'common_mistake',1,'Evite reduzir o controle ou alterar a trajetória apenas para completar o movimento.' from public.exercises e
union all select md5(e.slug||'-safety-1')::uuid,e.id,'safety_note',1,'Interrompa se houver dor aguda, tontura ou perda de controle. Esta orientação não substitui avaliação profissional.' from public.exercises e
on conflict do nothing;

with specific_execution(exercise_slug, content_pt) as (values
('barbell-bench-press','Retire a barra com os ombros apoiados, desça-a em direção ao meio do peito e estenda os cotovelos mantendo punhos e antebraços alinhados.'),
('dumbbell-bench-press','Desça os halteres ao lado do peito com controle e empurre-os até os braços ficarem estendidos, sem perder o apoio das escápulas.'),
('incline-dumbbell-press','Conduza os halteres para baixo ao lado do peito superior e empurre-os na direção do teto, preservando o contato com o banco.'),
('push-up','Flexione os cotovelos para aproximar peito e quadris do solo juntos; empurre o chão mantendo cabeça, tronco e pernas alinhados.'),
('cable-chest-fly','Com leve flexão fixa dos cotovelos, aproxime as mãos à frente do peito e retorne até um alongamento confortável.'),
('lat-pulldown','Puxe a barra em direção à parte alta do peito levando os cotovelos para baixo; retorne sem elevar o tronco ou soltar o controle.'),
('pull-up','Inicie com os braços estendidos, leve os cotovelos para baixo para elevar o corpo e retorne de forma controlada à suspensão.'),
('barbell-bent-over-row','Mantenha o tronco inclinado estável, puxe a barra em direção ao abdômen e estenda novamente os braços sem balançar o corpo.'),
('seated-cable-row','Puxe o pegador em direção ao tronco levando os cotovelos para trás e retorne sem arredondar ou projetar excessivamente as costas.'),
('one-arm-dumbbell-row','Com o tronco apoiado e estável, leve o cotovelo para trás até o halter se aproximar do tronco e desça o braço com controle.'),
('barbell-overhead-press','Empurre a barra acima da cabeça enquanto ela passa próxima ao rosto; finalize alinhada sobre o tronco e desça com controle.'),
('seated-dumbbell-shoulder-press','Partindo dos halteres ao lado dos ombros, empurre-os acima da cabeça e retorne sem perder o apoio do tronco.'),
('dumbbell-lateral-raise','Eleve os braços lateralmente com cotovelos levemente flexionados até uma altura confortável e desça sem impulso.'),
('cable-face-pull','Puxe a corda em direção ao rosto separando as pontas e levando cotovelos para fora; retorne mantendo tensão controlada.'),
('barbell-curl','Flexione os cotovelos para elevar a barra sem deslocá-los para frente e desça até estender os braços com controle.'),
('alternating-dumbbell-curl','Flexione um cotovelo por vez mantendo o braço junto ao tronco; complete a descida antes de alternar o lado.'),
('dumbbell-hammer-curl','Mantenha as palmas voltadas uma para a outra, flexione os cotovelos sem balançar o tronco e retorne lentamente.'),
('cable-triceps-pushdown','Mantenha os cotovelos próximos ao tronco, estenda-os para levar o pegador para baixo e retorne sem mover os ombros.'),
('ez-bar-lying-triceps-extension','Com os braços apontados para cima, flexione os cotovelos para aproximar a barra da testa e estenda-os sem abrir excessivamente os cotovelos.'),
('bench-dip','Desça o corpo flexionando os cotovelos enquanto permanece próximo ao banco; empurre o apoio para retornar sem projetar os ombros.'),
('barbell-back-squat','Flexione quadris e joelhos mantendo os pés apoiados e o tronco organizado; empurre o chão para retornar à posição em pé.'),
('leg-press','Desça a plataforma flexionando quadris e joelhos dentro de uma amplitude controlada e empurre-a sem retirar quadris ou pés dos apoios.'),
('leg-extension','Estenda os joelhos para elevar o apoio e retorne lentamente até a posição inicial sem retirar o quadril do assento.'),
('bulgarian-split-squat','Desça o quadril flexionando a perna da frente enquanto o pé traseiro permanece apoiado; pressione o pé dianteiro para subir.'),
('smith-machine-squat','Desça pela guia flexionando quadris e joelhos com os pés firmes; estenda-os para subir sem relaxar contra as travas.'),
('barbell-romanian-deadlift','Leve os quadris para trás enquanto a barra desce próxima às pernas; estenda os quadris para retornar sem arredondar as costas.'),
('seated-leg-curl','Flexione os joelhos para levar o rolo para baixo e para trás; retorne controladamente sem levantar o quadril do assento.'),
('barbell-hip-thrust','Eleve o quadril até alinhar tronco e coxas, mantendo as costelas organizadas; desça sem perder o apoio das costas.'),
('bodyweight-glute-bridge','Pressione os pés no solo e eleve o quadril até alinhar tronco e coxas; retorne sem hiperestender a região lombar.'),
('standing-calf-raise','Eleve os calcanhares pela flexão plantar, pause brevemente no alto e desça controladamente mantendo os tornozelos alinhados.'),
('seated-calf-raise','Com os joelhos flexionados e apoiados, eleve os calcanhares, pause no alto e desça por uma amplitude controlada.'),
('front-plank','Sustente ombros, quadris e tornozelos alinhados enquanto pressiona antebraços e pés contra o solo, sem deixar a lombar ceder.'),
('dead-bug','Afaste lentamente braço e perna opostos mantendo o tronco estável; retorne ao centro e alterne os lados.'),
('cable-crunch','Flexione o tronco aproximando costelas e pelve sem puxar o cabo apenas com os braços; retorne sob controle.'),
('pallof-press','Afaste o pegador do peito sem permitir que o tronco gire; retorne as mãos mantendo quadris e ombros voltados à frente.'),
('back-extension','Incline o tronco pelo quadril e retorne até alinhá-lo com as pernas, sem ultrapassar uma extensão neutra confortável.'),
('dumbbell-farmer-carry','Caminhe com passos controlados e halteres ao lado do corpo, mantendo o tronco alto e evitando inclinação lateral.')
)
update public.exercise_instruction_steps instruction
set content_pt = specific_execution.content_pt
from specific_execution
join public.exercises exercise on exercise.slug = specific_execution.exercise_slug
where instruction.exercise_id = exercise.id and instruction.section = 'execution';

with r(source_slug,target_slug,relation_type) as (values
('dumbbell-bench-press','barbell-bench-press','variation_of'),('incline-dumbbell-press','dumbbell-bench-press','variation_of'),
('push-up','barbell-bench-press','equipment_alternative'),('barbell-bench-press','push-up','equipment_alternative'),
('pull-up','lat-pulldown','similar_pattern'),('lat-pulldown','pull-up','similar_pattern'),('one-arm-dumbbell-row','barbell-bent-over-row','variation_of'),
('seated-cable-row','barbell-bent-over-row','equipment_alternative'),('barbell-bent-over-row','seated-cable-row','equipment_alternative'),
('seated-dumbbell-shoulder-press','barbell-overhead-press','variation_of'),('alternating-dumbbell-curl','barbell-curl','variation_of'),
('dumbbell-hammer-curl','barbell-curl','similar_target'),('barbell-curl','dumbbell-hammer-curl','similar_target'),
('smith-machine-squat','barbell-back-squat','equipment_alternative'),('barbell-back-squat','smith-machine-squat','equipment_alternative'),
('bodyweight-glute-bridge','barbell-hip-thrust','regression'),('barbell-hip-thrust','bodyweight-glute-bridge','progression'),
('dead-bug','front-plank','similar_target'),('front-plank','dead-bug','similar_target'),
('seated-calf-raise','standing-calf-raise','similar_target'),('standing-calf-raise','seated-calf-raise','similar_target'))
insert into public.exercise_relations (source_exercise_id,target_exercise_id,relation_type)
select s.id,t.id,r.relation_type from r join public.exercises s on s.slug=r.source_slug join public.exercises t on t.slug=r.target_slug on conflict do nothing;
