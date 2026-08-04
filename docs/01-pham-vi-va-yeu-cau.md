# 01 - Phạm vi và yêu cầu

## Tóm tắt

HeapBeat mô phỏng hệ thống phát nhạc chờ cộng đồng cho phòng tự học. Một thiết bị ở phòng đóng vai trò Player/Kiosk, còn sinh viên dùng điện thoại hoặc máy tính để gửi bài, vote và xem hàng đợi. Hệ thống chọn bài tiếp theo bằng Max-Heap, lưu playlist đã phát bằng Circular Doubly Linked List và chống spam bằng Hash Map.

## Vai trò người dùng

- Sinh viên: tìm bài hợp lệ, gửi request, upvote/downvote, xem bài đang phát và queue.
- Người quản lý phòng: bật/tắt phòng, duyệt hoặc xóa bài, block/unblock sinh viên, cấu hình âm lượng và chính sách bản quyền.
- Player/Kiosk: phát nhạc đã được duyệt, hiển thị now playing, tự động chuyển bài khi kết thúc.
- Hệ thống: đồng bộ realtime, heapify sau mỗi vote, ghi log, thực thi chống spam.

## Yêu cầu chức năng

### F1. Quản lý phòng phát

- Giao diện cho phép chọn không gian trình diễn theo mã phòng.
- Phiên bản nộp tập trung vào một hàng đợi công cộng do backend C quản lý tập trung.
- Kiến trúc nhiều hàng đợi độc lập theo phòng được xác định là hướng mở rộng sau MVP.

### F2. Tìm và thêm bài hát

- Sinh viên tìm bài từ nguồn hợp pháp: Openverse, Jamendo, Internet Archive hoặc catalog nội bộ đã được cấp quyền.
- Mỗi bài phải có `sourceUrl`, `licenseType`, `licenseUrl`, `attributionText` và trạng thái kiểm duyệt.
- Nếu bài đã tồn tại trong queue, request mới không tạo bản sao mà có thể được tính như một upvote hợp lệ.
- Cho phép thêm bài mới vào cuối Circular Doubly Linked List khi bài được phát hoặc được admin ghim vào playlist.

### F3. Phát nhạc cơ bản

- Player có Play/Pause, Next, Previous, Repeat All.
- Next/Previous di chuyển trên Circular Doubly Linked List.
- Khi queue Max-Heap còn bài, bài ở đỉnh heap được pop ra làm bài tiếp theo.
- Khi queue trống, Player lặp playlist vòng hiện có.

### F4. Upvote/Downvote realtime

- Bài đang chờ phát được lưu trong Max-Heap.
- Upvote tăng điểm ưu tiên và gọi `heapifyUp`.
- Downvote giảm điểm ưu tiên và gọi `heapifyDown` khi cần.
- Bài có điểm cao nhất luôn ở `heap[0]`.
- Tie-breaker khuyến nghị: điểm vote cao hơn trước, nếu bằng nhau thì bài request sớm hơn trước.

### F5. Chống spam và phá hoại

- Hash Map lưu trạng thái theo StudentID đã hash.
- Nếu một sinh viên gửi quá 3 bài trong 10 phút, hệ thống block 30 phút.
- Nếu một sinh viên gửi trùng cùng bài nhiều lần, hệ thống block 30 phút.
- Khi block, toàn bộ request đang chờ của sinh viên đó bị xóa khỏi Max-Heap.
- Mỗi sinh viên chỉ được vote một lần cho một bài theo một chiều tại một thời điểm; đổi từ upvote sang downvote sẽ cập nhật điểm chênh lệch.

### F6. Quản trị và kiểm duyệt

- Admin có thể xóa bài không phù hợp.
- Admin có thể khóa nguồn nhạc không đủ license.
- Admin có thể xem lý do block và thời điểm hết block.
- Log các hành động quan trọng: request, vote, pop heap, block, purge, skip.

## Yêu cầu phi chức năng

- Realtime: vote và queue cập nhật trong vòng 1 giây trong mạng LAN/trường.
- Độ đúng CTDL: mọi thay đổi điểm vote phải giữ invariant Max-Heap.
- Bảo mật: không lưu StudentID thô nếu không cần; dùng hash có salt phía server.
- Bản quyền: không phát audio nếu chưa có license record hợp lệ.
- Đa nền tảng: web/PWA responsive trên Windows, macOS, Linux, iOS và Android.
- Offline demo: có thể chạy bằng dữ liệu mẫu và audio mẫu hợp pháp khi không có internet.

## Phạm vi MVP

- Một phòng phát duy nhất.
- StudentID nhập thủ công.
- Tìm bài từ catalog mẫu hợp pháp.
- Queue Max-Heap, vote realtime trong cùng máy hoặc cùng LAN.
- Player HTML5 Audio chạy trong trình duyệt; Admin là thiết bị điều khiển loa.
- Spam rule: quá 3 request/10 phút hoặc duplicate song request.
- Tài liệu giải thích rõ CTDL và độ phức tạp.

## Mở rộng sau MVP

- Nhiều phòng phát song song.
- QR code tham gia phòng.
- Admin moderation dashboard.
- Vote decay theo thời gian để bài mới vẫn có cơ hội.
- Import catalog từ Openverse/Jamendo/Internet Archive.
- Xác thực bằng email trường, SSO hoặc mã sinh viên.
- Đồng bộ cloud backend và push notification.
- Màn hình kiosk full-screen cho TV/sảnh.

## Tiêu chí hoàn thành đồ án

- Demo được thêm bài, vote, heap tự sắp xếp và pop bài có vote cao nhất.
- Demo được Next/Prev/Repeat bằng danh sách liên kết vòng kép.
- Demo được block spam và xóa toàn bộ bài của sinh viên bị block khỏi queue.
- Có báo cáo kèm sơ đồ kiến trúc, mô tả CTDL, pseudocode và test case.
- Có giải thích chiến lược API/bản quyền, nêu rõ nguồn nhạc nào được phép phát và nguồn nào chỉ dùng metadata/link.
