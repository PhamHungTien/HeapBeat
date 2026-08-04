import { SONG_CATALOG } from "../data/catalog";
import {
  CircularDoublyLinkedList,
  QueueMaxHeap,
  SpamGuard,
  createAuditEvent,
  createQueueItem,
  formatClock,
  formatRemaining,
  normalizeStudentId,
  type AuditEvent,
  type QueueItem,
  type Song,
  type StudentSpamSnapshot,
  type VoteValue,
  type UserAccount,
} from "../lib/heapbeat";

export type Feedback = {
  tone: "neutral" | "success" | "warning" | "danger";
  message: string;
};

export type RoomState = {
  queue: QueueItem[];
  playlistSongs: Song[];
  currentPlaylistIndex: number | null;
  isPlaying: boolean;
  progressSec: number;
  studentSpamStates: Record<string, StudentSpamSnapshot>;
  auditEvents: AuditEvent[];
  feedback: Feedback;

  // Room specific moderation configurations
  spamGuardEnabled: boolean;
  maxRequests: number;
  blockDurationMs: number;
  strictLicenseGate: boolean;
};

export type RoomInfo = {
  name: string;
  listeners: number;
  code: string;
};

export type AppState = {
  activeRoomName: string;
  queue: QueueItem[];
  playlistSongs: Song[];
  currentPlaylistIndex: number | null;
  isPlaying: boolean;
  progressSec: number;
  studentSpamStates: Record<string, StudentSpamSnapshot>;
  auditEvents: AuditEvent[];
  feedback: Feedback;

  // Active room configurations
  spamGuardEnabled: boolean;
  maxRequests: number;
  blockDurationMs: number;
  strictLicenseGate: boolean;

  // Caches for other rooms
  rooms: Record<string, RoomState>;

  // Global/UI settings
  activeAdminPanel: "settings" | "moderation" | "analytics" | null;
  volume: number; // 0 to 100
  repeatMode: "all" | "one" | "off";
  songCatalog: Song[];

  // Dynamic Room List States
  roomList: RoomInfo[];
  isCreateRoomOpen: boolean;
};

export type AppAction =
  | { type: "REQUEST_SONG"; studentId: string; songId: string; now: number }
  | {
      type: "CAST_VOTE";
      studentId: string;
      requestId: string;
      vote: VoteValue;
      now: number;
    }
  | { type: "REMOVE_REQUEST"; requestId: string; now: number }
  | { type: "CLEAR_QUEUE"; now: number }
  | { type: "PLAYER_NEXT"; now: number }
  | { type: "PLAYER_PREV"; now: number }
  | { type: "TRACK_ENDED"; now: number }
  | { type: "TOGGLE_PLAY"; now: number }
  | { type: "RESET_DEMO"; now: number }
  | {
      type: "SET_FEEDBACK";
      feedback: Feedback;
      auditMessage?: string;
      now: number;
    }
  | { type: "TICK"; now: number; actualTime?: number; autoAdvance?: boolean }
  | { type: "SWITCH_ROOM"; roomName: string; now: number }
  | { type: "SET_VOLUME"; volume: number }
  | { type: "TOGGLE_REPEAT" }
  | { type: "SHUFFLE_QUEUE"; now: number }
  | { type: "CLOSE_ADMIN_PANEL" }
  | { type: "OPEN_ADMIN_PANEL"; panel: "settings" | "moderation" | "analytics" }
  | {
      type: "UPDATE_ROOM_SETTINGS";
      settings: {
        spamGuardEnabled: boolean;
        maxRequests: number;
        blockDurationMs: number;
        strictLicenseGate: boolean;
      };
      now: number;
    }
  | { type: "APPROVE_SONG"; songId: string; now: number }
  | { type: "REJECT_SONG"; songId: string; now: number }
  | { type: "FORCE_UNBLOCK_STUDENT"; studentHash: string; now: number }
  | { type: "OPEN_CREATE_ROOM" }
  | { type: "CLOSE_CREATE_ROOM" }
  | {
      type: "CREATE_ROOM";
      name: string;
      code: string;
      listeners: number;
      now: number;
    }
  | { type: "SEEK_SONG"; time: number; now: number }
  | {
      type: "SYNC_C_BACKEND";
      queue: QueueItem[];
      playlistSongs: Song[];
      currentPlaylistIndex: number | null;
      feedback?: Feedback;
      now: number;
    }
  | { type: "SYNC_STATE"; shared: SharedSnapshot; now: number };

/**
 * The slice of AppState that is shared across devices. Everything else — which room
 * you are in, your volume, your repeat mode, which modal you have open — is local to
 * a tab and must never be overwritten by a peer's push.
 */
export type SharedSnapshot = {
  rooms: Record<string, RoomState>;
  roomList: RoomInfo[];
  songCatalog: Song[];
};

export type IconName =
  | "activity"
  | "chart"
  | "chevron"
  | "copy"
  | "down"
  | "download"
  | "external"
  | "filter"
  | "globe"
  | "info"
  | "lock"
  | "music"
  | "next"
  | "pause"
  | "play"
  | "plus"
  | "prev"
  | "radio"
  | "repeat"
  | "search"
  | "settings"
  | "shield"
  | "shuffle"
  | "trash"
  | "up"
  | "user"
  | "users"
  | "volume"
  | "close"
  | "logout";

export type CatalogTab = "catalog" | "requests";

const MAX_AUDIT_EVENTS = 7;
export const PERSISTED_STATE_KEY = "heapbeat:demo-state:v8";

export const ADMIN_TOOLS = [
  { label: "Room settings", icon: "settings" as IconName, action: "settings" },
  {
    label: "Moderation Queue",
    icon: "shield" as IconName,
    action: "moderation",
  },
  { label: "Live Analytics", icon: "chart" as IconName, action: "analytics" },
  {
    label: "Export session data",
    icon: "download" as IconName,
    action: "export",
  },
  { label: "Reset active room", icon: "repeat" as IconName, action: "reset" },
];

