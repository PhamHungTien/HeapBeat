export type LicenseType =
  | "CC0"
  | "CC-BY"
  | "CC-BY-SA"
  | "PUBLIC_DOMAIN"
  | "SCHOOL_OWNED"
  | "USER_PROVIDED"
  | "COMMERCIAL_LICENSE";

export type SongApprovalStatus =
  "pending_license_review" | "approved" | "rejected";

export type UserAccount = {
  studentId: string;
  name: string;
  passwordHash: string;
  role: "student" | "admin";
};

export type Song = {
  id: string;
  canonicalKey: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  durationSec: number;
  color: string;
  coverTone: "lake" | "sunset" | "forest" | "night" | "paper" | "rain";
  mood: string;
  sourceProvider: "internal" | "openverse" | "internet_archive" | "jamendo";
  sourceUrl: string;
  licenseType: LicenseType;
  licenseUrl: string;
  attributionText: string;
  publicPlaybackAllowed: boolean;
  approvalStatus: SongApprovalStatus;
  coverUrl?: string;
};

export type VoteValue = -1 | 0 | 1;

export type QueueItem = {
  requestId: string;
  song: Song;
  requestedBy: string;
  requestedAt: number;
  upvotes: number;
  downvotes: number;
  score: number;
  votesByStudent: Record<string, VoteValue>;
  /** Tiebreak assigned by an admin shuffle. Unset items fall back to requestedAt. */
  shuffleOrder?: number;
};

export type SpamBlockReason =
  "DUPLICATE_SONG_REQUEST" | "REQUEST_LIMIT_EXCEEDED" | "ALREADY_BLOCKED";

export type StudentRequestRecord = {
  songKey: string;
  timestamp: number;
};

export type StudentSpamSnapshot = {
  studentHash: string;
  recentRequests: StudentRequestRecord[];
  activeRequestIds: string[];
  blockedUntil?: number;
  blockReason?: SpamBlockReason;
  blockCount: number;
};

export type SpamCheckResult =
  | { status: "allowed" }
  | {
      status: "blocked";
      reason: SpamBlockReason;
      blockedUntil: number;
      purgeRequestIds: string[];
    };

export type AuditEvent = {
  id: string;
  at: number;
  tone: "info" | "success" | "warning" | "danger";
  message: string;
};

type PlaylistNode<T> = {
  value: T;
  index: number;
  prev: PlaylistNode<T>;
  next: PlaylistNode<T>;
};

export const SPAM_WINDOW_MS = 10 * 60 * 1000;
export const BLOCK_DURATION_MS = 30 * 60 * 1000;
export const MAX_REQUESTS_PER_WINDOW = 3;

export function normalizeStudentId(studentId: string) {
  return studentId.trim().replace(/\s+/g, "").toUpperCase();
}

export function maskStudentId(studentHash: string) {
  if (studentHash.length <= 4) {
    return studentHash;
  }

  return `${studentHash.slice(0, 2)}*${studentHash.slice(-3)}`;
}

export function compareQueueItems(a: QueueItem, b: QueueItem) {
  if (a.score !== b.score) {
    return b.score - a.score;
  }

  if (a.upvotes !== b.upvotes) {
    return b.upvotes - a.upvotes;
  }

  // Unshuffled items sort last within a tie group, so a fresh request never jumps
  // ahead of tracks an admin has already ordered by hand.
  const aTie = a.shuffleOrder ?? Number.MAX_SAFE_INTEGER;
  const bTie = b.shuffleOrder ?? Number.MAX_SAFE_INTEGER;

  if (aTie !== bTie) {
    return aTie - bTie;
  }

  return a.requestedAt - b.requestedAt;
}

export function rankQueue(items: QueueItem[]) {
  return [...items].sort(compareQueueItems);
}

export function createQueueItem(
  song: Song,
  requestedBy: string,
  requestId: string,
  requestedAt: number,
  voters: Record<string, VoteValue> = { [requestedBy]: 1 },
  shuffleOrder?: number,
): QueueItem {
  const values = Object.values(voters);
  const upvotes = values.filter((vote) => vote === 1).length;
  const downvotes = values.filter((vote) => vote === -1).length;

  return {
    requestId,
    song,
    requestedBy,
    requestedAt,
    upvotes,
    downvotes,
    score: upvotes - downvotes,
    votesByStudent: { ...voters },
    shuffleOrder,
  };
}

