import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  BLOCK_DURATION_MS,
  CircularDoublyLinkedList,
  MAX_REQUESTS_PER_WINDOW,
  QueueMaxHeap,
  SPAM_WINDOW_MS,
  SpamGuard,
  compareQueueItems,
  createQueueItem,
  type QueueItem,
  type Song,
} from "../src/lib/heapbeat";
import {
  appReducer,
  createInitialState,
  getCurrentSong,
  revivePersistedState,
} from "../src/app/model";
import { resolveAudioSource } from "../src/audio/useAudioPlayer";
import { SONG_CATALOG } from "../src/data/catalog";

function song(id: string): Song {
  return {
    id,
    canonicalKey: `test:${id}`,
    title: id,
    artist: "HeapBeat Test",
    album: "Test Suite",
    genre: "Test",
    durationSec: 120,
    color: "#000000",
    coverTone: "paper",
    mood: "Test",
    sourceProvider: "internal",
    sourceUrl: `/music/${id}.mp3`,
    licenseType: "SCHOOL_OWNED",
    licenseUrl: "test-license",
    attributionText: "Test fixture",
    publicPlaybackAllowed: true,
    approvalStatus: "approved",
  };
}

describe("Bundled piano catalog", () => {
  it("contains 18 unique local MP3 tracks and no generated audio sources", () => {
    expect(SONG_CATALOG).toHaveLength(18);
    expect(new Set(SONG_CATALOG.map((entry) => entry.id)).size).toBe(18);

    for (const entry of SONG_CATALOG) {
      expect(entry.sourceUrl).toMatch(/^\/music\/[\w-]+\.mp3$/);
      expect(entry.sourceUrl).not.toContain("synth:");
      expect(entry.durationSec).toBeGreaterThan(0);

      const filePath = fileURLToPath(
        new URL(`../public${entry.sourceUrl}`, import.meta.url),
      );
      expect(existsSync(filePath), `${entry.sourceUrl} is missing`).toBe(true);
    }
  });

  it("resolves root-looking media paths inside a subfolder deployment", () => {
    expect(
      resolveAudioSource(
        "/music/anh-nang-cua-anh.mp3",
        "https://example.edu/heapbeat/index.html",
        "./",
      ),
    ).toBe("https://example.edu/heapbeat/music/anh-nang-cua-anh.mp3");
  });
});

function item(id: string, score: number, requestedAt: number): QueueItem {
  const voters = Object.fromEntries(
    Array.from({ length: score }, (_, index) => [`V${index}`, 1 as const]),
  );
  return createQueueItem(
    song(id),
    "OWNER",
    `request-${id}`,
    requestedAt,
    voters,
  );
}

function expectHeapInvariant(heap: QueueMaxHeap) {
  const values = heap.toArray();
  values.forEach((value, index) => {
    const left = index * 2 + 1;
    const right = index * 2 + 2;
    if (left < values.length) {
      expect(compareQueueItems(value, values[left])).toBeLessThanOrEqual(0);
    }
    if (right < values.length) {
      expect(compareQueueItems(value, values[right])).toBeLessThanOrEqual(0);
    }
  });
}

describe("CircularDoublyLinkedList", () => {
  it("returns null for next and prev on an empty list", () => {
    const list = new CircularDoublyLinkedList<string>();
    expect(list.next()).toBeNull();
    expect(list.prev()).toBeNull();
  });

  it("wraps forward from the tail to the head", () => {
    const list = CircularDoublyLinkedList.fromArray(["A", "B", "C"], 2);
    expect(list.next()?.value).toBe("A");
  });

  it("wraps backward from the head to the tail", () => {
    const list = CircularDoublyLinkedList.fromArray(["A", "B", "C"], 0);
    expect(list.prev()?.value).toBe("C");
  });

  it("adds a new tail without breaking the ring", () => {
    const list = CircularDoublyLinkedList.fromArray(["A", "B"], 0);
    expect(list.addLast("C").index).toBe(2);
    expect(list.prev()?.value).toBe("C");
    expect(list.next()?.value).toBe("A");
  });
});

