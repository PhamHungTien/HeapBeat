#include "heapbeat.h"

#include <ctype.h>
#include <stdarg.h>
#include <stdio.h>
#include <string.h>
#include <sys/time.h>

typedef struct {
  char *buffer;
  size_t capacity;
  size_t length;
  bool ok;
} HBJsonWriter;

/* ========================================================================== */
/* JSON RESPONSE BUILDER                                                      */
/* Bộ ghi giới hạn dung lượng, luôn phát hiện tràn trước khi trả HTTP response. */
/* ========================================================================== */

static void json_append(HBJsonWriter *writer, const char *format, ...) {
  if (!writer->ok || writer->length >= writer->capacity) {
    writer->ok = false;
    return;
  }
  va_list args;
  va_start(args, format);
  int written = vsnprintf(writer->buffer + writer->length,
                          writer->capacity - writer->length, format, args);
  va_end(args);
  if (written < 0 || (size_t)written >= writer->capacity - writer->length) {
    writer->ok = false;
    return;
  }
  writer->length += (size_t)written;
}

static HBServiceResult result_make(int status, const char *code,
                                   const char *message) {
  HBServiceResult result;
  memset(&result, 0, sizeof(result));
  result.http_status = status;
  (void)snprintf(result.code, sizeof(result.code), "%s", code);
  (void)snprintf(result.message, sizeof(result.message), "%s", message);
  return result;
}

int64_t hb_now_ms(void) {
  struct timeval now;
  (void)gettimeofday(&now, NULL);
  return (int64_t)now.tv_sec * 1000LL + now.tv_usec / 1000;
}

bool hb_normalize_student_id(const char *input,
                             char output[HB_STUDENT_ID_SIZE]) {
  size_t write_index = 0;
  if (input == NULL) {
    return false;
  }
  for (const unsigned char *p = (const unsigned char *)input; *p != 0; ++p) {
    if (isspace(*p)) {
      continue;
    }
    if (!(isalnum(*p) || *p == '-' || *p == '_')) {
      return false;
    }
    if (write_index + 1 >= HB_STUDENT_ID_SIZE) {
      return false;
    }
    output[write_index++] = (char)toupper(*p);
  }
  output[write_index] = 0;
  return write_index > 0;
}

static void catalog_add(HBBackend *backend, int id, const char *title,
                        const char *artist) {
  HBSong *song = &backend->catalog[backend->catalog_count++];
  memset(song, 0, sizeof(*song));
  song->id = id;
  (void)snprintf(song->title, sizeof(song->title), "%s", title);
  (void)snprintf(song->artist, sizeof(song->artist), "%s", artist);
  (void)snprintf(song->license_url, sizeof(song->license_url),
                 "https://github.com/PhamHungTien/HeapBeat");
  song->approved = true;
  song->public_playback_allowed = true;
}

static const HBSong *catalog_find(const HBBackend *backend, int song_id) {
  for (size_t i = 0; i < backend->catalog_count; ++i) {
    if (backend->catalog[i].id == song_id) {
      return &backend->catalog[i];
    }
  }
  return NULL;
}

static void seed_request(HBBackend *backend, int request_id, int song_id,
                         const char *student_id, int64_t requested_at,
                         int extra_upvotes) {
  const HBSong *song = catalog_find(backend, song_id);
  if (song == NULL) {
    return;
  }
  HBQueueItem item = hb_queue_item_create(request_id, song, student_id,
                                          requested_at);
  if (!hb_heap_insert(&backend->queue, &item)) {
    return;
  }
  hb_spam_record(&backend->spam_guard, student_id, song_id, requested_at,
                 request_id);
  for (int i = 0; i < extra_upvotes; ++i) {
    char voter[HB_STUDENT_ID_SIZE];
    (void)snprintf(voter, sizeof(voter), "SEED%02d", i + 1);
    (void)hb_heap_change_vote(&backend->queue, request_id, voter, 1, NULL);
  }
}

