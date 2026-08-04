#include "heapbeat.h"

#include <arpa/inet.h>
#include <errno.h>
#include <netinet/in.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>
#include <sys/socket.h>
#include <unistd.h>

#define HB_HTTP_REQUEST_BYTES 65536
#define HB_HTTP_RESPONSE_BYTES 65536

static volatile sig_atomic_t server_running = 1;

static void stop_server(int signal_number) {
  (void)signal_number;
  server_running = 0;
}

static const char *status_text(int status) {
  switch (status) {
  case 200:
    return "OK";
  case 201:
    return "Created";
  case 204:
    return "No Content";
  case 400:
    return "Bad Request";
  case 403:
    return "Forbidden";
  case 404:
    return "Not Found";
  case 405:
    return "Method Not Allowed";
  case 413:
    return "Payload Too Large";
  case 429:
    return "Too Many Requests";
  case 500:
    return "Internal Server Error";
  case 507:
    return "Insufficient Storage";
  default:
    return "Error";
  }
}

static bool send_all(int socket_fd, const char *data, size_t length) {
  size_t sent = 0;
  while (sent < length) {
    ssize_t current = send(socket_fd, data + sent, length - sent, 0);
    if (current <= 0) {
      return false;
    }
    sent += (size_t)current;
  }
  return true;
}

static void send_json(int socket_fd, int status, const char *json) {
  char header[1024];
  size_t body_length = json == NULL ? 0 : strlen(json);
  int header_length = snprintf(
      header, sizeof(header),
      "HTTP/1.1 %d %s\r\n"
      "Content-Type: application/json; charset=utf-8\r\n"
      "Content-Length: %zu\r\n"
      "Access-Control-Allow-Origin: *\r\n"
      "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n"
      "Access-Control-Allow-Headers: Content-Type\r\n"
      "Cache-Control: no-store\r\n"
      "Connection: close\r\n\r\n",
      status, status_text(status), body_length);
  if (header_length <= 0 || (size_t)header_length >= sizeof(header)) {
    return;
  }
  (void)send_all(socket_fd, header, (size_t)header_length);
  if (body_length > 0) {
    (void)send_all(socket_fd, json, body_length);
  }
}

static void send_error(int socket_fd, int status, const char *code,
                       const char *message) {
  char json[512];
  (void)snprintf(json, sizeof(json),
                 "{\"code\":\"%s\",\"message\":\"%s\"}", code,
                 message);
  send_json(socket_fd, status, json);
}

static size_t content_length_from_headers(const char *request,
                                          const char *headers_end) {
  const char *line = strstr(request, "\r\n");
  if (line == NULL) {
    return 0;
  }
  line += 2;
  while (line < headers_end) {
    const char *line_end = strstr(line, "\r\n");
    if (line_end == NULL || line_end > headers_end) {
      break;
    }
    const char prefix[] = "Content-Length:";
    if ((size_t)(line_end - line) >= sizeof(prefix) - 1 &&
        strncasecmp(line, prefix, sizeof(prefix) - 1) == 0) {
      return (size_t)strtoull(line + sizeof(prefix) - 1, NULL, 10);
    }
    line = line_end + 2;
  }
  return 0;
}

static ssize_t receive_request(int socket_fd, char *buffer, size_t capacity,
                               char **body_out) {
  size_t total = 0;
  size_t expected_total = 0;
  char *headers_end = NULL;

  while (total + 1 < capacity) {
    ssize_t received = recv(socket_fd, buffer + total, capacity - total - 1, 0);
    if (received <= 0) {
      return received;
    }
    total += (size_t)received;
    buffer[total] = 0;

    if (headers_end == NULL) {
      headers_end = strstr(buffer, "\r\n\r\n");
      if (headers_end != NULL) {
        size_t header_bytes = (size_t)(headers_end + 4 - buffer);
        size_t content_length =
            content_length_from_headers(buffer, headers_end);
        if (content_length > capacity - header_bytes - 1) {
          return -2;
        }
        expected_total = header_bytes + content_length;
        *body_out = headers_end + 4;
      }
    }
    if (headers_end != NULL && total >= expected_total) {
      return (ssize_t)total;
    }
  }
  return -2;
}

static const char *find_json_value(const char *json, const char *key) {
  char pattern[80];
  int written = snprintf(pattern, sizeof(pattern), "\"%s\"", key);
  if (written <= 0 || (size_t)written >= sizeof(pattern)) {
    return NULL;
  }
  const char *position = strstr(json, pattern);
  if (position == NULL) {
    return NULL;
  }
  position += strlen(pattern);
  while (*position == ' ' || *position == '\t' || *position == '\r' ||
         *position == '\n') {
    ++position;
  }
  if (*position++ != ':') {
    return NULL;
  }
  while (*position == ' ' || *position == '\t' || *position == '\r' ||
         *position == '\n') {
    ++position;
  }
  return position;
}

