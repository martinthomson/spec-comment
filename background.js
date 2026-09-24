const extensionAPI = globalThis.browser ?? globalThis.chrome;

extensionAPI.action.onClicked.addListener(async tab => {
  if (tab.id === undefined) return;

  try {
    const target = { tabId: tab.id };
    await extensionAPI.scripting.insertCSS({
      target,
      files: ["comment.css"],
    });
    await extensionAPI.scripting.executeScript({
      target,
      files: ["comment.js"],
    });
  } catch (error) {
    // Some browser pages, such as chrome:// URLs, do not allow extensions to
    // inject scripts. Keep the service worker alive without an unhandled error.
    console.debug("RFC Comment could not be injected into this tab.", error);
  }
});