void hb_backend_init(HBBackend *backend, bool seed_demo_data) {
  memset(backend, 0, sizeof(*backend));
  hb_heap_init(&backend->queue);
  hb_playlist_init(&backend->playlist);
  hb_spam_init(&backend->spam_guard);
  backend->next_request_id = 2000;

  catalog_add(backend, 1, "Anh Nang Cua Anh", "Ca Phao Pianist");
  catalog_add(backend, 2, "Beo Dat May Troi", "Ca Phao Pianist");
  catalog_add(backend, 3, "Buong Doi Tay Nhau Ra", "Ca Phao Pianist");
  catalog_add(backend, 4, "Chac Ai Do Se Ve", "Ca Phao Pianist");
  catalog_add(backend, 5, "Chung Ta Khong Thuoc Ve Nhau", "Ca Phao Pianist");
  catalog_add(backend, 6, "Co Em Cho", "Ca Phao Pianist");
  catalog_add(backend, 7, "Dom Dom", "Vu Ngoc Tien");
  catalog_add(backend, 8, "Dung Lam Trai Tim Anh Dau", "Ca Phao Pianist");
  catalog_add(backend, 9, "Ghen", "Ca Phao Pianist");
  catalog_add(backend, 10, "Giac Mo Trua", "Ca Phao Pianist");
  catalog_add(backend, 11, "Hay Trao Cho Anh", "Ca Phao Pianist");
  catalog_add(backend, 12, "Kem Duyen", "Ca Phao Pianist");
  catalog_add(backend, 13, "Lac Troi", "Ca Phao Pianist");
  catalog_add(backend, 14, "Nguoi Hay Quen Em Di", "Ca Phao Pianist");
  catalog_add(backend, 15, "Noi Nay Co Anh", "Ca Phao Pianist");
  catalog_add(backend, 16, "Phep Mau", "Yuriko Piano");
  catalog_add(backend, 17, "Sao Anh Chua Ve Nha", "Ca Phao Pianist");
  catalog_add(backend, 18, "Thien Ly Oi", "Yuriko Piano");

  if (seed_demo_data) {
    int64_t now = hb_now_ms();
    (void)hb_playlist_add_last(&backend->playlist, &backend->catalog[0]);
    seed_request(backend, 1001, 2, "SV001", now - 180000, 4);
    seed_request(backend, 1002, 3, "SV002", now - 240000, 3);
    seed_request(backend, 1003, 4, "SV003", now - 120000, 1);
  }
}

void hb_backend_destroy(HBBackend *backend) {
  hb_playlist_destroy(&backend->playlist);
}

HBServiceResult hb_backend_request_song(HBBackend *backend,
                                        const char *student_id, int song_id,
                                        int64_t now_ms) {
  /* ======================================================================== */
  /* LUỒNG REQUEST SONG                                                       */
  /* License Gate -> SpamGuard -> auto-upvote bài có sẵn hoặc insert Heap.     */
  /* Khi vi phạm: removeMany(active IDs) + removeStudentVotes + buildHeap.     */
  /* ======================================================================== */
  char normalized[HB_STUDENT_ID_SIZE];
  if (!hb_normalize_student_id(student_id, normalized)) {
    return result_make(400, "INVALID_STUDENT_ID", "StudentID khong hop le.");
  }
  const HBSong *song = catalog_find(backend, song_id);
  if (song == NULL) {
    return result_make(404, "SONG_NOT_FOUND", "Khong tim thay bai hat.");
  }
  if (!song->approved || !song->public_playback_allowed ||
      song->license_url[0] == 0) {
    return result_make(403, "LICENSE_REJECTED",
                       "Bai hat chua du dieu kien giay phep.");
  }

  if (strcmp(normalized, "ADMIN") != 0) {
    HBSpamDecision decision =
        hb_spam_check(&backend->spam_guard, normalized, song_id, now_ms);
    if (decision.status != HB_SPAM_ALLOWED) {
      size_t purged = hb_heap_remove_many(
          &backend->queue, decision.purge_request_ids, decision.purge_count);
      size_t removed_votes =
          hb_heap_remove_student_votes(&backend->queue, normalized);
      HBServiceResult blocked =
          result_make(429,
                      decision.status == HB_SPAM_DUPLICATE
                          ? "DUPLICATE_SONG_REQUEST"
                          : decision.status == HB_SPAM_LIMIT_EXCEEDED
                                ? "REQUEST_LIMIT_EXCEEDED"
                                : "ALREADY_BLOCKED",
                      "StudentID bi chan; da thu hoi bai va vote lien quan.");
      blocked.blocked_until_ms = decision.blocked_until_ms;
      blocked.purged_count = (int)purged;
      blocked.removed_votes = (int)removed_votes;
      return blocked;
    }
  }

  HBQueueItem *existing = hb_heap_find_song(&backend->queue, song_id);
  if (existing != NULL) {
    int request_id = existing->request_id;
    int delta = 0;
    if (!hb_heap_change_vote(&backend->queue, request_id, normalized, 1,
                             &delta)) {
      return result_make(500, "VOTE_UPDATE_FAILED",
                         "Khong the cap nhat vote trong Heap.");
    }
    if (strcmp(normalized, "ADMIN") != 0) {
      hb_spam_record(&backend->spam_guard, normalized, song_id, now_ms, 0);
    }
    HBQueueItem *updated =
        hb_heap_find_request(&backend->queue, request_id);
    HBServiceResult result = result_make(
        200, delta == 0 ? "ALREADY_PENDING" : "AUTO_UPVOTED",
        delta == 0 ? "Bai da cho va vote khong doi."
                   : "Bai da co trong Heap; yeu cau duoc chuyen thanh Upvote.");
    result.request_id = request_id;
    result.delta = delta;
    result.score = updated == NULL ? 0 : updated->score;
    return result;
  }

  int request_id = backend->next_request_id++;
  HBQueueItem item =
      hb_queue_item_create(request_id, song, normalized, now_ms);
  if (!hb_heap_insert(&backend->queue, &item)) {
    return result_make(507, "QUEUE_FULL", "Hang doi da day.");
  }
  if (strcmp(normalized, "ADMIN") != 0) {
    hb_spam_record(&backend->spam_guard, normalized, song_id, now_ms,
                   request_id);
  }
  HBServiceResult result =
      result_make(201, "QUEUED", "Da them bai vao Max-Heap.");
  result.request_id = request_id;
  result.score = item.score;
  return result;
}

