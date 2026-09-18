/**
 * @jest-environment <rootDir>/test/jest-environments/timezone.environment.ts
 * @jest-environment-options {"timeZone": "America/Los_Angeles"}
 */

/**
 * Regression tests for review_stats' notion of "a day".
 *
 * These run with the process timezone pinned to America/Los_Angeles (UTC-7 in
 * June) regardless of the host, because the bug they cover - the study streak
 * always reporting 0 - only reproduces west of UTC and was therefore invisible
 * on a UTC+3 development machine and on UTC CI.
 *
 * Every instant below is an explicit Date.UTC(...) annotated with its local
 * wall-clock equivalent. June is months away from either DST transition, so
 * these fixtures cannot drift.
 */
import { Test, TestingModule } from "@nestjs/testing";
import { ReviewStatsTool } from "../review-stats.tool";
import { AnkiConnectClient } from "@/mcp/clients/anki-connect.client";
import { parseToolResult } from "@/test-fixtures/test-helpers";
import { CardReviewTuple, ReviewStatsResult } from "../review-stats.types";

jest.mock("@/mcp/clients/anki-connect.client");

/** 2026-06-15 19:00 PDT. Its UTC date (06-16) differs from its local date. */
const NOW_MS = Date.UTC(2026, 5, 16, 2);

/** Sat 2026-06-13 12:00 PDT - same day in UTC and local. */
const SAT_NOON = Date.UTC(2026, 5, 13, 19);
/** Sun 2026-06-14 21:30 PDT - UTC says 06-15, the user says 06-14. */
const SUN_EVENING = Date.UTC(2026, 5, 15, 4, 30);
/** Mon 2026-06-15 12:00 PDT. */
const MON_NOON = Date.UTC(2026, 5, 15, 19);

const START_DATE = "2026-06-13";
const DECK = "Streak";

/** [timestamp, cardId, usn, button, ivl, lastIvl, factor, time, type] */
const goodReview = (timestampMs: number, cardId: number): CardReviewTuple => [
  timestampMs,
  cardId,
  -1,
  3,
  4,
  -60,
  2500,
  6157,
  0,
];

describe("review_stats in America/Los_Angeles", () => {
  let tool: ReviewStatsTool;
  let ankiClient: jest.Mocked<AnkiConnectClient>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReviewStatsTool, AnkiConnectClient],
    }).compile();

    tool = module.get<ReviewStatsTool>(ReviewStatsTool);
    ankiClient = module.get(
      AnkiConnectClient,
    ) as jest.Mocked<AnkiConnectClient>;

    jest.clearAllMocks();

    ankiClient.invoke.mockImplementation((action: string) => {
      if (action === "cardReviews") {
        return Promise.resolve([
          goodReview(SAT_NOON, 1),
          goodReview(SUN_EVENING, 2),
          goodReview(MON_NOON, 3),
        ]);
      }
      return Promise.resolve({});
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const run = async (): Promise<ReviewStatsResult> => {
    jest.useFakeTimers({ now: NOW_MS });
    const raw = await tool.execute({ deck: DECK, start_date: START_DATE });
    return parseToolResult(raw) as ReviewStatsResult;
  };

  it("sanity: the pinned timezone was applied", () => {
    // If this fails the assertions below are meaningless - the custom test
    // environment did not take effect.
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(
      "America/Los_Angeles",
    );
    expect(new Date(NOW_MS).getTimezoneOffset()).toBe(420); // UTC-7
  });

  it("counts a streak that runs up to the local calendar day", async () => {
    const result = await run();
    expect(result.summary.streak).toBe(3);
  });

  it("buckets an evening review into the local day it was done on", async () => {
    const result = await run();
    expect(result.reviews_by_day).toEqual([
      { date: "2026-06-13", count: 1 },
      { date: "2026-06-14", count: 1 },
      { date: "2026-06-15", count: 1 },
    ]);
  });

  it("defaults end_date to the local calendar day", async () => {
    const result = await run();
    expect(result.period.end).toBe("2026-06-15");
  });
});