describe("QueueMaxHeap", () => {
  it("keeps the highest score at the root", () => {
    const heap = new QueueMaxHeap([
      item("A", 1, 1),
      item("B", 5, 2),
      item("C", 3, 3),
    ]);
    expect(heap.peek()?.song.id).toBe("B");
    expectHeapInvariant(heap);
  });

  it("heapifies up after an upvote", () => {
    const heap = new QueueMaxHeap([item("A", 4, 1), item("B", 3, 2)]);
    heap.changeVote("request-B", "NEW-1", 1);
    heap.changeVote("request-B", "NEW-2", 1);
    expect(heap.peek()?.song.id).toBe("B");
    expectHeapInvariant(heap);
  });

  it("heapifies down after removing votes from the root", () => {
    const root = createQueueItem(song("A"), "OWNER", "request-A", 1, {
      V1: 1,
      V2: 1,
      V3: 1,
    });
    const heap = new QueueMaxHeap([root, item("B", 2, 2)]);
    heap.changeVote("request-A", "V1", -1);
    expect(heap.peek()?.song.id).toBe("B");
    expectHeapInvariant(heap);
  });

  it("uses FIFO as the final tie-break", () => {
    const heap = new QueueMaxHeap([
      item("late", 2, 200),
      item("early", 2, 100),
    ]);
    expect(heap.peek()?.song.id).toBe("early");
  });

  it("extracts items in non-increasing priority order", () => {
    const heap = new QueueMaxHeap([
      item("A", 2, 3),
      item("B", 5, 2),
      item("C", 1, 1),
      item("D", 3, 4),
    ]);
    const scores: number[] = [];
    while (heap.peek()) {
      scores.push(heap.extractMax()!.score);
    }
    expect(scores).toEqual([5, 3, 2, 1]);
  });

  it("removes arbitrary items while preserving the invariant", () => {
    const heap = new QueueMaxHeap([
      item("A", 5, 1),
      item("B", 4, 2),
      item("C", 3, 3),
      item("D", 2, 4),
    ]);
    expect(heap.remove("request-B")?.song.id).toBe("B");
    expect(heap.toArray().some((entry) => entry.song.id === "B")).toBe(false);
    expectHeapInvariant(heap);
  });

  it("removes every vote from a blocked student and rebuilds the heap", () => {
    const first = createQueueItem(song("A"), "OWNER-A", "request-A", 1, {
      SPAMMER: 1,
      V1: 1,
    });
    const second = createQueueItem(song("B"), "OWNER-B", "request-B", 2, {
      V2: 1,
      V3: 1,
    });
    const heap = new QueueMaxHeap([first, second]);

    expect(heap.peek()?.song.id).toBe("A");
    expect(heap.removeStudentVotes("SPAMMER")).toBe(1);
    expect(heap.peek()?.song.id).toBe("B");
    expect(
      heap.toArray().some((entry) => "SPAMMER" in entry.votesByStudent),
    ).toBe(false);
    expectHeapInvariant(heap);
  });
});