HBServiceResult hb_backend_cast_vote(HBBackend *backend,
                                     const char *student_id, int request_id,
                                     HBVoteValue vote, int64_t now_ms) {
  /* ======================================================================== */
  /* LUỒNG CAST VOTE                                                          */
  /* Chặn tài khoản vi phạm trước; sau đó chuyển +1/0/-1 và để Max-Heap chọn   */
  /* heapifyUp hoặc heapifyDown dựa trên delta.                                */
  /* ======================================================================== */
  char normalized[HB_STUDENT_ID_SIZE];
  if (!hb_normalize_student_id(student_id, normalized)) {
    return result_make(400, "INVALID_STUDENT_ID", "StudentID khong hop le.");
  }
  if (vote < -1 || vote > 1) {
    return result_make(400, "INVALID_VOTE", "Vote phai la -1, 0 hoac 1.");
  }
  int64_t blocked_until = 0;
  if (hb_spam_is_blocked(&backend->spam_guard, normalized, now_ms,
                         &blocked_until)) {
    HBServiceResult blocked =
        result_make(429, "SPAM_BLOCKED", "Tai khoan dang bi chan vote.");
    blocked.blocked_until_ms = blocked_until;
    return blocked;
  }
  int delta = 0;
  if (!hb_heap_change_vote(&backend->queue, request_id, normalized, vote,
                           &delta)) {
    return result_make(404, "REQUEST_NOT_FOUND",
                       "Khong tim thay request trong Heap.");
  }
  HBQueueItem *updated = hb_heap_find_request(&backend->queue, request_id);
  HBServiceResult result =
      result_make(200, delta == 0 ? "VOTE_UNCHANGED" : "VOTE_UPDATED",
                  delta == 0 ? "Vote khong thay doi."
                             : "Da cap nhat vote va tai can bang Heap.");
  result.request_id = request_id;
  result.delta = delta;
  result.score = updated == NULL ? 0 : updated->score;
  return result;
}

