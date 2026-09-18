import { z } from "zod";
import { AnkiConnectClient } from "@/mcp/clients/anki-connect.client";

/**
 * Shared input schema for the suspension tools (`areSuspended`, `suspend`,
 * `unsuspend`). AnkiConnect's own suspend/unsuspend/areSuspended actions have
 * no documented upper bound, but an unbounded array risks pathological
 * request sizes — 500 is generous for interactive use.
 */
export const cardIdsSchema = z
  .array(z.number().int().positive())
  .min(1)
  .max(500)
  .describe(
    "Array of card IDs (max 500). Card IDs (not note IDs) — use get_cards, " +
      "get_due_cards, or notesInfo to obtain them.",
  );

/**
 * Per-card suspension state. `null` means the card ID doesn't exist —
 * AnkiConnect's `areSuspended` reports missing cards this way rather than
 * omitting them, so callers can tell "not suspended" from "doesn't exist".
 */
export const cardSuspensionStatusSchema = z.object({
  cardId: z.number(),
  suspended: z
    .boolean()
    .nullable()
    .describe(
      "true if suspended, false if not suspended, null if the card ID does not exist",
    ),
});

export type CardSuspensionStatus = z.infer<typeof cardSuspensionStatusSchema>;

export const suspensionCountsSchema = z.object({
  total: z.number(),
  suspendedCount: z.number(),
  unsuspendedCount: z.number(),
  missingCount: z.number(),
});

export type SuspensionCounts = z.infer<typeof suspensionCountsSchema>;

/**
 * Call AnkiConnect's `areSuspended` and pair each result back up with its
 * requested card ID, preserving input order (including duplicates).
 */
export async function fetchSuspensionStatuses(
  cards: number[],
  client: AnkiConnectClient,
): Promise<CardSuspensionStatus[]> {
  const results = await client.invoke<Array<boolean | null>>("areSuspended", {
    cards,
  });

  // `null` in this module means "card doesn't exist" and drives the
  // pre-mutation existence check, so a malformed reply must never be coerced
  // into it — a missing slot would look like a bogus card ID.
  if (!Array.isArray(results) || results.length !== cards.length) {
    throw new Error(
      `areSuspended returned ${
        Array.isArray(results)
          ? `${results.length} entries`
          : results === null
            ? "null"
            : typeof results
      } for ${cards.length} card(s)`,
    );
  }

  return cards.map((cardId, index) => {
    const suspended = results[index];
    if (typeof suspended !== "boolean" && suspended !== null) {
      throw new Error(
        `areSuspended returned ${JSON.stringify(suspended)} for card ${cardId}; ` +
          `expected true, false, or null`,
      );
    }
    return { cardId, suspended };
  });
}

export function summarizeSuspensionStatuses(
  statuses: CardSuspensionStatus[],
): SuspensionCounts {
  let suspendedCount = 0;
  let unsuspendedCount = 0;
  let missingCount = 0;

  for (const status of statuses) {
    if (status.suspended === true) {
      suspendedCount++;
    } else if (status.suspended === false) {
      unsuspendedCount++;
    } else {
      missingCount++;
    }
  }

  return {
    total: statuses.length,
    suspendedCount,
    unsuspendedCount,
    missingCount,
  };
}

/**
 * Card IDs whose `areSuspended` status came back `null` — AnkiConnect's way
 * of marking a card that doesn't exist.
 */
export function findMissingCardIds(statuses: CardSuspensionStatus[]): number[] {
  return statuses
    .filter((status) => status.suspended === null)
    .map((status) => status.cardId);
}
