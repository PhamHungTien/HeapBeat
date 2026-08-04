# 07 - Kiểm thử và báo cáo

## Chiến lược kiểm thử

HeapBeat cần kiểm thử ở 4 lớp:

- Unit test cho cấu trúc dữ liệu.
- Integration test cho request/vote/spam/license gate.
- UI test cho Player, queue, admin action.
- Manual test đa nền tảng và realtime.

## Unit test CTDL

### Circular Doubly Linked List

| Case | Input | Kết quả mong đợi |
| --- | --- | --- |
| Empty next | List rỗng, gọi `next()` | Trả `null`. |
| One node next | Thêm A, gọi `next()` | Vẫn là A. |
| One node prev | Thêm A, gọi `prev()` | Vẫn là A. |
| Wrap forward | Thêm A B C, current C, gọi `next()` | Quay về A. |
| Wrap backward | Current A, gọi `prev()` | Quay về C. |
| Add last | Thêm D sau A B C | Tail là D, D.next là head. |

### Max-Heap

| Case | Input | Kết quả mong đợi |
| --- | --- | --- |
| Insert | A score 1, B score 5, C score 3 | Root là B. |
| Upvote | C +3 | C nổi lên root nếu score cao nhất. |
| Downvote root | B -5 | Root được heapifyDown đúng. |
| Tie-break | A score 3 requestedAt sớm hơn B score 3 | A đứng trước B. |
| Remove middle | Xóa phần tử giữa heap | Heap invariant vẫn đúng. |
| Extract max | Pop root | Trả bài score cao nhất, root mới hợp lệ. |

### SpamGuard Hash Map

| Case | Input | Kết quả mong đợi |
| --- | --- | --- |
| 3 request | 3 bài khác nhau trong 10 phút | Cho phép. |
| 4 request | Request thứ 4 trong 10 phút | Block 30 phút. |
| Duplicate song | Cùng StudentID gửi lại cùng canonicalKey | Block 30 phút. |
| Purge | Student có 2 request active rồi bị block | Cả 2 bị remove khỏi heap. |
| Expired window | Request cũ hơn 10 phút | Không tính vào limit mới. |
| Block expiry | Sau `blockedUntil` | Cho phép request lại, state được reset hợp lý. |

## Integration test

### Request bài hợp lệ

1. Catalog có song `approved`.
2. Student `SV001` gửi request.
3. Backend gọi License Gate.
4. SpamGuard trả allowed.
5. QueueService insert vào heap.
6. WebSocket phát `queue.updated`.

Kỳ vọng: HTTP 201, queue có bài mới, heap invariant đúng.

### Request bài thiếu license

1. Catalog có song `pending_license_review`.
2. Student request bài đó.

Kỳ vọng: HTTP 409 `SONG_NOT_APPROVED`, heap không đổi.

### Vote realtime

1. Queue có A score 1, B score 2.
2. Student upvote A hai lần từ 2 account khác nhau.

Kỳ vọng: A lên root, tất cả client nhận `queue.updated`.

### Spam duplicate

1. `SV001` request A.
2. `SV001` request A lần nữa.

Kỳ vọng: `SV001` bị block, request A trước đó bị purge khỏi heap, broadcast `spam.blocked`.

### Player ended

1. Queue có A root.
2. Player gọi `/player/ended`.

Kỳ vọng: Backend `extractMax`, trả A, A được thêm vào playlist/history.

## UI test checklist

- Now Playing hiển thị title, artist, artwork nếu có.
- Attribution không bị che hoặc quá nhỏ.
- Queue rank đổi ngay sau vote.
- Button upvote/downvote disable đúng khi user đã vote cùng chiều.
- Trạng thái block hiển thị thời gian còn lại.
- Admin remove một bài thì queue biến mất ở mọi client.
- Layout không vỡ ở 390x844, 768x1024, 1440x900.
- Player không phát bài chưa duyệt license.

## Manual test đa nền tảng

| Nền tảng | Việc cần kiểm |
| --- | --- |
| Windows | Chrome/Edge, PWA standalone, HTML5 Audio và responsive. |
| macOS | Safari/Chrome, PWA standalone và quyền phát audio. |
| Linux | Chrome/Firefox, production build và audio output. |
| Android | Layout mobile, Add to Home Screen và kết nối LAN. |
| iOS | Safari, Add to Home Screen và chính sách autoplay của HTML5 Audio. |

## Test bản quyền

- Import bài không có `licenseUrl`: bị từ chối.
- Import bài có `sourceUrl` nhưng thiếu attribution: bị từ chối hoặc pending review.
- Bài license hết hạn: không phát.
- Bài từ Spotify/YouTube URL trực tiếp: bị từ chối nếu định dùng làm `audioUrl`.
- Export license report có đầy đủ title, artist, source, license, verifiedAt.

## Gợi ý cấu trúc báo cáo

### 1. Giới thiệu

- Vấn đề tại phòng tự học.
- Mục tiêu: công bằng, realtime, chống spam, tôn trọng bản quyền.

### 2. Phân tích yêu cầu

- Actor.
- Use case.
- Functional/non-functional requirements.

### 3. Kiến trúc

- Sơ đồ client/backend/player.
- Lý do chọn React + TypeScript + PWA.
- Luồng request/vote/playback.

### 4. Thiết kế CTDL

- Circular Doubly Linked List.
- Max-Heap có index map.
- Hash Map chống spam.
- Bảng độ phức tạp.

### 5. Thiết kế API

- REST endpoints.
- WebSocket events.
- Mã lỗi.

### 6. Bản quyền và nguồn nhạc

- Nguồn được phép dùng.
- Nguồn chỉ dùng metadata/link.
- Quy trình duyệt license.

### 7. Kiểm thử

- Bảng test case.
- Ảnh/chụp màn hình kết quả.
- Các lỗi đã xử lý.

### 8. Kết luận và phát triển

- Những gì đã đạt.
- Hạn chế: mobile packaging, license thật, multi-room scale.
- Hướng mở rộng: SSO trường, admin dashboard, vote decay, Jamendo/Openverse import.

## Demo script 5 phút

1. Mở Player/Kiosk, queue đang rỗng.
2. Student `SV001` gửi bài A.
3. Student `SV002` gửi bài B.
4. Upvote B để B lên đầu heap.
5. Nhấn Next hoặc giả lập bài kết thúc, B được phát.
6. Nhấn Prev/Next để chứng minh Circular Doubly Linked List.
7. `SV001` gửi quá 3 bài hoặc gửi trùng A.
8. Hệ thống block `SV001` và purge request của `SV001`.
9. Mở license info của bài đang phát.

## Câu nên nói khi bảo vệ

- "Max-Heap giúp lấy bài có vote cao nhất trong O(log n), và index map giúp cập nhật vote không phải quét toàn bộ queue."
- "Circular Doubly Linked List phù hợp với player vì node cuối nối về node đầu, nên Repeat All là hành vi tự nhiên của cấu trúc."
- "Hash Map giúp kiểm tra spam theo StudentID trung bình O(1), đồng thời lưu requestIds để purge nhanh khi block."
- "Ứng dụng không coi API nghe nhạc là giấy phép bản quyền; mỗi bài phát cần license record riêng."
