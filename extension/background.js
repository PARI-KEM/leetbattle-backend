// Service worker placeholder.
// All networking currently happens from the content script and popup,
// which both have host_permissions for the backend. If LeetCode's CSP
// ever blocks WebSocket from the content world, proxy through here using
// chrome.runtime.onMessage.

// Edit this line to point at your deployed backend before zipping for friends.
// Each user can also override it later via the extension popup.
const DEFAULT_BACKEND_URL = 'http://localhost:8080';

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['backendUrl'], (res) => {
    if (!res.backendUrl) {
      chrome.storage.local.set({ backendUrl: DEFAULT_BACKEND_URL });
    }
  });
});
