#ifndef HEAPBEAT_H
#define HEAPBEAT_H

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#define HB_MAX_QUEUE 128
#define HB_MAX_VOTES_PER_ITEM 128
#define HB_INDEX_CAPACITY 257
#define HB_STUDENT_CAPACITY 257
#define HB_MAX_RECENT_REQUESTS 16
#define HB_MAX_ACTIVE_REQUESTS 32
#define HB_STUDENT_ID_SIZE 32
#define HB_TEXT_SIZE 96
#define HB_CODE_SIZE 40

#define HB_SPAM_WINDOW_MS (10LL * 60LL * 1000LL)
#define HB_BLOCK_DURATION_MS (30LL * 60LL * 1000LL)
#define HB_MAX_REQUESTS_PER_WINDOW 3

/* ========================================================================== */
/* 1. CẤU TRÚC DỮ LIỆU MIỀN NGHIỆP VỤ                                       */
/* Song, vote và request là dữ liệu chung được Max-Heap, Playlist và SpamGuard */
/* cùng sử dụng.                                                               */
/* ========================================================================== */

typedef int HBVoteValue;

typedef struct {
  int id;
  char title[HB_TEXT_SIZE];
  char artist[HB_TEXT_SIZE];
  char license_url[160];
  bool approved;
  bool public_playback_allowed;
} HBSong;

typedef struct {
  char student_id[HB_STUDENT_ID_SIZE];
  HBVoteValue value;
} HBVoteEntry;

typedef struct {
  int request_id;
  HBSong song;
  char requested_by[HB_STUDENT_ID_SIZE];
  int64_t requested_at_ms;
  int upvotes;
  int downvotes;
  int score;
  int shuffle_order;
  HBVoteEntry votes[HB_MAX_VOTES_PER_ITEM];
  size_t vote_count;
} HBQueueItem;

/* ========================================================================== */
/* 2. MAX-HEAP + HASH MAP CHỈ SỐ                                              */
/* Mảng items giữ cây Heap; index_by_request_id định vị request trung bình     */
/* O(1), nhờ đó Upvote/Downvote chỉ cần tái cân bằng O(log n).                 */
/* ========================================================================== */

typedef enum {
  HB_INDEX_EMPTY = 0,
  HB_INDEX_OCCUPIED = 1,
  HB_INDEX_TOMBSTONE = 2,
} HBIndexSlotState;

typedef struct {
  int request_id;
  size_t index;
  HBIndexSlotState state;
} HBIndexEntry;

typedef struct {
  HBQueueItem items[HB_MAX_QUEUE];
  size_t size;
  HBIndexEntry index_by_request_id[HB_INDEX_CAPACITY];
} HBMaxHeap;

/* ========================================================================== */
/* 3. DANH SÁCH LIÊN KẾT ĐÔI VÒNG                                            */
/* head->prev là tail, tail->next là head. Next/Previous là O(1).              */
/* ========================================================================== */

typedef struct HBPlaylistNode {
  HBSong song;
  struct HBPlaylistNode *prev;
  struct HBPlaylistNode *next;
} HBPlaylistNode;

typedef struct {
  HBPlaylistNode *head;
  HBPlaylistNode *current;
  size_t size;
} HBCircularPlaylist;

/* ========================================================================== */
/* 4. HASH MAP CHỐNG SPAM                                                     */
/* Mỗi StudentID ánh xạ tới cửa sổ 10 phút, request đang sở hữu và thời gian   */
/* chặn. Vi phạm sẽ chụp active_request_ids để thu hồi khỏi Max-Heap.          */
/* ========================================================================== */

typedef struct {
  int song_id;
  int64_t timestamp_ms;
} HBRecentRequest;

typedef struct {
  char student_id[HB_STUDENT_ID_SIZE];
  HBRecentRequest recent[HB_MAX_RECENT_REQUESTS];
  size_t recent_count;
  int active_request_ids[HB_MAX_ACTIVE_REQUESTS];
  size_t active_count;
  int64_t blocked_until_ms;
  char block_reason[HB_CODE_SIZE];
  unsigned block_count;
  bool occupied;
} HBStudentState;

typedef struct {
  HBStudentState students[HB_STUDENT_CAPACITY];
} HBSpamGuard;

typedef enum {
  HB_SPAM_ALLOWED = 0,
  HB_SPAM_ALREADY_BLOCKED,
  HB_SPAM_DUPLICATE,
  HB_SPAM_LIMIT_EXCEEDED,
} HBSpamStatus;

typedef struct {
  HBSpamStatus status;
  int64_t blocked_until_ms;
  int purge_request_ids[HB_MAX_ACTIVE_REQUESTS];
  size_t purge_count;
} HBSpamDecision;

