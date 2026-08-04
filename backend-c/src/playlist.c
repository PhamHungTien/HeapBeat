#include "heapbeat.h"

#include <stdlib.h>

/* ========================================================================== */
/* CIRCULAR DOUBLY LINKED LIST - DANH SÁCH LIÊN KẾT ĐÔI VÒNG                 */
/* Bất biến: head->prev == tail và tail->next == head.                         */
/* current->next hỗ trợ Next; current->prev hỗ trợ Previous trong O(1).        */
/* ========================================================================== */

void hb_playlist_init(HBCircularPlaylist *playlist) {
  playlist->head = NULL;
  playlist->current = NULL;
  playlist->size = 0;
}

void hb_playlist_destroy(HBCircularPlaylist *playlist) {
  if (playlist->head != NULL) {
    HBPlaylistNode *node = playlist->head;
    for (size_t i = 0; i < playlist->size; ++i) {
      HBPlaylistNode *next = node->next;
      free(node);
      node = next;
    }
  }
  hb_playlist_init(playlist);
}

bool hb_playlist_add_last(HBCircularPlaylist *playlist, const HBSong *song) {
  /* LUỒNG ADDLAST: nối node mới giữa tail hiện tại và head. */
  HBPlaylistNode *node = calloc(1, sizeof(*node));
  if (node == NULL) {
    return false;
  }
  node->song = *song;
  if (playlist->head == NULL) {
    node->prev = node;
    node->next = node;
    playlist->head = node;
    playlist->current = node;
  } else {
    HBPlaylistNode *tail = playlist->head->prev;
    tail->next = node;
    node->prev = tail;
    node->next = playlist->head;
    playlist->head->prev = node;
  }
  ++playlist->size;
  return true;
}

const HBSong *hb_playlist_current(const HBCircularPlaylist *playlist) {
  return playlist->current == NULL ? NULL : &playlist->current->song;
}

const HBSong *hb_playlist_next(HBCircularPlaylist *playlist) {
  if (playlist->current == NULL) {
    return NULL;
  }
  playlist->current = playlist->current->next;
  return &playlist->current->song;
}

const HBSong *hb_playlist_previous(HBCircularPlaylist *playlist) {
  if (playlist->current == NULL) {
    return NULL;
  }
  playlist->current = playlist->current->prev;
  return &playlist->current->song;
}

void hb_playlist_select_tail(HBCircularPlaylist *playlist) {
  if (playlist->head != NULL) {
    playlist->current = playlist->head->prev;
  }
}

bool hb_playlist_is_valid(const HBCircularPlaylist *playlist) {
  if (playlist->size == 0) {
    return playlist->head == NULL && playlist->current == NULL;
  }
  if (playlist->head == NULL || playlist->current == NULL ||
      playlist->head->prev == NULL || playlist->head->prev->next != playlist->head) {
    return false;
  }
  const HBPlaylistNode *node = playlist->head;
  bool found_current = false;
  for (size_t i = 0; i < playlist->size; ++i) {
    if (node == playlist->current) {
      found_current = true;
    }
    if (node->next == NULL || node->prev == NULL || node->next->prev != node ||
        node->prev->next != node) {
      return false;
    }
    node = node->next;
  }
  return node == playlist->head && found_current;
}
