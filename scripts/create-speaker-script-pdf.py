#!/usr/bin/env python3
"""Render the plain-text speaker script as a minimal A4 PDF."""

from html import escape
from pathlib import Path

from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "presentation" / "Kich-ban-thuyet-trinh.txt"
OUTPUT = ROOT / "presentation" / "Kich-ban-thuyet-trinh.pdf"
FONT = Path("/System/Library/Fonts/Supplemental/Times New Roman.ttf")


def main() -> None:
    pdfmetrics.registerFont(TTFont("TimesNewRoman", str(FONT)))

    document = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        leftMargin=22 * mm,
        rightMargin=22 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
        title="HeapBeat - Kịch bản thuyết trình và giải thích thuật toán",
        author="Phạm Hùng Tiến",
        subject="Upvote, Downvote, Max-Heap, danh sách liên kết đôi vòng và SpamGuard",
    )
    body = ParagraphStyle(
        "PlainScript",
        fontName="TimesNewRoman",
        fontSize=11,
        leading=15,
        alignment=TA_LEFT,
        spaceAfter=0,
    )

    story = []
    for line in SOURCE.read_text(encoding="utf-8").splitlines():
        if line:
            story.append(Paragraph(escape(line), body))
        else:
            story.append(Spacer(1, 7.5))

    document.build(story)


if __name__ == "__main__":
    main()