static bool json_get_string(const char *json, const char *key, char *output,
                            size_t capacity) {
  const char *value = find_json_value(json, key);
  if (value == NULL || *value++ != '"') {
    return false;
  }
  size_t length = 0;
  while (*value != 0 && *value != '"') {
    if (*value == '\\' || length + 1 >= capacity) {
      return false;
    }
    output[length++] = *value++;
  }
  if (*value != '"') {
    return false;
  }
  output[length] = 0;
  return true;
}

static bool json_get_int(const char *json, const char *key, int *output) {
  const char *value = find_json_value(json, key);
  if (value == NULL) {
    return false;
  }
  char *end = NULL;
  long parsed = strtol(value, &end, 10);
  if (end == value) {
    return false;
  }
  *output = (int)parsed;
  return true;
}

static void respond_service_result(int socket_fd,
                                   const HBServiceResult *result) {
  char json[2048];
  if (!hb_service_result_json(result, json, sizeof(json))) {
    send_error(socket_fd, 500, "JSON_OVERFLOW",
               "Khong the tao JSON response.");
    return;
  }
  send_json(socket_fd, result->http_status, json);
}

/* ========================================================================== */
/* HTTP ROUTER - BIÊN GIỮA REACT VÀ BACKEND C                                */
/* GET chỉ đọc snapshot; POST gửi command để C thay đổi Heap/CDLL/SpamGuard.   */
/* ========================================================================== */

static void route_request(HBBackend *backend, int socket_fd, const char *method,
                          const char *path, const char *body) {
  char json[HB_HTTP_RESPONSE_BYTES];

  if (strcmp(method, "OPTIONS") == 0) {
    send_json(socket_fd, 204, NULL);
    return;
  }
  if (strcmp(method, "GET") == 0 && strcmp(path, "/health") == 0) {
    send_json(socket_fd, 200,
              "{\"status\":\"ok\",\"language\":\"C11\","
              "\"backend\":\"authoritative\"}");
    return;
  }
  if (strcmp(method, "GET") == 0 && strcmp(path, "/api/catalog") == 0) {
    if (hb_backend_catalog_json(backend, json, sizeof(json))) {
      send_json(socket_fd, 200, json);
    } else {
      send_error(socket_fd, 500, "JSON_OVERFLOW", "Catalog qua lon.");
    }
    return;
  }
  if (strcmp(method, "GET") == 0 && strcmp(path, "/api/queue") == 0) {
    if (hb_backend_queue_json(backend, json, sizeof(json))) {
      send_json(socket_fd, 200, json);
    } else {
      send_error(socket_fd, 500, "JSON_OVERFLOW", "Queue qua lon.");
    }
    return;
  }
  if (strcmp(method, "GET") == 0 && strcmp(path, "/api/player") == 0) {
    if (hb_backend_player_json(backend, json, sizeof(json))) {
      send_json(socket_fd, 200, json);
    } else {
      send_error(socket_fd, 500, "JSON_OVERFLOW", "Playlist qua lon.");
    }
    return;
  }
  if (strcmp(method, "GET") == 0 && strcmp(path, "/api/state") == 0) {
    if (hb_backend_state_json(backend, json, sizeof(json))) {
      send_json(socket_fd, 200, json);
    } else {
      send_error(socket_fd, 500, "JSON_OVERFLOW", "State qua lon.");
    }
    return;
  }
  if (strcmp(method, "POST") == 0 && strcmp(path, "/api/request") == 0) {
    char student_id[HB_STUDENT_ID_SIZE];
    int song_id = 0;
    if (!json_get_string(body, "studentId", student_id, sizeof(student_id)) ||
        !json_get_int(body, "songId", &song_id)) {
      send_error(socket_fd, 400, "INVALID_BODY",
                 "Can studentId va songId.");
      return;
    }
    HBServiceResult result = hb_backend_request_song(
        backend, student_id, song_id, hb_now_ms());
    respond_service_result(socket_fd, &result);
    return;
  }
  if (strcmp(method, "POST") == 0 && strcmp(path, "/api/vote") == 0) {
    char student_id[HB_STUDENT_ID_SIZE];
    int request_id = 0;
    int vote = 0;
    if (!json_get_string(body, "studentId", student_id, sizeof(student_id)) ||
        !json_get_int(body, "requestId", &request_id) ||
        !json_get_int(body, "vote", &vote)) {
      send_error(socket_fd, 400, "INVALID_BODY",
                 "Can studentId, requestId va vote.");
      return;
    }
    HBServiceResult result = hb_backend_cast_vote(
        backend, student_id, request_id, vote, hb_now_ms());
    respond_service_result(socket_fd, &result);
    return;
  }
  if (strcmp(method, "POST") == 0 &&
      strcmp(path, "/api/queue/remove") == 0) {
    int request_id = 0;
    if (!json_get_int(body, "requestId", &request_id)) {
      send_error(socket_fd, 400, "INVALID_BODY", "Can requestId.");
      return;
    }
    HBServiceResult result = hb_backend_remove_request(backend, request_id);
    respond_service_result(socket_fd, &result);
    return;
  }
  if (strcmp(method, "POST") == 0 &&
      strcmp(path, "/api/queue/clear") == 0) {
    HBServiceResult result = hb_backend_clear_queue(backend);
    respond_service_result(socket_fd, &result);
    return;
  }
  if (strcmp(method, "POST") == 0 &&
      strcmp(path, "/api/queue/shuffle") == 0) {
    HBServiceResult result =
        hb_backend_shuffle_queue(backend, (uint32_t)hb_now_ms());
    respond_service_result(socket_fd, &result);
    return;
  }
  if (strcmp(method, "POST") == 0 &&
      strcmp(path, "/api/player/next") == 0) {
    HBServiceResult result = hb_backend_next(backend, hb_now_ms());
    respond_service_result(socket_fd, &result);
    return;
  }
  if (strcmp(method, "POST") == 0 &&
      strcmp(path, "/api/player/previous") == 0) {
    HBServiceResult result = hb_backend_previous(backend);
    respond_service_result(socket_fd, &result);
    return;
  }
  if (strcmp(method, "POST") == 0 && strcmp(path, "/api/reset") == 0) {
    hb_backend_destroy(backend);
    hb_backend_init(backend, true);
    send_json(socket_fd, 200,
              "{\"code\":\"RESET\",\"message\":\"Demo state da reset.\"}");
    return;
  }
  send_error(socket_fd, 404, "ROUTE_NOT_FOUND", "Khong tim thay API.");
}

