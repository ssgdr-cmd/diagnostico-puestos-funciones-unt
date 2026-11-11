/** Regresión estructural V19.3.0. No sustituye una prueba contra PostgreSQL real. */
const fs=require('fs'),assert=require('assert');
const app=fs.readFileSync('app.js','utf8');
const api=fs.readFileSync('supabase/functions/unt-faculty-supervised/index.ts','utf8');
const sql=fs.readFileSync('supabase/migracion_v19_3_0_consolidacion_urh.sql','utf8');
const roster=fs.readFileSync('supabase/functions/unt-faculty-review/index.ts','utf8');
assert(app.includes('urhProgressBlock()'),'El tablero URH necesita los agregados');
assert(app.includes("facultyApi('progress'"),'El frontend debe invocar la cobertura');
assert(api.includes("action==='progress'"),'API de cobertura agregada');
assert(api.includes("urh?.role==='urh_admin'"),'Control de rol URH');
assert(sql.includes("CREATE OR REPLACE FUNCTION public.unt_urh_progress_v1930"),'RPC agregada');
assert(sql.includes("REVOKE ALL ON FUNCTION public.unt_urh_progress_v1930(uuid) FROM PUBLIC,anon,authenticated"),'RPC privada');
assert(sql.includes("public.unt_faculty_review_checks") && sql.includes("c.checked=true"),'Se exige revisión previa para validar');
assert(sql.includes("length(v_document)<4"),'Se exige oficio SGDUNT para personal');
assert(api.includes("db.auth.getUser(jwt)"),'URH verifica JWT en el servidor');
assert(roster.includes("token_hash")&&roster.includes("expires_at")&&roster.includes("faculty_id"),'Enlaces restringidos por facultad');
assert(!sql.includes('DROP TABLE public.intake_submissions'),'La migración no destruye fichas');
console.log('OK: 11 comprobaciones estructurales V19.3.0');
