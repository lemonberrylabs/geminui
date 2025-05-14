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

  // Find the conversations-list element
  // The INSTRUCTIONS.md implies an element with this name/ID or a prominent class.
  // Let's try common ways to find it: by ID, by class, or as a landmark/role.
  let conversationListEl = document.getElementById('conversations-list');
  if (!conversationListEl) {
    conversationListEl = document.querySelector('.conversations-list');
  }
  if (!conversationListEl) {
    // Fallback: Look for a nav element that might contain the list, then divs with jslog
    // This is a bit of a guess if 'conversations-list' is not a direct ID/class.
    // The original script used 'main nav' then 'region'.
    // Let's try to be more specific to items with jslog as per instructions.
    console.log('[GeminiUI Enhancer] Could not find element with ID/class "conversations-list". Searching for potential parent containers.');
    // We will iterate through divs with jslog later. For now, let's assume 'conversations-list' exists or this will fail.
    // This part needs robust selector from actual page structure if 'conversations-list' is not a direct ID/class.
  }

  if (!conversationListEl) {
    console.error('[GeminiUI Enhancer] "conversations-list" element not found. Cannot extract conversations.');
    // Attempt to find all divs with jslog as a last resort, but this is less targeted
    const allDivsWithJslog = Array.from(document.querySelectorAll('div[jslog]'));
    if (allDivsWithJslog.length > 0) {
        console.log(`[GeminiUI Enhancer] Found ${allDivsWithJslog.length} divs with jslog attribute as a fallback.`);
        // This fallback would need a different processing logic, for now we rely on conversations-list
    }
    return conversations;
  }

  console.log('[GeminiUI Enhancer] Found "conversations-list" element:', conversationListEl);

  // INSTRUCTIONS.md: "each div under that conversation list element has a jslog field in it"
  // and "The title is a div with the class conversation-title".
  // We should look for these items within conversationListEl.

  // Handle "Show more" - This part might need to be adapted based on where "Show more" is relative to "conversations-list"
  // The original script looked for "Show more" in a region.
  // For now, let's assume it's within or near conversationListEl.
  let showMoreBtn = Array.from(conversationListEl.querySelectorAll('button')).find(
    btn => btn.textContent && btn.textContent.trim() === 'Show more'
  );
  while (showMoreBtn) {
    console.log('[GeminiUI Enhancer] Clicking "Show more"...');
    showMoreBtn.click();
    await sleep(1000); // Increased wait time, consider MutationObserver for production
    showMoreBtn = Array.from(conversationListEl.querySelectorAll('button')).find(
      btn => btn.textContent && btn.textContent.trim() === 'Show more'
    );
  }
  console.log('[GeminiUI Enhancer] No more "Show more" buttons found or all items loaded.');

  const conversationItems = conversationListEl.querySelectorAll('div[jslog]');
  console.log(`[GeminiUI Enhancer] Found ${conversationItems.length} potential conversation items (divs with jslog).`);

  for (const item of conversationItems) {
    const jslog = item.getAttribute('jslog');
    const titleEl = item.querySelector('div.conversation-title');
    
    if (jslog && titleEl) {
      const title = titleEl.textContent ? titleEl.textContent.trim() : 'Untitled';
      let url = null;

      // INSTRUCTIONS.md jslog format: BardVeMetadataKey:[null,null,null,null,null,null,null,["c_ID",...]]
      // Need to extract "c_ID" then use ID for the URL https://gemini.google.com/app/ID
      const jslogPattern = /BardVeMetadataKey:\[(?:[^,]+,){7}\["(c_([a-zA-Z0-9]+))"/;
      const match = jslog.match(jslogPattern);

      if (match && match[2]) { // match[2] is the ID part like "b048403da36b0a23"
        const chatId = match[2];
        url = `https://gemini.google.com/app/${chatId}`;
        console.log(`[GeminiUI Enhancer] Extracted title: "${title}", id: ${chatId}, url: ${url}`);
      } else {
        console.warn('[GeminiUI Enhancer] Could not extract chat ID from jslog:', jslog);
        // Fallback for older regex if the new one fails, for debugging
        const oldMatch = jslog.match(/c_([a-zA-Z0-9]+)/);
        if (oldMatch && oldMatch[1]) {
            const fallbackId = oldMatch[1];
            // This fallback might be making the wrong URL if c_ is part of the ID for the URL
            // The instruction was app/ID, so the original regex was extracting the ID correctly.
            // Let's stick to the new more specific regex and if it fails, the ID is not extracted.
            // url = `https://gemini.google.com/app/${fallbackId}`;
            // console.log(`[GeminiUI Enhancer] Fallback extraction - title: "${title}", id: ${fallbackId}, url: ${url}`);
        }
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
      if (!jslog) console.warn('[GeminiUI Enhancer] Div found without jslog attribute inside conversation list.');
      if (!titleEl) console.warn('[GeminiUI Enhancer] Div found without .conversation-title inside conversation list.');
    }
  }
  
  console.log(`[GeminiUI Enhancer] Extracted ${conversations.length} conversations.`);
  return conversations;
}

// Save conversations to storage
function saveConversations(conversations) {
  chrome.storage.local.set({
    geminiConversations: conversations,
    lastUpdated: new Date().toISOString()
  }, () => {
    chrome.runtime.sendMessage({
      action: 'conversationsUpdated',
      count: conversations.length
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
        if (conversations.length > 0) {
            saveConversations(conversations);
        } else {
            console.log('[GeminiUI Enhancer] No conversations extracted, or an error occurred. Not saving empty data.');
            // Optionally, still call saveConversations to update timestamp or clear old data
            // saveConversations([]); // Clears data and updates timestamp
        }
    });
  } else {
    console.log('[GeminiUI Enhancer] Document already loaded, running extraction.');
    const conversations = await extractAllConversations();
    if (conversations.length > 0) {
        saveConversations(conversations);
    } else {
        console.log('[GeminiUI Enhancer] No conversations extracted, or an error occurred. Not saving empty data.');
         // Optionally, still call saveConversations to update timestamp or clear old data
         // saveConversations([]); // Clears data and updates timestamp
    }
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
setTimeout(runScraper, 1000); 
// runScraper(); // Original immediate call

console.log('[GeminiUI Enhancer] Content script loaded and running.'); 