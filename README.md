# HeapBeat

[![License: MIT](https://img.shields.io/badge/License-MIT-087F78.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-19-173C4A.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-173C4A.svg)](https://www.typescriptlang.org/)
[![C](https://img.shields.io/badge/C-11-173C4A.svg)](backend-c/README.md)

HeapBeat is a collaborative music queue for school lobbies and self-study
rooms. Students request tracks and cast upvotes or downvotes; administrators
control playback, review music sources, and monitor policy violations.

The project demonstrates three core data structures through observable system
behavior:

- a **Max-Heap with a request-index map** for real-time queue ranking;
- a **circular doubly linked list** for Next, Previous, and Repeat All;
- a **Hash Map** for per-Student-ID request windows and spam blocking.

Official repository:
[github.com/PhamHungTien/HeapBeat](https://github.com/PhamHungTien/HeapBeat)

## Live demo

- Website: [https://phamhungtien.synology.me/heapbeat/](https://phamhungtien.synology.me/heapbeat/)
- Administrator: `admin` / `admin@123`
- Students create their own accounts from the sign-up screen.

The credentials and bundled audio are provided only for coursework evaluation
and demonstration.

## Current architecture

HeapBeat now uses one authoritative runtime path:

1. React renders the interface and sends JSON commands to `public/api.php`.
2. PHP acts only as a reverse proxy to the C11 service on `127.0.0.1:8081`.
3. C authoritatively performs SpamGuard, vote changes, heap rebalancing,
   `extractMax`, and circular-playlist navigation.
4. React polls one combined C snapshot; the former revision/state/patch
   document is no longer used.

During Vite development, its proxy sends the same routes directly to C. Demo
accounts remain local browser data and are separate from the queue backend.

## Features

- A focused single-room coursework runtime with one authoritative public queue.
- Immediate heap rebalancing after every upvote or downvote.
- Duplicate-song detection and a limit of three requests per ten-minute
  sliding window.
- Thirty-minute blocking with automatic removal of the offender's active
  requests and votes.
- Administrator and student roles, license review, moderation, and statistics.
- HTML5 Audio playback using 18 bundled piano MP3 files.
- Cross-tab queue synchronization through the authoritative C snapshot.
- Installable PWA behavior and responsive desktop/mobile layouts.
- A C11 REST backend with Max-Heap, index map, circular doubly linked list, and
  open-addressing SpamGuard.

## Technology

- React 19, TypeScript 5.8, Vite 7, and Vitest
- HTML5 Audio, Local Storage, Service Worker, and Web App Manifest
- PHP reverse proxy for NAS deployment
- C11, POSIX sockets, Make, and CMake for the authoritative backend
- XeLaTeX for the scientific report and Beamer slide sources
- PowerPoint export for the presentation deck

## Getting started — web application

Requirements: Node.js 20 or later and npm.

```bash
git clone https://github.com/PhamHungTien/HeapBeat.git
cd HeapBeat
npm ci
npm run backend:c
./backend-c/build/heapbeat-backend --port 8081
```

In a second terminal:

```bash
npm run dev
```

Open [http://127.0.0.1:1420](http://127.0.0.1:1420).

Main commands:

```bash
npm run check       # Formatting check, TypeScript tests, production build
npm run test        # Run the Vitest suite
npm run build       # Type-check and build the web application
npm run backend:c   # Build the standalone C11 HTTP backend
npm run test:backend:c # Build and test the standalone C11 backend
npm run report      # Compile report/main.tex
npm run slides      # Compile presentation/slides.tex
npm run release     # Create the submission package under release/
```

## Getting started — C11 backend

Requirements: a C11 compiler (`clang` or `gcc`) and `make`.

```bash
cd backend-c
make
make test
./build/heapbeat-backend --port 8081
```

Quick API check:

```bash
curl http://127.0.0.1:8081/health
curl http://127.0.0.1:8081/api/queue
curl -X POST http://127.0.0.1:8081/api/vote \
  -H 'Content-Type: application/json' \
  -d '{"studentId":"SV900","requestId":1003,"vote":1}'
curl -X POST http://127.0.0.1:8081/api/player/next
```

See [backend-c/README.md](backend-c/README.md) for the complete API table,
algorithm flow, spam policy, build instructions, and presentation sequence.

## Repository structure

```text
HeapBeat/
├── src/                         React/TypeScript application
│   ├── app/model.ts             Domain model, reducer, and persistence
│   ├── audio/                   HTMLAudioElement lifecycle
│   ├── components/              Catalog, player, queue, sidebar, and modals
│   ├── data/catalog.ts          Demo catalog and license metadata
│   ├── lib/heapbeat.ts          TypeScript data structures and algorithms
│   ├── App.tsx                  Application orchestration
│   └── App.css                  Responsive visual system
├── tests/heapbeat.test.ts       TypeScript algorithm/application tests
├── public/
│   ├── api.php                  PHP → C11 reverse proxy
│   ├── music/                   18 bundled demo MP3 files
│   ├── licenses/                Audio attribution and usage notice
│   ├── manifest.webmanifest     PWA metadata
│   └── sw.js                    Service worker
├── backend-c/                   Standalone C11 REST backend
│   ├── include/heapbeat.h       Shared structures and public API
│   ├── src/heap.c               Max-Heap, heapify, vote flow, index map
│   ├── src/playlist.c           Circular doubly linked list
│   ├── src/spam_guard.c         StudentID Hash Map and blocking policy
│   ├── src/backend.c            Authoritative business-service flow
│   ├── src/http_server.c        HTTP/JSON router
│   ├── src/main.c               CLI entry point
│   ├── tests/test_backend.c     C integration and invariant tests
│   ├── Makefile                 Primary build entry point
│   └── CMakeLists.txt           Alternative CMake build
├── docs/                        Requirements, architecture, API, and testing
├── report/                      XeLaTeX report source, figures, and main.pdf
├── presentation/                Beamer source, PDF, PPTX, and speaker script
├── submission/                  Lightweight project-link submission PDF
├── scripts/create-release.mjs   Reproducible submission packager
├── LICENSE                      MIT License for project source code
└── package.json                 Web build, test, report, and release commands
```

Generated or local-only directories such as `node_modules/`, `dist/`,
`release/`, `tmp/`, `output/`, and `backend-c/build/` are intentionally not
part of the source tree committed to Git.

## Algorithm behavior

### Max-Heap and voting

Queue items are ordered by score, upvote count, shuffle order, and request
time. A `requestId -> heapIndex` map is updated whenever two nodes swap.
Changing a vote computes `delta = nextVote - previousVote`: a positive delta
uses `heapifyUp`, while a negative delta uses `heapifyDown`. Peeking the next
track is `O(1)`; insertion, vote adjustment, removal, and `extractMax` are
`O(log n)`.

### Circular doubly linked list

The playback list maintains `head->prev == tail` and `tail->next == head`.
Moving Next or Previous only follows one pointer, including wrap-around, so
both operations are `O(1)`.

### SpamGuard Hash Map

Each normalized Student ID maps to recent request timestamps, active request
IDs, and a blocking deadline. Old timestamps are pruned from a ten-minute
sliding window. A duplicate request or a fourth request within the window
triggers a thirty-minute block and returns the exact queue entries that must
be removed.

## Documentation and deliverables

- [Scope and requirements](docs/01-pham-vi-va-yeu-cau.md)
- [API and music licensing](docs/02-api-va-ban-quyen.md)
- [Web/PWA architecture](docs/03-kien-truc-da-nen-tang.md)
- [Data-structure design](docs/04-thiet-ke-ctdl.md)
- [Backend API and synchronization](docs/05-api-backend-realtime.md)
- [Implementation roadmap](docs/06-lo-trinh-trien-khai.md)
- [Testing and reporting](docs/07-kiem-thu-va-bao-cao.md)
- [Scientific report PDF](report/main.pdf)
- [Presentation PDF](presentation/slides.pdf)
- [Presentation PowerPoint](presentation/slides.pptx)
- [Speaker script PDF](presentation/Kich-ban-thuyet-trinh.pdf)
- [Project-link submission PDF](submission/project-links.pdf)

## Audio and licensing

Playback uses the 18 local piano MP3 files under `public/music/`; the
application does not stream from a third-party music API. Artist metadata and
demo-use limitations are documented in
[public/licenses/HEAPBEAT-PIANO-NOTICE.txt](public/licenses/HEAPBEAT-PIANO-NOTICE.txt).
Possessing an audio file does not automatically grant public-performance
rights, so every future import must retain its source, license, attribution,
and playback-rights review.

The HeapBeat source code is released under the [MIT License](LICENSE). Bundled
audio and third-party assets may be subject to separate terms in their
accompanying notices.
