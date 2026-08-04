CC ?= cc
CFLAGS ?= -std=c11 -O2 -Wall -Wextra -Werror -pedantic
CPPFLAGS ?= -Iinclude

BUILD_DIR := build
CORE_SOURCES := src/heap.c src/playlist.c src/spam_guard.c src/backend.c
SERVER_SOURCES := $(CORE_SOURCES) src/http_server.c src/main.c
TEST_SOURCES := $(CORE_SOURCES) tests/test_backend.c
SERVER_BIN := $(BUILD_DIR)/heapbeat-backend
TEST_BIN := $(BUILD_DIR)/test-backend

.PHONY: all run test clean

all: $(SERVER_BIN)

$(BUILD_DIR):
	mkdir -p $(BUILD_DIR)

$(SERVER_BIN): $(SERVER_SOURCES) include/heapbeat.h | $(BUILD_DIR)
	$(CC) $(CPPFLAGS) $(CFLAGS) $(SERVER_SOURCES) -o $@

$(TEST_BIN): $(TEST_SOURCES) include/heapbeat.h | $(BUILD_DIR)
	$(CC) $(CPPFLAGS) $(CFLAGS) $(TEST_SOURCES) -o $@

run: $(SERVER_BIN)
	./$(SERVER_BIN)

test: $(TEST_BIN)
	./$(TEST_BIN)

clean:
	rm -f $(SERVER_BIN) $(TEST_BIN)
	rmdir $(BUILD_DIR) 2>/dev/null || true
