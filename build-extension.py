#!/usr/bin/env python3
"""Create a Firefox/Chromium extension ZIP with manifest.json at its root."""

from pathlib import Path
import sys
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parent
FILES = (
    "manifest.json",
    "background.js",
    "comment.js",
    "comment.css",
    "icons/comment.svg",
    "icons/comment-16.png",
    "icons/comment-32.png",
    "icons/comment-48.png",
    "icons/comment-96.png",
    "icons/comment-128.png",
)


def main() -> None:
    output = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "spec-comment-extension.zip"
    output = output.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)

    with ZipFile(output, "w", compression=ZIP_DEFLATED) as bundle:
        for filename in FILES:
            bundle.write(ROOT / filename, arcname=filename)

    print(f"Created {output}")


if __name__ == "__main__":
    main()
