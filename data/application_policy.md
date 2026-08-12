# Política de postulación — límites duros

Estas reglas están implementadas en código (`shared/policy.ts`, `automation/guards.ts`). No se saltean con un prompt.

1. **Nunca inventar datos** en un formulario. Si falta info, la postulación queda `Incompleto - <motivo>` y se loguea.
2. **Nunca intentar resolver un CAPTCHA.** El script se pausa y avisa para que lo resuelvas vos.
3. **Nunca cargar DNI / CUIL / CUIT / pasaporte ni datos bancarios.**
4. **Nunca crear cuentas ni aceptar términos legales** en tu nombre.
5. **Nunca postular** a algo excluido o para lo que claramente no calificás.
6. **LinkedIn:** nunca apretar el botón de envío final sin confirmación tuya (`requireManualConfirm: true` por defecto).
7. **Nunca headless** en postulaciones reales. El navegador tiene que verse.

Delays aleatorios entre acciones. Topes diarios bajos al principio (3–5 por portal).
