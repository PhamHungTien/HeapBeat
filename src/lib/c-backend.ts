import type { QueueItem, Song, VoteValue } from "./heapbeat";

type CQueueItem = {
  requestId: number;
  songId: number;
  requestedBy: string;
  requestedAt: number;
  upvotes: number;
  downvotes: number;
  score: number;
  shuffleOrder: number;
  votesByStudent: Record<string, VoteValue>;
};

type CStateResponse = {
  queue: {
    valid: boolean;
    items: CQueueItem[];
  };
  player: {
    valid: boolean;
    currentIndex: number | null;
    history: Array<{ songId: number }>;
  };
};

export type CBackendSnapshot = {
  queue: QueueItem[];
  playlistSongs: Song[];
  currentPlaylistIndex: number | null;
};

export type CServiceResult = {
  code: string;
  message: string;
  requestId: number;
  score: number;
  delta: number;
  purgedCount: number;
  removedVotes: number;
  blockedUntil: number;
};

export class CBackendError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

async function cFetch<T>(route: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`./api.php?route=${encodeURIComponent(route)}`, {
    cache: "no-store",
    ...init,
    headers: init?.body
      ? { "Content-Type": "application/json", ...init.headers }
      : init?.headers,
  });
  const payload = (await response.json()) as T & {
    code?: string;
    message?: string;
  };
  if (!response.ok) {
    throw new CBackendError(
      payload.message ?? "Backend C trả về lỗi.",
      response.status,
      payload.code ?? "C_BACKEND_ERROR",
    );
  }
  return payload;
}

function catalogSong(catalog: Song[], numericId: number) {
  const song = catalog[numericId - 1];
  if (!song) {
    throw new CBackendError(
      `Backend C trả songId=${numericId} không tồn tại trong catalog web.`,
      502,
      "CATALOG_MISMATCH",
    );
  }
  return song;
}

export async function loadCBackendState(
  catalog: Song[],
): Promise<CBackendSnapshot> {
  const state = await cFetch<CStateResponse>("state");
  if (!state.queue.valid || !state.player.valid) {
    throw new CBackendError(
      "Backend C báo bất biến cấu trúc dữ liệu không hợp lệ.",
      500,
      "C_INVARIANT_FAILED",
    );
  }

  return {
    queue: state.queue.items.map((item) => ({
      requestId: String(item.requestId),
      song: catalogSong(catalog, item.songId),
      requestedBy: item.requestedBy,
      requestedAt: item.requestedAt,
      upvotes: item.upvotes,
      downvotes: item.downvotes,
      score: item.score,
      votesByStudent: item.votesByStudent,
      shuffleOrder: item.shuffleOrder < 0 ? undefined : item.shuffleOrder,
    })),
    playlistSongs: state.player.history.map((item) =>
      catalogSong(catalog, item.songId),
    ),
    currentPlaylistIndex: state.player.currentIndex,
  };
}

export function songIdForC(catalog: Song[], songId: string) {
  const index = catalog.findIndex((song) => song.id === songId);
  if (index < 0) {
    throw new CBackendError(
      "Không tìm thấy bài hát trong catalog C.",
      400,
      "SONG_NOT_FOUND",
    );
  }
  return index + 1;
}

export async function runCBackendCommand(
  route: string,
  body?: Record<string, string | number>,
) {
  return cFetch<CServiceResult>(route, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
}