HBServiceResult hb_backend_next(HBBackend *backend, int64_t now_ms) {
  /* ======================================================================== */
  /* LUỒNG PLAYER NEXT                                                        */
  /* Heap còn bài: extractMax -> gỡ ownership SpamGuard -> addLast vào CDLL.   */
  /* Heap rỗng: đi next trên danh sách vòng để thực hiện Repeat All.            */
  /* ======================================================================== */
  (void)now_ms;
  HBQueueItem next_item;
  if (hb_heap_extract_max(&backend->queue, &next_item)) {
    hb_spam_remove_active_request(&backend->spam_guard,
                                  next_item.request_id);
    if (!hb_playlist_add_last(&backend->playlist, &next_item.song)) {
      return result_make(500, "PLAYLIST_ALLOCATION_FAILED",
                         "Khong the cap phat node playlist.");
    }
    hb_playlist_select_tail(&backend->playlist);
    HBServiceResult result =
        result_make(200, "PLAYING_FROM_HEAP",
                    "extractMax va addLast da hoan tat.");
    result.has_song = true;
    result.song = next_item.song;
    result.request_id = next_item.request_id;
    result.score = next_item.score;
    return result;
  }

  const HBSong *looped = hb_playlist_next(&backend->playlist);
  if (looped == NULL) {
    return result_make(404, "NOTHING_TO_PLAY",
                       "Heap va playlist deu rong.");
  }
  HBServiceResult result =
      result_make(200, "PLAYING_FROM_HISTORY",
                  "Heap rong; chuyen Next tren danh sach vong.");
  result.has_song = true;
  result.song = *looped;
  return result;
}

HBServiceResult hb_backend_previous(HBBackend *backend) {
  const HBSong *song = hb_playlist_previous(&backend->playlist);
  if (song == NULL) {
    return result_make(404, "PLAYLIST_EMPTY", "Playlist dang rong.");
  }
  HBServiceResult result =
      result_make(200, "PLAYING_PREVIOUS",
                  "Da di lui bang con tro prev cua danh sach vong.");
  result.has_song = true;
  result.song = *song;
  return result;
}

HBServiceResult hb_backend_remove_request(HBBackend *backend, int request_id) {
  HBQueueItem removed;
  if (!hb_heap_remove(&backend->queue, request_id, &removed)) {
    return result_make(404, "REQUEST_NOT_FOUND",
                       "Khong tim thay request trong Heap.");
  }
  hb_spam_remove_active_request(&backend->spam_guard, request_id);
  HBServiceResult result =
      result_make(200, "REQUEST_REMOVED", "Admin da xoa request khoi Heap.");
  result.request_id = request_id;
  result.has_song = true;
  result.song = removed.song;
  return result;
}

HBServiceResult hb_backend_clear_queue(HBBackend *backend) {
  int removed = (int)backend->queue.size;
  for (size_t i = 0; i < backend->queue.size; ++i) {
    hb_spam_remove_active_request(&backend->spam_guard,
                                  backend->queue.items[i].request_id);
  }
  hb_heap_init(&backend->queue);
  HBServiceResult result =
      result_make(200, "QUEUE_CLEARED", "Admin da xoa toan bo Max-Heap.");
  result.purged_count = removed;
  return result;
}

HBServiceResult hb_backend_shuffle_queue(HBBackend *backend, uint32_t seed) {
  hb_heap_shuffle(&backend->queue, seed);
  return result_make(200, "QUEUE_SHUFFLED",
                     "C da gan shuffleOrder va buildHeap lai.");
}

bool hb_backend_catalog_json(const HBBackend *backend, char *buffer,
                             size_t capacity) {
  HBJsonWriter writer = {buffer, capacity, 0, true};
  json_append(&writer, "{\"songs\":[");
  for (size_t i = 0; i < backend->catalog_count; ++i) {
    const HBSong *song = &backend->catalog[i];
    json_append(&writer,
                "%s{\"id\":%d,\"title\":\"%s\",\"artist\":\"%s\","
                "\"approved\":%s,\"publicPlaybackAllowed\":%s}",
                i == 0 ? "" : ",", song->id, song->title, song->artist,
                song->approved ? "true" : "false",
                song->public_playback_allowed ? "true" : "false");
  }
  json_append(&writer, "]}");
  return writer.ok;
}

