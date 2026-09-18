import { Test, TestingModule } from "@nestjs/testing";
import {
  fetchSuspensionStatuses,
  findMissingCardIds,
  summarizeSuspensionStatuses,
} from "@/mcp/utils/card-suspension.utils";
import { AnkiConnectClient } from "@/mcp/clients/anki-connect.client";

jest.mock("@/mcp/clients/anki-connect.client");

describe("card-suspension.utils", () => {
  let ankiClient: jest.Mocked<AnkiConnectClient>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AnkiConnectClient],
    }).compile();

    ankiClient = module.get(
      AnkiConnectClient,
    ) as jest.Mocked<AnkiConnectClient>;
    jest.clearAllMocks();
  });

  describe("fetchSuspensionStatuses", () => {
    it("should pair each card ID with its status, preserving order and duplicates", async () => {
      const cards = [222, 111, 222];
      ankiClient.invoke.mockResolvedValueOnce([false, true, false]);

      const result = await fetchSuspensionStatuses(cards, ankiClient);

      expect(ankiClient.invoke).toHaveBeenCalledWith("areSuspended", {
        cards,
      });
      expect(result).toEqual([
        { cardId: 222, suspended: false },
        { cardId: 111, suspended: true },
        { cardId: 222, suspended: false },
      ]);
    });

    it("should throw when areSuspended returns a non-array", async () => {
      const cards = [111, 222];
      ankiClient.invoke.mockResolvedValueOnce(null as never);

      await expect(fetchSuspensionStatuses(cards, ankiClient)).rejects.toThrow(
        /areSuspended returned null for 2 card\(s\)/,
      );
    });

    it("should throw when areSuspended returns fewer entries than requested", async () => {
      const cards = [111, 222];
      ankiClient.invoke.mockResolvedValueOnce([true]);

      await expect(fetchSuspensionStatuses(cards, ankiClient)).rejects.toThrow(
        /1 entries for 2 card\(s\)/,
      );
    });

    it("should throw when areSuspended returns more entries than requested", async () => {
      const cards = [111];
      ankiClient.invoke.mockResolvedValueOnce([true, false]);

      await expect(fetchSuspensionStatuses(cards, ankiClient)).rejects.toThrow(
        /2 entries for 1 card\(s\)/,
      );
    });

    it.each([undefined, "false"])(
      "should throw when an entry is neither boolean nor null (%p)",
      async (badEntry) => {
        const cards = [111, 222];
        ankiClient.invoke.mockResolvedValueOnce([true, badEntry as never]);

        await expect(
          fetchSuspensionStatuses(cards, ankiClient),
        ).rejects.toThrow(/card 222/);
      },
    );
  });

  describe("summarizeSuspensionStatuses", () => {
    it("should count suspended, unsuspended and missing", () => {
      const result = summarizeSuspensionStatuses([
        { cardId: 111, suspended: true },
        { cardId: 222, suspended: false },
        { cardId: 333, suspended: false },
        { cardId: 444, suspended: null },
      ]);

      expect(result).toEqual({
        total: 4,
        suspendedCount: 1,
        unsuspendedCount: 2,
        missingCount: 1,
      });
    });
  });

  describe("findMissingCardIds", () => {
    it("should return only the card IDs whose status is null", () => {
      const result = findMissingCardIds([
        { cardId: 111, suspended: true },
        { cardId: 222, suspended: null },
        { cardId: 333, suspended: false },
        { cardId: 444, suspended: null },
      ]);

      expect(result).toEqual([222, 444]);
    });
  });
});