export const TRANSLATIONS = {
  en: {
    searchCatalog: "Search Catalog",
    antiSpamStatus: "Anti-spam status",
    clear: "Clear",
    blocked: "Blocked",
    bannedDesc: "Banned from submitting requests.",
    eligibleDesc: "Eligible to request tracks.",
    blockedUntil: "Blocked until",
    noRateLimit: "No active rate limit.",
    left: "left",
    studentId: "Student ID",
    enterStudentId: "Enter your Student ID",
    switchIdentity: "Switch Identity",
    schoolCatalog: "School Catalog",
    jamendoLive: "Jamendo CC Live",
    catalog: "Catalog",
    yourVotes: "Your votes",
    searchPlaceholderLocal: "Search local songs, artists...",
    searchPlaceholderJamendo: "Search Jamendo live database...",
    allGenres: "All Genres",
    allLicenses: "All Licenses",
    reset: "Reset",
    fetchingStreams: "Fetching CC music streams...",
    track: "Track",
    artist: "Artist",
    license: "License",
    add: "Add",
    noTracksFound: "No catalog tracks found.",
    emptyRequests: "You haven't requested or voted on active items.",
    showing: "Showing",
    of: "of",
    roomsSessions: "Rooms & Sessions",
    searchRooms: "Search rooms...",
    joinOrCreateRoom: "Join or create room",
    sessionSettings: "Session Settings",
    roomCode: "Room code",
    activeRoom: "Active Room",
    listeners: "Listeners",
    online: "online",
    queueLength: "Queue length",
    playlistRing: "Playlist ring",
    heapRoot: "Heap root",
    autoPlay: "Auto-play",
    active: "Active",
    paused: "Paused",
    adminTools: "Admin tools",
    roomSettingsLabel: "Room settings",
    moderationQueueLabel: "Moderation Desk",
    liveAnalyticsLabel: "Live Analytics",
    exportDataLabel: "Export session data",
    resetActiveRoomLabel: "Reset active room",
    waiting: "Waiting",
    activeListeners: "Active Listeners",
    emptyQueue: "No tracks waiting in the Max-Heap priority queue.",
    requestSongTip: "Request songs to build the queue.",
    requestedBy: "Requested by",
    priorityScore: "Priority score",
    upvoted: "Upvoted",
    downvoted: "Downvoted",
    vote: "Vote",
    nowPlaying: "Now Playing",
    nextUp: "Next up",
    volume: "Volume",
    repeatMode: "Repeat Mode",
    shuffle: "Shuffle",
    createRoomTitle: "Create Study Room",
    roomNameLabel: "Room Name",
    roomNamePlaceholder: "e.g. Creative Zone F2, Lab A4",
    createRoomDesc:
      "Creating a new room will register it dynamically in the workspace, assign it an access code, simulate active listeners, and allocate a fresh Max-Heap study session.",
    cancel: "Cancel",
    createRoom: "Create Room",
    settingsTitle: "Room Settings",
    antiSpamEnable: "Enable Anti-Spam (Hash Map Trackers)",
    antiSpamDesc:
      "Monitors student requests within 10 minute windows to prevent room hijack.",
    maxReqOption: "requests",
    maxReqStrict: "2 requests (Strict)",
    maxReqDefault: "3 requests (Default)",
    maxReqRelaxed: "5 requests (Relaxed)",
    blockDurationLabel: "Spammer block duration:",
    secQuickTest: "30 Seconds (For Quick Testing)",
    min: "Minutes",
    minStandard: "30 Minutes (Standard)",
    strictLicenseGate: "Enforce Copyright Gate (Strict License checking)",
    strictLicenseGateDesc:
      "Blocks unverified or pending songs in catalog. Disable to allow custom requests.",
    saveConfig: "Save configuration",
    moderationDesk: "Moderation Desk",
    copyrightApprovals: "Copyright Approvals",
    approve: "Approve",
    reject: "Reject",
    noPendingTracks: "No pending tracks. Catalog is fully licensed.",
    blockedStudents: "Blocked Students",
    reason: "Reason",
    until: "Until",
    unblock: "Unblock",
    noActiveBlocks: "No active blocks. Spam-guard is green.",
    closePanel: "Close panel",
    tracksWaiting: "Tracks Waiting",
    playbackHistory: "Playback History",
    blockedIncidents: "Blocked Incidents",
    genreDistHistory: "Genre Distribution in Playlist Ring",
    noHistory: "No tracks in playback history.",
    queueScores: "Queue Upvote Scores",
    queueEmptyScore: "Queue is empty. No score data to display.",
    tipUpvote: "Tip: Upvote to move a track higher. Downvote to move lower.",
    login: "Login",
    register: "Register",
    logout: "Logout",
    password: "Password",
    name: "Full Name",
    role: "User Role",
    studentRole: "Student (Request & Vote Only)",
    adminRole: "University Administrator (Full Access)",
    dontHaveAccount: "Don't have an account?",
    alreadyHaveAccount: "Already have an account?",
    invalidCredentials: "Invalid Student ID or password.",
    adminRequired: "Administrator access required.",
    registerSuccess: "Registration successful! You can now log in.",
    studentIdExists: "Student ID already exists.",
    fieldsRequired: "All fields are required.",
    pwMinLength: "Password must be at least 6 characters.",
    recentlyPlayed: "Recently Played",
    viewHistory: "View full history",
  },
  vi: {
    searchCatalog: "Tìm kiếm danh mục",
    antiSpamStatus: "Trạng thái chống spam",
    clear: "Sạch",
    blocked: "Đang chặn",
    bannedDesc: "Bị cấm gửi yêu cầu bài hát.",
    eligibleDesc: "Được phép yêu cầu bài hát.",
    blockedUntil: "Bị chặn đến",
    noRateLimit: "Không có giới hạn tần suất.",
    left: "còn lại",
    studentId: "Mã sinh viên",
    enterStudentId: "Nhập mã sinh viên của bạn",
    switchIdentity: "Đổi sinh viên",
    schoolCatalog: "Danh mục trường học",
    jamendoLive: "Nhạc sống Jamendo CC",
    catalog: "Danh mục",
    yourVotes: "Lượt vote của bạn",
    searchPlaceholderLocal: "Tìm kiếm bài hát, ca sĩ nội bộ...",
    searchPlaceholderJamendo: "Tìm kiếm cơ sở dữ liệu Jamendo...",
    allGenres: "Tất cả thể loại",
    allLicenses: "Tất cả bản quyền",
    reset: "Đặt lại",
    fetchingStreams: "Đang tải luồng nhạc CC...",
    track: "Bài hát",
    artist: "Nghệ sĩ",
    license: "Bản quyền",
    add: "Thêm",
    noTracksFound: "Không tìm thấy bài hát nào.",
    emptyRequests: "Bạn chưa yêu cầu hoặc vote bài hát nào.",
    showing: "Hiển thị",
    of: "trên",
    roomsSessions: "Phòng học & Session",
    searchRooms: "Tìm kiếm phòng...",
    joinOrCreateRoom: "Tham gia / Tạo phòng học",
    sessionSettings: "Cài đặt Session",
    roomCode: "Mã phòng",
    activeRoom: "Phòng hiện tại",
    listeners: "Người nghe",
    online: "online",
    queueLength: "Hàng đợi chờ phát",
    playlistRing: "Playlist vòng kép",
    heapRoot: "Heap Root (Đầu phát)",
    autoPlay: "Tự động phát",
    active: "Hoạt động",
    paused: "Tạm dừng",
    adminTools: "Công cụ Admin",
    roomSettingsLabel: "Cấu hình phòng",
    moderationQueueLabel: "Bàn kiểm duyệt",
    liveAnalyticsLabel: "Thống kê thời gian thực",
    exportDataLabel: "Xuất dữ liệu Session",
    resetActiveRoomLabel: "Reset phòng hiện tại",
    waiting: "Bài hát đang chờ",
    activeListeners: "Người nghe hoạt động",
    emptyQueue: "Không có bài hát nào trong hàng đợi ưu tiên Max-Heap.",
    requestSongTip: "Gửi yêu cầu bài hát để xây dựng hàng đợi.",
    requestedBy: "Yêu cầu bởi",
    priorityScore: "Điểm ưu tiên",
    upvoted: "Đã Upvote",
    downvoted: "Đã Downvote",
    vote: "Vote",
    nowPlaying: "Đang Phát Nhạc",
    nextUp: "Bài tiếp theo",
    volume: "Âm lượng",
    repeatMode: "Chế độ lặp",
    shuffle: "Trộn bài",
    createRoomTitle: "Tạo phòng tự học mới",
    roomNameLabel: "Tên phòng",
    roomNamePlaceholder: "Ví dụ: Phòng tự học E3, Khu yên tĩnh F1",
    createRoomDesc:
      "Tạo phòng học mới sẽ tự động đăng ký phòng trong hệ thống, cấp mã truy cập, giả lập người nghe và phân bổ hàng đợi Max-Heap độc lập.",
    cancel: "Hủy bỏ",
    createRoom: "Tạo phòng",
    settingsTitle: "Cấu hình phòng học",
    antiSpamEnable: "Kích hoạt chống Spam (Bảng băm theo dõi)",
    antiSpamDesc:
      "Giám sát các yêu cầu của sinh viên trong 10 phút để tránh phá hoại hàng đợi.",
    maxReqOption: "yêu cầu",
    maxReqStrict: "2 yêu cầu (Nghiêm ngặt)",
    maxReqDefault: "3 yêu cầu (Mặc định)",
    maxReqRelaxed: "5 yêu cầu (Nới lỏng)",
    blockDurationLabel: "Thời gian chặn spam:",
    secQuickTest: "30 Giây (Để test nhanh)",
    min: "Phút",
    minStandard: "30 Phút (Chuẩn)",
    strictLicenseGate: "Bắt buộc kiểm duyệt Bản quyền (Strict Gate)",
    strictLicenseGateDesc:
      "Chỉ phát các bài hát được duyệt trong danh mục. Tắt đi để cho phép yêu cầu tự do.",
    saveConfig: "Lưu cấu hình",
    moderationDesk: "Bàn kiểm duyệt Admin",
    copyrightApprovals: "Phê duyệt Bản quyền",
    approve: "Duyệt",
    reject: "Từ chối",
    noPendingTracks: "Không có bài hát chờ duyệt. Danh mục sạch bản quyền.",
    blockedStudents: "Sinh viên bị chặn",
    reason: "Lý do",
    until: "Đến",
    unblock: "Mở chặn",
    noActiveBlocks: "Không có sinh viên bị chặn. Hệ thống an toàn.",
    closePanel: "Đóng bảng điều khiển",
    tracksWaiting: "Bài hát đang chờ",
    playbackHistory: "Lịch sử phát nhạc",
    blockedIncidents: "Sự cố spam bị chặn",
    genreDistHistory: "Cơ cấu Thể loại trong Playlist Vòng",
    noHistory: "Chưa phát bài hát nào.",
    queueScores: "Phổ điểm Upvote của Hàng đợi",
    queueEmptyScore: "Hàng đợi trống. Không có dữ liệu điểm.",
    tipUpvote:
      "Gợi ý: Upvote bài hát để tăng độ ưu tiên trên Heap. Downvote để giảm.",
    login: "Đăng nhập",
    register: "Đăng ký",
    logout: "Đăng xuất",
    password: "Mật khẩu",
    name: "Họ và tên",
    role: "Vai trò người dùng",
    studentRole: "Sinh viên (Chỉ yêu cầu & bỏ phiếu)",
    adminRole: "Quản trị viên trường học (Toàn quyền)",
    dontHaveAccount: "Chưa có tài khoản?",
    alreadyHaveAccount: "Đã có tài khoản?",
    invalidCredentials: "Mã sinh viên hoặc mật khẩu không chính xác.",
    adminRequired: "Yêu cầu quyền Quản trị viên.",
    registerSuccess: "Đăng ký thành công! Bạn có thể đăng nhập ngay.",
    studentIdExists: "Mã sinh viên đã tồn tại.",
    fieldsRequired: "Vui lòng nhập đầy đủ các trường.",
    pwMinLength: "Mật khẩu phải dài ít nhất 6 ký tự.",
    recentlyPlayed: "Đã phát gần đây",
    viewHistory: "Xem lịch sử đầy đủ",
  },
};