export function createAuditEvent(
  message: string,
  tone: AuditEvent["tone"],
  at: number,
): AuditEvent {
  return {
    id: `evt_${at}_${Math.random().toString(36).slice(2, 7)}`,
    at,
    tone,
    message,
  };
}

export function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.max(0, Math.floor(totalSeconds % 60));
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function formatClock(timestamp: number) {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

export function formatRemaining(targetTime: number, now: number) {
  const remainingMs = Math.max(0, targetTime - now);
  const minutes = Math.floor(remainingMs / 60000);
  const seconds = Math.floor((remainingMs % 60000) / 1000);
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

function cloneQueueItem(item: QueueItem): QueueItem {
  return {
    ...item,
    votesByStudent: { ...item.votesByStudent },
  };
}

export class CircularDoublyLinkedList<T> {
  private head: PlaylistNode<T> | null = null;
  private current: PlaylistNode<T> | null = null;
  private length = 0;

  static fromArray<T>(
    items: T[],
    currentIndex: number | null = items.length > 0 ? 0 : null,
  ) {
    const list = new CircularDoublyLinkedList<T>();

    items.forEach((item) => {
      list.addLast(item);
    });

    if (currentIndex !== null) {
      list.setCurrentIndex(currentIndex);
    }

    return list;
  }

  size() {
    return this.length;
  }

  addLast(value: T) {
    const node = {
      value,
      index: this.length,
    } as PlaylistNode<T>;

    if (!this.head) {
      node.prev = node;
      node.next = node;
      this.head = node;
      this.current = node;
    } else {
      const tail = this.head.prev;
      tail.next = node;
      node.prev = tail;
      node.next = this.head;
      this.head.prev = node;
    }

    this.length += 1;
    return { value: node.value, index: node.index };
  }

  setCurrentIndex(index: number) {
    if (!this.head || this.length === 0) {
      this.current = null;
      return null;
    }

    const targetIndex = ((index % this.length) + this.length) % this.length;
    let node = this.head;

    for (let step = 0; step < targetIndex; step += 1) {
      node = node.next;
    }

    this.current = node;
    return { value: node.value, index: node.index };
  }

  currentValue() {
    if (!this.current) {
      return null;
    }

    return { value: this.current.value, index: this.current.index };
  }

  next() {
    if (!this.current) {
      return null;
    }

    this.current = this.current.next;
    return { value: this.current.value, index: this.current.index };
  }

  prev() {
    if (!this.current) {
      return null;
    }

    this.current = this.current.prev;
    return { value: this.current.value, index: this.current.index };
  }

  toArray() {
    if (!this.head) {
      return [];
    }

    const values: T[] = [];
    let node = this.head;

    for (let count = 0; count < this.length; count += 1) {
      values.push(node.value);
      node = node.next;
    }

    return values;
  }
}

export class QueueMaxHeap {
  private heap: QueueItem[] = [];
  private indexByRequestId = new Map<string, number>();

  constructor(items: QueueItem[] = []) {
    this.heap = items.map(cloneQueueItem);
    this.rebuildIndex();
    this.buildHeap();
  }

  toArray() {
    return this.heap.map(cloneQueueItem);
  }

  peek() {
    return this.heap[0] ? cloneQueueItem(this.heap[0]) : null;
  }

  findBySongKey(songKey: string) {
    const item = this.heap.find(
      (queueItem) => queueItem.song.canonicalKey === songKey,
    );

    return item ? cloneQueueItem(item) : null;
  }

  insert(item: QueueItem) {
    this.heap.push(cloneQueueItem(item));
    this.indexByRequestId.set(item.requestId, this.heap.length - 1);
    this.heapifyUp(this.heap.length - 1);
  }

  changeVote(requestId: string, studentHash: string, nextVote: VoteValue) {
    const index = this.indexByRequestId.get(requestId);

    if (index === undefined) {
      return null;
    }

    const item = this.heap[index];
    const previousVote = item.votesByStudent[studentHash] ?? 0;

    if (previousVote === nextVote) {
      return { item: cloneQueueItem(item), delta: 0 };
    }

    const votesByStudent = { ...item.votesByStudent };

    if (nextVote === 0) {
      delete votesByStudent[studentHash];
    } else {
      votesByStudent[studentHash] = nextVote;
    }

    const updated = createQueueItem(
      item.song,
      item.requestedBy,
      item.requestId,
      item.requestedAt,
      votesByStudent,
      item.shuffleOrder,
    );
    const delta = nextVote - previousVote;

    this.heap[index] = updated;

    if (delta > 0) {
      this.heapifyUp(index);
    } else {
      this.heapifyDown(index);
    }

    const updatedIndex = this.indexByRequestId.get(requestId);
    return {
      item:
        updatedIndex === undefined
          ? cloneQueueItem(updated)
          : cloneQueueItem(this.heap[updatedIndex]),
      delta,
    };
  }

  extractMax() {
    if (this.heap.length === 0) {
      return null;
    }

    const max = this.heap[0];
    const last = this.heap.pop();
    this.indexByRequestId.delete(max.requestId);

    if (this.heap.length > 0 && last) {
      this.heap[0] = last;
      this.indexByRequestId.set(last.requestId, 0);
      this.heapifyDown(0);
    }

    return cloneQueueItem(max);
  }

  remove(requestId: string) {
    const index = this.indexByRequestId.get(requestId);

    if (index === undefined) {
      return null;
    }

    const removed = this.heap[index];
    const last = this.heap.pop();
    this.indexByRequestId.delete(requestId);

    if (index < this.heap.length && last) {
      this.heap[index] = last;
      this.indexByRequestId.set(last.requestId, index);
      this.heapifyUp(index);
      const adjustedIndex = this.indexByRequestId.get(last.requestId);

      if (adjustedIndex !== undefined) {
        this.heapifyDown(adjustedIndex);
      }
    }

    return cloneQueueItem(removed);
  }

  removeMany(requestIds: string[]) {
    return requestIds
      .map((requestId) => this.remove(requestId))
      .filter((item): item is QueueItem => item !== null);
  }

  removeStudentVotes(studentHash: string) {
    let removedVotes = 0;

    this.heap = this.heap.map((item) => {
      if (item.votesByStudent[studentHash] === undefined) {
        return item;
      }

      const votesByStudent = { ...item.votesByStudent };
      delete votesByStudent[studentHash];
      removedVotes += 1;
      return createQueueItem(
        item.song,
        item.requestedBy,
        item.requestId,
        item.requestedAt,
        votesByStudent,
        item.shuffleOrder,
      );
    });

    if (removedVotes > 0) {
      this.rebuildIndex();
      this.buildHeap();
    }

    return removedVotes;
  }

  private buildHeap() {
    for (
      let index = Math.floor(this.heap.length / 2) - 1;
      index >= 0;
      index -= 1
    ) {
      this.heapifyDown(index);
    }
  }

  private rebuildIndex() {
    this.indexByRequestId.clear();
    this.heap.forEach((item, index) => {
      this.indexByRequestId.set(item.requestId, index);
    });
  }

  private higherPriority(a: QueueItem, b: QueueItem) {
    return compareQueueItems(a, b) < 0;
  }

  private heapifyUp(startIndex: number) {
    let index = startIndex;

    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);

      if (!this.higherPriority(this.heap[index], this.heap[parentIndex])) {
        break;
      }

      this.swap(index, parentIndex);
      index = parentIndex;
    }
  }

  private heapifyDown(startIndex: number) {
    let index = startIndex;

    while (true) {
      const left = index * 2 + 1;
      const right = index * 2 + 2;
      let best = index;

      if (
        left < this.heap.length &&
        this.higherPriority(this.heap[left], this.heap[best])
      ) {
        best = left;
      }

      if (
        right < this.heap.length &&
        this.higherPriority(this.heap[right], this.heap[best])
      ) {
        best = right;
      }

      if (best === index) {
        break;
      }

      this.swap(index, best);
      index = best;
    }
  }

  private swap(a: number, b: number) {
    const temp = this.heap[a];
    this.heap[a] = this.heap[b];
    this.heap[b] = temp;
    this.indexByRequestId.set(this.heap[a].requestId, a);
    this.indexByRequestId.set(this.heap[b].requestId, b);
  }
}

