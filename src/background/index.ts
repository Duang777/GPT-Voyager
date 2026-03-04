chrome.runtime.onInstalled.addListener((details) => {
  const reason = details.reason ?? "unknown";
  console.log(`[GPT Voyager] Extension installed/updated. reason=${reason}`);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "GV_PING") {
    sendResponse({
      ok: true,
      timestamp: Date.now()
    });
    return true;
  }
  return false;
});