export function readableBlockReason(reason: string, lang: "vi" | "en" = "vi") {
  switch (reason) {
    case "DUPLICATE_SONG_REQUEST":
      return lang === "vi" ? "yêu cầu trùng bài" : "duplicate song request";
    case "REQUEST_LIMIT_EXCEEDED":
      return lang === "vi"
        ? "vượt giới hạn tần suất"
        : "request limit exceeded";
    case "ALREADY_BLOCKED":
      return lang === "vi" ? "đã bị chặn từ trước" : "already blocked";
    default:
      return reason.toLowerCase();
  }
}

export function formatLicenseLabel(licenseType: Song["licenseType"]) {
  switch (licenseType) {
    case "SCHOOL_OWNED":
      return "School owned";
    case "USER_PROVIDED":
      return "User-provided piano";
    case "PUBLIC_DOMAIN":
      return "Public domain";
    case "COMMERCIAL_LICENSE":
      return "Commercial";
    default:
      return licenseType;
  }
}

export const ACCOUNTS_KEY = "heapbeat_accounts_v2";

export const DEFAULT_ACCOUNTS: UserAccount[] = [
  {
    studentId: "admin",
    name: "Quản trị HeapBeat",
    passwordHash: "admin@123",
    role: "admin",
  },
  {
    studentId: "SV001",
    name: "Sinh viên Demo 1",
    passwordHash: "demo123",
    role: "student",
  },
  {
    studentId: "SV002",
    name: "Sinh viên Demo 2",
    passwordHash: "demo123",
    role: "student",
  },
  {
    studentId: "SV9999",
    name: "Tài khoản kiểm thử Spam",
    passwordHash: "demo123",
    role: "student",
  },
];

/**
 * getStudentName runs once per queue row per render, so the accounts blob is parsed
 * once and reused until something writes it back through saveAccounts.
 */
let accountNameCache: Map<string, string> | null = null;

function getAccountNames() {
  if (accountNameCache) {
    return accountNameCache;
  }

  const names = new Map<string, string>();

  try {
    const cached = localStorage.getItem(ACCOUNTS_KEY);
    if (cached) {
      const accounts: UserAccount[] = JSON.parse(cached);
      accounts.forEach((account) => {
        names.set(normalizeStudentId(account.studentId), account.name);
      });
    }
  } catch {
    // A corrupt blob just means we fall back to raw student hashes.
  }

  accountNameCache = names;
  return names;
}

export function saveAccounts(accounts: UserAccount[]) {
  accountNameCache = null;
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

export function getStudentName(hash: string, lang: "vi" | "en") {
  if (hash === "ADMIN")
    return lang === "vi" ? "Quản trị viên (Admin)" : "Administrator (Admin)";

  const name = getAccountNames().get(hash);
  return name ? `${name} (${hash})` : hash;
}

export function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Returns the previous reference whenever `next` is deep-equal to it. A poll that
 * re-parses an unchanged server document would otherwise hand React brand new object
 * identities for every song and queue item, retriggering the audio effect and the
 * push effect on a 1.5s cycle.
 */
function preserveIdentity<T>(prev: unknown, next: T): T {
  if (Object.is(prev, next)) {
    return next;
  }

  if (Array.isArray(prev) && Array.isArray(next)) {
    let changed = prev.length !== next.length;
    const merged = next.map((item, index) => {
      const value = preserveIdentity(prev[index], item);
      changed = changed || !Object.is(value, prev[index]);
      return value;
    });

    return (changed ? merged : prev) as T;
  }

  if (isPlainObject(prev) && isPlainObject(next)) {
    const nextKeys = Object.keys(next);
    let changed = Object.keys(prev).length !== nextKeys.length;
    const merged: Record<string, unknown> = {};

    nextKeys.forEach((key) => {
      const value = preserveIdentity(prev[key], next[key]);
      merged[key] = value;
      changed = changed || !Object.is(value, prev[key]);
    });

    return (changed ? merged : prev) as T;
  }

  return next;
}

function matchesBundledPianoCatalog(catalog: Song[]) {
  if (catalog.length !== SONG_CATALOG.length) {
    return false;
  }

  const bundledSources = new Map(
    SONG_CATALOG.map((song) => [song.id, song.sourceUrl]),
  );
  return catalog.every(
    (song) => bundledSources.get(song.id) === song.sourceUrl,
  );
}

export function revivePersistedState(
  value: unknown,
  fallback: AppState,
): AppState {
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const candidate = value as Partial<AppState>;

  const revived = {
    ...fallback,
    activeRoomName:
      typeof candidate.activeRoomName === "string"
        ? candidate.activeRoomName
        : fallback.activeRoomName,
    queue: Array.isArray(candidate.queue) ? candidate.queue : fallback.queue,
    playlistSongs: Array.isArray(candidate.playlistSongs)
      ? candidate.playlistSongs
      : fallback.playlistSongs,
    currentPlaylistIndex:
      typeof candidate.currentPlaylistIndex === "number" ||
      candidate.currentPlaylistIndex === null
        ? candidate.currentPlaylistIndex
        : fallback.currentPlaylistIndex,
    isPlaying: false, // Always force initial playback to paused state on page load/refresh to satisfy browser auto-play policies
    progressSec:
      typeof candidate.progressSec === "number"
        ? candidate.progressSec
        : fallback.progressSec,
    studentSpamStates:
      candidate.studentSpamStates &&
      typeof candidate.studentSpamStates === "object"
        ? (candidate.studentSpamStates as Record<string, StudentSpamSnapshot>)
        : fallback.studentSpamStates,
    auditEvents: Array.isArray(candidate.auditEvents)
      ? candidate.auditEvents
      : fallback.auditEvents,
    feedback:
      candidate.feedback && typeof candidate.feedback === "object"
        ? (candidate.feedback as Feedback)
        : fallback.feedback,

    spamGuardEnabled:
      typeof candidate.spamGuardEnabled === "boolean"
        ? candidate.spamGuardEnabled
        : fallback.spamGuardEnabled,
    maxRequests:
      typeof candidate.maxRequests === "number"
        ? candidate.maxRequests
        : fallback.maxRequests,
    blockDurationMs:
      typeof candidate.blockDurationMs === "number"
        ? candidate.blockDurationMs
        : fallback.blockDurationMs,
    strictLicenseGate:
      typeof candidate.strictLicenseGate === "boolean"
        ? candidate.strictLicenseGate
        : fallback.strictLicenseGate,

    rooms:
      candidate.rooms && typeof candidate.rooms === "object"
        ? (candidate.rooms as Record<string, RoomState>)
        : fallback.rooms,
    volume:
      typeof candidate.volume === "number" ? candidate.volume : fallback.volume,
    repeatMode:
      candidate.repeatMode === "all" ||
      candidate.repeatMode === "one" ||
      candidate.repeatMode === "off"
        ? candidate.repeatMode
        : fallback.repeatMode,
    songCatalog: Array.isArray(candidate.songCatalog)
      ? candidate.songCatalog
      : fallback.songCatalog,
    roomList: Array.isArray(candidate.roomList)
      ? candidate.roomList
      : fallback.roomList,
    isCreateRoomOpen: false, // Always reset modal to closed on reload
  };

  return stabilizePlaybackState(revived);
}

export function createStoredInitialState() {
  const fallback = createInitialState();

  if (typeof window === "undefined") {
    return fallback;
  }

  const stored = window.localStorage.getItem(PERSISTED_STATE_KEY);

  if (!stored) {
    return fallback;
  }

  try {
    return revivePersistedState(JSON.parse(stored), fallback);
  } catch {
    return fallback;
  }
}

export function persistAppState(state: AppState) {
  if (typeof window === "undefined") {
    return;
  }

  const snapshot: AppState = {
    ...state,
    progressSec: Math.max(0, state.progressSec),
  };

  try {
    window.localStorage.setItem(PERSISTED_STATE_KEY, JSON.stringify(snapshot));
  } catch {
    // Quota exceeded: drop the inactive-room cache, which is the bulkiest field and
    // the only one we can rebuild, rather than letting the write throw through render.
    try {
      const trimmed: AppState = { ...snapshot, rooms: {} };
      window.localStorage.setItem(PERSISTED_STATE_KEY, JSON.stringify(trimmed));
    } catch {
      window.localStorage.removeItem(PERSISTED_STATE_KEY);
    }
  }
}

export function clearPersistedState() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(PERSISTED_STATE_KEY);
  }
}

