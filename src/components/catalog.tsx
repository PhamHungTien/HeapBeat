import { TRANSLATIONS, type CatalogTab } from "../app/model";
import type { QueueItem, Song, UserAccount } from "../lib/heapbeat";
import { CoverArt, Icon, IconButton } from "./primitives";

export function RequestPanel({
  searchTerm,
  activeTab,
  genreFilter,
  genreOptions,
  filteredSongs,
  studentRequests,
  lang,
  currentPage,
  onPageChange,
  currentUser,
  onSearchTermChange,
  onGenreFilterChange,
  onTabChange,
  onRequestSong,
}: {
  searchTerm: string;
  activeTab: CatalogTab;
  genreFilter: string;
  genreOptions: string[];
  filteredSongs: Song[];
  studentRequests: QueueItem[];
  lang: "vi" | "en";
  currentPage: number;
  onPageChange: (page: number) => void;
  currentUser: UserAccount;
  onSearchTermChange: (searchTerm: string) => void;
  onGenreFilterChange: (genre: string) => void;
  onTabChange: (tab: CatalogTab) => void;
  onRequestSong: (songId: string) => void;
}) {
  const t = TRANSLATIONS[lang];

  return (
    <aside className="request-panel">
      <div className="request-header">
        <div>
          <h2>{t.searchCatalog}</h2>
          <Icon name="info" />
        </div>
        <button type="button">
          {lang === "vi" ? "Mở" : "Open"} <Icon name="chevron" />
        </button>
      </div>

      <div
        className="active-student-card"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.4rem",
          padding: "0.85rem",
          background: "#f1f5f3",
          border: "1px solid #d6dfdb",
          borderRadius: "8px",
          marginBottom: "0.85rem",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontSize: "0.74rem",
              fontWeight: 700,
              color: "#6b7d77",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {currentUser.role === "admin"
              ? lang === "vi"
                ? "Tài khoản Quản trị"
                : "Admin Profile"
              : lang === "vi"
                ? "Tài khoản Sinh viên"
                : "Student Profile"}
          </span>
          <span
            style={{
              fontSize: "0.72rem",
              background: currentUser.role === "admin" ? "#fef3c7" : "#d1fae5",
              color: currentUser.role === "admin" ? "#92400e" : "#065f46",
              padding: "2px 8px",
              borderRadius: "12px",
              fontWeight: "bold",
            }}
          >
            {currentUser.role === "admin" ? "Admin" : "Student"}
          </span>
        </div>
        <div>
          <strong
            style={{ fontSize: "0.95rem", color: "#17211f", display: "block" }}
          >
            {currentUser.name}
          </strong>
          {currentUser.role !== "admin" && (
            <small style={{ fontSize: "0.78rem", color: "#4f5f5a" }}>
              {t.studentId}: {currentUser.studentId}
            </small>
          )}
        </div>
      </div>

      <div className="request-tabs" role="tablist">
        <button
          className={activeTab === "catalog" ? "active" : ""}
          onClick={() => onTabChange("catalog")}
          role="tab"
          type="button"
        >
          {t.catalog}
        </button>
        {currentUser.role !== "admin" && (
          <button
            className={activeTab === "requests" ? "active" : ""}
            onClick={() => onTabChange("requests")}
            role="tab"
            type="button"
          >
            {t.yourVotes} ({studentRequests.length})
          </button>
        )}
      </div>

      <label className="catalog-search">
        <Icon name="search" />
        <input
          value={searchTerm}
          onChange={(event) => onSearchTermChange(event.target.value)}
          placeholder={t.searchPlaceholderLocal}
        />
      </label>

      {/* Quick filters for the bundled piano library. */}
      <div
        className="quick-tags"
        style={{
          display: "flex",
          gap: "0.4rem",
          margin: "0rem 0 0.85rem",
          flexWrap: "wrap",
        }}
      >
        {[
          { label: "Piano", query: "Piano" },
          { label: "V-Pop", query: "V-Pop" },
          { label: "Cà Pháo", query: "Cà Pháo Pianist" },
          { label: "Yuriko", query: "Yuriko Piano" },
          { label: "Thư giãn", query: "Calm" },
        ].map(({ label, query }) => (
          <button
            key={label}
            onClick={() =>
              onSearchTermChange(
                searchTerm.toLowerCase() === query.toLowerCase() ? "" : query,
              )
            }
            style={{
              padding: "4px 9px",
              fontSize: "0.74rem",
              borderRadius: "12px",
              border: "1px solid #dde5e1",
              background:
                searchTerm.toLowerCase() === query.toLowerCase()
                  ? "#087f78"
                  : "#ffffff",
              color:
                searchTerm.toLowerCase() === query.toLowerCase()
                  ? "#ffffff"
                  : "#50615c",
              cursor: "pointer",
              fontWeight: 600,
              transition: "all 0.15s ease",
            }}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      <div className="filter-row">
        <label>
          <select
            aria-label="Genre filter"
            value={genreFilter}
            onChange={(event) => onGenreFilterChange(event.target.value)}
          >
            <option value="all">{t.allGenres}</option>
            {genreOptions.map((genre) => (
              <option key={genre} value={genre}>
                {genre}
              </option>
            ))}
          </select>
          <Icon name="chevron" />
        </label>
        <button
          onClick={() => {
            onGenreFilterChange("all");
            onSearchTermChange("");
          }}
          type="button"
        >
          <Icon name="filter" /> {t.reset}
        </button>
      </div>

      {activeTab === "catalog" ? (
        <div className="catalog-table">
          <div className="catalog-header">
            <span style={{ gridColumn: "1 / 3" }}>{t.track}</span>
            <span style={{ textAlign: "right" }}>{t.add}</span>
          </div>
          {(() => {
            const ITEMS_PER_PAGE = 8;
            const offset = (currentPage - 1) * ITEMS_PER_PAGE;
            const pagedSongs = filteredSongs.slice(
              offset,
              offset + ITEMS_PER_PAGE,
            );

            return pagedSongs.map((song) => {
              const isApproved =
                song.approvalStatus === "approved" &&
                song.publicPlaybackAllowed;

              return (
                <article className="catalog-row" key={song.id}>
                  <CoverArt compact song={song} />
                  <div className="catalog-copy">
                    <strong title={song.title}>{song.title}</strong>
                    <small>{song.artist}</small>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                      justifyContent: "flex-end",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.68rem",
                        padding: "2px 7px",
                        borderRadius: "10px",
                        background: "rgba(8,127,120,0.08)",
                        color: "#087f78",
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}
                    >
                      {song.genre}
                    </span>
                    <IconButton
                      disabled={!isApproved}
                      icon={isApproved ? "plus" : "lock"}
                      label={
                        isApproved
                          ? lang === "vi"
                            ? `Yêu cầu bài ${song.title}`
                            : `Request ${song.title}`
                          : lang === "vi"
                            ? `Bị khóa: ${song.approvalStatus}`
                            : `Blocked: ${song.approvalStatus}`
                      }
                      onClick={() => onRequestSong(song.id)}
                      variant={isApproved ? "ghost" : "danger"}
                    />
                  </div>
                </article>
              );
            });
          })()}
          {filteredSongs.length === 0 ? (
            <div className="catalog-empty">{t.noTracksFound}</div>
          ) : null}
        </div>
      ) : (
        <div className="your-requests">
          {studentRequests.length > 0 ? (
            studentRequests.map((item) => (
              <article key={item.requestId} className="your-request-row">
                <CoverArt compact song={item.song} />
                <div className="request-info">
                  <strong>{item.song.title}</strong>
                  <small>
                    {lang === "vi"
                      ? `Điểm ưu tiên: ${item.score} · Trên Max-Heap`
                      : `Voted Score: ${item.score} · Priority in Max-Heap`}
                  </small>
                </div>
              </article>
            ))
          ) : (
            <div className="empty-state">{t.emptyRequests}</div>
          )}
        </div>
      )}

      {(() => {
        const ITEMS_PER_PAGE = 8;
        const totalPages = Math.max(
          1,
          Math.ceil(filteredSongs.length / ITEMS_PER_PAGE),
        );
        const offset = (currentPage - 1) * ITEMS_PER_PAGE;

        return (
          <div className="catalog-footer">
            <span>
              {t.showing} {filteredSongs.length === 0 ? 0 : offset + 1}-
              {Math.min(offset + ITEMS_PER_PAGE, filteredSongs.length)} {t.of}{" "}
              {filteredSongs.length}
            </span>
            <div
              style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}
            >
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                (page) => {
                  const isCurrent = page === currentPage;
                  return (
                    <button
                      key={page}
                      onClick={() => onPageChange(page)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontWeight: isCurrent ? "bold" : "normal",
                        borderBottom: isCurrent ? "2px solid #087f78" : "none",
                        color: isCurrent ? "#087f78" : "#4f5f5a",
                        padding: "2px 6px",
                        margin: "0 2px",
                        fontSize: "0.85rem",
                      }}
                      type="button"
                    >
                      {page}
                    </button>
                  );
                },
              )}
              <button
                onClick={() =>
                  onPageChange(Math.min(totalPages, currentPage + 1))
                }
                disabled={currentPage === totalPages || totalPages <= 1}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  opacity:
                    currentPage === totalPages || totalPages <= 1 ? 0.35 : 1,
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                }}
                type="button"
              >
                <Icon name="chevron" />
              </button>
            </div>
          </div>
        );
      })()}
    </aside>
  );
}
