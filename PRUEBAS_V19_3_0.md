# FACULTADES UNT V19.3.0 · Pruebas realizadas y pendientes

| Prueba | Resultado |
|---|---|
| Sintaxis app.js y módulos JS | OK (Node.js --check) |
| Sintaxis tres funciones TS | OK (TypeScript transpileModule) |
| Autoasistente de redacción local | 5/5 casos |
| Autoguardado concurrente simulado | OK |
| 400 solicitudes con códigos distintos y la misma IP en backend simulado | 400/400; no prueba de carga real |
| Generador de oficio V19.2.2 | 12/12 comprobaciones |
| Navegación HTML en Chromium sin conexión a Supabase | OK: 13 facultades y panel URH |
| Marcar ficha como revisada y generar oficio en demostración | OK |
| Tablero de 13 facultades y agregación de datos ficticios | OK |
| Conexión al proyecto Supabase de producción | NO probada |
| Seguridad real de funciones, SQL y privilegios de roles en Supabase | NO probada |
| Concurrencia real de 350–400 usuarios | NO probada |

La nueva migración impide que la URH marque una ficha de personal como validada sin revisión previa de facultad y documento firmado referenciado. Las declaraciones de autoridades conservan el flujo directo a la URH.

**No declare el sistema listo para producción sin completar el plan de aceptación `INSTALAR_V19_3_0.md` (apartado E).**