export function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking in the same tick cancels the download in Firefox and Safari.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function createRoomInitialState(
  roomName: string,
  now: number,
  _catalog: Song[],
): RoomState {
  const heap = new QueueMaxHeap([]);
  const spamGuard = new SpamGuard();

  return {
    queue: heap.toArray(),
    playlistSongs: [],
    currentPlaylistIndex: null,
    isPlaying: false,
    progressSec: 0,
    studentSpamStates: spamGuard.snapshot(),
    auditEvents: [
      createAuditEvent(
        `Phòng ${roomName} đã được tạo và sẵn sàng phát nhạc.`,
        "success",
        now,
      ),
    ],
    feedback: {
      tone: "neutral",
      message: "Yêu cầu bài hát để xây dựng hàng đợi ưu tiên.",
    },
    spamGuardEnabled: true,
    maxRequests: 3,
    blockDurationMs: 30 * 60 * 1000,
    strictLicenseGate: true,
  };
}

export function createInitialState(): AppState {
  const catalog = [...SONG_CATALOG];
  const now = Date.now();
  const activeRoomName = "Phòng tự học A1";
  const seededHeap = new QueueMaxHeap([
    createQueueItem(catalog[1], "SV001", "seed-request-1", now - 180_000, {
      SV001: 1,
      SV002: 1,
      SV003: 1,
      SV004: 1,
      SV005: 1,
    }),
    createQueueItem(catalog[2], "SV002", "seed-request-2", now - 240_000, {
      SV001: 1,
      SV002: 1,
      SV003: 1,
      SV004: 1,
    }),
    createQueueItem(catalog[3], "SV003", "seed-request-3", now - 120_000, {
      SV001: 1,
      SV003: 1,
    }),
    createQueueItem(catalog[4], "SV004", "seed-request-4", now - 60_000, {
      SV004: 1,
    }),
  ]);
  const activeRoom: RoomState = {
    queue: seededHeap.toArray(),
    playlistSongs: [catalog[0]],
    currentPlaylistIndex: 0,
    isPlaying: false,
    progressSec: 42,
    studentSpamStates: {},
    auditEvents: [
      createAuditEvent(
        "Dữ liệu trình diễn an toàn bản quyền đã sẵn sàng.",
        "success",
        now,
      ),
      createAuditEvent(
        "Max-Heap được khởi tạo với 4 yêu cầu mẫu.",
        "info",
        now - 1_000,
      ),
    ],
    feedback: {
      tone: "neutral",
      message: "Upvote một bài để quan sát Max-Heap tự tái cân bằng.",
    },
    spamGuardEnabled: true,
    maxRequests: 3,
    blockDurationMs: 30 * 60 * 1000,
    strictLicenseGate: true,
  };
  const libraryRoom = createRoomInitialState("Sảnh thư viện", now, catalog);

  return {
    activeRoomName,
    ...activeRoom,
    rooms: {
      [activeRoomName]: activeRoom,
      "Sảnh thư viện": libraryRoom,
    },
    activeAdminPanel: null,
    volume: 70,
    repeatMode: "all",
    songCatalog: catalog,
    roomList: [
      { name: activeRoomName, listeners: 0, code: "A1-2026" },
      { name: "Sảnh thư viện", listeners: 0, code: "LIB-2026" },
    ],
    isCreateRoomOpen: false,
  };
}

/** Snapshots the flattened active-room fields back into a cacheable RoomState. */
export function projectActiveRoom(state: AppState): RoomState {
  return {
    queue: state.queue,
    playlistSongs: state.playlistSongs,
    currentPlaylistIndex: state.currentPlaylistIndex,
    isPlaying: state.isPlaying,
    progressSec: state.progressSec,
    studentSpamStates: state.studentSpamStates,
    auditEvents: state.auditEvents,
    feedback: state.feedback,
    spamGuardEnabled: state.spamGuardEnabled,
    maxRequests: state.maxRequests,
    blockDurationMs: state.blockDurationMs,
    strictLicenseGate: state.strictLicenseGate,
  };
}

function appendEvent(state: AppState, event: AuditEvent) {
  return [event, ...state.auditEvents].slice(0, MAX_AUDIT_EVENTS);
}

export function getCurrentSong(state: AppState) {
  if (
    state.currentPlaylistIndex === null ||
    !Number.isInteger(state.currentPlaylistIndex) ||
    state.currentPlaylistIndex < 0 ||
    state.currentPlaylistIndex >= state.playlistSongs.length
  ) {
    return null;
  }

  return state.playlistSongs[state.currentPlaylistIndex] ?? null;
}

/**
 * Keeps the flattened player state internally consistent after local actions,
 * restored storage and remote snapshots. An empty playlist can never retain a
 * dangling current index or an active playhead.
 */
function stabilizePlaybackState(state: AppState): AppState {
  if (state.playlistSongs.length === 0) {
    if (
      state.currentPlaylistIndex === null &&
      !state.isPlaying &&
      state.progressSec === 0
    ) {
      return state;
    }

    return {
      ...state,
      currentPlaylistIndex: null,
      isPlaying: false,
      progressSec: 0,
    };
  }

  const rawIndex = state.currentPlaylistIndex;
  const currentPlaylistIndex =
    rawIndex !== null && Number.isInteger(rawIndex)
      ? Math.min(Math.max(rawIndex, 0), state.playlistSongs.length - 1)
      : 0;
  const duration = state.playlistSongs[currentPlaylistIndex].durationSec;
  const progressSec = Number.isFinite(state.progressSec)
    ? Math.min(Math.max(state.progressSec, 0), duration)
    : 0;

  if (
    currentPlaylistIndex === state.currentPlaylistIndex &&
    progressSec === state.progressSec
  ) {
    return state;
  }

  return {
    ...state,
    currentPlaylistIndex,
    progressSec,
  };
}

