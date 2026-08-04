# 02 - API và bản quyền

Tài liệu này không phải tư vấn pháp lý. Nó là checklist kỹ thuật để đồ án không đi vào hướng rủi ro như tải nhạc lậu, bypass DRM hoặc phát nhạc thương mại ở nơi công cộng khi chưa có quyền. Các điều khoản API có thể thay đổi, nên trước khi nộp hoặc triển khai thật cần kiểm tra lại nguồn chính thức.

## Kết luận khuyến nghị

**Trạng thái bản nộp:** ứng dụng đóng gói 18 bản piano MP3 do chủ dự án
cung cấp và phát bằng HTML5 Audio. Catalog lưu người biểu diễn đọc từ ID3, nguồn
file cục bộ và thông báo tại
`public/licenses/HEAPBEAT-PIANO-NOTICE.txt`. Release không tự động nhập hoặc
phát nhạc từ API. Vì đây là các bản cover, trước khi phát ngoài phạm vi demo nội
bộ vẫn phải xác minh cả quyền bản ghi, quyền tác phẩm và quyền biểu diễn công
cộng nếu có.

Hướng an toàn nhất cho HeapBeat:

1. Dùng catalog nội bộ gồm các file audio tự tạo, được trường cấp quyền, public domain hoặc Creative Commons phù hợp.
2. Dùng Openverse/Internet Archive để tìm nội dung mở, nhưng phải xác minh license từng bài tại trang nguồn.
3. Dùng Jamendo cho nhạc độc lập; với môi trường công cộng/thương mại, cần kiểm tra gói Jamendo Licensing hoặc giấy phép tương ứng.
4. Dùng MusicBrainz/Cover Art Archive cho metadata, không dùng để phát audio.
5. Tránh dùng YouTube/Spotify/Apple Music làm nguồn phát tập trung cho loa phòng tự học nếu chưa có thỏa thuận bản quyền riêng.

## Ma trận lựa chọn API

| API/Nguồn | Dùng tốt cho | Có nên phát audio trong HeapBeat? | Ghi chú bản quyền |
| --- | --- | --- | --- |
| Catalog nội bộ | Demo ổn định, kiểm soát license | Có | Tốt nhất nếu mỗi file có license record rõ ràng. |
| Openverse API | Tìm audio Creative Commons/public domain | Có điều kiện | Openverse là bộ máy tìm kiếm media mở, nhưng phải tự xác minh license tại nguồn gốc. |
| Internet Archive API | Public domain/CC audio, metadata, file | Có điều kiện | Kiểm tra license từng item, không giả định mọi file đều dùng được. |
| Jamendo API | Nhạc độc lập, search, radio, track | Có điều kiện | API miễn phí cho non-commercial; public/commercial use cần giấy phép phù hợp. |
| MusicBrainz API | Metadata nghệ sĩ, track, release | Không | Không cung cấp quyền phát audio. |
| Spotify Web API | Metadata, playlist, điều khiển playback theo tài khoản | Không cho loa công cộng | Streaming chỉ cho Premium subscriber; preview có giới hạn mục đích quảng bá. |
| Apple Music API/MusicKit | Playback cho người dùng Apple Music đã đăng nhập | Không cho loa công cộng mặc định | Phù hợp khi từng user có subscription; không tự cấp quyền public performance. |
| YouTube Data API/Embed | Link/nhúng video theo player chính thức | Không khuyến nghị | Điều khoản hạn chế download, public streaming và sử dụng ngoài tính năng YouTube cho phép. |

## API nên dùng

### 1. Catalog nội bộ có license

Đây là lựa chọn tốt nhất cho đồ án vì ổn định, không phụ thuộc quota và dễ chứng minh không vi phạm bản quyền.

Nguồn file có thể là:

- Bài nhạc do nhóm tự sáng tác/ghi âm.
- Audio public domain.
- Audio CC0, CC BY hoặc CC BY-SA nếu tuân thủ attribution/share-alike.
- Bài từ thư viện trả phí/royalty-free có giấy phép cho public playback.
- Bài được tác giả/trường cấp quyền bằng văn bản.