/* ========================================================================== */
/* 5. BACKEND AUTHORITATIVE                                                   */
/* Backend là nguồn sự thật: request, vote và player đều phải đi qua service   */
/* C trước khi JSON mới được trả về giao diện.                                 */
/* ========================================================================== */

typedef struct {
  int http_status;
  char code[HB_CODE_SIZE];
  char message[256];
  int request_id;
  int score;
  int delta;
  int purged_count;
  int removed_votes;
  int64_t blocked_until_ms;
  bool has_song;
  HBSong song;
} HBServiceResult;

typedef struct {
  HBMaxHeap queue;
  HBCircularPlaylist playlist;
  HBSpamGuard spam_guard;
  HBSong catalog[24];
  size_t catalog_count;
  int next_request_id;
} HBBackend;

int64_t hb_now_ms(void);
bool hb_normalize_student_id(const char *input,
                             char output[HB_STUDENT_ID_SIZE]);

void hb_heap_init(HBMaxHeap *heap);
bool hb_heap_insert(HBMaxHeap *heap, const HBQueueItem *item);
const HBQueueItem *hb_heap_peek(const HBMaxHeap *heap);
HBQueueItem *hb_heap_find_request(HBMaxHeap *heap, int request_id);
HBQueueItem *hb_heap_find_song(HBMaxHeap *heap, int song_id);
bool hb_heap_change_vote(HBMaxHeap *heap, int request_id,
                         const char *student_id, HBVoteValue next_vote,
                         int *delta_out);
bool hb_heap_extract_max(HBMaxHeap *heap, HBQueueItem *output);
bool hb_heap_remove(HBMaxHeap *heap, int request_id, HBQueueItem *output);
size_t hb_heap_remove_many(HBMaxHeap *heap, const int *request_ids,
                           size_t count);
size_t hb_heap_remove_student_votes(HBMaxHeap *heap,
                                    const char *student_id);
void hb_heap_shuffle(HBMaxHeap *heap, uint32_t seed);
bool hb_heap_is_valid(const HBMaxHeap *heap);
HBQueueItem hb_queue_item_create(int request_id, const HBSong *song,
                                  const char *requested_by,
                                  int64_t requested_at_ms);

void hb_playlist_init(HBCircularPlaylist *playlist);
void hb_playlist_destroy(HBCircularPlaylist *playlist);
bool hb_playlist_add_last(HBCircularPlaylist *playlist, const HBSong *song);
const HBSong *hb_playlist_current(const HBCircularPlaylist *playlist);
const HBSong *hb_playlist_next(HBCircularPlaylist *playlist);
const HBSong *hb_playlist_previous(HBCircularPlaylist *playlist);
void hb_playlist_select_tail(HBCircularPlaylist *playlist);
bool hb_playlist_is_valid(const HBCircularPlaylist *playlist);

void hb_spam_init(HBSpamGuard *guard);
HBSpamDecision hb_spam_check(HBSpamGuard *guard, const char *student_id,
                             int song_id, int64_t now_ms);
void hb_spam_record(HBSpamGuard *guard, const char *student_id, int song_id,
                    int64_t now_ms, int owned_request_id);
void hb_spam_remove_active_request(HBSpamGuard *guard, int request_id);
bool hb_spam_is_blocked(HBSpamGuard *guard, const char *student_id,
                        int64_t now_ms, int64_t *blocked_until_ms);

void hb_backend_init(HBBackend *backend, bool seed_demo_data);
void hb_backend_destroy(HBBackend *backend);
HBServiceResult hb_backend_request_song(HBBackend *backend,
                                        const char *student_id, int song_id,
                                        int64_t now_ms);
HBServiceResult hb_backend_cast_vote(HBBackend *backend,
                                     const char *student_id, int request_id,
                                     HBVoteValue vote, int64_t now_ms);
HBServiceResult hb_backend_next(HBBackend *backend, int64_t now_ms);
HBServiceResult hb_backend_previous(HBBackend *backend);
HBServiceResult hb_backend_remove_request(HBBackend *backend, int request_id);
HBServiceResult hb_backend_clear_queue(HBBackend *backend);
HBServiceResult hb_backend_shuffle_queue(HBBackend *backend, uint32_t seed);
bool hb_backend_catalog_json(const HBBackend *backend, char *buffer,
                             size_t capacity);
bool hb_backend_queue_json(const HBBackend *backend, char *buffer,
                           size_t capacity);
bool hb_backend_player_json(const HBBackend *backend, char *buffer,
                            size_t capacity);
bool hb_backend_state_json(const HBBackend *backend, char *buffer,
                           size_t capacity);
bool hb_service_result_json(const HBServiceResult *result, char *buffer,
                            size_t capacity);

int hb_http_serve(HBBackend *backend, unsigned short port);

#endif
