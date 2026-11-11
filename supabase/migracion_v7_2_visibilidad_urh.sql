-- UNT FACULTADES 2027 · V7.2
-- Ejecutar DESPUÉS de migracion_v7_validacion_facultad.sql.
-- Permite que la URH vea las fichas validadas inmediatamente, sin adelantar
-- su condición de remisión formal ni permitir lectura de fichas pendientes.
BEGIN;
DROP POLICY IF EXISTS intake_only_urh ON public.intake_submissions;
CREATE POLICY intake_only_urh ON public.intake_submissions
 FOR SELECT TO authenticated
 USING (
   status IN ('validated','forwarded')
   AND EXISTS (
     SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'urh_admin'
   )
 );
COMMIT;

-- Verificaciones administrativas (no alteran la información):
-- SELECT policyname,cmd,qual FROM pg_policies
-- WHERE schemaname='public' AND tablename='intake_submissions';
-- SELECT status,count(*) FROM public.intake_submissions GROUP BY status;
