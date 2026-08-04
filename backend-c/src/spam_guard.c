#include "heapbeat.h"

#include <stdio.h>
#include <string.h>

/* ========================================================================== */
/* HASH MAP SPAMGUARD THEO STUDENTID                                          */
/* Dùng FNV-1a + open addressing để truy cập trạng thái trung bình O(1).       */
/* ========================================================================== */

static uint32_t hash_student_id(const char *student_id) {
  uint32_t hash = 2166136261u;
  for (const unsigned char *p = (const unsigned char *)student_id; *p != 0;
       ++p) {
    hash ^= *p;
    hash *= 16777619u;
  }
  return hash;
}

static HBStudentState *get_or_create(HBSpamGuard *guard,
                                     const char *student_id) {
  size_t start = hash_student_id(student_id) % HB_STUDENT_CAPACITY;
  for (size_t step = 0; step < HB_STUDENT_CAPACITY; ++step) {
    HBStudentState *state =
        &guard->students[(start + step) % HB_STUDENT_CAPACITY];
    if (state->occupied && strcmp(state->student_id, student_id) == 0) {
      return state;
    }
    if (!state->occupied) {
      memset(state, 0, sizeof(*state));
      state->occupied = true;
      (void)snprintf(state->student_id, sizeof(state->student_id), "%s",
                     student_id);
      return state;
    }
  }
  return NULL;
}

static void prune_recent(HBStudentState *state, int64_t now_ms) {
  /* CỬA SỔ TRƯỢT: loại mọi mốc cũ hơn 10 phút trước khi kiểm tra. */
  int64_t window_start = now_ms - HB_SPAM_WINDOW_MS;
  size_t write_index = 0;
  for (size_t i = 0; i < state->recent_count; ++i) {
    if (state->recent[i].timestamp_ms >= window_start) {
      state->recent[write_index++] = state->recent[i];
    }
  }
  state->recent_count = write_index;
}

static HBSpamDecision block_student(HBStudentState *state,
                                    HBSpamStatus status,
                                    const char *reason, int64_t now_ms) {
  HBSpamDecision decision;
  memset(&decision, 0, sizeof(decision));
  decision.status = status;
  decision.blocked_until_ms = now_ms + HB_BLOCK_DURATION_MS;
  decision.purge_count = state->active_count;
  for (size_t i = 0; i < state->active_count; ++i) {
    decision.purge_request_ids[i] = state->active_request_ids[i];
  }
  state->blocked_until_ms = decision.blocked_until_ms;
  (void)snprintf(state->block_reason, sizeof(state->block_reason), "%s",
                 reason);
  ++state->block_count;
  state->recent_count = 0;
  state->active_count = 0;
  return decision;
}

void hb_spam_init(HBSpamGuard *guard) { memset(guard, 0, sizeof(*guard)); }

HBSpamDecision hb_spam_check(HBSpamGuard *guard, const char *student_id,
                             int song_id, int64_t now_ms) {
  /* ======================================================================== */
  /* LUỒNG CHỐNG SPAM                                                        */
  /* 1. Xóa mốc cũ. 2. Kiểm tra blockedUntil. 3. Kiểm tra bài trùng.          */
  /* 4. Nếu đã có 3 yêu cầu thì yêu cầu thứ tư kích hoạt block 30 phút.        */
  /* ======================================================================== */
  HBSpamDecision allowed;
  memset(&allowed, 0, sizeof(allowed));
  allowed.status = HB_SPAM_ALLOWED;

  HBStudentState *state = get_or_create(guard, student_id);
  if (state == NULL) {
    HBSpamDecision full;
    memset(&full, 0, sizeof(full));
    full.status = HB_SPAM_LIMIT_EXCEEDED;
    full.blocked_until_ms = now_ms + HB_BLOCK_DURATION_MS;
    return full;
  }
  prune_recent(state, now_ms);
  if (state->blocked_until_ms > now_ms) {
    allowed.status = HB_SPAM_ALREADY_BLOCKED;
    allowed.blocked_until_ms = state->blocked_until_ms;
    return allowed;
  }
  for (size_t i = 0; i < state->recent_count; ++i) {
    if (state->recent[i].song_id == song_id) {
      return block_student(state, HB_SPAM_DUPLICATE,
                           "DUPLICATE_SONG_REQUEST", now_ms);
    }
  }
  if (state->recent_count >= HB_MAX_REQUESTS_PER_WINDOW) {
    return block_student(state, HB_SPAM_LIMIT_EXCEEDED,
                         "REQUEST_LIMIT_EXCEEDED", now_ms);
  }
  return allowed;
}

void hb_spam_record(HBSpamGuard *guard, const char *student_id, int song_id,
                    int64_t now_ms, int owned_request_id) {
  HBStudentState *state = get_or_create(guard, student_id);
  if (state == NULL) {
    return;
  }
  prune_recent(state, now_ms);
  if (state->recent_count < HB_MAX_RECENT_REQUESTS) {
    HBRecentRequest *request = &state->recent[state->recent_count++];
    request->song_id = song_id;
    request->timestamp_ms = now_ms;
  }
  if (owned_request_id > 0 && state->active_count < HB_MAX_ACTIVE_REQUESTS) {
    state->active_request_ids[state->active_count++] = owned_request_id;
  }
}

void hb_spam_remove_active_request(HBSpamGuard *guard, int request_id) {
  for (size_t slot = 0; slot < HB_STUDENT_CAPACITY; ++slot) {
    HBStudentState *state = &guard->students[slot];
    if (!state->occupied) {
      continue;
    }
    size_t write_index = 0;
    for (size_t i = 0; i < state->active_count; ++i) {
      if (state->active_request_ids[i] != request_id) {
        state->active_request_ids[write_index++] =
            state->active_request_ids[i];
      }
    }
    state->active_count = write_index;
  }
}

bool hb_spam_is_blocked(HBSpamGuard *guard, const char *student_id,
                        int64_t now_ms, int64_t *blocked_until_ms) {
  HBStudentState *state = get_or_create(guard, student_id);
  if (state == NULL) {
    return true;
  }
  prune_recent(state, now_ms);
  if (state->blocked_until_ms > now_ms) {
    if (blocked_until_ms != NULL) {
      *blocked_until_ms = state->blocked_until_ms;
    }
    return true;
  }
  return false;
}