function advanceToNextTrack(state: AppState, now: number, manual: boolean) {
  // If in Loop Single Track mode and this is an automatic track change, loop it
  if (state.repeatMode === "one" && !manual) {
    const current = getCurrentSong(state);
    return {
      ...state,
      progressSec: 0,
      feedback: {
        tone: "neutral" as const,
        message: current
          ? `Looping track: ${current.title}`
          : "No song selected",
      },
    };
  }

  const heap = new QueueMaxHeap(state.queue);
  const nextItem = heap.extractMax();

  if (nextItem) {
    const playlist = CircularDoublyLinkedList.fromArray(
      state.playlistSongs,
      state.currentPlaylistIndex,
    );
    const added = playlist.addLast(nextItem.song);

    return {
      ...state,
      queue: heap.toArray(),
      playlistSongs: playlist.toArray(),
      currentPlaylistIndex: added.index,
      progressSec: 0,
      feedback: {
        tone: "success" as const,
        message: `${nextItem.song.title} popped from Max-Heap queue to player.`,
      },
      auditEvents: appendEvent(
        state,
        createAuditEvent(
          `Pop max: ${nextItem.song.title} (${nextItem.score} votes)`,
          "success",
          now,
        ),
      ),
    };
  }

  // If queue is empty, handle Loop Off
  if (state.repeatMode === "off" && !manual) {
    return {
      ...state,
      isPlaying: false,
      progressSec: 0,
      feedback: {
        tone: "neutral" as const,
        message: "Playback stopped. Queue is empty.",
      },
    };
  }

  // Fallback to playlist loop
  if (state.playlistSongs.length > 0) {
    const playlist = CircularDoublyLinkedList.fromArray(
      state.playlistSongs,
      state.currentPlaylistIndex ?? 0,
    );
    const moved = playlist.next();

    if (moved) {
      return {
        ...state,
        currentPlaylistIndex: moved.index,
        progressSec: 0,
        feedback: {
          tone: "neutral" as const,
          message: manual
            ? `Repeat playlist: ${moved.value.title}`
            : `Auto repeat: ${moved.value.title}`,
        },
      };
    }
  }

  return {
    ...state,
    isPlaying: false,
    progressSec: 0,
    feedback: {
      tone: "warning" as const,
      message: "Queue and playlist are empty.",
    },
  };
}

function moveToPreviousTrack(state: AppState) {
  if (state.playlistSongs.length === 0) {
    return {
      ...state,
      feedback: {
        tone: "warning" as const,
        message: "Playlist is empty.",
      },
    };
  }

  const playlist = CircularDoublyLinkedList.fromArray(
    state.playlistSongs,
    state.currentPlaylistIndex ?? 0,
  );
  const moved = playlist.prev();

  if (!moved) {
    return state;
  }

  return {
    ...state,
    currentPlaylistIndex: moved.index,
    progressSec: 0,
    feedback: {
      tone: "neutral" as const,
      message: `Previous track: ${moved.value.title}`,
    },
  };
}

function coreReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "SWITCH_ROOM": {
      const oldRoom = state.activeRoomName;
      const newRoom = action.roomName;
      if (oldRoom === newRoom) return state;

      // 1. Save current active room settings to cache
      const updatedRooms = {
        ...state.rooms,
        ...(oldRoom ? { [oldRoom]: projectActiveRoom(state) } : {}),
      };

      // 2. Load next active room settings from cache
      const targetRoom =
        updatedRooms[newRoom] ||
        createRoomInitialState(newRoom, action.now, state.songCatalog);

      return {
        ...state,
        activeRoomName: newRoom,
        queue: targetRoom.queue,
        playlistSongs: targetRoom.playlistSongs,
        currentPlaylistIndex: targetRoom.currentPlaylistIndex,
        isPlaying: targetRoom.isPlaying,
        progressSec: targetRoom.progressSec,
        studentSpamStates: targetRoom.studentSpamStates,
        auditEvents: [
          createAuditEvent(`Connected to ${newRoom}`, "info", action.now),
          ...targetRoom.auditEvents,
        ].slice(0, MAX_AUDIT_EVENTS),
        feedback: {
          tone: "success",
          message: `Switched session to ${newRoom}.`,
        },
        spamGuardEnabled: targetRoom.spamGuardEnabled,
        maxRequests: targetRoom.maxRequests,
        blockDurationMs: targetRoom.blockDurationMs,
        strictLicenseGate: targetRoom.strictLicenseGate,
        rooms: updatedRooms,
        activeAdminPanel: null, // close any panel on switch
      };
    }

    case "SET_VOLUME":
      return {
        ...state,
        volume: action.volume,
      };

    case "TOGGLE_REPEAT": {
      const modes: ("all" | "one" | "off")[] = ["all", "one", "off"];
      const nextIndex = (modes.indexOf(state.repeatMode) + 1) % modes.length;
      return {
        ...state,
        repeatMode: modes[nextIndex],
        feedback: {
          tone: "neutral",
          message: `Loop mode: ${modes[nextIndex].toUpperCase()}`,
        },
      };
    }

    case "SHUFFLE_QUEUE": {
      if (state.queue.length <= 1) {
        return {
          ...state,
          feedback: {
            tone: "warning",
            message: "Queue needs at least 2 tracks to shuffle.",
          },
        };
      }

      const items = [...state.queue];
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = items[i];
        items[i] = items[j];
        items[j] = temp;
      }

      // Reorder the heap through the dedicated tiebreak. Votes still outrank a shuffle,
      // and requestedAt stays intact so the queue keeps showing real request times.
      const shuffled = items.map((item, index) => ({
        ...item,
        shuffleOrder: index,
      }));

      const heap = new QueueMaxHeap(shuffled);
      return {
        ...state,
        queue: heap.toArray(),
        feedback: {
          tone: "success",
          message: "Scrambled community requests inside the Max-Heap.",
        },
        auditEvents: appendEvent(
          state,
          createAuditEvent("Admin shuffled waiting queue", "info", action.now),
        ),
      };
    }

    case "OPEN_ADMIN_PANEL":
      return {
        ...state,
        activeAdminPanel: action.panel,
      };

    case "CLOSE_ADMIN_PANEL":
      return {
        ...state,
        activeAdminPanel: null,
      };

    case "UPDATE_ROOM_SETTINGS":
      return {
        ...state,
        spamGuardEnabled: action.settings.spamGuardEnabled,
        maxRequests: action.settings.maxRequests,
        blockDurationMs: action.settings.blockDurationMs,
        strictLicenseGate: action.settings.strictLicenseGate,
        feedback: {
          tone: "success",
          message: "Room settings updated successfully.",
        },
        auditEvents: appendEvent(
          state,
          createAuditEvent(
            "Admin updated room settings",
            "warning",
            action.now,
          ),
        ),
      };

    case "APPROVE_SONG": {
      const updatedCatalog = state.songCatalog.map((song) => {
        if (song.id === action.songId) {
          return {
            ...song,
            approvalStatus: "approved" as const,
            publicPlaybackAllowed: true,
          };
        }
        return song;
      });

      const updatedPlaylist = state.playlistSongs.map((song) => {
        if (song.id === action.songId) {
          return {
            ...song,
            approvalStatus: "approved" as const,
            publicPlaybackAllowed: true,
          };
        }
        return song;
      });

      const updatedQueue = state.queue.map((item) => {
        if (item.song.id === action.songId) {
          return {
            ...item,
            song: {
              ...item.song,
              approvalStatus: "approved" as const,
              publicPlaybackAllowed: true,
            },
          };
        }
        return item;
      });

      const approvedSong = state.songCatalog.find(
        (s) => s.id === action.songId,
      );
      const title = approvedSong ? approvedSong.title : action.songId;

      return {
        ...state,
        songCatalog: updatedCatalog,
        playlistSongs: updatedPlaylist,
        queue: updatedQueue,
        feedback: {
          tone: "success",
          message: `Approved "${title}" copyright playback license.`,
        },
        auditEvents: appendEvent(
          state,
          createAuditEvent(
            `Approved copyright: ${title}`,
            "success",
            action.now,
          ),
        ),
      };
    }

    case "REJECT_SONG": {
      const updatedCatalog = state.songCatalog.map((song) => {
        if (song.id === action.songId) {
          return {
            ...song,
            approvalStatus: "rejected" as const,
            publicPlaybackAllowed: false,
          };
        }
        return song;
      });

      // Evict rejected song requests from active queue
      const heap = new QueueMaxHeap(state.queue);
      const toRemove = state.queue.filter(
        (item) => item.song.id === action.songId,
      );
      toRemove.forEach((item) => heap.remove(item.requestId));

      const oldCurrentIndex = state.currentPlaylistIndex;
      const oldCurrentSong = getCurrentSong(state);
      const updatedPlaylist = state.playlistSongs.filter(
        (song) => song.id !== action.songId,
      );
      const removedBeforeCurrent =
        oldCurrentIndex === null
          ? 0
          : state.playlistSongs
              .slice(0, oldCurrentIndex)
              .filter((song) => song.id === action.songId).length;
      const currentWasRejected = oldCurrentSong?.id === action.songId;
      const nextPlaylistIndex =
        updatedPlaylist.length === 0
          ? null
          : currentWasRejected
            ? Math.min(oldCurrentIndex ?? 0, updatedPlaylist.length - 1)
            : Math.min(
                Math.max((oldCurrentIndex ?? 0) - removedBeforeCurrent, 0),
                updatedPlaylist.length - 1,
              );

      const guard = new SpamGuard(
        state.studentSpamStates,
        state.maxRequests,
        state.blockDurationMs,
      );
      toRemove.forEach((item) => guard.removeActiveRequest(item.requestId));

      const rejectedSong = state.songCatalog.find(
        (s) => s.id === action.songId,
      );
      const title = rejectedSong ? rejectedSong.title : action.songId;

      return {
        ...state,
        songCatalog: updatedCatalog,
        queue: heap.toArray(),
        playlistSongs: updatedPlaylist,
        currentPlaylistIndex: nextPlaylistIndex,
        progressSec: currentWasRejected ? 0 : state.progressSec,
        isPlaying: updatedPlaylist.length > 0 && state.isPlaying,
        studentSpamStates: guard.snapshot(),
        feedback: {
          tone: "danger",
          message: `Rejected "${title}". Removed ${toRemove.length} request(s) and stopped any active playback of it.`,
        },
        auditEvents: appendEvent(
          state,
          createAuditEvent(
            `Rejected copyright: ${title}`,
            "danger",
            action.now,
          ),
        ),
      };
    }

    case "FORCE_UNBLOCK_STUDENT": {
      const hash = action.studentHash;
      const spamStates = { ...state.studentSpamStates };
      if (spamStates[hash]) {
        spamStates[hash] = {
          ...spamStates[hash],
          blockedUntil: undefined,
          blockReason: undefined,
          recentRequests: [],
        };
      }

      return {
        ...state,
        studentSpamStates: spamStates,
        feedback: {
          tone: "success",
          message: `Manually bypassed block for Student: ${hash}.`,
        },
        auditEvents: appendEvent(
          state,
          createAuditEvent(`Forced unblock: ${hash}`, "success", action.now),
        ),
      };
    }

    case "REQUEST_SONG": {
      const studentHash = normalizeStudentId(action.studentId);
      const song = state.songCatalog.find(
        (catalogSong) => catalogSong.id === action.songId,
      );

      if (!studentHash) {
        return {
          ...state,
          feedback: {
            tone: "warning",
            message: "Enter a Student ID before requesting a song.",
          },
        };
      }

      if (!song) {
        return {
          ...state,
          feedback: { tone: "danger", message: "Song not found." },
        };
      }

      const isLicenseSafe =
        song.approvalStatus === "approved" &&
        song.publicPlaybackAllowed &&
        song.licenseUrl !== "";

      if (state.strictLicenseGate && !isLicenseSafe) {
        return {
          ...state,
          feedback: {
            tone: "danger",
            message: `${song.title} is blocked due to license verification rules.`,
          },
          auditEvents: appendEvent(
            state,
            createAuditEvent(
              `License gate blocked: ${song.title}`,
              "danger",
              action.now,
            ),
          ),
        };
      }

      // Check anti-spam configurations
      if (state.spamGuardEnabled && studentHash !== "ADMIN") {
        const guard = new SpamGuard(
          state.studentSpamStates,
          state.maxRequests,
          state.blockDurationMs,
        );
        const spamResult = guard.checkBeforeRequest(
          studentHash,
          song.canonicalKey,
          action.now,
        );

        if (spamResult.status === "blocked") {
          const heap = new QueueMaxHeap(state.queue);
          const purged = heap.removeMany(spamResult.purgeRequestIds);
          const removedVotes = heap.removeStudentVotes(studentHash);

          return {
            ...state,
            queue: heap.toArray(),
            studentSpamStates: guard.snapshot(),
            feedback: {
              tone: "danger",
              message: `${studentHash} blocked until ${formatClock(
                spamResult.blockedUntil,
              )}. Evicted ${purged.length} songs and removed ${removedVotes} vote(s).`,
            },
            auditEvents: appendEvent(
              state,
              createAuditEvent(
                `Blocked spammer ${studentHash}: ${readableBlockReason(spamResult.reason)}`,
                "danger",
                action.now,
              ),
            ),
          };
        }

        const heap = new QueueMaxHeap(state.queue);
        const existing = heap.findBySongKey(song.canonicalKey);

        if (existing) {
          const voteResult = heap.changeVote(
            existing.requestId,
            studentHash,
            1,
          );
          guard.recordAllowedRequest(
            studentHash,
            song.canonicalKey,
            action.now,
          );

          return {
            ...state,
            queue: heap.toArray(),
            studentSpamStates: guard.snapshot(),
            feedback: {
              tone: voteResult?.delta ? "success" : "neutral",
              message: voteResult?.delta
                ? `${song.title} already queued, upvoted instead.`
                : `${song.title} is already pending.`,
            },
            auditEvents: appendEvent(
              state,
              createAuditEvent(
                `Auto-upvoted request: ${song.title}`,
                "info",
                action.now,
              ),
            ),
          };
        }

        const requestId = `req_${action.now}_${song.id}_${studentHash}`;
        const item = createQueueItem(song, studentHash, requestId, action.now);
        heap.insert(item);
        guard.recordAllowedRequest(
          studentHash,
          song.canonicalKey,
          action.now,
          requestId,
        );

        return {
          ...state,
          queue: heap.toArray(),
          studentSpamStates: guard.snapshot(),
          feedback: {
            tone: "success",
            message: `Queued "${song.title}" into the Max-Heap pool.`,
          },
          auditEvents: appendEvent(
            state,
            createAuditEvent(
              `Request queued: ${song.title}`,
              "success",
              action.now,
            ),
          ),
        };
      } else {
        // Spam guard disabled bypass
        const heap = new QueueMaxHeap(state.queue);
        const existing = heap.findBySongKey(song.canonicalKey);

        if (existing) {
          const voteResult = heap.changeVote(
            existing.requestId,
            studentHash,
            1,
          );
          return {
            ...state,
            queue: heap.toArray(),
            feedback: {
              tone: voteResult?.delta ? "success" : "neutral",
              message: voteResult?.delta
                ? `${song.title} upvoted in queue.`
                : `${song.title} already exists.`,
            },
          };
        }

        const requestId = `req_${action.now}_${song.id}_${studentHash}`;
        const item = createQueueItem(song, studentHash, requestId, action.now);
        heap.insert(item);

        return {
          ...state,
          queue: heap.toArray(),
          feedback: {
            tone: "success",
            message: `Queued "${song.title}" (Spam Guard bypassed).`,
          },
          auditEvents: appendEvent(
            state,
            createAuditEvent(
              `Request queued (unregulated): ${song.title}`,
              "success",
              action.now,
            ),
          ),
        };
      }
    }

    case "CAST_VOTE": {
      const studentHash = normalizeStudentId(action.studentId);

      if (!studentHash) {
        return {
          ...state,
          feedback: {
            tone: "warning",
            message: "Enter a Student ID before voting.",
          },
        };
      }

      if (state.spamGuardEnabled) {
        const guard = new SpamGuard(
          state.studentSpamStates,
          state.maxRequests,
          state.blockDurationMs,
        );
        const studentStatus = guard.getStudentStatus(studentHash, action.now);

        if (studentStatus.isBlocked && studentStatus.blockedUntil) {
          return {
            ...state,
            studentSpamStates: guard.snapshot(),
            feedback: {
              tone: "danger",
              message: `Student ${studentHash} is blocked for ${formatRemaining(
                studentStatus.blockedUntil,
                action.now,
              )}.`,
            },
          };
        }
      }

      const heap = new QueueMaxHeap(state.queue);
      const voteResult = heap.changeVote(
        action.requestId,
        studentHash,
        action.vote,
      );

      if (!voteResult) {
        return {
          ...state,
          feedback: {
            tone: "warning",
            message: "Request evicted from queue.",
          },
        };
      }

      return {
        ...state,
        queue: heap.toArray(),
        feedback: {
          tone: voteResult.delta === 0 ? "neutral" : "success",
          message:
            voteResult.delta === 0
              ? "Vote already registered."
              : `Heap adjusted: "${voteResult.item.song.title}" score is now ${voteResult.item.score}.`,
        },
        auditEvents: appendEvent(
          state,
          createAuditEvent(
            `Vote recorded (${action.vote > 0 ? "+1" : "-1"}): ${voteResult.item.song.title}`,
            "info",
            action.now,
          ),
        ),
      };
    }

    case "REMOVE_REQUEST": {
      const heap = new QueueMaxHeap(state.queue);
      const removed = heap.remove(action.requestId);

      if (state.spamGuardEnabled) {
        const guard = new SpamGuard(
          state.studentSpamStates,
          state.maxRequests,
          state.blockDurationMs,
        );
        guard.removeActiveRequest(action.requestId);
        return {
          ...state,
          queue: heap.toArray(),
          studentSpamStates: guard.snapshot(),
          feedback: {
            tone: removed ? "warning" : "neutral",
            message: removed
              ? `Admin removed "${removed.song.title}" from heap.`
              : "Request already gone.",
          },
          auditEvents: removed
            ? appendEvent(
                state,
                createAuditEvent(
                  `Admin evicted: ${removed.song.title}`,
                  "warning",
                  action.now,
                ),
              )
            : state.auditEvents,
        };
      }

      return {
        ...state,
        queue: heap.toArray(),
        feedback: {
          tone: removed ? "warning" : "neutral",
          message: removed
            ? `Admin evicted "${removed.song.title}".`
            : "Request already gone.",
        },
        auditEvents: removed
          ? appendEvent(
              state,
              createAuditEvent(
                `Admin evicted: ${removed.song.title}`,
                "warning",
                action.now,
              ),
            )
          : state.auditEvents,
      };
    }

    case "CLEAR_QUEUE": {
      if (state.queue.length === 0) {
        return {
          ...state,
          feedback: {
            tone: "neutral",
            message: "Queue is already empty.",
          },
        };
      }

      const guard = new SpamGuard(
        state.studentSpamStates,
        state.maxRequests,
        state.blockDurationMs,
      );
      state.queue.forEach((item) => guard.removeActiveRequest(item.requestId));
      const removedCount = state.queue.length;

      return {
        ...state,
        queue: [],
        studentSpamStates: guard.snapshot(),
        feedback: {
          tone: "warning",
          message: `Cleared ${removedCount} request(s) from the queue.`,
        },
        auditEvents: appendEvent(
          state,
          createAuditEvent(
            `Admin cleared ${removedCount} queued request(s)`,
            "warning",
            action.now,
          ),
        ),
      };
    }

    case "PLAYER_NEXT":
      return advanceToNextTrack(state, action.now, true);

    // The audio element reaching its end is not a manual skip: repeat-one must loop
    // the track and repeat-off must stop once the queue drains. advanceToNextTrack
    // already carries isPlaying forward when it finds something to play.
    case "TRACK_ENDED": {
      const advanced = advanceToNextTrack(state, action.now, false);
      return {
        ...advanced,
        isPlaying: advanced.isPlaying && getCurrentSong(advanced) !== null,
      };
    }

    case "PLAYER_PREV":
      return moveToPreviousTrack(state);

    case "TOGGLE_PLAY": {
      if (!getCurrentSong(state) && state.queue.length > 0) {
        return {
          ...advanceToNextTrack(state, action.now, true),
          isPlaying: true,
        };
      }

      if (!getCurrentSong(state)) {
        return {
          ...state,
          feedback: {
            tone: "warning",
            message: "Request a song before starting playback.",
          },
        };
      }

      return {
        ...state,
        isPlaying: !state.isPlaying,
        feedback: {
          tone: "neutral",
          message: state.isPlaying
            ? "Piano playback paused."
            : "Piano playback started.",
        },
      };
    }

    case "RESET_DEMO": {
      const roomName = state.activeRoomName;

      if (!roomName) {
        return {
          ...state,
          feedback: { tone: "warning", message: "No active room to reset." },
        };
      }

      // Reset only the active room. The room list, the other rooms' queues and the
      // catalog approval decisions all survive.
      const fresh = createRoomInitialState(
        roomName,
        action.now,
        state.songCatalog,
      );

      return {
        ...state,
        ...fresh,
        rooms: { ...state.rooms, [roomName]: fresh },
        activeAdminPanel: null,
        feedback: {
          tone: "success",
          message: `Active session for ${roomName} has been reset.`,
        },
        auditEvents: [
          createAuditEvent(
            `Admin reset room ${roomName}`,
            "warning",
            action.now,
          ),
          ...fresh.auditEvents,
        ].slice(0, MAX_AUDIT_EVENTS),
      };
    }

    case "SET_FEEDBACK": {
      const auditTone =
        action.feedback.tone === "neutral" ? "info" : action.feedback.tone;

      return {
        ...state,
        feedback: action.feedback,
        auditEvents: action.auditMessage
          ? appendEvent(
              state,
              createAuditEvent(action.auditMessage, auditTone, action.now),
            )
          : state.auditEvents,
      };
    }

    case "TICK": {
      const currentSong = getCurrentSong(state);

      if (!state.isPlaying || !currentSong) {
        return state;
      }

      // actualTime means an <audio> element is the clock. Its own "ended" event decides
      // when the track is over — catalog durationSec runs a few seconds long, so
      // advancing here too would skip a track.
      if (action.actualTime !== undefined) {
        const clamped = Math.min(action.actualTime, currentSong.durationSec);
        return clamped === state.progressSec
          ? state
          : { ...state, progressSec: clamped };
      }

      const nextProgress = state.progressSec + 1;

      if (nextProgress >= currentSong.durationSec) {
        // Only the device driving the speakers may pop the heap. A follower that
        // advanced on its own clock would race the room into a different track.
        if (!action.autoAdvance) {
          return state.progressSec === currentSong.durationSec
            ? state
            : { ...state, progressSec: currentSong.durationSec };
        }

        const advanced = advanceToNextTrack(state, action.now, false);
        return {
          ...advanced,
          isPlaying: advanced.isPlaying && getCurrentSong(advanced) !== null,
        };
      }

      return {
        ...state,
        progressSec: nextProgress,
      };
    }

    case "SEEK_SONG": {
      return {
        ...state,
        progressSec: Math.max(
          0,
          Math.min(getCurrentSong(state)?.durationSec ?? 0, action.time),
        ),
      };
    }

    case "SYNC_C_BACKEND": {
      const previousSong = getCurrentSong(state);
      const incomingSong =
        action.currentPlaylistIndex === null
          ? null
          : (action.playlistSongs[action.currentPlaylistIndex] ?? null);
      const songChanged = previousSong?.id !== incomingSong?.id;
      const nextRoom: RoomState = {
        ...projectActiveRoom(state),
        queue: action.queue,
        playlistSongs: action.playlistSongs,
        currentPlaylistIndex: action.currentPlaylistIndex,
        progressSec: songChanged ? 0 : state.progressSec,
        isPlaying: incomingSong === null ? false : state.isPlaying,
        feedback: action.feedback ?? state.feedback,
      };

      return {
        ...state,
        queue: nextRoom.queue,
        playlistSongs: nextRoom.playlistSongs,
        currentPlaylistIndex: nextRoom.currentPlaylistIndex,
        progressSec: nextRoom.progressSec,
        isPlaying: nextRoom.isPlaying,
        feedback: nextRoom.feedback,
        rooms: {
          ...state.rooms,
          [state.activeRoomName]: nextRoom,
        },
        auditEvents: action.feedback
          ? appendEvent(
              state,
              createAuditEvent(action.feedback.message, "info", action.now),
            )
          : state.auditEvents,
      };
    }

    case "SYNC_STATE": {
      // Ignore one legacy server snapshot after upgrading from generated tracks.
      // Once the first poll finishes, this client pushes the bundled piano schema.
      if (!matchesBundledPianoCatalog(action.shared.songCatalog)) {
        return state;
      }

      // Only the shared slice crosses devices. activeRoomName, volume, repeatMode and
      // the open modal belong to this tab and are deliberately left untouched.
      const rooms = preserveIdentity(state.rooms, action.shared.rooms);
      const roomList = preserveIdentity(state.roomList, action.shared.roomList);
      const songCatalog = preserveIdentity(
        state.songCatalog,
        action.shared.songCatalog,
      );

      // A peer touched a room we are not in, or nothing changed at all. Returning the
      // very same state object keeps React from re-rendering the whole app.
      if (
        rooms === state.rooms &&
        roomList === state.roomList &&
        songCatalog === state.songCatalog
      ) {
        return state;
      }

      const incomingRoom = rooms[state.activeRoomName];

      if (!incomingRoom) {
        return { ...state, rooms, roomList, songCatalog };
      }

      const currentSong = getCurrentSong(state);
      const incomingSong =
        incomingRoom.currentPlaylistIndex === null
          ? null
          : (incomingRoom.playlistSongs[incomingRoom.currentPlaylistIndex] ??
            null);
      const songChanged = currentSong?.id !== incomingSong?.id;

      // Following the peer's playhead second by second would fight our own clock and
      // reseek the audio element constantly. Resync only on a track change or real drift.
      const shouldSyncProgress =
        songChanged ||
        Math.abs(incomingRoom.progressSec - state.progressSec) > 5;

      return {
        ...state,
        rooms,
        roomList,
        songCatalog,
        queue: incomingRoom.queue,
        playlistSongs: incomingRoom.playlistSongs,
        currentPlaylistIndex: incomingRoom.currentPlaylistIndex,
        studentSpamStates: incomingRoom.studentSpamStates,
        auditEvents: incomingRoom.auditEvents,
        spamGuardEnabled: incomingRoom.spamGuardEnabled,
        maxRequests: incomingRoom.maxRequests,
        blockDurationMs: incomingRoom.blockDurationMs,
        strictLicenseGate: incomingRoom.strictLicenseGate,
        isPlaying: incomingRoom.isPlaying,
        progressSec: shouldSyncProgress
          ? incomingRoom.progressSec
          : state.progressSec,
        // feedback is a toast aimed at whoever triggered the action; keep ours.
      };
    }

    case "OPEN_CREATE_ROOM":
      return {
        ...state,
        isCreateRoomOpen: true,
      };

    case "CLOSE_CREATE_ROOM":
      return {
        ...state,
        isCreateRoomOpen: false,
      };

    case "CREATE_ROOM": {
      const newRoomName = action.name.trim();
      const exists = state.roomList.some(
        (r) => r.name.toLowerCase() === newRoomName.toLowerCase(),
      );
      if (exists) {
        return {
          ...state,
          feedback: {
            tone: "danger",
            message: `Room "${newRoomName}" already exists!`,
          },
        };
      }

      const newRoomInfo: RoomInfo = {
        name: newRoomName,
        code: action.code,
        listeners: action.listeners,
      };

      const newRoomState = createRoomInitialState(
        newRoomName,
        action.now,
        state.songCatalog,
      );

      // Save current active room cache
      const currentRoomCache: RoomState = {
        queue: state.queue,
        playlistSongs: state.playlistSongs,
        currentPlaylistIndex: state.currentPlaylistIndex,
        isPlaying: state.isPlaying,
        progressSec: state.progressSec,
        studentSpamStates: state.studentSpamStates,
        auditEvents: state.auditEvents,
        feedback: state.feedback,
        spamGuardEnabled: state.spamGuardEnabled,
        maxRequests: state.maxRequests,
        blockDurationMs: state.blockDurationMs,
        strictLicenseGate: state.strictLicenseGate,
      };

      const updatedRooms = {
        ...state.rooms,
        ...(state.activeRoomName
          ? { [state.activeRoomName]: currentRoomCache }
          : {}),
        [newRoomName]: newRoomState,
      };

      return {
        ...state,
        activeRoomName: newRoomName,
        queue: newRoomState.queue,
        playlistSongs: newRoomState.playlistSongs,
        currentPlaylistIndex: newRoomState.currentPlaylistIndex,
        isPlaying: newRoomState.isPlaying,
        progressSec: newRoomState.progressSec,
        studentSpamStates: newRoomState.studentSpamStates,
        auditEvents: [
          createAuditEvent(
            `Created and joined room ${newRoomName}`,
            "success",
            action.now,
          ),
          ...newRoomState.auditEvents,
        ].slice(0, MAX_AUDIT_EVENTS),
        feedback: {
          tone: "success",
          message: `Created room "${newRoomName}" successfully.`,
        },
        spamGuardEnabled: newRoomState.spamGuardEnabled,
        maxRequests: newRoomState.maxRequests,
        blockDurationMs: newRoomState.blockDurationMs,
        strictLicenseGate: newRoomState.strictLicenseGate,
        rooms: updatedRooms,
        roomList: [...state.roomList, newRoomInfo],
        isCreateRoomOpen: false,
        activeAdminPanel: null,
      };
    }

    default:
      return state;
  }
}

