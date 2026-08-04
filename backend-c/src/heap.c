#include "heapbeat.h"

#include <limits.h>
#include <stdio.h>
#include <string.h>

/* ========================================================================== */
/* HASH MAP CHỈ SỐ REQUESTID -> HEAP INDEX                                    */
/* Open addressing giúp changeVote/remove không phải quét toàn bộ mảng Heap.   */
/* ========================================================================== */

static size_t hash_request_id(int request_id) {
  return ((uint32_t)request_id * 2654435761u) % HB_INDEX_CAPACITY;
}

static void index_clear(HBMaxHeap *heap) {
  memset(heap->index_by_request_id, 0, sizeof(heap->index_by_request_id));
}

static bool index_set(HBMaxHeap *heap, int request_id, size_t index) {
  size_t start = hash_request_id(request_id);
  size_t tombstone = HB_INDEX_CAPACITY;

  for (size_t step = 0; step < HB_INDEX_CAPACITY; ++step) {
    size_t slot = (start + step) % HB_INDEX_CAPACITY;
    HBIndexEntry *entry = &heap->index_by_request_id[slot];
    if (entry->state == HB_INDEX_OCCUPIED && entry->request_id == request_id) {
      entry->index = index;
      return true;
    }
    if (entry->state == HB_INDEX_TOMBSTONE && tombstone == HB_INDEX_CAPACITY) {
      tombstone = slot;
    }
    if (entry->state == HB_INDEX_EMPTY) {
      slot = tombstone == HB_INDEX_CAPACITY ? slot : tombstone;
      entry = &heap->index_by_request_id[slot];
      entry->request_id = request_id;
      entry->index = index;
      entry->state = HB_INDEX_OCCUPIED;
      return true;
    }
  }
  return false;
}

static bool index_get(const HBMaxHeap *heap, int request_id, size_t *index) {
  size_t start = hash_request_id(request_id);
  for (size_t step = 0; step < HB_INDEX_CAPACITY; ++step) {
    size_t slot = (start + step) % HB_INDEX_CAPACITY;
    const HBIndexEntry *entry = &heap->index_by_request_id[slot];
    if (entry->state == HB_INDEX_EMPTY) {
      return false;
    }
    if (entry->state == HB_INDEX_OCCUPIED && entry->request_id == request_id) {
      *index = entry->index;
      return true;
    }
  }
  return false;
}

static void index_delete(HBMaxHeap *heap, int request_id) {
  size_t start = hash_request_id(request_id);
  for (size_t step = 0; step < HB_INDEX_CAPACITY; ++step) {
    size_t slot = (start + step) % HB_INDEX_CAPACITY;
    HBIndexEntry *entry = &heap->index_by_request_id[slot];
    if (entry->state == HB_INDEX_EMPTY) {
      return;
    }
    if (entry->state == HB_INDEX_OCCUPIED && entry->request_id == request_id) {
      entry->state = HB_INDEX_TOMBSTONE;
      return;
    }
  }
}

static void rebuild_index(HBMaxHeap *heap) {
  index_clear(heap);
  for (size_t i = 0; i < heap->size; ++i) {
    (void)index_set(heap, heap->items[i].request_id, i);
  }
}

/* ========================================================================== */
/* THỨ TỰ ƯU TIÊN CỦA MAX-HEAP                                               */
/* So sánh lần lượt: score, upvotes, shuffleOrder và requestedAt.              */
/* ========================================================================== */

static bool higher_priority(const HBQueueItem *a, const HBQueueItem *b) {
  if (a->score != b->score) {
    return a->score > b->score;
  }
  if (a->upvotes != b->upvotes) {
    return a->upvotes > b->upvotes;
  }
  int a_order = a->shuffle_order < 0 ? INT_MAX : a->shuffle_order;
  int b_order = b->shuffle_order < 0 ? INT_MAX : b->shuffle_order;
  if (a_order != b_order) {
    return a_order < b_order;
  }
  return a->requested_at_ms < b->requested_at_ms;
}

static void swap_items(HBMaxHeap *heap, size_t a, size_t b) {
  HBQueueItem temporary = heap->items[a];
  heap->items[a] = heap->items[b];
  heap->items[b] = temporary;
  (void)index_set(heap, heap->items[a].request_id, a);
  (void)index_set(heap, heap->items[b].request_id, b);
}

/* ========================================================================== */
/* LUỒNG HEAPIFYUP - NODE TĂNG ƯU TIÊN                                        */
/* So sánh với cha và đổi chỗ cho tới khi bất biến Heap được khôi phục.         */
/* ========================================================================== */

static void heapify_up(HBMaxHeap *heap, size_t index) {
  while (index > 0) {
    size_t parent = (index - 1) / 2;
    if (!higher_priority(&heap->items[index], &heap->items[parent])) {
      break;
    }
    swap_items(heap, index, parent);
    index = parent;
  }
}

