// DOM Elements
const conversationCountElement = document.getElementById('conversation-count');
const lastUpdatedElement = document.getElementById('last-updated');
const refreshButton = document.getElementById('refresh-btn');
const searchInput = document.getElementById('search-input');
const clearSearchButton = document.getElementById('clear-search');
const conversationsContainer = document.getElementById('conversations-container');

// State
let conversations = [];
let filteredConversations = [];
let lastUpdated = null;

// Function to format date
function formatDate(dateString) {
  if (!dateString) return 'Never';
  
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

// Function to render conversations
function renderConversations(conversationsToRender) {
  conversationsContainer.innerHTML = '';
  
  if (conversationsToRender.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    
    if (searchInput.value) {
      emptyState.textContent = 'No conversations match your search.';
    } else {
      emptyState.textContent = 'No conversations found. Visit Gemini and use the extension to collect data.';
    }
    
    conversationsContainer.appendChild(emptyState);
    return;
  }
  
  // Sort conversations by most recent update
  const sortedConversations = [...conversationsToRender].sort((a, b) => {
    return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
  });
  
  // Create and append conversation cards
  sortedConversations.forEach(conversation => {
    const card = document.createElement('div');
    card.className = 'conversation-card';
    card.onclick = () => {
      window.open(conversation.url, '_blank');
    };
    
    const title = document.createElement('h3');
    title.className = 'conversation-title';
    title.textContent = conversation.title;
    
    const url = document.createElement('span');
    url.className = 'conversation-url';
    url.textContent = conversation.url;
    
    card.appendChild(title);
    card.appendChild(url);
    conversationsContainer.appendChild(card);
  });
}

// Function to load data from Chrome storage
function loadData() {
  // Check if Chrome API is available (when loaded as an extension)
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.get(['geminiConversations', 'lastUpdated'], result => {
      conversations = result.geminiConversations || [];
      lastUpdated = result.lastUpdated;
      updateUI();
    });
  } else {
    // Demo mode when loaded as a standalone webpage
    console.log('Chrome storage API not available. Running in demo mode.');
    
    // Sample data for demonstration
    conversations = [
      { id: '1', title: 'How to build a Chrome extension', url: 'https://gemini.google.com/app/sample1', timestamp: new Date().toISOString() },
      { id: '2', title: 'Understanding React hooks', url: 'https://gemini.google.com/app/sample2', timestamp: new Date(Date.now() - 86400000).toISOString() },
      { id: '3', title: 'Machine learning basics', url: 'https://gemini.google.com/app/sample3', timestamp: new Date(Date.now() - 172800000).toISOString() },
    ];
    lastUpdated = new Date().toISOString();
    updateUI();
  }
}

// Function to update the UI with the loaded data
function updateUI() {
  // Update conversation count
  conversationCountElement.textContent = `${conversations.length} conversations`;
  
  // Update last updated timestamp
  lastUpdatedElement.textContent = formatDate(lastUpdated);
  
  // Initial render of conversations
  filteredConversations = conversations;
  renderConversations(filteredConversations);
}

// Function to handle search
function handleSearch() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  
  if (searchTerm) {
    clearSearchButton.style.display = 'block';
    filteredConversations = conversations.filter(conversation => {
      return conversation.title.toLowerCase().includes(searchTerm);
    });
  } else {
    clearSearchButton.style.display = 'none';
    filteredConversations = conversations;
  }
  
  renderConversations(filteredConversations);
}

// Function to clear search
function clearSearch() {
  searchInput.value = '';
  clearSearchButton.style.display = 'none';
  filteredConversations = conversations;
  renderConversations(filteredConversations);
}

// Event listeners
searchInput.addEventListener('input', handleSearch);
clearSearchButton.addEventListener('click', clearSearch);

// Handle refresh button
refreshButton.addEventListener('click', () => {
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    refreshButton.textContent = 'Refreshing...';
    refreshButton.disabled = true;
    
    // Send message to background script to trigger a refresh
    chrome.runtime.sendMessage({ action: 'refreshData' }, () => {
      // Reload data after a delay
      setTimeout(() => {
        loadData();
        refreshButton.textContent = 'Refresh Data';
        refreshButton.disabled = false;
      }, 1000);
    });
  } else {
    // In standalone mode, just reload demo data
    loadData();
  }
});

// Listen for storage changes from extension
if (typeof chrome !== 'undefined' && chrome.storage) {
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
      if (changes.geminiConversations) {
        conversations = changes.geminiConversations.newValue || [];
        handleSearch(); // Re-filter with current search term
      }
      
      if (changes.lastUpdated) {
        lastUpdated = changes.lastUpdated.newValue;
        lastUpdatedElement.textContent = formatDate(lastUpdated);
      }
    }
  });
}

// Initialize the application
document.addEventListener('DOMContentLoaded', loadData); 