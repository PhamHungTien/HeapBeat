import {
  TRANSLATIONS,
  formatLicenseLabel,
  getStudentName,
  type Feedback,
} from "../app/model";
import {
  formatClock,
  formatDuration,
  maskStudentId,
  normalizeStudentId,
  type QueueItem,
  type Song,
  type UserAccount,
  type VoteValue,
} from "../lib/heapbeat";
import { CoverArt, Icon, IconButton } from "./primitives";

function VisualizerBars({ isPlaying }: { isPlaying: boolean }) {
  return (
    <div className={`visualizer-bars ${isPlaying ? "playing" : ""}`}>
      <span className="bar" />
      <span className="bar" />
      <span className="bar" />
      <span className="bar" />
      <span className="bar" />
      <span className="bar" />
      <span className="bar" />
      <span className="bar" />
      <span className="bar" />
      <span className="bar" />
      <span className="bar" />
      <span className="bar" />
    </div>
  );
}

function localizeFeedback(message: string, lang: "vi" | "en") {
  if (lang === "en") {
    return message;
  }

  const exact: Record<string, string> = {
    "Queue is already empty.": "Hàng đợi đã trống.",
    "Queue and playlist are empty.": "Hàng đợi và lịch sử phát đều đang trống.",
    "Playlist is empty.": "Chưa có bài nào trong lịch sử phát.",
    "Playback stopped. Queue is empty.": "Đã dừng phát vì hàng đợi đang trống.",
    "Request a song before starting playback.":
      "Hãy yêu cầu một bài hát trước khi bắt đầu phát.",
    "Request already gone.": "Yêu cầu này đã được xóa trước đó.",
    "Request evicted from queue.": "Yêu cầu không còn trong hàng đợi.",
    "Vote already registered.": "Lượt bình chọn này đã được ghi nhận.",
    "Queue needs at least 2 tracks to shuffle.":
      "Cần ít nhất 2 bài trong hàng đợi để trộn thứ tự.",
    "Room settings updated successfully.": "Đã cập nhật cấu hình phòng.",
  };

  if (exact[message]) {
    return exact[message];
  }

  const patterns: Array<[RegExp, (...parts: string[]) => string]> = [
    [
      /^Cleared (\d+) request\(s\) from the queue\.$/,
      (count) => `Đã xóa ${count} bài khỏi hàng đợi.`,
    ],
    [/^Switched session to (.+)\.$/, (room) => `Đã chuyển sang phòng ${room}.`],
    [
      /^Admin removed "(.+)" from heap\.$/,
      (title) => `Quản trị viên đã xóa "${title}" khỏi Max-Heap.`,
    ],
    [/^Admin evicted "(.+)"\.$/, (title) => `Quản trị viên đã xóa "${title}".`],
    [
      /^Heap adjusted: "(.+)" score is now (-?\d+)\.$/,
      (title, score) =>
        `Max-Heap đã cân bằng lại: "${title}" hiện có ${score} điểm.`,
    ],
    [/^Previous track: (.+)$/, (title) => `Bài trước đó: ${title}`],
    [/^Repeat playlist: (.+)$/, (title) => `Lặp playlist: ${title}`],
    [/^Auto repeat: (.+)$/, (title) => `Tự động lặp playlist: ${title}`],
    [
      /^(.+) popped from Max-Heap queue to player\.$/,
      (title) => `"${title}" đã được lấy từ gốc Max-Heap để phát.`,
    ],
    [
      /^Audio file unavailable: (.+)\.$/,
      (title) => `Không thể tải tệp nhạc của "${title}".`,
    ],
  ];

  for (const [pattern, translate] of patterns) {
    const match = message.match(pattern);
    if (match) {
      return translate(...match.slice(1));
    }
  }

  return message;
}