/* ========================================================================== */
/* LUỒNG HEAPIFYDOWN - NODE GIẢM ƯU TIÊN                                      */
/* Chọn node tốt nhất giữa cha và hai con, sau đó đi dần xuống dưới.            */
/* ========================================================================== */

static void heapify_down(HBMaxHeap *heap, size_t index) {
  for (;;) {
    size_t left = index * 2 + 1;
    size_t right = index * 2 + 2;
    size_t best = index;

    if (left < heap->size &&
        higher_priority(&heap->items[left], &heap->items[best])) {
      best = left;
    }
    if (right < heap->size &&
        higher_priority(&heap->items[right], &heap->items[best])) {
      best = right;
    }
    if (best == index) {
      break;
    }
    swap_items(heap, index, best);
    index = best;
  }
}

static void build_heap(HBMaxHeap *heap) {
  if (heap->size < 2) {
    return;
  }
  for (size_t i = heap->size / 2; i > 0; --i) {
    heapify_down(heap, i - 1);
  }
}

static int find_vote(const HBQueueItem *item, const char *student_id) {
  for (size_t i = 0; i < item->vote_count; ++i) {
    if (strcmp(item->votes[i].student_id, student_id) == 0) {
      return (int)i;
    }
  }
  return -1;
}

static void recount_votes(HBQueueItem *item) {
  item->upvotes = 0;
  item->downvotes = 0;
  for (size_t i = 0; i < item->vote_count; ++i) {
    if (item->votes[i].value == 1) {
      ++item->upvotes;
    } else if (item->votes[i].value == -1) {
      ++item->downvotes;
    }
  }
  item->score = item->upvotes - item->downvotes;
}

HBQueueItem hb_queue_item_create(int request_id, const HBSong *song,
                                  const char *requested_by,
                                  int64_t requested_at_ms) {
  HBQueueItem item;
  memset(&item, 0, sizeof(item));
  item.request_id = request_id;
  item.song = *song;
  (void)snprintf(item.requested_by, sizeof(item.requested_by), "%s",
                 requested_by);
  item.requested_at_ms = requested_at_ms;
  item.shuffle_order = -1;
  item.vote_count = 1;
  (void)snprintf(item.votes[0].student_id,
                 sizeof(item.votes[0].student_id), "%s", requested_by);
  item.votes[0].value = 1;
  recount_votes(&item);
  return item;
}

void hb_heap_init(HBMaxHeap *heap) { memset(heap, 0, sizeof(*heap)); }

bool hb_heap_insert(HBMaxHeap *heap, const HBQueueItem *item) {
  if (heap->size >= HB_MAX_QUEUE) {
    return false;
  }
  size_t index = heap->size++;
  heap->items[index] = *item;
  if (!index_set(heap, item->request_id, index)) {
    --heap->size;
    return false;
  }
  heapify_up(heap, index);
  return true;
}

const HBQueueItem *hb_heap_peek(const HBMaxHeap *heap) {
  return heap->size == 0 ? NULL : &heap->items[0];
}

HBQueueItem *hb_heap_find_request(HBMaxHeap *heap, int request_id) {
  size_t index = 0;
  return index_get(heap, request_id, &index) ? &heap->items[index] : NULL;
}

HBQueueItem *hb_heap_find_song(HBMaxHeap *heap, int song_id) {
  for (size_t i = 0; i < heap->size; ++i) {
    if (heap->items[i].song.id == song_id) {
      return &heap->items[i];
    }
  }
  return NULL;
}

bool hb_heap_change_vote(HBMaxHeap *heap, int request_id,
                         const char *student_id, HBVoteValue next_vote,
                         int *delta_out) {
  if (next_vote < -1 || next_vote > 1) {
    return false;
  }
  size_t index = 0;
  if (!index_get(heap, request_id, &index)) {
    return false;
  }

  HBQueueItem *item = &heap->items[index];
  int vote_index = find_vote(item, student_id);
  int previous_vote = vote_index < 0 ? 0 : item->votes[vote_index].value;
  int delta = next_vote - previous_vote;
  if (delta_out != NULL) {
    *delta_out = delta;
  }
  if (delta == 0) {
    return true;
  }

  if (next_vote == 0) {
    if (vote_index >= 0) {
      size_t last = --item->vote_count;
      if ((size_t)vote_index < last) {
        item->votes[vote_index] = item->votes[last];
      }
    }
  } else if (vote_index >= 0) {
    item->votes[vote_index].value = next_vote;
  } else {
    if (item->vote_count >= HB_MAX_VOTES_PER_ITEM) {
      return false;
    }
    HBVoteEntry *entry = &item->votes[item->vote_count++];
    (void)snprintf(entry->student_id, sizeof(entry->student_id), "%s",
                   student_id);
    entry->value = next_vote;
  }

  recount_votes(item);

  /* ======================================================================== */
  /* LUỒNG UPVOTE / DOWNVOTE                                                  */
  /* delta > 0: mức ưu tiên tăng -> heapifyUp.                                 */
  /* delta < 0: mức ưu tiên giảm -> heapifyDown.                               */
  /* Ví dụ -1 -> +1 có delta +2; +1 -> -1 có delta -2.                        */
  /* ======================================================================== */
  if (delta > 0) {
    heapify_up(heap, index);
  } else {
    heapify_down(heap, index);
  }
  return true;
}

