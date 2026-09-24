# RFC Comment browser extension

This is a Manifest V3 extension for Firefox and Chromium browsers. Its toolbar
button injects the comment editor and its stylesheet into the current page.

## Load the extension

### Chromium

1. Open `chrome://extensions` (or the equivalent extensions page in Chromium).
2. Turn on **Developer mode**.
3. Choose **Load unpacked** and select this directory.

### Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Choose **Load Temporary Add-on** and select `manifest.json` from this directory.

Then open an RFC HTML document and click the **Add RFC comments** toolbar button.

The extension uses `activeTab` access, so it only receives permission to inject
into a tab after you click its toolbar button. Browser-internal pages do not
allow injection. Build a distributable ZIP with `./build-extension.py`.

The toolbar artwork is in `icons/comment.svg`; the manifest uses PNG renders of
that SVG because Chromium does not accept SVG toolbar icons.