// `satisfies` makes TypeScript reject this list if RoomState ever grows a field.
const ROOM_STATE_KEYS = Object.keys({
  queue: 0,
  playlistSongs: 0,
  currentPlaylistIndex: 0,
  isPlaying: 0,
  progressSec: 0,
  studentSpamStates: 0,
  auditEvents: 0,
  feedback: 0,
  spamGuardEnabled: 0,
  maxRequests: 0,
  blockDurationMs: 0,
  strictLicenseGate: 0,
} satisfies Record<keyof RoomState, unknown>) as (keyof RoomState)[];

function roomStateEquals(a: RoomState | undefined, b: RoomState) {
  return (
    a !== undefined && ROOM_STATE_KEYS.every((key) => Object.is(a[key], b[key]))
  );
}

export function appReducer(state: AppState, action: AppAction): AppState {
  const nextState = stabilizePlaybackState(coreReducer(state, action));

  if (!nextState.activeRoomName) {
    return nextState;
  }

  // Mirror the flattened active-room fields back into the cache. The previous version
  // only mirrored when the key already existed, so a room you had just switched into
  // was never written back and lost its queue on the next switch.
  const mirrored = projectActiveRoom(nextState);
  const cached = nextState.rooms[nextState.activeRoomName];

  if (roomStateEquals(cached, mirrored)) {
    return nextState;
  }

  return {
    ...nextState,
    rooms: {
      ...nextState.rooms,
      [nextState.activeRoomName]: mirrored,
    },
  };
}
