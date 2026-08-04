import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  appReducer,
  clearPersistedState,
  createStoredInitialState,
  downloadJson,
  getCurrentSong,
  persistAppState,
  type CatalogTab,
} from "./app/model";
import { useAudioPlayer } from "./audio/useAudioPlayer";
import { RequestPanel } from "./components/catalog";
import {
  AnalyticsModal,
  AuthScreen,
  CreateRoomModal,
  ModerationModal,
  SettingsModal,
  TitleBar,
} from "./components/modals";
import { PlayerPanel, QueuePanel, RecentlyPlayed } from "./components/playback";
import { Icon } from "./components/primitives";
import { Sidebar } from "./components/sidebar";
import {
  CBackendError,
  loadCBackendState,
  runCBackendCommand,
  songIdForC,
} from "./lib/c-backend";
import {
  QueueMaxHeap,
  normalizeStudentId,
  rankQueue,
  type UserAccount,
  type VoteValue,
} from "./lib/heapbeat";
import "./App.css";

export default function App() {
  // The C snapshot is the sole source of truth for queue and player state.
  // A request sequence below prevents slower responses from replacing newer snapshots.
  const [state, dispatch] = useReducer(
    appReducer,
    undefined,
    createStoredInitialState,
  );

  const [searchTerm, setSearchTerm] = useState("");
  const [roomSearch, setRoomSearch] = useState("");
  const [genreFilter, setGenreFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<CatalogTab>("catalog");
  const [now, setNow] = useState(() => Date.now());
  const [seekTrigger, setSeekTrigger] = useState(0);

  const [lang, setLang] = useState<"vi" | "en">("vi");
  const [mobileTab, setMobileTab] = useState<"rooms" | "player" | "request">(
    "player",
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    try {
      const cached = localStorage.getItem("heapbeat_current_user");
      return cached ? (JSON.parse(cached) as UserAccount) : null;
    } catch {
      return null;
    }
  });

  // The signed-in account is the only identity in the app. Keeping a separate studentId
  // state let "Reset active room" silently reassign every subsequent vote to SV001.
  const studentId = currentUser?.studentId ?? "";

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(
        "heapbeat_current_user",
        JSON.stringify(currentUser),
      );
    } else {
      localStorage.removeItem("heapbeat_current_user");
    }
  }, [currentUser]);

  // Auto-switch mobile view tab based on active room selection state
  useEffect(() => {
    if (!state.activeRoomName) {
      setMobileTab("rooms");
    } else {
      setMobileTab("player");
    }
  }, [state.activeRoomName]);

  const currentSong = getCurrentSong(state);
  const rootItem = useMemo(
    () => new QueueMaxHeap(state.queue).peek(),
    [state.queue],
  );
  const rankedQueue = useMemo(() => rankQueue(state.queue), [state.queue]);
  const normalizedStudentId = normalizeStudentId(studentId);

  // Refs for tracking properties inside TICK interval safely without re-creating the interval
  const isPlayingRef = useRef(state.isPlaying);
  isPlayingRef.current = state.isPlaying;
  const currentSongRef = useRef(currentSong);
  currentSongRef.current = currentSong;

  const [activeListenersMap, setActiveListenersMap] = useState<
    Record<string, number>
  >({});

  // Tab Heartbeat for real-time listener count calculation
  useEffect(() => {
    if (!state.activeRoomName) return;
    const tabId = Math.random().toString(36).substring(2, 9);

    const writeHeartbeat = () => {
      try {
        const heartbeatsRaw = localStorage.getItem("heapbeat:active-tabs");
        const heartbeats: Record<
          string,
          { roomName: string; timestamp: number }
        > = heartbeatsRaw ? JSON.parse(heartbeatsRaw) : {};

        // Update this tab's heartbeat
        heartbeats[tabId] = {
          roomName: state.activeRoomName,
          timestamp: Date.now(),
        };

        // Prune stale heartbeats (older than 6 seconds)
        const activeLimit = Date.now() - 6000;
        const activeHeartbeats: Record<
          string,
          { roomName: string; timestamp: number }
        > = {};
        Object.entries(heartbeats).forEach(([id, hb]) => {
          if (hb.timestamp > activeLimit) {
            activeHeartbeats[id] = hb;
          }
        });

        localStorage.setItem(
          "heapbeat:active-tabs",
          JSON.stringify(activeHeartbeats),
        );
      } catch (e) {
        console.warn("Heartbeat error", e);
      }
    };

    writeHeartbeat();
    const interval = setInterval(writeHeartbeat, 2000);

    return () => {
      clearInterval(interval);
      try {
        const heartbeatsRaw = localStorage.getItem("heapbeat:active-tabs");
        if (heartbeatsRaw) {
          const heartbeats = JSON.parse(heartbeatsRaw);
          delete heartbeats[tabId];
          localStorage.setItem(
            "heapbeat:active-tabs",
            JSON.stringify(heartbeats),
          );
        }
      } catch (e) {}
    };
  }, [state.activeRoomName]);

  // Read heartbeats of all tabs in all rooms to calculate the actual active listeners map
  useEffect(() => {
    const checkListeners = () => {
      try {
        const heartbeatsRaw = localStorage.getItem("heapbeat:active-tabs");
        if (heartbeatsRaw) {
          const heartbeats: Record<
            string,
            { roomName: string; timestamp: number }
          > = JSON.parse(heartbeatsRaw);
          const activeLimit = Date.now() - 6000;

          const newMap: Record<string, number> = {};
          Object.values(heartbeats).forEach((hb) => {
            if (hb.timestamp > activeLimit) {
              newMap[hb.roomName] = (newMap[hb.roomName] || 0) + 1;
            }
          });
          setActiveListenersMap(newMap);
        }
      } catch (e) {}
    };

    checkListeners();
    const interval = setInterval(checkListeners, 2000);
    return () => clearInterval(interval);
  }, []);

  const latestStateRef = useRef(state);
  latestStateRef.current = state;
  const cSyncSequenceRef = useRef(0);
  const cSnapshotKeyRef = useRef("");

  const syncFromC = useCallback(
    async (feedback?: {
      tone: "neutral" | "success" | "warning" | "danger";
      message: string;
    }) => {
      const sequence = ++cSyncSequenceRef.current;
      const snapshot = await loadCBackendState(
        latestStateRef.current.songCatalog,
      );
      if (sequence !== cSyncSequenceRef.current) return;
      const snapshotKey = JSON.stringify(snapshot);
      if (!feedback && snapshotKey === cSnapshotKeyRef.current) return;
      cSnapshotKeyRef.current = snapshotKey;
      dispatch({
        type: "SYNC_C_BACKEND",
        ...snapshot,
        feedback,
        now: Date.now(),
      });
    },
    [],
  );

  const executeC = useCallback(
    async (route: string, body?: Record<string, string | number>) => {
      try {
        const result = await runCBackendCommand(route, body);
        await syncFromC({ tone: "success", message: result.message });
        return true;
      } catch (error) {
        dispatch({
          type: "SET_FEEDBACK",
          feedback: {
            tone: "danger",
            message:
              error instanceof CBackendError
                ? error.message
                : "Không thể kết nối backend C.",
          },
          now: Date.now(),
        });
        return false;
      }
    },
    [syncFromC],
  );

  // C là nguồn sự thật duy nhất. Poll một snapshot gộp để các tab cùng nhìn
  // thấy Heap và CDLL giống nhau mà không tạo chuỗi request rev -> state.
  useEffect(() => {
    let cancelled = false;
    let requestInFlight = false;

    const pollC = async () => {
      if (requestInFlight) return;
      requestInFlight = true;
      try {
        if (!cancelled) await syncFromC();
      } catch {
        // Mutation handlers surface errors. Polling stays quiet while C restarts.
      } finally {
        requestInFlight = false;
      }
    };

    void pollC();
    const interval = setInterval(pollC, 1500);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [syncFromC]);

  const genreOptions = useMemo(
    () => [...new Set(state.songCatalog.map((song) => song.genre))].sort(),
    [state.songCatalog],
  );

  const filteredSongs = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();

    return state.songCatalog.filter((song) => {
      const matchesSearch =
        !normalized ||
        `${song.title} ${song.artist} ${song.album} ${song.genre} ${song.mood}`
          .toLowerCase()
          .includes(normalized);
      const matchesGenre = genreFilter === "all" || song.genre === genreFilter;

      return matchesSearch && matchesGenre;
    });
  }, [genreFilter, searchTerm, state.songCatalog]);

  const studentRequests = useMemo(
    () =>
      rankedQueue.filter(
        (item) =>
          item.requestedBy === normalizedStudentId ||
          item.votesByStudent[normalizedStudentId],
      ),
    [normalizedStudentId, rankedQueue],
  );

  // Only the administrator tab drives the physical room speaker.
  const isAudioAdmin = currentUser?.role === "admin";
  const isAudioAdminRef = useRef(isAudioAdmin);
  isAudioAdminRef.current = isAudioAdmin;

  const handleNext = useCallback(() => {
    void executeC("next");
  }, [executeC]);

  const handlePrevious = useCallback(() => {
    void executeC("previous");
  }, [executeC]);

  const handleTogglePlayback = useCallback(async () => {
    if (!currentSong && state.queue.length > 0) {
      const advanced = await executeC("next");
      if (!advanced) return;
    }
    dispatch({ type: "TOGGLE_PLAY", now: Date.now() });
  }, [currentSong, executeC, state.queue.length]);

  const handleTrackEnded = useCallback(() => {
    void executeC("next");
  }, [executeC]);

  useAudioPlayer(
    isAudioAdmin,
    state.isPlaying,
    currentSong,
    state.volume,
    state.progressSec,
    state.activeRoomName,
    seekTrigger,
    dispatch,
    handleTrackEnded,
  );

  // Reset pagination page to 1 when search query, filter criteria, source tab, or view tab changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, genreFilter, activeTab]);

  // Global keyboard shortcuts. Gated on the same role as the on-screen transport, or a
  // student hitting Space would pause the whole room's speaker.
  useEffect(() => {
    if (!isAudioAdmin) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "SELECT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.getAttribute("contenteditable") === "true")
      ) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        void handleTogglePlayback();
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        handleNext();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        handlePrevious();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNext, handlePrevious, handleTogglePlayback, isAudioAdmin]);

  // localStorage.setItem is synchronous and the snapshot is large, so it must not run on
  // every playhead tick. Progress is coarsened to a 5s bucket; everything else is exact.
  const progressBucket = Math.floor(state.progressSec / 5);
  useEffect(() => {
    const timer = window.setTimeout(
      () => persistAppState(latestStateRef.current),
      400,
    );
    return () => window.clearTimeout(timer);
  }, [
    progressBucket,
    state.activeRoomName,
    state.auditEvents,
    state.currentPlaylistIndex,
    state.isPlaying,
    state.playlistSongs,
    state.queue,
    state.repeatMode,
    state.roomList,
    state.rooms,
    state.songCatalog,
    state.studentSpamStates,
    state.volume,
  ]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const tickNow = Date.now();
      setNow(tickNow);

      if (!isPlayingRef.current) {
        return;
      }

      const song = currentSongRef.current;
      const drivesAudioElement = Boolean(song && isAudioAdminRef.current);

      // The admin's audio element owns the clock. Student tabs follow the shared
      // playhead and use this timer only for smooth local progress between syncs.
      if (!drivesAudioElement) {
        dispatch({
          type: "TICK",
          now: tickNow,
          autoAdvance: isAudioAdminRef.current,
        });
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const handleRequestSong = useCallback(
    (songId: string) => {
      const requesterId = currentUser?.studentId ?? studentId;
      void executeC("request", {
        studentId: requesterId,
        songId: songIdForC(latestStateRef.current.songCatalog, songId),
      });
    },
    [currentUser, executeC, studentId],
  );

  const handleVote = useCallback(
    (requestId: string, vote: VoteValue) => {
      void executeC("vote", {
        studentId,
        requestId: Number(requestId),
        vote,
      });
    },
    [executeC, studentId],
  );

  const handleRoomSelect = useCallback((roomName: string) => {
    dispatch({
      type: "SWITCH_ROOM",
      roomName,
      now: Date.now(),
    });
  }, []);

  const handleVolumeChange = useCallback((val: number) => {
    dispatch({
      type: "SET_VOLUME",
      volume: val,
    });
  }, []);

  const handleToggleRepeat = useCallback(() => {
    dispatch({
      type: "TOGGLE_REPEAT",
    });
  }, []);

  const handleShuffle = useCallback(() => {
    void executeC("shuffle");
  }, [executeC]);

  const handleSeek = useCallback((time: number) => {
    dispatch({ type: "SEEK_SONG", time, now: Date.now() });
    setSeekTrigger((prev) => prev + 1);
  }, []);

  const handleAdminTool = useCallback(
    (action: string) => {
      const nowValue = Date.now();

      if (action === "export") {
        downloadJson(
          `heapbeat-${state.activeRoomName.replace(/\s+/g, "-").toLowerCase()}-${nowValue}.json`,
          {
            room: state.activeRoomName,
            exportedAt: new Date(nowValue).toISOString(),
            nowPlaying: currentSong,
            queue: rankedQueue,
            playlist: state.playlistSongs,
            auditEvents: state.auditEvents,
            spamConfiguration: {
              spamGuardEnabled: state.spamGuardEnabled,
              maxRequests: state.maxRequests,
              blockDurationMs: state.blockDurationMs,
            },
          },
        );
        dispatch({
          type: "SET_FEEDBACK",
          now: nowValue,
          feedback: {
            tone: "success",
            message:
              "Full playback audit logs and session state exported as JSON.",
          },
          auditMessage: "Admin exported full playback audit logs JSON",
        });
        return;
      }

      if (action === "reset") {
        clearPersistedState();
        void executeC("reset");
        setSearchTerm("");
        setRoomSearch("");
        setGenreFilter("all");
        setActiveTab("catalog");
        return;
      }

      if (
        action === "settings" ||
        action === "moderation" ||
        action === "analytics"
      ) {
        dispatch({
          type: "OPEN_ADMIN_PANEL",
          panel: action,
        });
      }
    },
    [
      currentSong,
      rankedQueue,
      state.auditEvents,
      state.playlistSongs,
      state.activeRoomName,
      state.spamGuardEnabled,
      state.maxRequests,
      state.blockDurationMs,
      executeC,
    ],
  );

  if (!currentUser) {
    return <AuthScreen lang={lang} onLoginSuccess={setCurrentUser} />;
  }

  return (
    <main className="app-frame">
      <TitleBar lang={lang} onLangChange={setLang} />
      <div className={`app-shell mobile-tab-${mobileTab}`}>
        <Sidebar
          isPlaying={state.isPlaying}
          latestEvent={state.auditEvents[0]}
          onAdminTool={handleAdminTool}
          onRoomSearchChange={setRoomSearch}
          playlistCount={state.playlistSongs.length}
          queueCount={state.queue.length}
          roomSearch={roomSearch}
          rootItem={rootItem}
          activeRoomName={state.activeRoomName}
          roomList={state.roomList.map((room) => ({
            ...room,
            listeners: activeListenersMap[room.name] || 0,
          }))}
          lang={lang}
          currentUser={currentUser}
          onLogout={() => setCurrentUser(null)}
          onRoomSelect={handleRoomSelect}
          onCreateRoomClick={() => dispatch({ type: "OPEN_CREATE_ROOM" })}
        />

        {state.activeRoomName ? (
          <>
            <div className="main-column">
              <PlayerPanel
                isPlaying={state.isPlaying}
                onNext={handleNext}
                onPrev={handlePrevious}
                onToggle={() => void handleTogglePlayback()}
                progressSec={state.progressSec}
                song={currentSong}
                volume={state.volume}
                repeatMode={state.repeatMode}
                queueCount={state.queue.length}
                lang={lang}
                currentUser={currentUser!}
                onVolumeChange={handleVolumeChange}
                onToggleRepeat={handleToggleRepeat}
                onShuffle={handleShuffle}
                onSeek={handleSeek}
              />

              <QueuePanel
                feedback={state.feedback}
                onRemove={(requestId) =>
                  void executeC("remove", { requestId: Number(requestId) })
                }
                onClear={() => void executeC("clear")}
                onVote={handleVote}
                rankedQueue={rankedQueue}
                rootItem={rootItem}
                currentUser={currentUser!}
                lang={lang}
              />

              <RecentlyPlayed
                currentIndex={state.currentPlaylistIndex}
                lang={lang}
                songs={state.playlistSongs}
              />
            </div>

            <RequestPanel
              activeTab={activeTab}
              filteredSongs={filteredSongs}
              genreFilter={genreFilter}
              genreOptions={genreOptions}
              lang={lang}
              currentPage={currentPage}
              onPageChange={setCurrentPage}
              currentUser={currentUser!}
              onGenreFilterChange={setGenreFilter}
              onRequestSong={handleRequestSong}
              onSearchTermChange={setSearchTerm}
              onTabChange={setActiveTab}
              searchTerm={searchTerm}
              studentRequests={studentRequests}
            />
          </>
        ) : (
          <div className="no-room-overlay">
            <div className="no-room-card">
              <div className="no-room-mark">
                <Icon name="activity" />
              </div>
              <h2>HeapBeat</h2>
              <p>
                {currentUser.role === "admin"
                  ? lang === "vi"
                    ? "Chào mừng bạn đến với hệ thống phát nhạc phòng tự học cộng đồng! Hiện tại chưa có phòng học nào được mở."
                    : "Welcome to the community study room playlist system! No active rooms are currently loaded."
                  : lang === "vi"
                    ? "Chào mừng bạn đến với hệ thống phát nhạc phòng tự học cộng đồng! Hiện tại chưa có phòng học nào được mở, vui lòng đợi quản trị viên kích hoạt phòng."
                    : "Welcome to the community study room playlist system! No active rooms are currently open, please wait for an administrator to activate a study room."}
              </p>
              {currentUser.role === "admin" && (
                <button
                  className="no-room-action"
                  onClick={() => dispatch({ type: "OPEN_CREATE_ROOM" })}
                  type="button"
                >
                  {lang === "vi"
                    ? "Tạo phòng học đầu tiên"
                    : "Create first study room"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Admin Panel Modal Dialogs */}
      {state.activeAdminPanel === "settings" && (
        <SettingsModal
          settings={{
            spamGuardEnabled: state.spamGuardEnabled,
            maxRequests: state.maxRequests,
            blockDurationMs: state.blockDurationMs,
            strictLicenseGate: state.strictLicenseGate,
          }}
          lang={lang}
          onClose={() => dispatch({ type: "CLOSE_ADMIN_PANEL" })}
          onSave={(updatedSettings) => {
            dispatch({
              type: "UPDATE_ROOM_SETTINGS",
              settings: updatedSettings,
              now: Date.now(),
            });
            dispatch({ type: "CLOSE_ADMIN_PANEL" });
          }}
        />
      )}

      {state.activeAdminPanel === "moderation" && (
        <ModerationModal
          songCatalog={state.songCatalog}
          studentSpamStates={state.studentSpamStates}
          now={now}
          lang={lang}
          onClose={() => dispatch({ type: "CLOSE_ADMIN_PANEL" })}
          onApproveSong={(songId) =>
            dispatch({ type: "APPROVE_SONG", songId, now: Date.now() })
          }
          onRejectSong={(songId) =>
            dispatch({ type: "REJECT_SONG", songId, now: Date.now() })
          }
          onForceUnblock={(studentHash) =>
            dispatch({
              type: "FORCE_UNBLOCK_STUDENT",
              studentHash,
              now: Date.now(),
            })
          }
        />
      )}

      {state.activeAdminPanel === "analytics" && (
        <AnalyticsModal
          queue={state.queue}
          playlistSongs={state.playlistSongs}
          studentSpamStates={state.studentSpamStates}
          lang={lang}
          onClose={() => dispatch({ type: "CLOSE_ADMIN_PANEL" })}
        />
      )}

      {state.isCreateRoomOpen && (
        <CreateRoomModal
          onClose={() => dispatch({ type: "CLOSE_CREATE_ROOM" })}
          lang={lang}
          onCreate={(name, code, listeners) =>
            dispatch({
              type: "CREATE_ROOM",
              name,
              code,
              listeners,
              now: Date.now(),
            })
          }
        />
      )}
      {/* Mobile Bottom Navigation Bar */}
      <nav className="mobile-nav">
        <button
          className={`mobile-nav-item ${mobileTab === "rooms" ? "active" : ""}`}
          onClick={() => setMobileTab("rooms")}
          type="button"
        >
          <Icon name="users" />
          <span>{lang === "vi" ? "Phòng học" : "Rooms"}</span>
        </button>
        <button
          className={`mobile-nav-item ${mobileTab === "player" ? "active" : ""}`}
          onClick={() => setMobileTab("player")}
          type="button"
        >
          <Icon name="activity" />
          <span>{lang === "vi" ? "Đang phát" : "Player"}</span>
        </button>
        <button
          className={`mobile-nav-item ${mobileTab === "request" ? "active" : ""}`}
          onClick={() => setMobileTab("request")}
          type="button"
        >
          <Icon name="search" />
          <span>{lang === "vi" ? "Tìm nhạc" : "Request"}</span>
        </button>
      </nav>
    </main>
  );
}
