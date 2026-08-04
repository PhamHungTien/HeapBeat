import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ACCOUNTS_KEY,
  DEFAULT_ACCOUNTS,
  TRANSLATIONS,
  readableBlockReason,
  saveAccounts,
} from "../app/model";
import {
  formatClock,
  formatRemaining,
  type QueueItem,
  type Song,
  type StudentSpamSnapshot,
  type UserAccount,
} from "../lib/heapbeat";
import { Icon } from "./primitives";

export function TitleBar({
  lang,
  onLangChange,
}: {
  lang: "vi" | "en";
  onLangChange: (lang: "vi" | "en") => void;
}) {
  return (
    <header className="titlebar">
      <div className="titlebar-brand">
        <div className="titlebar-mark">
          <Icon name="music" />
        </div>
        <div className="titlebar-copy">
          <strong>HeapBeat</strong>
          <span>
            {lang === "vi"
              ? "Phát nhạc cộng đồng cho phòng tự học"
              : "Community music for study rooms"}
          </span>
        </div>
      </div>
      <div className="titlebar-actions">
        <div className="language-switcher-tabs" aria-label="Language">
          <button
            onClick={() => onLangChange("vi")}
            className={lang === "vi" ? "active" : ""}
            aria-pressed={lang === "vi"}
            type="button"
          >
            VI
          </button>
          <button
            onClick={() => onLangChange("en")}
            className={lang === "en" ? "active" : ""}
            aria-pressed={lang === "en"}
            type="button"
          >
            EN
          </button>
        </div>
        <span className="web-app-badge">
          <Icon name="globe" />
          <span>{lang === "vi" ? "Web/PWA" : "Web/PWA"}</span>
        </span>
      </div>
    </header>
  );
}

