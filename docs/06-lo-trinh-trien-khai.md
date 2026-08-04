# 06 - Lộ trình triển khai

## Phase 0 - Chuẩn bị dữ liệu hợp pháp

Mục tiêu: có catalog demo không vi phạm bản quyền.

Việc cần làm:

- Tạo 8-12 bài mẫu bằng audio tự tạo, public domain hoặc CC hợp lệ.
- Lưu metadata: title, artist, duration, audioUrl, licenseType, licenseUrl, sourceUrl, attributionText.
- Đặt tất cả bài mẫu ở trạng thái `approved`.
- Thêm 2-3 bài cố tình thiếu license để demo License Gate từ chối.

Tiêu chí hoàn thành:

- Player chỉ phát được bài `approved`.
- Màn hình now playing hiển thị attribution.

## Phase 1 - Cài CTDL thuần TypeScript

Mục tiêu: chứng minh yêu cầu đồ án bằng code rõ ràng.

Việc cần làm:

- Viết `CircularDoublyLinkedList.ts`.
- Viết `MaxHeap.ts` có `indexByRequestId`.
- Viết `SpamGuard.ts`.
- Viết unit test cho từng CTDL.

Tiêu chí hoàn thành:

- Test heapify pass với insert, upvote, downvote, remove, extractMax.
- Test linked list pass với empty, one node, multi node, wrap-around.
- Test spam pass với duplicate và quá 3 request/10 phút.

## Phase 2 - UI Player

Mục tiêu: xây dựng giao diện HeapBeat responsive cho máy phát và điện thoại.

Màn hình cần có:

- Now Playing.
- Queue ranking.
- Playlist/history.
- Controls: Play/Pause, Next, Prev, Repeat.
- Attribution/License badge.
- Admin mini panel để skip/remove.

Tiêu chí hoàn thành:

- Click Next/Prev chạy đúng circular playlist.
- Khi bài kết thúc, tự gọi next.
- Không có text hướng dẫn thừa trong UI; chỉ có control rõ ràng.

## Phase 3 - Request và vote local

Mục tiêu: demo end-to-end trên một máy.

Việc cần làm:

- Form nhập StudentID.
- Search catalog nội bộ.
- Request bài.
- Upvote/downvote queue.
- Block sinh viên spam.
- Purge request khỏi heap khi block.

Tiêu chí hoàn thành:

- Request thứ 4 trong 10 phút bị block.
- Gửi trùng bài bị block.
- Queue tự đổi rank sau mỗi vote.
- Bài có vote cao nhất được phát tiếp theo.

## Phase 4 - Backend realtime

Mục tiêu: nhiều thiết bị cùng vote.

Việc cần làm:

- Tạo backend REST + WebSocket.
- Chuyển Max-Heap và SpamGuard sang backend.
- Web player subscribe WebSocket.
- Student client gửi request/vote qua REST.
- Broadcast `queue.updated`, `nowPlaying.changed`, `spam.blocked`.

Tiêu chí hoàn thành:

- Hai browser/device thấy queue cập nhật gần realtime.
- Player nhận next track từ server.
- Restart server rebuild heap từ database.

## Phase 5 - API nhạc hợp pháp

Mục tiêu: mở rộng catalog nhưng vẫn kiểm soát bản quyền.

Việc cần làm:

- Tích hợp Openverse audio search ở backend.
- Tích hợp Internet Archive metadata import.
- Tùy chọn Jamendo search nếu có API key.
- Thêm màn hình admin duyệt license.
- Không cho bài chưa duyệt vào Player.

Tiêu chí hoàn thành:

- Import bài tạo trạng thái `pending_license_review`.
- Admin duyệt xong mới request được.
- Export được danh sách bài + license evidence.

## Phase 6 - PWA và đa nền tảng

Mục tiêu: một web build dùng được trên desktop và mobile.

Việc cần làm:

- Thêm Web App Manifest và service worker.
- Kiểm tra production build bằng HTTP server.
- Kiểm tra desktop 1600x1000 và mobile 390x844.
- Kiểm tra Add to Home Screen và chính sách autoplay trên thiết bị thật.

Tiêu chí hoàn thành:

- Web/PWA chạy được từ production build.
- UI không vỡ ở mobile viewport.
- Tài liệu ghi rõ lệnh dev/build cho từng nền tảng.

## Phase 7 - Hoàn thiện báo cáo

Mục tiêu: nộp đồ án rõ kỹ thuật và đúng yêu cầu.

Nội dung báo cáo:

- Bối cảnh bài toán.
- Phân tích yêu cầu.
- Kiến trúc hệ thống.
- Thiết kế CTDL.
- Pseudocode chính.
- API và bản quyền.
- Ảnh màn hình demo.
- Test case và kết quả.
- Hạn chế và hướng phát triển.

Tiêu chí hoàn thành:

- Giảng viên nhìn thấy rõ Circular Doubly Linked List, Max-Heap, Hash Map.
- Có bảng độ phức tạp.
- Có demo spam block và heapify realtime.
- Có tuyên bố không dùng nguồn nhạc vi phạm bản quyền.

## Ưu tiên nếu thời gian ít

1. CTDL + unit test.
2. UI local demo.
3. Spam block + purge.
4. License-safe sample catalog.
5. Realtime WebSocket.
6. API Openverse/Jamendo.
7. PWA và kiểm thử thiết bị thật.

Nếu chỉ còn rất ít thời gian, nên bỏ tích hợp API nhạc thật và dùng catalog mẫu hợp pháp. Phần API có thể trình bày trong tài liệu như hướng mở rộng an toàn.
