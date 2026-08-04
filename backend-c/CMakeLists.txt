cmake_minimum_required(VERSION 3.16)
project(heapbeat_backend_c VERSION 1.0 LANGUAGES C)

set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED ON)
set(CMAKE_C_EXTENSIONS OFF)

set(HEAPBEAT_CORE
    src/heap.c
    src/playlist.c
    src/spam_guard.c
    src/backend.c)

add_library(heapbeat_core STATIC ${HEAPBEAT_CORE})
target_include_directories(heapbeat_core PUBLIC include)

add_executable(heapbeat-backend src/http_server.c src/main.c)
target_link_libraries(heapbeat-backend PRIVATE heapbeat_core)

enable_testing()
add_executable(heapbeat-backend-tests tests/test_backend.c)
target_link_libraries(heapbeat-backend-tests PRIVATE heapbeat_core)
add_test(NAME heapbeat-backend-tests COMMAND heapbeat-backend-tests)

if(MSVC)
  target_compile_options(heapbeat_core PRIVATE /W4 /WX)
  target_compile_options(heapbeat-backend PRIVATE /W4 /WX)
  target_compile_options(heapbeat-backend-tests PRIVATE /W4 /WX)
else()
  target_compile_options(heapbeat_core PRIVATE -Wall -Wextra -Werror -pedantic)
  target_compile_options(heapbeat-backend PRIVATE -Wall -Wextra -Werror -pedantic)
  target_compile_options(heapbeat-backend-tests PRIVATE -Wall -Wextra -Werror -pedantic)
endif()