describe("SpamGuard", () => {
  it("allows exactly three distinct requests in ten minutes", () => {
    const guard = new SpamGuard();
    const now = 1_000_000;
    for (let index = 0; index < MAX_REQUESTS_PER_WINDOW; index += 1) {
      expect(
        guard.checkBeforeRequest("SV001", `song-${index}`, now + index).status,
      ).toBe("allowed");
      guard.recordAllowedRequest(
        "SV001",
        `song-${index}`,
        now + index,
        `request-${index}`,
      );
    }
  });

  it("blocks the fourth request and returns owned request ids to purge", () => {
    const guard = new SpamGuard();
    const now = 2_000_000;
    for (let index = 0; index < 3; index += 1) {
      guard.recordAllowedRequest(
        "SV001",
        `song-${index}`,
        now + index,
        `request-${index}`,
      );
    }
    const result = guard.checkBeforeRequest("SV001", "song-4", now + 4);
    expect(result.status).toBe("blocked");
    if (result.status === "blocked") {
      expect(result.reason).toBe("REQUEST_LIMIT_EXCEEDED");
      expect(result.blockedUntil).toBe(now + 4 + BLOCK_DURATION_MS);
      expect(result.purgeRequestIds).toEqual([
        "request-0",
        "request-1",
        "request-2",
      ]);
    }
  });

  it("blocks a duplicate song request", () => {
    const guard = new SpamGuard();
    const now = 3_000_000;
    guard.recordAllowedRequest("SV002", "same-song", now, "request-same");
    const result = guard.checkBeforeRequest("SV002", "same-song", now + 1);
    expect(result.status).toBe("blocked");
    if (result.status === "blocked") {
      expect(result.reason).toBe("DUPLICATE_SONG_REQUEST");
      expect(result.purgeRequestIds).toEqual(["request-same"]);
    }
  });

  it("prunes requests outside the sliding window", () => {
    const guard = new SpamGuard();
    const now = 4_000_000;
    for (let index = 0; index < 3; index += 1) {
      guard.recordAllowedRequest("SV003", `old-${index}`, now + index);
    }
    const afterWindow = now + SPAM_WINDOW_MS + 10;
    expect(guard.checkBeforeRequest("SV003", "fresh", afterWindow).status).toBe(
      "allowed",
    );
  });

  it("allows requests again after the block expires", () => {
    const guard = new SpamGuard();
    const now = 5_000_000;
    guard.recordAllowedRequest("SV004", "duplicate", now, "request-1");
    const blocked = guard.checkBeforeRequest("SV004", "duplicate", now + 1);
    expect(blocked.status).toBe("blocked");
    expect(
      guard.checkBeforeRequest("SV004", "new-song", now + BLOCK_DURATION_MS + 2)
        .status,
    ).toBe("allowed");
  });
});

describe("App playback invariants", () => {
  it("keeps an empty room stopped with no dangling playlist index", () => {
    const initial = createInitialState();
    const empty = {
      ...initial,
      queue: [],
      playlistSongs: [],
      currentPlaylistIndex: 9,
      isPlaying: true,
      progressSec: 42,
    };

    const next = appReducer(empty, { type: "PLAYER_NEXT", now: 10 });
    expect(next.currentPlaylistIndex).toBeNull();
    expect(next.isPlaying).toBe(false);
    expect(next.progressSec).toBe(0);
    expect(getCurrentSong(next)).toBeNull();
  });

  it("clears the full queue without stopping the current playlist song", () => {
    const initial = createInitialState();
    const currentSong = getCurrentSong(initial);
    const requestId = initial.queue[0].requestId;
    const withSpamOwnership = {
      ...initial,
      studentSpamStates: {
        SVTEST: {
          studentHash: "SVTEST",
          recentRequests: [],
          activeRequestIds: [requestId],
          blockCount: 0,
        },
      },
    };
    const next = appReducer(withSpamOwnership, {
      type: "CLEAR_QUEUE",
      now: 20,
    });

    expect(next.queue).toEqual([]);
    expect(getCurrentSong(next)?.id).toBe(currentSong?.id);
    expect(next.currentPlaylistIndex).toBe(0);
    expect(next.studentSpamStates.SVTEST.activeRequestIds).toEqual([]);
  });

  it("removes a rejected current song and resets playback when history becomes empty", () => {
    const initial = createInitialState();
    const currentSong = getCurrentSong(initial)!;
    const playing = { ...initial, isPlaying: true, progressSec: 25 };
    const next = appReducer(playing, {
      type: "REJECT_SONG",
      songId: currentSong.id,
      now: 30,
    });

    expect(next.playlistSongs).toEqual([]);
    expect(next.currentPlaylistIndex).toBeNull();
    expect(next.isPlaying).toBe(false);
    expect(next.progressSec).toBe(0);
  });

  it("repairs an invalid persisted playhead", () => {
    const fallback = createInitialState();
    const revived = revivePersistedState(
      {
        ...fallback,
        playlistSongs: [],
        currentPlaylistIndex: 4,
        isPlaying: true,
        progressSec: Number.NaN,
      },
      fallback,
    );

    expect(revived.currentPlaylistIndex).toBeNull();
    expect(revived.isPlaying).toBe(false);
    expect(revived.progressSec).toBe(0);
  });
});
