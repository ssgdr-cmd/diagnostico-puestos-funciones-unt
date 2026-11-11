/* Comprobaciones estáticas adicionales: NO sustituyen PostgreSQL real. */
const fs=require('fs'),assert=require('assert');
const s=fs.readFileSync('supabase/migracion_v19_3_2_integridad_revision.sql','utf8');
const a=fs.readFileSync('app.js','utf8');
const r=fs.readFileSync('supabase/functions/unt-faculty-review/index.ts','utf8');
const u=fs.readFileSync('supabase/functions/unt-faculty-supervised/index.ts','utf8');
assert(s.includes("(p_content - 'functions') IS DISTINCT FROM (v.content - 'functions')"));
assert(s.includes('reviewed_revision=v_row.revision_no'));
assert(s.includes('ch.reviewed_revision=s.revision_no'));
assert(s.includes('reviewed_revision=EXCLUDED.reviewed_revision'));
assert(a.includes('if(!demo)await loadFacultyReview();'));
assert(a.includes('if(facultyHasUnsavedChanges(r))'));
assert(a.includes("const rows=state.facReviewRows||[];"));
assert(r.includes('reviewed_revision')&&r.includes('ck.get(r.id)?.reviewed_revision'));
assert(u.includes('reviewed_revision'));
assert(!s.includes('DROP TABLE public.intake_submissions'));
assert.equal((s.match(/\$\$/g)||[]).length%2,0);
console.log('OK: 11 comprobaciones integridad V19.3.2');
