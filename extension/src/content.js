// Content script to extract Gemini conversation data (robust: ensures sidebar is open)

// Helper to delay execution
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Ensures the sidebar is open by clicking the hamburger menu if needed
async function ensureSidebarOpen() {
  // Try to find the navigation region
  let nav = document.querySelector('main nav');
  if (nav) return true;

  // Try to find the hamburger menu button
  // Try common selectors: aria-label, text, or fallback to first button
  let menuBtn = document.querySelector('button[aria-label="Main menu"]');
  if (!menuBtn) {
    // Fallback: look for a button with text content 'Main menu'
    menuBtn = Array.from(document.querySelectorAll('button')).find(
      btn => btn.textContent && btn.textContent.trim() === 'Main menu'
    );
  }
  if (menuBtn) {
    menuBtn.click();
    // Wait for the sidebar to appear
    for (let i = 0; i < 10; i++) {
      await sleep(200);
      nav = document.querySelector('main nav');
      if (nav) return true;
    }
  }
  // If still not found, give up
  return !!document.querySelector('main nav');
}

// Extracts conversation data from the left-hand menu
async function extractAllConversations() {
  const conversations = [];
  const seen = new Set();
  console.log('[GeminiUI Enhancer] Starting conversation extraction...');

  // Ensure sidebar is open (assuming conversations-list might be in a sidebar)
  // const sidebarReady = await ensureSidebarOpen();
  // if (!sidebarReady) {
  //   console.error('[GeminiUI Enhancer] Sidebar could not be opened or found.');
  //   return conversations;
  // }
  // For now, let's assume the conversations-list is directly available or sidebar logic is complex to debug first.

  // Find the conversations-list element using its data-test-id
  const conversationListEl = document.querySelector('conversations-list[data-test-id="all-conversations"]');

  if (!conversationListEl) {
    console.error('[GeminiUI Enhancer] "conversations-list[data-test-id=\\"all-conversations\\"]" element not found. Cannot extract conversations.');
    // Attempt to find all divs with jslog as a last resort, but this is less targeted
    const allDivsWithJslog = Array.from(document.querySelectorAll('div[jslog]')); // This was a fallback, less likely to be useful now
    if (allDivsWithJslog.length > 0) {
        console.log(`[GeminiUI Enhancer] Fallback: Found ${allDivsWithJslog.length} divs with jslog attribute.`);
    }
    return conversations;
  }

  console.log('[GeminiUI Enhancer] Found conversation list element:', conversationListEl);

  // Handle "Show more" button using its data-test-id and text content
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const currentShowMoreBtn = conversationListEl.querySelector('button[data-test-id="show-more-button"]');

    if (currentShowMoreBtn && currentShowMoreBtn.textContent && currentShowMoreBtn.textContent.trim().toLowerCase() === 'show more') {
      console.log('[GeminiUI Enhancer] Clicking "Show more" button:', currentShowMoreBtn);
      currentShowMoreBtn.click();
      await sleep(1500); // Wait a bit longer for new items to load
    } else {
      if (currentShowMoreBtn) {
        console.log('[GeminiUI Enhancer] Button with data-test-id="show-more-button" found, but text is not "Show more". Current text:', currentShowMoreBtn.textContent);
      } else {
        console.log('[GeminiUI Enhancer] "Show more" button with data-test-id="show-more-button" no longer found.');
      }
      break; // Exit the loop
    }
  }
  console.log('[GeminiUI Enhancer] Finished handling "Show more" logic.');

  // Wait a moment for items to render after any "Show more" clicks
  console.log('[GeminiUI Enhancer] Waiting for conversation items to render...');
  await sleep(1000); // 1-second delay

  // Iterate over conversation item containers
  // These containers wrap the actual clickable conversation item (div with role="button")
  const conversationItemContainers = conversationListEl.querySelectorAll('div.conversation-items-container');
  console.log(`[GeminiUI Enhancer] Found ${conversationItemContainers.length} potential conversation item containers (div.conversation-items-container).`);

  for (const container of conversationItemContainers) {
    // The actual clickable item with jslog is a div with role="button" and data-test-id="conversation"
    const jslogEl = container.querySelector('div[role="button"][data-test-id="conversation"][jslog]');
    
    if (jslogEl) {
      // The title (div.conversation-title) is a direct child of jslogEl
      const titleEl = jslogEl.querySelector('div.conversation-title');
      const jslog = jslogEl.getAttribute('jslog');
      
      if (titleEl && jslog) {
        const title = titleEl.textContent ? titleEl.textContent.trim() : 'Untitled';
        let url = null;

        // INSTRUCTIONS.md jslog format: BardVeMetadataKey:[...,["c_ID",...]] or BardVeMetadataKey:[...,["ID",...]]
        // Need to extract the ID part for the URL https://gemini.google.com/app/ID
        // The pattern should capture the ID part, which might or might not have "c_" prefix in the jslog itself.
        // The final URL should be gemini.google.com/app/ID (without c_).
        const jslogPattern = /BardVeMetadataKey:\[(?:[^,\]]*?,){7}\s*\["(?:c_)?([a-zA-Z0-9]+)"/;
        const match = jslog.match(jslogPattern);

        if (match && match[1]) { 
          const chatId = match[1]; // This is the ID, e.g., "0926671376b872ce"
          url = `https://gemini.google.com/app/${chatId}`;
          console.log(`[GeminiUI Enhancer] Extracted title: "${title}", id: ${chatId}, url: ${url}`);
        } else {
          console.warn(`[GeminiUI Enhancer] Could not extract chat ID from jslog: "${jslog}" on element:`, jslogEl);
        }

        if (url) {
          const key = `${title}-${url}`;
          if (!seen.has(key)) {
            conversations.push({ title, url });
            seen.add(key);
          } else {
            console.log(`[GeminiUI Enhancer] Duplicate conversation skipped: ${key}`);
          }
        }
      } else {
        if (!titleEl) console.warn('[GeminiUI Enhancer] Conversation item div[role="button"] found without a div.conversation-title child:', jslogEl);
        // jslog is guaranteed by jslogEl selector check
      }
    } else {
      console.warn('[GeminiUI Enhancer] Conversation item container found without a div[role="button"][data-test-id="conversation"][jslog] child:', container);
    }
  }
  
  console.log(`[GeminiUI Enhancer] Extracted ${conversations.length} conversations.`);
  return conversations;
}

