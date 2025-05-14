// Background script for the GeminiUI Enhancer extension

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'conversationsUpdated') {
    // Update the badge with the count of conversations
    if (message.count) {
      chrome.action.setBadgeText({ text: message.count.toString() });
      chrome.action.setBadgeBackgroundColor({ color: '#4285F4' });
    }
  } else if (message.action === 'openGeminiUI') {
    // Open our custom UI page
    chrome.tabs.create({ url: chrome.runtime.getURL('index.html') });
  } else if (message.action === 'refreshData') {
    // Get the current active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) {
        sendResponse({ success: false, error: 'No active tab found' });
        return;
      }
      
      const activeTab = tabs[0];
      
      // Check if this is a Gemini tab
      if (activeTab.url && activeTab.url.startsWith('https://gemini.google.com/app')) {
        // Execute content script to trigger data refresh
        chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          function: () => {
            // Dispatch custom event to trigger refresh
            const refreshEvent = new CustomEvent('geminiUiEnhancerRefresh');
            document.dispatchEvent(refreshEvent);
            
            // Scroll the conversation list to load more items
            const navElement = document.querySelector('[role="navigation"]');
            if (navElement) {
              navElement.scrollTo(0, navElement.scrollHeight);
            }
          }
        }).then(() => {
          sendResponse({ success: true });
        }).catch(error => {
          sendResponse({ success: false, error: error.message });
        });
      } else {
        // Try to find or open a Gemini tab
        chrome.tabs.query({ url: 'https://gemini.google.com/app*' }, (geminiTabs) => {
          if (geminiTabs.length > 0) {
            // Switch to the existing Gemini tab
            chrome.tabs.update(geminiTabs[0].id, { active: true }, () => {
              sendResponse({ success: true, message: 'Switched to Gemini tab' });
            });
          } else {
            // Open a new Gemini tab
            chrome.tabs.create({ url: 'https://gemini.google.com/app' }, () => {
              sendResponse({ success: true, message: 'Opened new Gemini tab' });
            });
          }
        });
      }
    });
    
    // Return true to indicate we're handling the response asynchronously
    return true;
  }
});

// Set up initial state when extension is installed
chrome.runtime.onInstalled.addListener(() => {
  console.log('GeminiUI Enhancer extension installed');
  
  // Initialize storage if needed
  chrome.storage.local.get(['geminiConversations'], result => {
    if (!result.geminiConversations) {
      chrome.storage.local.set({ 
        geminiConversations: [],
        lastUpdated: new Date().toISOString()
      });
    }
  });
  
  // Create a context menu item to open the enhanced UI
  chrome.contextMenus?.create({
    id: 'open-gemini-ui',
    title: 'Open Enhanced GeminiUI',
    contexts: ['action']
  });
});

// Handle context menu clicks
chrome.contextMenus?.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'open-gemini-ui') {
    chrome.tabs.create({ url: chrome.runtime.getURL('index.html') });
  }
}); 