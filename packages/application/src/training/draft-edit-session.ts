/**
 * Unsaved-changes state of the program builder (Implementation Phase 19,
 * ADR-0099). Pure transitions: any edit makes the draft dirty; only a
 * successful save or an explicit discard makes it clean again. A failed save
 * keeps the edits dirty. Switching the selected day/week/block is not an
 * edit and not a departure.
 */
export type DraftEditSession = Readonly<{ dirty: boolean; saving: boolean }>;

export type DraftEditEvent =
  "edited" | "save_started" | "save_succeeded" | "save_failed" | "discarded";

export const cleanDraftEditSession: DraftEditSession = {
  dirty: false,
  saving: false,
};

export function draftEditTransition(
  session: DraftEditSession,
  event: DraftEditEvent,
): DraftEditSession {
  switch (event) {
    case "edited":
      return { ...session, dirty: true };
    case "save_started":
      return { ...session, saving: true };
    case "save_succeeded":
      return { dirty: false, saving: false };
    case "save_failed":
      return { ...session, saving: false };
    case "discarded":
      return { dirty: false, saving: false };
  }
}

/** Leaving the builder asks for confirmation only when edits are unsaved. */
export const shouldGuardDraftLeave = (session: DraftEditSession): boolean =>
  session.dirty;

/**
 * Options of the leave confirmation. "Salvar e sair" is intentionally absent:
 * a save can fail validation (e.g. a day without exercises) or the network,
 * and leaving must never be tied to an outcome the athlete did not see.
 */
export const draftLeaveOptions = [
  { id: "keep_editing", label: "Continuar editando" },
  { id: "discard", label: "Descartar alterações" },
] as const;