export class SpamGuard {
  private states = new Map<string, StudentSpamSnapshot>();

  constructor(
    snapshots: Record<string, StudentSpamSnapshot> = {},
    private maxRequests: number = MAX_REQUESTS_PER_WINDOW,
    private blockDurationMs: number = BLOCK_DURATION_MS,
  ) {
    Object.entries(snapshots).forEach(([studentHash, snapshot]) => {
      this.states.set(studentHash, {
        ...snapshot,
        studentHash,
        recentRequests: [...snapshot.recentRequests],
        activeRequestIds: [...snapshot.activeRequestIds],
      });
    });
  }

  checkBeforeRequest(
    studentHash: string,
    songKey: string,
    now: number,
  ): SpamCheckResult {
    const state = this.getOrCreate(studentHash);
    this.pruneRecentRequests(state, now);

    if (state.blockedUntil && state.blockedUntil > now) {
      return {
        status: "blocked",
        reason: "ALREADY_BLOCKED",
        blockedUntil: state.blockedUntil,
        purgeRequestIds: [],
      };
    }

    const isDuplicate = state.recentRequests.some(
      (request) => request.songKey === songKey,
    );

    if (isDuplicate) {
      return this.blockStudent(studentHash, "DUPLICATE_SONG_REQUEST", now);
    }

    if (state.recentRequests.length >= this.maxRequests) {
      return this.blockStudent(studentHash, "REQUEST_LIMIT_EXCEEDED", now);
    }

    return { status: "allowed" };
  }