Mỗi bài trong database nên có:

```ts
type LicenseRecord = {
  licenseType: "CC0" | "CC-BY" | "CC-BY-SA" | "CC-BY-NC" | "PUBLIC_DOMAIN" | "COMMERCIAL_LICENSE" | "SCHOOL_OWNED";
  licenseUrl: string;
  sourceUrl: string;
  attributionText: string;
  verifiedBy: string;
  verifiedAt: string;
  publicPlaybackAllowed: boolean;
  expiresAt?: string;
};
```

### 2. Openverse API

Openverse là lựa chọn tốt để tìm audio mở vì API tập trung vào media Creative Commons và public domain. Tuy vậy, Openverse tự nêu rằng họ không bảo đảm tuyệt đối độ chính xác của license, nên HeapBeat cần lưu `sourceUrl` và yêu cầu admin bấm xác minh trước khi đưa bài vào catalog phát.

Luồng khuyến nghị:

1. Sinh viên tìm bài qua Openverse audio search.
2. App hiển thị title, creator, source, license.
3. Bài mới vào trạng thái `pending_license_review`.
4. Admin mở trang nguồn, xác minh license, rồi chuyển sang `approved`.
5. Player chỉ phát bài `approved`.

Không nên tự động phát ngay kết quả Openverse nếu chưa xác minh.

### 3. Internet Archive API

Internet Archive có API tìm kiếm và metadata cho nhiều loại nội dung, bao gồm audio. Đây là nguồn tốt cho public domain/CC, nhưng chất lượng metadata và license phụ thuộc từng item.

Luồng khuyến nghị:

- Dùng Advanced Search để lọc `mediatype:audio`.
- Gọi Metadata API để lấy file, creator, title, license, item page.
- Chỉ import file có license rõ ràng.
- Lưu snapshot metadata vào database để báo cáo đồ án có bằng chứng.

### 4. Jamendo API

Jamendo có API cho catalog nhạc độc lập, search track/radio và OAuth. Đây là nguồn tiện để demo vì có nhiều track, nhưng cần đọc kỹ license:

- Jamendo API nêu content trên nền tảng được phát hành theo Creative Commons.
- API miễn phí cho non-commercial use.
- Use case ở không gian công cộng hoặc có yếu tố thương mại nên dùng Jamendo Licensing/gói phù hợp.

Với đồ án trong lớp, có thể dùng Jamendo ở chế độ non-commercial demo. Với triển khai thật tại sảnh/phòng tự học, nên coi đây là use case public playback và xin giấy phép phù hợp.

### 5. MusicBrainz API

MusicBrainz phù hợp để chuẩn hóa metadata: tên nghệ sĩ, album, recording ID, release date, ISRC. API này không cấp quyền phát audio. HeapBeat có thể dùng MusicBrainz để tránh trùng bài bằng `musicbrainzRecordingId` hoặc chuẩn hóa tên bài.

## API chỉ nên dùng hạn chế

### Spotify

Spotify Web API rất tốt cho metadata và playlist cá nhân, nhưng không phải nguồn audio tự do. Chính sách developer của Spotify giới hạn streaming nhạc qua nền tảng Spotify cho Premium subscribers, và preview clip cũng có ràng buộc mục đích quảng bá. Vì vậy:

- Có thể dùng link mở Spotify hoặc metadata nếu tuân thủ policy.
- Không dùng Spotify làm nguồn phát loa phòng tự học.
- Không download, cache hoặc chuyển đổi Spotify content.

### Apple Music/MusicKit

MusicKit cho phép user đã cấp quyền truy cập Apple Music catalog và phát trong app/website theo tài khoản/subscription. Điều này phù hợp cho trải nghiệm cá nhân, không tự động biến app thành hệ thống phát nhạc công cộng hợp pháp.

- Có thể dùng nếu mỗi user phát bằng tài khoản Apple Music của họ.
- Không coi Apple Music API là giấy phép public performance cho một phòng.
- Không lưu/copy file audio từ Apple Music.

