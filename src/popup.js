// Popup script for the GeminiUI Enhancer extension

// DOM elements
const conversationCountElement = document.getElementById('conversation-count');
const lastUpdatedElement = document.getElementById('last-updated');
const openUiButton = document.getElementById('open-ui');
const refreshButton = document.getElementById('refresh');
const scrapingIndicator = document.getElementById('scraping-indicator');

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
  // It's better to send a message to the background script to handle this,
  // as it has more robust logic for finding/opening Gemini and injecting.
  chrome.runtime.sendMessage({ action: 'refreshData' }, (response) => {
    if (response && response.success) {
      // The background script will handle triggering the content script.
      // The content script will now send 'scrapingStatus' messages.
      // We don't need to manually set 'Refreshing...' here anymore,
      // as the message listener below will handle the UI updates.
      console.log('[GeminiUI Enhancer Popup] Refresh data message sent to background.');
    } else {
      console.error('[GeminiUI Enhancer Popup] Failed to send refresh data message:', response?.error);
      alert('Could not initiate data refresh. Ensure a Gemini tab is open or can be opened.');
    }
  });
});

// Listen for messages from the background script (e.g., scraping status)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'scrapingStatus') {
    if (message.status === 'started') {
      scrapingIndicator.textContent = 'Scraping conversations...';
      scrapingIndicator.style.display = 'block';
      refreshButton.disabled = true;
      refreshButton.textContent = 'Scraping...';
    } else if (message.status === 'completed') {
      scrapingIndicator.textContent = `Scraping complete. Found ${message.count || 0} new.`;
      // Keep indicator visible for a moment, then hide
      setTimeout(() => {
        scrapingIndicator.style.display = 'none';
      }, 3000);
      refreshButton.disabled = false;
      refreshButton.textContent = 'Refresh Data';
      loadData(); // Reload data to show new count and last updated
    } else if (message.status === 'error') {
      scrapingIndicator.textContent = `Error during scraping: ${message.errorMessage || 'Unknown error'}`;
      scrapingIndicator.style.backgroundColor = '#fce8e6'; // Error color
      scrapingIndicator.style.color = '#c5221f';
      // Keep indicator visible for a moment, then hide
      setTimeout(() => {
        scrapingIndicator.style.display = 'none';
        scrapingIndicator.style.backgroundColor = '#e8f0fe'; // Reset color
        scrapingIndicator.style.color = '#1967d2';
      }, 5000);
      refreshButton.disabled = false;
      refreshButton.textContent = 'Refresh Data';
    }
  }
});

// Function to update UI based on scraping state
function updateUiForScrapingState(state) {
  if (state === 'scraping') {
    scrapingIndicator.textContent = 'Scraping conversations...';
    scrapingIndicator.style.display = 'block';
    refreshButton.disabled = true;
    refreshButton.textContent = 'Scraping...';
  } else {
    // For 'idle' or 'error' states, the normal message handler will eventually reset things
    // or the user can try again. Here, we just ensure the button is enabled if not scraping.
    if (refreshButton.textContent === 'Scraping...') { // Only reset if it was in scraping state
        scrapingIndicator.style.display = 'none';
        refreshButton.disabled = false;
        refreshButton.textContent = 'Refresh Data';
    }
  }
}

// Initialize the popup
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  // Ask background script for current scraping state
  chrome.runtime.sendMessage({ action: 'getScrapingState' }, (response) => {
    if (response && response.status) {
      console.log('[GeminiUI Enhancer Popup] Received initial scraping state:', response.status);
      updateUiForScrapingState(response.status);
    }
  });
}); 