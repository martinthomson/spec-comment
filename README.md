# Spec Comment browser extension

This is a Manifest V3 extension for Firefox and Chromium browsers. Its toolbar
button injects a comment editor into the current page.

From there, you can add comments by highlighting sections of text
and hitting the button that appears (or the 'c' key).

The interface is basic, but it saves comments
and highlights where comments were made.
Comments can be assigned a severity (Major Issue, Minor Issue, Comment, or Nit).

Finally, the review can be copied to clipboard, downloaded, or,
if the page includes references to a GitHub repository or mailing list,
a fresh GitHub issue or email can be created.

## Debugging the extension

### Chromium

1. Open `chrome://extensions` (or the equivalent extensions page in Chromium).
2. Turn on **Developer mode**.
3. Choose **Load unpacked** and select this directory.

### Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Choose **Load Temporary Add-on** and select `manifest.json` from this directory.

Then open any web page and click the toolbar button.

Build a distributable ZIP with `./build-extension.py`.

The toolbar artwork is in `icons/comment.svg`; the manifest uses PNG renders of
that SVG because Chromium does not accept SVG toolbar icons.
