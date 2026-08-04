#include "heapbeat.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static int tests_run = 0;

#define CHECK(condition)                                                       \
  do {                                                                         \
    ++tests_run;                                                               \
    if (!(condition)) {                                                        \
      fprintf(stderr, "[FAIL] %s:%d: %s\n", __FILE__, __LINE__, #condition);  \
      exit(EXIT_FAILURE);                                                      \
    }                                                                          \
  } while (0)

static HBSong make_song(int id, const char *title) {
  HBSong song;
  memset(&song, 0, sizeof(song));
  song.id = id;
  (void)snprintf(song.title, sizeof(song.title), "%s", title);
  (void)snprintf(song.artist, sizeof(song.artist), "HeapBeat Artist");
  (void)snprintf(song.license_url, sizeof(song.license_url),
                 "https://example.test/license");
  song.approved = true;
  song.public_playback_allowed = true;
  return song;
}

/* ========================================================================== */
/* KIỂM THỬ MAX-HEAP, UPVOTE VÀ DOWNVOTE                                     */
/* Xác nhận đổi vote làm đúng delta và luôn giữ phần tử ưu tiên nhất ở gốc.   */
/* ========================================================================== */

static void test_heap_and_votes(void) {
  HBMaxHeap heap;
  hb_heap_init(&heap);
  HBSong a = make_song(1, "A");
  HBSong b = make_song(2, "B");
  HBSong c = make_song(3, "C");
  HBQueueItem item_a = hb_queue_item_create(101, &a, "SV001", 1000);
  HBQueueItem item_b = hb_queue_item_create(102, &b, "SV002", 2000);
  HBQueueItem item_c = hb_queue_item_create(103, &c, "SV003", 3000);

  CHECK(hb_heap_insert(&heap, &item_a));
  CHECK(hb_heap_insert(&heap, &item_b));
  CHECK(hb_heap_insert(&heap, &item_c));
  CHECK(hb_heap_is_valid(&heap));
  CHECK(hb_heap_peek(&heap)->request_id == 101);

  int delta = 0;
  CHECK(hb_heap_change_vote(&heap, 103, "SV010", 1, &delta));
  CHECK(delta == 1);
  CHECK(hb_heap_peek(&heap)->request_id == 103);
  CHECK(hb_heap_is_valid(&heap));

  CHECK(hb_heap_change_vote(&heap, 103, "SV010", -1, &delta));
  CHECK(delta == -2);
  CHECK(hb_heap_peek(&heap)->request_id == 101);
  CHECK(hb_heap_is_valid(&heap));

  CHECK(hb_heap_remove(&heap, 102, NULL));
  CHECK(hb_heap_find_request(&heap, 102) == NULL);
  CHECK(hb_heap_is_valid(&heap));

  HBQueueItem maximum;
  CHECK(hb_heap_extract_max(&heap, &maximum));
  CHECK(maximum.request_id == 101);
  CHECK(hb_heap_is_valid(&heap));
}

/* ========================================================================== */
/* KIỂM THỬ DANH SÁCH LIÊN KẾT ĐÔI VÒNG                                     */
/* Next ở tail quay về head; Previous ở head quay về tail.                    */
/* ========================================================================== */

static void test_circular_playlist(void) {
  HBCircularPlaylist playlist;
  hb_playlist_init(&playlist);
  HBSong a = make_song(1, "A");
  HBSong b = make_song(2, "B");
  HBSong c = make_song(3, "C");

  CHECK(hb_playlist_add_last(&playlist, &a));
  CHECK(hb_playlist_add_last(&playlist, &b));
  CHECK(hb_playlist_add_last(&playlist, &c));
  CHECK(hb_playlist_is_valid(&playlist));
  CHECK(hb_playlist_current(&playlist)->id == 1);
  CHECK(hb_playlist_previous(&playlist)->id == 3);
  CHECK(hb_playlist_next(&playlist)->id == 1);
  CHECK(hb_playlist_next(&playlist)->id == 2);
  CHECK(hb_playlist_next(&playlist)->id == 3);
  CHECK(hb_playlist_next(&playlist)->id == 1);

  hb_playlist_destroy(&playlist);
  CHECK(hb_playlist_is_valid(&playlist));
}

/* ========================================================================== */
/* KIỂM THỬ HASH MAP CHỐNG SPAM                                              */
/* Yêu cầu thứ tư/10 phút và yêu cầu trùng đều phải chặn 30 phút.             */
/* ========================================================================== */

static void test_spam_guard(void) {
  const int64_t now = 1000000;
  HBSpamGuard guard;
  hb_spam_init(&guard);

  for (int song_id = 1; song_id <= 3; ++song_id) {
    HBSpamDecision decision = hb_spam_check(&guard, "SV100", song_id, now);
    CHECK(decision.status == HB_SPAM_ALLOWED);
    hb_spam_record(&guard, "SV100", song_id, now, 2000 + song_id);
  }
  HBSpamDecision fourth = hb_spam_check(&guard, "SV100", 4, now);
  CHECK(fourth.status == HB_SPAM_LIMIT_EXCEEDED);
  CHECK(fourth.blocked_until_ms == now + HB_BLOCK_DURATION_MS);
  CHECK(fourth.purge_count == 3);

  HBSpamDecision first = hb_spam_check(&guard, "SV200", 1, now);
  CHECK(first.status == HB_SPAM_ALLOWED);
  hb_spam_record(&guard, "SV200", 1, now, 3001);
  HBSpamDecision duplicate = hb_spam_check(&guard, "SV200", 1, now + 1);
  CHECK(duplicate.status == HB_SPAM_DUPLICATE);
  CHECK(duplicate.purge_count == 1);
}

/* ========================================================================== */
/* KIỂM THỬ LUỒNG BACKEND TÍCH HỢP                                           */
/* Request -> Vote -> extractMax -> addLast vào CDLL -> JSON snapshot.         */
/* ========================================================================== */

static void test_backend_flow(void) {
  HBBackend backend;
  hb_backend_init(&backend, false);
  const int64_t now = 5000000;

  HBServiceResult request =
      hb_backend_request_song(&backend, " sv001 ", 1, now);
  CHECK(request.http_status == 201);
  CHECK(request.request_id == 2000);
  CHECK(backend.queue.size == 1);

  HBServiceResult vote =
      hb_backend_cast_vote(&backend, "SV002", request.request_id, 1, now + 1);
  CHECK(vote.http_status == 200);
  CHECK(vote.delta == 1);
  CHECK(vote.score == 2);

  HBServiceResult downvote = hb_backend_cast_vote(
      &backend, "SV002", request.request_id, -1, now + 2);
  CHECK(downvote.http_status == 200);
  CHECK(downvote.delta == -2);
  CHECK(downvote.score == 0);

  HBServiceResult next = hb_backend_next(&backend, now + 3);
  CHECK(next.http_status == 200);
  CHECK(strcmp(next.code, "PLAYING_FROM_HEAP") == 0);
  CHECK(backend.queue.size == 0);
  CHECK(backend.playlist.size == 1);
  CHECK(hb_playlist_is_valid(&backend.playlist));

  char state[65536];
  CHECK(hb_backend_state_json(&backend, state, sizeof(state)));
  CHECK(strstr(state, "\"valid\":true") != NULL);
  CHECK(strstr(state, "Anh Nang Cua Anh") != NULL);
  hb_backend_destroy(&backend);
}

int main(void) {
  test_heap_and_votes();
  test_circular_playlist();
  test_spam_guard();
  test_backend_flow();
  printf("[PASS] %d assertions - HeapBeat backend C\n", tests_run);
  return EXIT_SUCCESS;
}
