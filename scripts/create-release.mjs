import { createHash } from "node:crypto";
import {
  cp,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const releaseLabel = "final";
const releaseDir = path.join(root, "release");
const stagingDir = path.join(releaseDir, ".staging");
const sourceName = `HeapBeat-${releaseLabel}-source`;
const webName = `HeapBeat-${releaseLabel}-web`;
const ignoredExtensions = new Set([
  ".aux",
  ".fdb_latexmk",
  ".fls",
  ".log",
  ".nav",
  ".out",
  ".snm",
  ".toc",
  ".xdv",
]);
const sourceEntries = [
  ".gitignore",
  "LICENSE",
  "README.md",
  "index.html",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "tsconfig.node.json",
  "vite.config.ts",
  "src",
  "tests",
  "backend-c",
  "public",
  "docs",
  "report",
  "presentation",
  "submission",
  "scripts",
];

function shouldCopy(source) {
  const relative = path.relative(root, source);
  const parts = relative.split(path.sep);
  const base = path.basename(source);

  if (base === ".DS_Store" || ignoredExtensions.has(path.extname(base))) {
    return false;
  }

  return (
    !parts.includes("target") &&
    !parts.includes("node_modules") &&
    !relative.startsWith(`backend-c${path.sep}build`)
  );
}

async function ensureFile(filePath, label) {
  try {
    const info = await stat(filePath);
    if (!info.isFile() || info.size === 0) {
      throw new Error("empty");
    }
  } catch {
    throw new Error(`${label} chưa tồn tại hoặc rỗng: ${filePath}`);
  }
}

async function sha256(filePath) {
  const data = await readFile(filePath);
  return createHash("sha256").update(data).digest("hex");
}

async function zipDirectory(directoryName, outputPath) {
  execFileSync("/usr/bin/zip", ["-q", "-r", outputPath, directoryName], {
    cwd: stagingDir,
    stdio: "inherit",
  });
}

await ensureFile(path.join(root, "dist", "index.html"), "Web production build");
await ensureFile(path.join(root, "report", "main.pdf"), "Báo cáo PDF");
await ensureFile(path.join(root, "presentation", "slides.pdf"), "Slide PDF");
await ensureFile(
  path.join(root, "presentation", "Kich-ban-thuyet-trinh.txt"),
  "Kịch bản thuyết trình",
);

await rm(releaseDir, { recursive: true, force: true });
await mkdir(stagingDir, { recursive: true });

const sourceRoot = path.join(stagingDir, sourceName);
await mkdir(sourceRoot, { recursive: true });
for (const entry of sourceEntries) {
  await cp(path.join(root, entry), path.join(sourceRoot, entry), {
    recursive: true,
    filter: shouldCopy,
  });
}

const webRoot = path.join(stagingDir, webName);
await cp(path.join(root, "dist"), webRoot, { recursive: true });
await writeFile(
  path.join(webRoot, "README_WEB.md"),
  `# HeapBeat - Web build

## Chạy web với backend C11

\`\`\`bash
cd backend-c && make
./build/heapbeat-backend --port 8081
php -S 0.0.0.0:8080 -t .
\`\`\`

Mở http://127.0.0.1:8080. Endpoint \`api.php\` chỉ reverse-proxy tới tiến
trình C11 tại \`127.0.0.1:8081\`. Max-Heap, vote, playlist và SpamGuard đều
được xử lý trong C. Tài khoản demo được lưu cục bộ trong trình duyệt.

## Tài khoản demo

- Admin: \`admin\` / \`admin@123\`
- Student: \`SV001\` / \`demo123\`
- Demo spam: \`SV9999\` / \`demo123\`

Release chứa 18 tệp piano MP3 do chủ dự án cung cấp cho demo nội bộ. Trình phát
dùng HTMLAudioElement và không tải nhạc từ API streaming. Xem hồ sơ attribution
và giới hạn sử dụng tại \`licenses/HEAPBEAT-PIANO-NOTICE.txt\`.
`,
  "utf8",
);

const sourceZip = path.join(releaseDir, `${sourceName}.zip`);
const webZip = path.join(releaseDir, `${webName}.zip`);
await zipDirectory(sourceName, sourceZip);
await zipDirectory(webName, webZip);

const deliverables = [
  [path.join(root, "report", "main.pdf"), "HeapBeat-Report.pdf"],
  [path.join(root, "presentation", "slides.pdf"), "HeapBeat-Slides.pdf"],
  [
    path.join(root, "presentation", "Kich-ban-thuyet-trinh.txt"),
    "HeapBeat-Kich-ban-thuyet-trinh.txt",
  ],
];
for (const [source, name] of deliverables) {
  await cp(source, path.join(releaseDir, name));
}

await writeFile(
  path.join(releaseDir, "SUBMISSION_CHECKLIST.md"),
  `# HeapBeat - Checklist nộp bài

- [x] Báo cáo PDF khổ A4 đã được biên dịch và kiểm tra trực quan.
- [x] Slide PDF đúng 15 trang cho phần trình bày 15 phút.
- [x] Kịch bản chia 8 thành viên, demo 5 phút và bộ câu hỏi Q&A.
- [x] Source ZIP không chứa node_modules, target hoặc file trạng thái runtime.
- [x] README tiếng Anh và giấy phép MIT được đóng gói cùng mã nguồn.
- [x] Web ZIP chạy độc lập qua HTTP server.
- [x] Prettier check, 22/22 unit test và Vite production build đạt.
- [x] Mã minh họa C biên dịch với \`-Wall -Wextra -Werror\` và mọi assert đạt.
- [x] Có đủ 18 tệp piano MP3 và thông báo attribution/phạm vi demo nội bộ.
- [x] Có SHA-256 cho mọi tệp bàn giao.

## Thứ tự nộp

1. \`HeapBeat-Report.pdf\`
2. \`HeapBeat-Slides.pdf\`
3. \`HeapBeat-${releaseLabel}-source.zip\`
4. \`HeapBeat-Kich-ban-thuyet-trinh.txt\`

\`HeapBeat-${releaseLabel}-web.zip\` là bản chạy nhanh dự phòng khi demo.

## Lưu ý phạm vi

Source dùng React + TypeScript + PWA để chạy trên trình duyệt Windows, macOS,
Linux, iOS và Android. Release nộp gồm source tái lập và web build đã xác minh
ở desktop và mobile viewport.

## Demo trực tuyến

- URL: https://phamhungtien.synology.me/heapbeat/
- Admin: \`admin\` / \`admin@123\`
`,
  "utf8",
);

const checksumTargets = (await readdir(releaseDir))
  .filter((name) => name !== ".staging" && name !== "SHA256SUMS.txt")
  .sort();
const checksumLines = [];
for (const name of checksumTargets) {
  const filePath = path.join(releaseDir, name);
  if ((await stat(filePath)).isFile()) {
    checksumLines.push(`${await sha256(filePath)}  ${name}`);
  }
}
await writeFile(
  path.join(releaseDir, "SHA256SUMS.txt"),
  `${checksumLines.join("\n")}\n`,
  "utf8",
);

await rm(stagingDir, { recursive: true, force: true });
console.log(`Đã tạo bộ nộp tại ${releaseDir}`);
