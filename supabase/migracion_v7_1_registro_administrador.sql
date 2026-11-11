-- UNT Facultades V7.1 · Ficha funcional del administrador de facultad.
-- Ejecutar DESPUÉS de migracion_v7_validacion_facultad.sql.
-- No elimina información ni altera el acceso URH existente.
BEGIN;
-- Garantiza que un administrador por facultad disponga de un solo registro propio.
-- El servicio de recepción genera identificadores ADM- sin solicitar ninguna clave al usuario.
CREATE UNIQUE INDEX IF NOT EXISTS unt_single_admin_functional_record
 ON public.intake_submissions(faculty_id)
 WHERE receipt_code LIKE 'ADM-%';
COMMIT;