static void handle_client(HBBackend *backend, int socket_fd) {
  char request[HB_HTTP_REQUEST_BYTES];
  char *body = NULL;
  ssize_t length = receive_request(socket_fd, request, sizeof(request), &body);
  if (length == -2) {
    send_error(socket_fd, 413, "REQUEST_TOO_LARGE", "Request qua lon.");
    return;
  }
  if (length <= 0 || body == NULL) {
    send_error(socket_fd, 400, "MALFORMED_HTTP", "HTTP request khong hop le.");
    return;
  }

  char method[12];
  char path[256];
  if (sscanf(request, "%11s %255s", method, path) != 2) {
    send_error(socket_fd, 400, "MALFORMED_REQUEST_LINE",
               "Khong doc duoc request line.");
    return;
  }
  route_request(backend, socket_fd, method, path, body);
}

int hb_http_serve(HBBackend *backend, unsigned short port) {
  struct sigaction action;
  memset(&action, 0, sizeof(action));
  action.sa_handler = stop_server;
  (void)sigemptyset(&action.sa_mask);
  (void)sigaction(SIGINT, &action, NULL);
  (void)sigaction(SIGTERM, &action, NULL);
  (void)signal(SIGPIPE, SIG_IGN);

  int server_fd = socket(AF_INET, SOCK_STREAM, 0);
  if (server_fd < 0) {
    perror("socket");
    return 1;
  }
  int reuse = 1;
  (void)setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR, &reuse, sizeof(reuse));

  struct sockaddr_in address;
  memset(&address, 0, sizeof(address));
  address.sin_family = AF_INET;
  address.sin_addr.s_addr = htonl(INADDR_ANY);
  address.sin_port = htons(port);
  if (bind(server_fd, (struct sockaddr *)&address, sizeof(address)) < 0) {
    perror("bind");
    (void)close(server_fd);
    return 1;
  }
  if (listen(server_fd, 32) < 0) {
    perror("listen");
    (void)close(server_fd);
    return 1;
  }

  printf("HeapBeat C backend dang chay tai http://127.0.0.1:%u\n", port);
  printf("Nhan Ctrl+C de dung server.\n");

  while (server_running) {
    int client_fd = accept(server_fd, NULL, NULL);
    if (client_fd < 0) {
      if (errno == EINTR) {
        continue;
      }
      perror("accept");
      break;
    }
    handle_client(backend, client_fd);
    (void)close(client_fd);
  }
  (void)close(server_fd);
  return 0;
}