// Save conversations to storage
function saveConversations(newlyScrapedConversations) {
  chrome.storage.local.get(['geminiConversations'], (result) => {
    const storedConversations = result.geminiConversations || [];
    
    // Use a Map to handle merging and de-duplication by URL
    const conversationsMap = new Map();

    // Add stored conversations to the map first
    for (const convo of storedConversations) {
      if (convo.url) { // Ensure URL exists to use as a key
        conversationsMap.set(convo.url, convo);
      }
    }

    // Add/update with newly scraped conversations
    // extractAllConversations already ensures newlyScrapedConversations are unique among themselves
    for (const convo of newlyScrapedConversations) {
      if (convo.url) { // Ensure URL exists
        conversationsMap.set(convo.url, convo); // Adds new or updates existing by URL
      }
    }

    const mergedConversations = Array.from(conversationsMap.values());

    chrome.storage.local.set({
      geminiConversations: mergedConversations,
      lastUpdated: new Date().toISOString()
    }, () => {
      chrome.runtime.sendMessage({
        action: 'conversationsUpdated',
        count: mergedConversations.length
      });
      console.log(`[GeminiUI Enhancer] Merged and saved ${mergedConversations.length} conversations.`);
    });
  });
}

// Main entry point
async function runScraper() {
  console.log('[GeminiUI Enhancer] runScraper called.');
  // It might be good to wait for document to be fully loaded
  if (document.readyState === 'loading') {
    console.log('[GeminiUI Enhancer] Document is loading, waiting for DOMContentLoaded.');
    document.addEventListener('DOMContentLoaded', async () => {
        console.log('[GeminiUI Enhancer] DOMContentLoaded, now running extraction.');
        const conversations = await extractAllConversations();
        if (conversations.length >= 0) { // Save even if empty to update timestamp or clear
            saveConversations(conversations);
            console.log(`[GeminiUI Enhancer] Saved ${conversations.length} conversations after DOMContentLoaded.`);
        } 
        // No explicit else, if conversations is undefined or null (error), it won't save.
    });
  } else {
    console.log('[GeminiUI Enhancer] Document already loaded, running extraction.');
    const conversations = await extractAllConversations();
    if (conversations.length >= 0) { // Save even if empty to update timestamp or clear
        saveConversations(conversations);
        console.log(`[GeminiUI Enhancer] Saved ${conversations.length} conversations (document already loaded).`);
    } 
    // No explicit else
  }
}

// Listen for manual refresh events
if (!window.__geminiEnhancerListener) {
  window.__geminiEnhancerListener = true;
  document.addEventListener('geminiUiEnhancerRefresh', runScraper);
}

// Initial run
// Wait a brief moment for the page to potentially settle, then run.
// Consider a more robust check like waiting for a specific element.
setTimeout(runScraper, 5000); // Increased delay to 5 seconds

console.log('[GeminiUI Enhancer] Content script loaded and running.');
