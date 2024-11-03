chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "capture") {
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        const tab = tabs[0];
        chrome.tabs.captureVisibleTab(
          tab.windowId,
          {format: 'png'},
          (dataUrl) => {
            sendResponse({dataUrl: dataUrl});
          }
        );
      });
      return true; // Required for async sendResponse
    }
  });