### YouTube

YouTube cho phép nghe/xem qua service và embeddable player theo điều khoản, nhưng hạn chế download, phát công cộng ngoài phạm vi cho phép và sử dụng content độc lập khỏi service.

- Có thể mở link YouTube bên ngoài hoặc nhúng player đúng chuẩn cho mục đích phù hợp.
- Không dùng YouTube làm nguồn MP3.
- Không tự động stream nhạc YouTube ra loa công cộng.

## Chính sách bản quyền trong app

### Trạng thái bài hát

```ts
type SongApprovalStatus =
  | "draft"
  | "pending_license_review"
  | "approved"
  | "rejected"
  | "expired";
```

Player chỉ nhận bài `approved` và `publicPlaybackAllowed = true`.

### Quy tắc import bài

- Không import audio nếu thiếu `licenseUrl` hoặc `sourceUrl`.
- Không import nếu license là `CC-BY-NC` mà app có yếu tố thương mại, tài trợ hoặc quảng cáo.
- Không import nếu license là `CC-BY-ND` và app có chỉnh sửa/cắt ghép audio.
- Không import nếu không thể xác định tác giả để attribution.
- Không dùng file từ nguồn "free download" không có license rõ ràng.

### Attribution

Mỗi bài CC BY/CC BY-SA cần hiển thị ít nhất:

- Tên bài.
- Tác giả/creator.
- License.
- Link nguồn.
- Link license.

Ví dụ:

```text
"Study Loop" by Nguyen A, licensed CC BY 4.0, source: https://example.edu/song
```

### Public performance

Phát nhạc trong sảnh/phòng tự học có thể bị xem là public performance. API phát nhạc không tự cấp quyền này. Ở Việt Nam, cần kiểm tra quyền với chủ sở hữu hoặc tổ chức quản lý quyền liên quan; VCPMC là tổ chức quản lý tập thể quyền tác giả âm nhạc tại Việt Nam. Với đồ án, nên ghi rõ "demo bằng audio có license mở hoặc audio tự tạo".

## Thiết kế dữ liệu chống vi phạm

```ts
type Song = {
  id: string;
  canonicalKey: string;
  title: string;
  artist: string;
  durationSec: number;
  audioUrl: string;
  artworkUrl?: string;
  sourceProvider: "internal" | "openverse" | "internet_archive" | "jamendo" | "manual";
  sourceUrl: string;
  license: LicenseRecord;
  approvalStatus: SongApprovalStatus;
};
```

`canonicalKey` nên được tạo từ provider ID, MusicBrainz Recording ID hoặc hash của `title + artist + duration` để phát hiện trùng.

## Checklist trước khi phát một bài

- Bài có `approvalStatus = approved`.
- `publicPlaybackAllowed = true`.
- License chưa hết hạn.
- Attribution hiển thị được trong màn hình now playing hoặc trang credits.
- Audio URL không phải link scrape/bypass từ YouTube/Spotify/Apple Music.
- File không nằm ngoài phạm vi license.
- Admin có thể export danh sách bài và license evidence.

## Nguồn tham khảo chính thức

- Openverse API: https://api.openverse.org/
- Openverse API Terms: https://wordpress.github.io/openverse-api/terms_of_service.html
- Creative Commons licenses: https://creativecommons.org/cc-licenses/
- Internet Archive Developer Portal: https://archive.org/developers/
- Jamendo API docs: https://developer.jamendo.com/v3.0/docs
- Jamendo API Terms: https://devportal.jamendo.com/signup
- MusicBrainz API: https://musicbrainz.org/doc/MusicBrainz_API
- Spotify Developer Policy: https://developer.spotify.com/policy
- Apple MusicKit: https://developer.apple.com/musickit/
- YouTube Terms: https://www.youtube.com/static?template=terms
- YouTube API Developer Policies: https://developers.google.com/youtube/terms/developer-policies
- VCPMC: https://www.vcpmc.org/en