export function SettingsModal({
  settings,
  lang,
  onClose,
  onSave,
}: {
  settings: {
    spamGuardEnabled: boolean;
    maxRequests: number;
    blockDurationMs: number;
    strictLicenseGate: boolean;
  };
  lang: "vi" | "en";
  onClose: () => void;
  onSave: (settings: {
    spamGuardEnabled: boolean;
    maxRequests: number;
    blockDurationMs: number;
    strictLicenseGate: boolean;
  }) => void;
}) {
  const t = TRANSLATIONS[lang];
  const [spamGuardEnabled, setSpamGuardEnabled] = useState(
    settings.spamGuardEnabled,
  );
  const [maxRequests, setMaxRequests] = useState(settings.maxRequests);
  const [blockDurationMs, setBlockDurationMs] = useState(
    settings.blockDurationMs,
  );
  const [strictLicenseGate, setStrictLicenseGate] = useState(
    settings.strictLicenseGate,
  );

  return (
    <div className="admin-modal-overlay">
      <div className="admin-modal-card">
        <div className="modal-header">
          <h3>{t.settingsTitle}</h3>
          <button
            onClick={onClose}
            aria-label={
              lang === "vi" ? "Đóng cài đặt" : "Close settings dialog"
            }
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="modal-body">
          <div className="settings-field">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={spamGuardEnabled}
                onChange={(e) => setSpamGuardEnabled(e.target.checked)}
              />
              <span>{t.antiSpamEnable}</span>
            </label>
            <p className="field-desc">{t.antiSpamDesc}</p>
          </div>

          <div
            className="settings-field"
            style={{ opacity: spamGuardEnabled ? 1 : 0.5 }}
          >
            <label>
              {lang === "vi"
                ? "Giới hạn yêu cầu trong 10 phút:"
                : "Max requests per 10 mins:"}
            </label>
            <select
              disabled={!spamGuardEnabled}
              value={maxRequests}
              onChange={(e) => setMaxRequests(Number(e.target.value))}
            >
              <option value={2}>
                {lang === "vi"
                  ? "2 yêu cầu (Nghiêm ngặt)"
                  : "2 requests (Strict)"}
              </option>
              <option value={3}>
                {lang === "vi"
                  ? "3 yêu cầu (Mặc định)"
                  : "3 requests (Default)"}
              </option>
              <option value={5}>
                {lang === "vi"
                  ? "5 yêu cầu (Nới lỏng)"
                  : "5 requests (Relaxed)"}
              </option>
              <option value={10}>10 {t.maxReqOption}</option>
            </select>
          </div>

          <div
            className="settings-field"
            style={{ opacity: spamGuardEnabled ? 1 : 0.5 }}
          >
            <label>{t.blockDurationLabel}</label>
            <select
              disabled={!spamGuardEnabled}
              value={blockDurationMs}
              onChange={(e) => setBlockDurationMs(Number(e.target.value))}
            >
              <option value={30 * 1000}>{t.secQuickTest}</option>
              <option value={5 * 60 * 1000}>
                5 {lang === "vi" ? "Phút" : "Minutes"}
              </option>
              <option value={10 * 60 * 1000}>
                10 {lang === "vi" ? "Phút" : "Minutes"}
              </option>
              <option value={30 * 60 * 1000}>{t.minStandard}</option>
            </select>
          </div>

          <div className="settings-field">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={strictLicenseGate}
                onChange={(e) => setStrictLicenseGate(e.target.checked)}
              />
              <span>{t.strictLicenseGate}</span>
            </label>
            <p className="field-desc">{t.strictLicenseGateDesc}</p>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            {t.cancel}
          </button>
          <button
            className="btn-primary"
            onClick={() =>
              onSave({
                spamGuardEnabled,
                maxRequests,
                blockDurationMs,
                strictLicenseGate,
              })
            }
          >
            {t.saveConfig}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ModerationModal({
  songCatalog,
  studentSpamStates,
  now,
  lang,
  onClose,
  onApproveSong,
  onRejectSong,
  onForceUnblock,
}: {
  songCatalog: Song[];
  studentSpamStates: Record<string, StudentSpamSnapshot>;
  now: number;
  lang: "vi" | "en";
  onClose: () => void;
  onApproveSong: (id: string) => void;
  onRejectSong: (id: string) => void;
  onForceUnblock: (hash: string) => void;
}) {
  const t = TRANSLATIONS[lang];
  const [activeTab, setActiveTab] = useState<"moderation" | "students">(
    "moderation",
  );

  // Load registered user accounts state from localStorage
  const [accounts, setAccounts] = useState<UserAccount[]>(() => {
    try {
      const cached = localStorage.getItem(ACCOUNTS_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const handleDeleteAccount = (studentId: string) => {
    if (studentId === "admin") {
      alert(
        lang === "vi"
          ? "Không thể xóa tài khoản Quản trị mặc định!"
          : "Cannot delete default Admin account!",
      );
      return;
    }
    if (
      window.confirm(
        lang === "vi"
          ? `Bạn có chắc chắn muốn xóa tài khoản ${studentId}?`
          : `Are you sure you want to delete account ${studentId}?`,
      )
    ) {
      const updated = accounts.filter((acc) => acc.studentId !== studentId);
      setAccounts(updated);
      saveAccounts(updated);
    }
  };

  const pendingSongs = songCatalog.filter(
    (song) => song.approvalStatus !== "approved",
  );
  const blockedStudents = Object.values(studentSpamStates).filter(
    (student) => student.blockedUntil && student.blockedUntil > now,
  );

  return (
    <div className="admin-modal-overlay">
      <div className="admin-modal-card wide">
        <div className="modal-header">
          <h3>{t.moderationDesk}</h3>
          <button
            onClick={onClose}
            aria-label={
              lang === "vi" ? "Đóng kiểm duyệt" : "Close moderation dialog"
            }
          >
            <Icon name="close" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div
          className="modal-tabs"
          style={{
            display: "flex",
            gap: "1.5rem",
            marginBottom: "1.2rem",
            borderBottom: "1px solid rgba(0,0,0,0.08)",
            paddingBottom: "0.2rem",
          }}
        >
          <button
            style={{
              background: "none",
              border: "none",
              fontSize: "0.95rem",
              fontWeight: activeTab === "moderation" ? "700" : "500",
              color: activeTab === "moderation" ? "#087f78" : "#4f5f5a",
              borderBottom:
                activeTab === "moderation" ? "3px solid #087f78" : "none",
              paddingBottom: "0.6rem",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            onClick={() => setActiveTab("moderation")}
          >
            {lang === "vi" ? "Kiểm duyệt & Chống Spam" : "Moderation & Spam"}
          </button>
          <button
            style={{
              background: "none",
              border: "none",
              fontSize: "0.95rem",
              fontWeight: activeTab === "students" ? "700" : "500",
              color: activeTab === "students" ? "#087f78" : "#4f5f5a",
              borderBottom:
                activeTab === "students" ? "3px solid #087f78" : "none",
              paddingBottom: "0.6rem",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            onClick={() => setActiveTab("students")}
          >
            {lang === "vi" ? "Quản lý Sinh viên" : "Student Accounts"}
          </button>
        </div>

        {activeTab === "moderation" ? (
          <div className="modal-body inline-grid-2">
            {/* Section 1: Copyright review */}
            <div className="moderation-pane">
              <h4>{t.copyrightApprovals}</h4>
              <div className="moderation-scroll-box">
                {pendingSongs.map((song) => (
                  <article key={song.id} className="moderation-item-row">
                    <div className="mod-song-details">
                      <strong>{song.title}</strong>
                      <small>
                        {song.artist} ({song.licenseType})
                      </small>
                      <span className={`status-badge ${song.approvalStatus}`}>
                        {song.approvalStatus === "pending_license_review"
                          ? lang === "vi"
                            ? "Chờ duyệt"
                            : "Pending"
                          : lang === "vi"
                            ? "Từ chối"
                            : "Rejected"}
                      </span>
                    </div>
                    <div className="mod-actions">
                      <button
                        className="btn-mini-success"
                        onClick={() => onApproveSong(song.id)}
                      >
                        {t.approve}
                      </button>
                      {song.approvalStatus !== "rejected" && (
                        <button
                          className="btn-mini-danger"
                          onClick={() => onRejectSong(song.id)}
                        >
                          {t.reject}
                        </button>
                      )}
                    </div>
                  </article>
                ))}
                {pendingSongs.length === 0 && (
                  <div className="mod-empty-text">{t.noPendingTracks}</div>
                )}
              </div>
            </div>

            {/* Section 2: Rate limit blocks */}
            <div className="moderation-pane">
              <h4>{t.blockedStudents}</h4>
              <div className="moderation-scroll-box">
                {blockedStudents.map((student) => (
                  <article
                    key={student.studentHash}
                    className="moderation-item-row"
                  >
                    <div className="mod-student-details">
                      <strong>ID: {student.studentHash}</strong>
                      <small>
                        {t.reason}:{" "}
                        {student.blockReason
                          ? readableBlockReason(student.blockReason, lang)
                          : lang === "vi"
                            ? "Spam"
                            : "Spamming"}
                      </small>
                      <time>
                        {t.until}: {formatClock(student.blockedUntil || 0)} (
                        {formatRemaining(student.blockedUntil || 0, now)}{" "}
                        {t.left})
                      </time>
                    </div>
                    <div className="mod-actions">
                      <button
                        className="btn-mini-success"
                        onClick={() => onForceUnblock(student.studentHash)}
                      >
                        {t.unblock}
                      </button>
                    </div>
                  </article>
                ))}
                {blockedStudents.length === 0 && (
                  <div className="mod-empty-text">{t.noActiveBlocks}</div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="modal-body" style={{ display: "block" }}>
            <div className="moderation-pane" style={{ width: "100%" }}>
              <h4>
                {lang === "vi"
                  ? "Danh sách Tài khoản Sinh viên đăng ký"
                  : "Registered Student Accounts"}
              </h4>
              <div
                className="moderation-scroll-box"
                style={{ maxHeight: "350px", overflowY: "auto" }}
              >
                {accounts.map((student) => (
                  <article
                    key={student.studentId}
                    className="moderation-item-row"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "0.75rem 0.5rem",
                      borderBottom: "1px solid #f1f5f3",
                    }}
                  >
                    <div
                      className="mod-student-details"
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.2rem",
                      }}
                    >
                      <strong>
                        {student.name} ({student.studentId})
                      </strong>
                      <small style={{ color: "#6b7d77" }}>
                        {lang === "vi"
                          ? `Vai trò: ${student.role === "admin" ? "Quản trị" : "Sinh viên"}`
                          : `Role: ${student.role}`}
                      </small>
                    </div>
                    <div className="mod-actions">
                      <button
                        className="btn-mini-danger"
                        style={{
                          padding: "0.35rem 0.75rem",
                          background:
                            student.studentId === "admin"
                              ? "#cbd5e1"
                              : "#ef4444",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: "4px",
                          fontSize: "0.78rem",
                          fontWeight: "600",
                          cursor:
                            student.studentId === "admin"
                              ? "not-allowed"
                              : "pointer",
                        }}
                        onClick={() => handleDeleteAccount(student.studentId)}
                        disabled={student.studentId === "admin"}
                      >
                        {lang === "vi" ? "Xóa tài khoản" : "Delete Account"}
                      </button>
                    </div>
                  </article>
                ))}
                {accounts.length === 0 && (
                  <div className="mod-empty-text">
                    {lang === "vi"
                      ? "Chưa có tài khoản nào được tạo."
                      : "No accounts registered."}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            {t.closePanel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AnalyticsModal({
  queue,
  playlistSongs,
  studentSpamStates,
  lang,
  onClose,
}: {
  queue: QueueItem[];
  playlistSongs: Song[];
  studentSpamStates: Record<string, StudentSpamSnapshot>;
  lang: "vi" | "en";
  onClose: () => void;
}) {
  const t = TRANSLATIONS[lang];
  // 1. Calculate Score distribution
  const scoreCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    queue.forEach((item) => {
      counts[item.score] = (counts[item.score] || 0) + 1;
    });
    return counts;
  }, [queue]);

  // 2. Count genres in playlist
  const genreDistribution = useMemo(() => {
    const dist: Record<string, number> = {};
    playlistSongs.forEach((song) => {
      dist[song.genre] = (dist[song.genre] || 0) + 1;
    });
    return dist;
  }, [playlistSongs]);

  // 3. Count total historical blocks
  const spamCount = useMemo(() => {
    return Object.values(studentSpamStates).reduce(
      (sum, item) => sum + (item.blockCount || 0),
      0,
    );
  }, [studentSpamStates]);

  const maxGenreCount = Math.max(...Object.values(genreDistribution), 1);

  return (
    <div className="admin-modal-overlay">
      <div className="admin-modal-card">
        <div className="modal-header">
          <h3>{t.liveAnalyticsLabel}</h3>
          <button
            onClick={onClose}
            aria-label={
              lang === "vi" ? "Đóng thống kê" : "Close analytics dialog"
            }
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="modal-body">
          <div className="analytics-layout">
            <div className="stats-row">
              <div className="stat-card">
                <strong>{queue.length}</strong>
                <span>{t.tracksWaiting}</span>
              </div>
              <div className="stat-card">
                <strong>{playlistSongs.length}</strong>
                <span>{t.playbackHistory}</span>
              </div>
              <div className="stat-card">
                <strong>{spamCount}</strong>
                <span>{t.blockedIncidents}</span>
              </div>
            </div>

            <div className="chart-section">
              <h4>{t.genreDistHistory}</h4>
              <div className="css-bar-chart">
                {Object.entries(genreDistribution).map(([genre, count]) => {
                  const percent = (count / maxGenreCount) * 100;
                  return (
                    <div className="bar-row" key={genre}>
                      <span className="bar-label">{genre}</span>
                      <div className="bar-container">
                        <span
                          className="bar-fill"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <span className="bar-value">
                        {count} {lang === "vi" ? "bài hát" : "track(s)"}
                      </span>
                    </div>
                  );
                })}
                {Object.keys(genreDistribution).length === 0 && (
                  <div className="chart-empty">{t.noHistory}</div>
                )}
              </div>
            </div>

            <div className="chart-section">
              <h4>{t.queueScores}</h4>
              <div className="score-badge-list">
                {Object.entries(scoreCounts).map(([score, count]) => (
                  <span className="score-badge" key={score}>
                    {lang === "vi"
                      ? `Điểm ${score}: ${count} bài hát`
                      : `Score ${score}: ${count} track(s)`}
                  </span>
                ))}
                {queue.length === 0 && (
                  <div className="chart-empty">{t.queueEmptyScore}</div>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            {t.closePanel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function CreateRoomModal({
  onClose,
  onCreate,
  lang,
}: {
  onClose: () => void;
  onCreate: (name: string, code: string, listeners: number) => void;
  lang: "vi" | "en";
}) {
  const t = TRANSLATIONS[lang];
  const [roomName, setRoomName] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const cleanName = roomName.trim();
    if (!cleanName) {
      setErrorMsg(
        lang === "vi"
          ? "Tên phòng không được để trống!"
          : "Room name cannot be empty!",
      );
      return;
    }
    if (cleanName.length < 3) {
      setErrorMsg(
        lang === "vi"
          ? "Tên phòng phải có ít nhất 3 ký tự!"
          : "Room name must be at least 3 characters!",
      );
      return;
    }
    if (cleanName.length > 25) {
      setErrorMsg(
        lang === "vi"
          ? "Tên phòng không được dài quá 25 ký tự!"
          : "Room name cannot exceed 25 characters!",
      );
      return;
    }

    // Generate random room codes like "E4-3A8T"
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const numbers = "0123456789";
    const prefix =
      alphabet[Math.floor(Math.random() * alphabet.length)] +
      numbers[Math.floor(Math.random() * numbers.length)];
    const suffix = Array.from(
      { length: 4 },
      () =>
        (alphabet + numbers)[
          Math.floor(Math.random() * (alphabet.length + numbers.length))
        ],
    ).join("");
    const generatedCode = `${prefix}-${suffix}`;

    // Simulated listeners online
    const generatedListeners = Math.floor(Math.random() * 10) + 1;

    onCreate(cleanName, generatedCode, generatedListeners);
  };

  return (
    <div className="admin-modal-overlay">
      <div className="admin-modal-card">
        <div className="modal-header">
          <h3>{t.createRoomTitle}</h3>
          <button
            onClick={onClose}
            aria-label={
              lang === "vi" ? "Đóng tạo phòng" : "Close create room dialog"
            }
          >
            <Icon name="close" />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="settings-field">
              <label>{t.roomNameLabel}</label>
              <input
                type="text"
                value={roomName}
                onChange={(e) => {
                  setRoomName(e.target.value);
                  setErrorMsg("");
                }}
                placeholder={t.roomNamePlaceholder}
                autoFocus
              />
              {errorMsg && (
                <p
                  className="error-text"
                  style={{
                    color: "#b91c1c",
                    fontSize: "0.78rem",
                    marginTop: "4px",
                    fontWeight: "bold",
                  }}
                >
                  {errorMsg}
                </p>
              )}
            </div>
            <p className="field-desc" style={{ marginTop: "8px" }}>
              {t.createRoomDesc}
            </p>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              {t.cancel}
            </button>
            <button type="submit" className="btn-primary">
              {t.createRoom}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AuthScreen({
  lang,
  onLoginSuccess,
}: {
  lang: "vi" | "en";
  onLoginSuccess: (user: UserAccount) => void;
}) {
  const t = TRANSLATIONS[lang];
  const [isRegister, setIsRegister] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const role = "student";
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [accounts, setAccounts] = useState<UserAccount[]>([]);

  useEffect(() => {
    try {
      const existing = localStorage.getItem(ACCOUNTS_KEY);
      const localAccounts = existing
        ? (JSON.parse(existing) as UserAccount[])
        : DEFAULT_ACCOUNTS.map((account) => ({ ...account }));
      setAccounts(localAccounts);
      if (!existing) saveAccounts(localAccounts);
    } catch {
      const fallback = DEFAULT_ACCOUNTS.map((account) => ({ ...account }));
      setAccounts(fallback);
      saveAccounts(fallback);
    }
  }, [isRegister]);

  const handleLogin = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const cleanId = studentId.trim();
    if (!cleanId || !password) {
      setError(t.fieldsRequired);
      return;
    }

    const found = accounts.find(
      (acc) =>
        acc.studentId.toLowerCase() === cleanId.toLowerCase() &&
        acc.passwordHash === password,
    );

    if (!found) {
      setError(t.invalidCredentials);
      return;
    }

    onLoginSuccess(found);
  };

  const handleRegister = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const cleanId = studentId.trim();
    const cleanName = name.trim();
    if (!cleanId || !cleanName || !password) {
      setError(t.fieldsRequired);
      return;
    }

    if (password.length < 6) {
      setError(t.pwMinLength);
      return;
    }

    const exists = accounts.some(
      (acc) => acc.studentId.toLowerCase() === cleanId.toLowerCase(),
    );

    if (exists) {
      setError(t.studentIdExists);
      return;
    }

    const newAcc: UserAccount = {
      studentId: cleanId,
      name: cleanName,
      passwordHash: password,
      role: role,
    };

    const updated = [...accounts, newAcc];
    setAccounts(updated);
    saveAccounts(updated);

    setSuccess(t.registerSuccess);

    setTimeout(() => {
      setIsRegister(false);
      setPassword("");
      setSuccess("");
    }, 1500);
  };

  return (
    <div className="auth-overlay">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="brand-mark">
            <Icon name="activity" />
          </div>
          <h2>HeapBeat</h2>
          <p>
            {lang === "vi"
              ? "Đồ án phát nhạc phòng tự học cộng đồng"
              : "Study Room Playlist Manager"}
          </p>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={!isRegister ? "active" : ""}
            onClick={() => {
              setIsRegister(false);
              setError("");
              setSuccess("");
            }}
          >
            {t.login}
          </button>
          <button
            type="button"
            className={isRegister ? "active" : ""}
            onClick={() => {
              setIsRegister(true);
              setError("");
              setSuccess("");
            }}
          >
            {t.register}
          </button>
        </div>

        {error && <div className="auth-alert danger">{error}</div>}
        {success && <div className="auth-alert success">{success}</div>}

        <form onSubmit={isRegister ? handleRegister : handleLogin}>
          <div className="auth-form-body">
            <label className="auth-field">
              <span>{t.studentId} *</span>
              <input
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder={
                  lang === "vi"
                    ? "Ví dụ: SV2026 hoặc admin"
                    : "e.g. SV2026 or admin"
                }
                required
              />
            </label>

            {isRegister && (
              <>
                <label className="auth-field">
                  <span>{t.name} *</span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={
                      lang === "vi"
                        ? "Nhập họ và tên thật"
                        : "Enter your full name"
                    }
                    required
                  />
                </label>
              </>
            )}

            <label className="auth-field">
              <span>{t.password} *</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={lang === "vi" ? "Nhập mật khẩu" : "Enter password"}
                required
              />
            </label>
          </div>

          <button type="submit" className="auth-submit-btn">
            {isRegister ? t.register : t.login}
          </button>
        </form>

        <div className="auth-footer">
          {!isRegister ? (
            <p>
              {t.dontHaveAccount}{" "}
              <span onClick={() => setIsRegister(true)}>{t.register}</span>
            </p>
          ) : (
            <p>
              {t.alreadyHaveAccount}{" "}
              <span onClick={() => setIsRegister(false)}>{t.login}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
