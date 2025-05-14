// Popup script for the GeminiUI Enhancer extension

// DOM elements
const conversationCountElement = document.getElementById('conversation-count');
const lastUpdatedElement = document.getElementById('last-updated');
const openUiButton = document.getElementById('open-ui');
const refreshButton = document.getElementById('refresh');

// Function to format date
function formatDate(dateString) {
  if (!dateString) return 'Never updated';
  
  const date = new Date(dateString);
  const now = new Date();
  
  // If it's today, just show the time
  if (date.toDateString() === now.toDateString()) {
    return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  
  // If it's yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  
  // Otherwise show the full date
  return date.toLocaleString([], { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit', 
    minute: '2-digit'
  });
}

// Load and display data from storage
function loadData() {
  chrome.storage.local.get(['geminiConversations', 'lastUpdated'], result => {
    const conversations = result.geminiConversations || [];
    const lastUpdated = result.lastUpdated;
    
    // Update UI
    conversationCountElement.textContent = conversations.length;
    lastUpdatedElement.textContent = `Last updated: ${formatDate(lastUpdated)}`;
  });
}

// Handle opening the custom UI
openUiButton.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'openGeminiUI' });
  // Close the popup
  window.close();
});

// Handle refreshing the data (this will trigger a scan on the current tab if it's Gemini)
refreshButton.addEventListener('click', async () => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs.length === 0) return;
  
  const tab = tabs[0];
  if (tab.url && tab.url.startsWith('https://gemini.google.com/app')) {
    // Execute a content script to trigger a refresh
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: () => {
        // This will run in the context of the page
        const event = new CustomEvent('geminiUiEnhancerRefresh');
        document.dispatchEvent(event);
        
        // Also trigger a scroll to load more conversations
        document.querySelector('[role="navigation"]')?.scrollTo(0, 9999);
      }
    });
    
    // Update button text to indicate refresh
    refreshButton.textContent = 'Refreshing...';
    setTimeout(() => {
      refreshButton.textContent = 'Refresh Data';
      loadData();
    }, 2000);
  } else {
    alert('Please navigate to Gemini to refresh conversation data');
  }
});

// Initialize the popup
document.addEventListener('DOMContentLoaded', loadData); 