bool hb_backend_queue_json(const HBBackend *backend, char *buffer,
                           size_t capacity) {
  HBJsonWriter writer = {buffer, capacity, 0, true};
  HBMaxHeap ranked = backend->queue;
  HBQueueItem item;
  size_t rank = 1;
  json_append(&writer, "{\"size\":%zu,\"valid\":%s,\"items\":[",
              backend->queue.size,
              hb_heap_is_valid(&backend->queue) ? "true" : "false");
  while (hb_heap_extract_max(&ranked, &item)) {
    json_append(&writer,
                "%s{\"rank\":%zu,\"requestId\":%d,\"songId\":%d,"
                "\"title\":\"%s\",\"artist\":\"%s\","
                "\"requestedBy\":\"%s\",\"score\":%d,"
                "\"upvotes\":%d,\"downvotes\":%d,"
                "\"requestedAt\":%lld,\"shuffleOrder\":%d,"
                "\"votesByStudent\":{",
                rank == 1 ? "" : ",", rank, item.request_id, item.song.id,
                item.song.title, item.song.artist, item.requested_by,
                item.score, item.upvotes, item.downvotes,
                (long long)item.requested_at_ms, item.shuffle_order);
    for (size_t vote_index = 0; vote_index < item.vote_count; ++vote_index) {
      json_append(&writer, "%s\"%s\":%d", vote_index == 0 ? "" : ",",
                  item.votes[vote_index].student_id,
                  item.votes[vote_index].value);
    }
    json_append(&writer, "}}");
    ++rank;
  }
  json_append(&writer, "]}");
  return writer.ok;
}

bool hb_backend_player_json(const HBBackend *backend, char *buffer,
                            size_t capacity) {
  HBJsonWriter writer = {buffer, capacity, 0, true};
  const HBSong *current = hb_playlist_current(&backend->playlist);
  size_t current_index = 0;
  const HBPlaylistNode *cursor = backend->playlist.head;
  for (size_t i = 0; i < backend->playlist.size; ++i) {
    if (cursor == backend->playlist.current) {
      current_index = i;
      break;
    }
    cursor = cursor->next;
  }
  json_append(&writer,
              "{\"playlistSize\":%zu,\"valid\":%s,\"currentIndex\":",
              backend->playlist.size,
              hb_playlist_is_valid(&backend->playlist) ? "true" : "false");
  if (current == NULL) {
    json_append(&writer, "null,\"current\":");
  } else {
    json_append(&writer, "%zu,\"current\":", current_index);
  }
  if (current == NULL) {
    json_append(&writer, "null");
  } else {
    json_append(&writer,
                "{\"songId\":%d,\"title\":\"%s\",\"artist\":\"%s\"}",
                current->id, current->title, current->artist);
  }
  json_append(&writer, ",\"history\":[");
  const HBPlaylistNode *node = backend->playlist.head;
  for (size_t i = 0; i < backend->playlist.size; ++i) {
    json_append(&writer,
                "%s{\"songId\":%d,\"title\":\"%s\"}",
                i == 0 ? "" : ",", node->song.id, node->song.title);
    node = node->next;
  }
  json_append(&writer, "]}");
  return writer.ok;
}

bool hb_backend_state_json(const HBBackend *backend, char *buffer,
                           size_t capacity) {
  char queue[48000];
  char player[12000];
  if (!hb_backend_queue_json(backend, queue, sizeof(queue)) ||
      !hb_backend_player_json(backend, player, sizeof(player))) {
    return false;
  }
  int written = snprintf(buffer, capacity, "{\"queue\":%s,\"player\":%s}",
                         queue, player);
  return written >= 0 && (size_t)written < capacity;
}

bool hb_service_result_json(const HBServiceResult *result, char *buffer,
                            size_t capacity) {
  HBJsonWriter writer = {buffer, capacity, 0, true};
  json_append(&writer,
              "{\"code\":\"%s\",\"message\":\"%s\","
              "\"requestId\":%d,\"score\":%d,\"delta\":%d,"
              "\"purgedCount\":%d,\"removedVotes\":%d,"
              "\"blockedUntil\":%lld",
              result->code, result->message, result->request_id, result->score,
              result->delta, result->purged_count, result->removed_votes,
              (long long)result->blocked_until_ms);
  if (result->has_song) {
    json_append(&writer,
                ",\"song\":{\"id\":%d,\"title\":\"%s\","
                "\"artist\":\"%s\"}",
                result->song.id, result->song.title, result->song.artist);
  }
  json_append(&writer, "}");
  return writer.ok;
}
