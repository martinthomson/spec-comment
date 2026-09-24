# Spec Comment browser extension

This is a Manifest V3 extension for Firefox and Chromium browsers.
A toolbar button injects a comment editor into the current page.

This has been lightly tested on IETF, W3C, and WHATWG specifications,
with rules that detect sections, figures, tables, algorithms,
and other features for reviews that are properly cross-referenced.

The tool saves and persists comments.
Start by highlighting sections of text
and hitting the button that appears (or the 'c' key).
This shows a panel where you can edit comments.

The interface is basic, but it saves comments
and highlights where comments were made.
Comments can be assigned a severity (Major Issue, Minor Issue, Comment, or Nit)
and, optionally, a title.

Finally, the review can be copied to clipboard, downloaded, or,
if references to a GitHub repository or mailing list are detected,
a fresh GitHub issue or email can be created.
The review is presented in markdown format
in a form roughly compatible with [ietf-comments](https://github.com/mnot/ietf-comments/blob/main/format.md).

## Debugging the extension

### Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Choose **Load Temporary Add-on** and select `manifest.json` from this directory.

### Chromium

1. Open `chrome://extensions` (or the equivalent extensions page in Chromium).
2. Turn on **Developer mode**.
3. Choose **Load unpacked** and select this directory.

Build a distributable ZIP with `./build-extension.py`.

The toolbar artwork is in `icons/comment.svg`; the manifest uses PNG renders of
that SVG because Chromium does not accept SVG toolbar icons.