  recordAllowedRequest(
    studentHash: string,
    songKey: string,
    now: number,
    ownedRequestId?: string,
  ) {
    const state = this.getOrCreate(studentHash);
    this.pruneRecentRequests(state, now);
    state.recentRequests.push({ songKey, timestamp: now });

    if (ownedRequestId) {
      state.activeRequestIds.push(ownedRequestId);
    }
  }

  removeActiveRequest(requestId: string) {
    this.states.forEach((state) => {
      state.activeRequestIds = state.activeRequestIds.filter(
        (activeRequestId) => activeRequestId !== requestId,
      );
    });
  }

  getStudentStatus(studentHash: string, now: number) {
    const state = this.getOrCreate(studentHash);
    this.pruneRecentRequests(state, now);

    return {
      ...state,
      isBlocked: Boolean(state.blockedUntil && state.blockedUntil > now),
    };
  }

  snapshot() {
    return Object.fromEntries(
      [...this.states.entries()].map(([studentHash, state]) => [
        studentHash,
        {
          ...state,
          recentRequests: [...state.recentRequests],
          activeRequestIds: [...state.activeRequestIds],
        },
      ]),
    );
  }

  private blockStudent(
    studentHash: string,
    reason: Exclude<SpamBlockReason, "ALREADY_BLOCKED">,
    now: number,
  ): SpamCheckResult {
    const state = this.getOrCreate(studentHash);
    const purgeRequestIds = [...state.activeRequestIds];
    state.blockedUntil = now + this.blockDurationMs;
    state.blockReason = reason;
    state.blockCount += 1;
    state.recentRequests = [];
    state.activeRequestIds = [];

    return {
      status: "blocked",
      reason,
      blockedUntil: state.blockedUntil,
      purgeRequestIds,
    };
  }

  private getOrCreate(studentHash: string) {
    const existing = this.states.get(studentHash);

    if (existing) {
      return existing;
    }

    const created: StudentSpamSnapshot = {
      studentHash,
      recentRequests: [],
      activeRequestIds: [],
      blockCount: 0,
    };
    this.states.set(studentHash, created);
    return created;
  }

  private pruneRecentRequests(state: StudentSpamSnapshot, now: number) {
    const windowStart = now - SPAM_WINDOW_MS;
    state.recentRequests = state.recentRequests.filter(
      (request) => request.timestamp >= windowStart,
    );
  }
}
