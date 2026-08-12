import { pendingBoard } from "./pending";

/**
 * LinkedIn — caso especial.
 *
 * El User Agreement prohíbe bots. Este módulo NUNCA aprieta Enviar por defecto
 * (`requireManualConfirm: true`). Cuando haya selectores revisados juntos:
 * busca, filtra, completa, adjunta CV, redacta carta si la piden, destilda
 * suscripciones, y se detiene en la pantalla de confirmación.
 *
 * Hasta entonces, cualquier llamada tira SelectorsPendingError.
 * Para que LinkedIn envíe solo, habría que poner requireManualConfirm: false
 * en config.json — el default queda en true a propósito.
 */
export const linkedinBoard = pendingBoard("linkedin", { requireManualConfirm: true });
