import { useState } from "react";
import { ADMIN_TOOLS, TRANSLATIONS, type RoomInfo } from "../app/model";
import {
  formatClock,
  type AuditEvent,
  type QueueItem,
  type UserAccount,
} from "../lib/heapbeat";
import { Icon } from "./primitives";

export function Sidebar({
  queueCount,
  playlistCount,
  rootItem,
  isPlaying,
  latestEvent,
  roomSearch,
  activeRoomName,
  roomList,
  lang,
  currentUser,
  onLogout,
  onRoomSearchChange,
  onAdminTool,
  onRoomSelect,
  onCreateRoomClick,
}: {
  queueCount: number;
  playlistCount: number;
  rootItem: QueueItem | null;
  isPlaying: boolean;
  latestEvent: AuditEvent | undefined;
  roomSearch: string;
  activeRoomName: string;
  roomList: RoomInfo[];
  lang: "vi" | "en";
  currentUser: UserAccount;
  onLogout: () => void;
  onRoomSearchChange: (value: string) => void;
  onAdminTool: (action: string) => void;
  onRoomSelect: (roomName: string) => void;
  onCreateRoomClick: () => void;
}) {
  const t = TRANSLATIONS[lang];
  const [copied, setCopied] = useState(false);
  const visibleRooms = roomList.filter((room) =>
    room.name.toLowerCase().includes(roomSearch.toLowerCase()),
  );

  const currentRoomInfo = roomList.find((r) => r.name === activeRoomName);

  return (
    <aside className="sidebar">
      <div className="brand-lockup">
        <div className="brand-mark">
          <Icon name="activity" />
        </div>
        <h1>HeapBeat</h1>
      </div>

      <section className="sidebar-section">
        <div className="sidebar-label">{t.roomsSessions}</div>
        <label className="search-field">
          <Icon name="search" />
          <input
            placeholder={t.searchRooms}
            value={roomSearch}
            onChange={(event) => onRoomSearchChange(event.target.value)}
          />
        </label>
        <div className="room-list">
          {visibleRooms.map((room) => {
            const isCurrent = room.name === activeRoomName;
            return (
              <button
                className={`room-row ${isCurrent ? "active" : ""}`}
                key={room.name}
                onClick={() => onRoomSelect(room.name)}
                type="button"
              >
                <Icon name={isCurrent ? "users" : "user"} />
                <span>
                  <strong>{room.name}</strong>
                  <small>
                    {isCurrent
                      ? lang === "vi"
                        ? "Đang phát · Hoạt động"
                        : "Now playing · Active"
                      : `${room.listeners} ${lang === "vi" ? "người nghe" : "listeners"} · ${room.code}`}
                  </small>
                </span>
                {isCurrent ? <Icon name="activity" /> : null}
              </button>
            );
          })}
          {visibleRooms.length === 0 ? (
            <div className="room-empty">
              {lang === "vi"
                ? "Không có phòng phù hợp."
                : "No rooms match this search."}
            </div>
          ) : null}
          {currentUser.role === "admin" && (
            <button
              className="join-row"
              onClick={onCreateRoomClick}
              type="button"
            >
              <Icon name="plus" />
              <span>{t.joinOrCreateRoom}</span>
            </button>
          )}
        </div>
      </section>

      {activeRoomName ? (
        <section className="sidebar-section session-panel">
          <div className="sidebar-label">{t.sessionSettings}</div>
          <dl>
            <div>
              <dt>{t.roomCode}</dt>
              <dd
                style={{ cursor: "pointer", position: "relative" }}
                onClick={() => {
                  if (currentRoomInfo) {
                    navigator.clipboard.writeText(currentRoomInfo.code);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1200);
                  }
                }}
              >
                {currentRoomInfo ? currentRoomInfo.code : "N/A"}{" "}
                <Icon name="copy" />
                {copied && (
                  <span className="copy-tooltip">
                    {lang === "vi" ? "Đã chép!" : "Copied!"}
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt>{t.activeRoom}</dt>
              <dd>{activeRoomName.split(" ").slice(-1)[0]}</dd>
            </div>
            <div>
              <dt>{t.listeners}</dt>
              <dd className="accent-text">
                {currentRoomInfo ? currentRoomInfo.listeners : 0} {t.online}
              </dd>
            </div>
            <div>
              <dt>{t.queueLength}</dt>
              <dd>{queueCount}</dd>
            </div>
            <div>
              <dt>{t.playlistRing}</dt>
              <dd>{playlistCount}</dd>
            </div>
            <div>
              <dt>{t.heapRoot}</dt>
              <dd>
                {rootItem
                  ? rootItem.song.title
                  : lang === "vi"
                    ? "Trống"
                    : "Empty"}
              </dd>
            </div>
            <div>
              <dt>{t.autoPlay}</dt>
              <dd className="accent-text">{isPlaying ? t.active : t.paused}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      {currentUser.role === "admin" && (
        <section className="sidebar-section admin-tools">
          <div className="sidebar-label">{t.adminTools}</div>
          {ADMIN_TOOLS.map((tool) => {
            let label = tool.label;
            if (tool.action === "settings") label = t.roomSettingsLabel;
            else if (tool.action === "moderation")
              label = t.moderationQueueLabel;
            else if (tool.action === "analytics") label = t.liveAnalyticsLabel;
            else if (tool.action === "export") label = t.exportDataLabel;
            else if (tool.action === "reset") label = t.resetActiveRoomLabel;

            return (
              <button
                className="tool-row"
                key={tool.label}
                onClick={() => onAdminTool(tool.action)}
                type="button"
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <Icon name={tool.icon} />
                <span>{label}</span>
              </button>
            );
          })}
        </section>
      )}

      <div
        className="admin-profile"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            minWidth: 0,
          }}
        >
          <div
            className="avatar"
            style={{
              background: currentUser.role === "admin" ? "#b45309" : "#087f78",
            }}
          >
            {currentUser.name.slice(0, 2).toUpperCase()}
          </div>
          <span
            style={{ minWidth: 0, display: "flex", flexDirection: "column" }}
          >
            <strong
              style={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {currentUser.name}
            </strong>
            <small
              style={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {currentUser.role === "admin" ? "Admin" : currentUser.studentId}
            </small>
          </span>
        </div>
        <button
          onClick={onLogout}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "4px",
            color: "#b91c1c",
            display: "flex",
            alignItems: "center",
          }}
          type="button"
          title={t.logout}
        >
          <Icon name="logout" />
        </button>
      </div>

      <div className="sidebar-footer">
        <span>HeapBeat</span>
        <strong>
          <span className="live-dot" />{" "}
          {lang === "vi" ? "Phát nhạc trực tiếp" : "Live Synthesis"}
        </strong>
      </div>
      {latestEvent ? (
        <div className={`latest-event ${latestEvent.tone}`}>
          <span>{formatClock(latestEvent.at)}</span>
          <strong>{latestEvent.message}</strong>
        </div>
      ) : null}
    </aside>
  );
}