export function PlayerPanel({
  song,
  progressSec,
  isPlaying,
  volume,
  repeatMode,
  queueCount,
  lang,
  currentUser,
  onToggle,
  onNext,
  onPrev,
  onVolumeChange,
  onToggleRepeat,
  onShuffle,
  onSeek,
}: {
  song: Song | null;
  progressSec: number;
  isPlaying: boolean;
  volume: number;
  repeatMode: "all" | "one" | "off";
  queueCount: number;
  lang: "vi" | "en";
  currentUser: UserAccount;
  onToggle: () => void;
  onNext: () => void;
  onPrev: () => void;
  onVolumeChange: (val: number) => void;
  onToggleRepeat: () => void;
  onShuffle: () => void;
  onSeek: (seconds: number) => void;
}) {
  const t = TRANSLATIONS[lang];
  const progressPercent = song
    ? Math.min(100, (progressSec / song.durationSec) * 100)
    : 0;
  const isAudioAdmin = currentUser?.role === "admin";

  return (
    <section className="player-panel">
      <div
        className="panel-heading"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            flexWrap: "wrap",
          }}
        >
          {t.nowPlaying}
          {isPlaying && (
            <span
              className="pulse-badge"
              style={{
                fontSize: "0.7rem",
                padding: "0.2rem 0.55rem",
                background: isAudioAdmin
                  ? "rgba(8, 127, 120, 0.12)"
                  : "rgba(16, 185, 129, 0.12)",
                color: isAudioAdmin ? "#087f78" : "#10b981",
                borderRadius: "999px",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: "0.3rem",
              }}
            >
              <Icon name={isAudioAdmin ? "radio" : "volume"} />
              {isAudioAdmin
                ? lang === "vi"
                  ? "Đang phát từ Heap Root"
                  : "Broadcasting from Heap Root"
                : lang === "vi"
                  ? "Đang nghe loa phòng học"
                  : "Listening on Room Speaker"}
            </span>
          )}
        </span>
        <VisualizerBars isPlaying={isPlaying} />
      </div>

      <div className="player-grid">
        <CoverArt song={song} isPlaying={isPlaying} />

        <div className="track-copy">
          <h2>
            {song?.title ?? (lang === "vi" ? "Chưa có nhạc" : "No music")}
          </h2>
          <p>
            {song?.artist ??
              (lang === "vi"
                ? "Hàng đợi đang trống. Hãy yêu cầu bài hát để bắt đầu phát."
                : "Queue is empty. Request a track to start playback.")}
          </p>
          <em>
            {song?.album ??
              (lang === "vi"
                ? "Đang chờ sinh viên gửi yêu cầu bài hát..."
                : "Waiting for student song requests...")}
          </em>

          <div className="progress-block">
            <div className="progress-times">
              <span>{formatDuration(progressSec)}</span>
              <span>{song ? formatDuration(song.durationSec) : "0:00"}</span>
            </div>
            <div className="progress-slider-wrapper">
              {isAudioAdmin ? (
                <input
                  type="range"
                  min="0"
                  max={song ? song.durationSec : 100}
                  value={progressSec}
                  onChange={(e) => onSeek(Number(e.target.value))}
                  disabled={!song}
                  className="progress-slider"
                  style={{
                    background: `linear-gradient(to right, #087f78 0%, #087f78 ${progressPercent}%, #dbe3df ${progressPercent}%, #dbe3df 100%)`,
                  }}
                />
              ) : (
                <div
                  className="progress-track-static"
                  aria-hidden="true"
                  style={{
                    background: "#dbe3df",
                    height: "0.36rem",
                    width: "100%",
                    borderRadius: "999px",
                    overflow: "hidden",
                    position: "relative",
                    marginTop: "0.4rem",
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      background: "#087f78",
                      height: "100%",
                      width: `${progressPercent}%`,
                      transition: "width 0.2s ease",
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {isAudioAdmin && (
            <div className="transport-controls">
              <IconButton
                icon="shuffle"
                label={t.shuffle}
                onClick={onShuffle}
                variant={repeatMode !== "off" ? "selected" : "ghost"}
                disabled={queueCount < 2}
              />
              <IconButton
                icon="prev"
                label={lang === "vi" ? "Bài trước đó" : "Previous track"}
                onClick={onPrev}
                disabled={!song}
              />
              <IconButton
                icon={isPlaying ? "pause" : "play"}
                label={
                  isPlaying
                    ? lang === "vi"
                      ? "Tạm dừng"
                      : "Pause"
                    : lang === "vi"
                      ? "Phát"
                      : "Play"
                }
                onClick={onToggle}
                variant="primary"
                disabled={!song && queueCount === 0}
              />
              <IconButton
                icon="next"
                label={lang === "vi" ? "Bài tiếp theo" : "Next track"}
                onClick={onNext}
                disabled={!song && queueCount === 0}
              />
              <IconButton
                icon="repeat"
                label={`${t.repeatMode}: ${repeatMode}`}
                onClick={onToggleRepeat}
                variant={repeatMode !== "off" ? "selected" : "ghost"}
              />
              <span className="repeat-badge-label">
                {repeatMode.toUpperCase()}
              </span>
            </div>
          )}
        </div>

        <div className="player-side">
          <div className={`license-card ${song ? "" : "empty"}`}>
            <div className="license-title">
              <Icon
                name={
                  !song
                    ? "music"
                    : song.approvalStatus === "approved"
                      ? "shield"
                      : "lock"
                }
              />
              <strong>
                {!song
                  ? lang === "vi"
                    ? "Chưa có bài đang phát"
                    : "No active track"
                  : song.approvalStatus === "approved"
                    ? lang === "vi"
                      ? "Đã duyệt cho demo"
                      : "Approved for demo"
                    : lang === "vi"
                      ? "Chờ duyệt bản quyền"
                      : "License pending"}
              </strong>
            </div>
            <dl>
              <div>
                <dt>{t.license}</dt>
                <dd>{song ? formatLicenseLabel(song.licenseType) : "—"}</dd>
              </div>
              <div>
                <dt>{lang === "vi" ? "Tác giả" : "Attribution"}</dt>
                <dd>{song?.artist ?? "—"}</dd>
              </div>
              <div>
                <dt>{lang === "vi" ? "Nguồn cấp" : "Source"}</dt>
                <dd>{song?.sourceProvider.replace("_", " ") ?? "—"}</dd>
              </div>
            </dl>
            {song ? (
              <a href={song.licenseUrl} rel="noreferrer" target="_blank">
                {lang === "vi"
                  ? "Xem chi tiết bản quyền"
                  : "View license details"}{" "}
                <Icon name="external" />
              </a>
            ) : null}
          </div>

          {isAudioAdmin && (
            <div className="volume-control">
              <Icon name="volume" />
              <input
                aria-label={t.volume}
                value={volume}
                onChange={(e) => onVolumeChange(Number(e.target.value))}
                max={100}
                min={0}
                type="range"
              />
              <span className="volume-percentage">{volume}%</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export function QueuePanel({
  rankedQueue,
  currentUser,
  rootItem,
  feedback,
  lang,
  onVote,
  onRemove,
  onClear,
}: {
  rankedQueue: QueueItem[];
  currentUser: UserAccount;
  rootItem: QueueItem | null;
  feedback: Feedback;
  lang: "vi" | "en";
  onVote: (requestId: string, vote: VoteValue) => void;
  onRemove: (requestId: string) => void;
  onClear: () => void;
}) {
  const t = TRANSLATIONS[lang];
  const isUserAdmin = currentUser?.role === "admin";
  const studentHash = isUserAdmin
    ? "admin"
    : normalizeStudentId(currentUser?.studentId || "");

  // Translate tip messages if they match default tips
  let translatedMsg = localizeFeedback(feedback.message, lang);
  if (
    feedback.message ===
    "Tip: Upvote to move a track higher. Downvote to move lower."
  ) {
    translatedMsg = t.tipUpvote;
  }

  return (
    <section className="queue-panel">
      <div className="queue-heading">
        <h2>
          {lang === "vi"
            ? "Hàng đợi Ưu tiên Max-Heap"
            : "Heap Priorities Queue"}{" "}
          ({rankedQueue.length})
        </h2>
        {isUserAdmin && rankedQueue.length > 0 ? (
          <button
            className="queue-clear-button"
            onClick={onClear}
            type="button"
          >
            <Icon name="trash" />
            <span>{lang === "vi" ? "Xóa hàng đợi" : "Clear queue"}</span>
          </button>
        ) : null}
      </div>
      <div className="queue-table" role="table" aria-label="Community queue">
        <div className="queue-header" role="row">
          <span>#</span>
          <span>{t.track}</span>
          <span>{t.artist}</span>
          <span>{lang === "vi" ? "Yêu cầu bởi" : "Added by"}</span>
          <span>{lang === "vi" ? "Điểm số" : "Score"}</span>
          <span>{lang === "vi" ? "Thời gian" : "Added"}</span>
          <span>{lang === "vi" ? "Quản trị" : "Admin"}</span>
        </div>

        {rankedQueue.map((item, index) => {
          const currentVote = item.votesByStudent[studentHash] ?? 0;
          const isRoot = rootItem?.requestId === item.requestId;
          const isMyRequest =
            !isUserAdmin && item.requestedBy === currentUser?.studentId;
          const canRemove = isUserAdmin || isMyRequest;

          return (
            <article
              className={`queue-row ${isRoot ? "root" : ""}`}
              key={item.requestId}
              role="row"
            >
              <div className="rank-cell">
                <span>{index + 1}</span>
                {isRoot ? <Icon name="play" /> : null}
              </div>
              <div className="queue-track">
                <strong>{item.song.title}</strong>
                <small className="queue-track-meta">
                  <span>{item.song.artist}</span>
                  <span aria-hidden="true">•</span>
                  <span>{item.song.album}</span>
                </small>
              </div>
              <div className="queue-artist">{item.song.artist}</div>
              <div className="queue-added-by">
                {maskStudentId(item.requestedBy)}
                {isMyRequest && (
                  <span
                    style={{
                      fontSize: "0.68rem",
                      marginLeft: "0.4rem",
                      padding: "0.12rem 0.4rem",
                      background: "rgba(8, 127, 120, 0.12)",
                      color: "#087f78",
                      borderRadius: "4px",
                      fontWeight: 700,
                    }}
                  >
                    {lang === "vi" ? "Bạn" : "You"}
                  </span>
                )}
                {isUserAdmin && item.requestedBy === "admin" && (
                  <span
                    style={{
                      fontSize: "0.68rem",
                      marginLeft: "0.4rem",
                      padding: "0.12rem 0.4rem",
                      background: "rgba(8, 127, 120, 0.12)",
                      color: "#087f78",
                      borderRadius: "4px",
                      fontWeight: 700,
                    }}
                  >
                    Admin
                  </span>
                )}
              </div>
              <div className="score-cell">
                {isUserAdmin ? (
                  <div
                    className="admin-score-container"
                    style={{
                      position: "relative",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.25rem",
                      cursor: "help",
                    }}
                  >
                    <strong style={{ fontSize: "1.1rem" }}>{item.score}</strong>
                    <Icon name="info" />
                    <div className="vote-details-tooltip">
                      <div className="tooltip-section up">
                        <span className="tooltip-header-badge up">
                          {lang === "vi" ? "Lượt Tăng" : "Upvotes"}
                        </span>
                        <ul>
                          {Object.entries(item.votesByStudent)
                            .filter(([_, val]) => val === 1)
                            .map(([hash]) => (
                              <li key={hash} title={getStudentName(hash, lang)}>
                                {getStudentName(hash, lang)}
                              </li>
                            ))}
                          {Object.entries(item.votesByStudent).filter(
                            ([_, val]) => val === 1,
                          ).length === 0 && <li>None</li>}
                        </ul>
                      </div>
                      <div
                        className="tooltip-section down"
                        style={{ marginTop: "0.5rem" }}
                      >
                        <span className="tooltip-header-badge down">
                          {lang === "vi" ? "Lượt Giảm" : "Downvotes"}
                        </span>
                        <ul>
                          {Object.entries(item.votesByStudent)
                            .filter(([_, val]) => val === -1)
                            .map(([hash]) => (
                              <li key={hash} title={getStudentName(hash, lang)}>
                                {getStudentName(hash, lang)}
                              </li>
                            ))}
                          {Object.entries(item.votesByStudent).filter(
                            ([_, val]) => val === -1,
                          ).length === 0 && <li>None</li>}
                        </ul>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <IconButton
                      icon="up"
                      label={
                        lang === "vi"
                          ? `Bỏ phiếu tăng ${item.song.title}`
                          : `Upvote ${item.song.title}`
                      }
                      onClick={() => onVote(item.requestId, 1)}
                      variant={currentVote === 1 ? "selected" : "ghost"}
                    />
                    <strong>{item.score}</strong>
                    <IconButton
                      icon="down"
                      label={
                        lang === "vi"
                          ? `Bỏ phiếu giảm ${item.song.title}`
                          : `Downvote ${item.song.title}`
                      }
                      onClick={() => onVote(item.requestId, -1)}
                      variant={currentVote === -1 ? "selected" : "ghost"}
                    />
                  </>
                )}
              </div>
              <time className="queue-time">
                {formatClock(item.requestedAt)}
              </time>
              <div className="queue-admin-cell">
                {canRemove ? (
                  <IconButton
                    icon="trash"
                    label={
                      lang === "vi"
                        ? `Xóa ${item.song.title}`
                        : `Remove ${item.song.title}`
                    }
                    onClick={() => onRemove(item.requestId)}
                    variant="danger"
                  />
                ) : (
                  <span style={{ color: "#bdc7c3", fontSize: "0.75rem" }}>
                    —
                  </span>
                )}
              </div>
            </article>
          );
        })}

        {rankedQueue.length === 0 ? (
          <div className="empty-state">
            {lang === "vi"
              ? "Hàng đợi đang trống. Các bài hát yêu cầu của sinh viên sẽ hiển thị ở đây."
              : "Queue is empty. Student requests will appear here."}
          </div>
        ) : null}
      </div>
      <div className={`queue-tip ${feedback.tone}`}>{translatedMsg}</div>
    </section>
  );
}

export function RecentlyPlayed({
  songs,
  currentIndex,
  lang,
}: {
  songs: Song[];
  currentIndex: number | null;
  lang: "vi" | "en";
}) {
  const t = TRANSLATIONS[lang];
  const recentlyPlayed = songs
    .filter((_, index) => index !== currentIndex)
    .slice(0, 5);
  const visibleSongs = recentlyPlayed;

  return (
    <section className="recent-panel">
      <div className="recent-heading">
        <h2>{t.recentlyPlayed}</h2>
      </div>
      <div className="recent-list">
        {visibleSongs.map((song, index) => (
          <article className="recent-item" key={`${song.id}-${index}`}>
            <CoverArt compact song={song} />
            <div>
              <strong>{song.title}</strong>
              <span>{song.artist}</span>
              <time>{formatDuration(song.durationSec)}</time>
              <small>
                <Icon name="shield" />
              </small>
            </div>
          </article>
        ))}
        {visibleSongs.length === 0 ? (
          <div className="empty-state recent-empty">
            <Icon name="music" />
            <span>
              {lang === "vi"
                ? "Chưa có lịch sử phát. Bài đầu tiên sẽ xuất hiện sau khi được lấy khỏi Max-Heap."
                : "No playback history yet. The first extracted heap item will appear here."}
            </span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
