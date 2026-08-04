#include "heapbeat.h"

#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static void print_usage(const char *program) {
  printf("Usage: %s [--port 8081] [--empty]\n", program);
  printf("  --port N   Cong HTTP, mac dinh 8081.\n");
  printf("  --empty    Khoi dong khong co du lieu mau.\n");
}

int main(int argc, char **argv) {
  unsigned short port = 8081;
  bool seed_demo_data = true;

  for (int i = 1; i < argc; ++i) {
    if (strcmp(argv[i], "--empty") == 0) {
      seed_demo_data = false;
    } else if (strcmp(argv[i], "--port") == 0 && i + 1 < argc) {
      errno = 0;
      char *end = NULL;
      long parsed = strtol(argv[++i], &end, 10);
      if (errno != 0 || end == argv[i] || *end != 0 || parsed < 1 ||
          parsed > 65535) {
        fprintf(stderr, "Port khong hop le: %s\n", argv[i]);
        return 2;
      }
      port = (unsigned short)parsed;
    } else if (strcmp(argv[i], "--help") == 0) {
      print_usage(argv[0]);
      return 0;
    } else {
      print_usage(argv[0]);
      return 2;
    }
  }

  /* ======================================================================== */
  /* KHỞI ĐỘNG BACKEND C AUTHORITATIVE                                        */
  /* Một event loop đơn luồng xử lý tuần tự request, nên các bất biến Heap,     */
  /* Playlist và SpamGuard không bị hai client sửa đồng thời trong bản demo.    */
  /* ======================================================================== */
  HBBackend backend;
  hb_backend_init(&backend, seed_demo_data);
  int result = hb_http_serve(&backend, port);
  hb_backend_destroy(&backend);
  return result;
}