bool hb_heap_extract_max(HBMaxHeap *heap, HBQueueItem *output) {
  /* ======================================================================== */
  /* LUỒNG EXTRACTMAX                                                         */
  /* Lưu gốc, đưa lá cuối lên index 0, xóa Map cũ rồi heapifyDown O(log n).    */
  /* ======================================================================== */
  if (heap->size == 0) {
    return false;
  }
  HBQueueItem maximum = heap->items[0];
  index_delete(heap, maximum.request_id);
  --heap->size;
  if (heap->size > 0) {
    heap->items[0] = heap->items[heap->size];
    (void)index_set(heap, heap->items[0].request_id, 0);
    heapify_down(heap, 0);
  }
  if (output != NULL) {
    *output = maximum;
  }
  return true;
}

bool hb_heap_remove(HBMaxHeap *heap, int request_id, HBQueueItem *output) {
  size_t index = 0;
  if (!index_get(heap, request_id, &index)) {
    return false;
  }
  HBQueueItem removed = heap->items[index];
  index_delete(heap, request_id);
  --heap->size;
  if (index < heap->size) {
    heap->items[index] = heap->items[heap->size];
    int moved_request_id = heap->items[index].request_id;
    (void)index_set(heap, moved_request_id, index);
    heapify_up(heap, index);
    size_t adjusted = 0;
    /* heapifyUp co the da doi phan tu khoi vi tri index ban dau. Map cho phep
       tim lai chinh phan tu vua bu vao de tiep tuc kiem tra huong di xuong. */
    if (index_get(heap, moved_request_id, &adjusted)) {
      heapify_down(heap, adjusted);
    }
  }
  if (output != NULL) {
    *output = removed;
  }
  return true;
}

size_t hb_heap_remove_many(HBMaxHeap *heap, const int *request_ids,
                           size_t count) {
  size_t removed = 0;
  for (size_t i = 0; i < count; ++i) {
    if (hb_heap_remove(heap, request_ids[i], NULL)) {
      ++removed;
    }
  }
  return removed;
}

size_t hb_heap_remove_student_votes(HBMaxHeap *heap,
                                    const char *student_id) {
  size_t removed = 0;
  for (size_t i = 0; i < heap->size; ++i) {
    HBQueueItem *item = &heap->items[i];
    int vote_index = find_vote(item, student_id);
    if (vote_index < 0) {
      continue;
    }
    size_t last = --item->vote_count;
    if ((size_t)vote_index < last) {
      item->votes[vote_index] = item->votes[last];
    }
    recount_votes(item);
    ++removed;
  }
  if (removed > 0) {
    rebuild_index(heap);
    build_heap(heap);
  }
  return removed;
}

void hb_heap_shuffle(HBMaxHeap *heap, uint32_t seed) {
  /* ======================================================================== */
  /* LUỒNG SHUFFLE TRONG MAX-HEAP                                            */
  /* Fisher-Yates tạo thứ tự phụ; score/upvotes vẫn là khóa ưu tiên cao hơn.  */
  /* ======================================================================== */
  size_t order[HB_MAX_QUEUE];
  for (size_t i = 0; i < heap->size; ++i) {
    order[i] = i;
  }
  for (size_t i = heap->size; i > 1; --i) {
    seed = seed * 1664525u + 1013904223u;
    size_t selected = (size_t)(seed % (uint32_t)i);
    size_t temporary = order[i - 1];
    order[i - 1] = order[selected];
    order[selected] = temporary;
  }
  for (size_t rank = 0; rank < heap->size; ++rank) {
    heap->items[order[rank]].shuffle_order = (int)rank;
  }
  rebuild_index(heap);
  build_heap(heap);
}

bool hb_heap_is_valid(const HBMaxHeap *heap) {
  for (size_t i = 0; i < heap->size; ++i) {
    size_t left = i * 2 + 1;
    size_t right = i * 2 + 2;
    if (left < heap->size && higher_priority(&heap->items[left], &heap->items[i])) {
      return false;
    }
    if (right < heap->size &&
        higher_priority(&heap->items[right], &heap->items[i])) {
      return false;
    }
    size_t mapped = 0;
    if (!index_get(heap, heap->items[i].request_id, &mapped) || mapped != i) {
      return false;
    }
  }
  return true;
}
