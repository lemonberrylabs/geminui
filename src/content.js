// Content script to extract Gemini conversation data (robust: ensures sidebar is open)

// Helper to delay execution
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Ensures the sidebar is open by clicking the hamburger menu if needed
async function ensureSidebarOpen() {
  console.log('[GeminiUI Enhancer] ensureSidebarOpen: Starting check...');

  function isNavValid(navElement) {
    if (!navElement) return false;
    const isOpenStyled = navElement.style.width.includes('var(--bard-sidenav-open-width)');
    const isDomVisible = navElement.offsetParent !== null || getComputedStyle(navElement).display !== 'none';
    const hasKeyContent = navElement.querySelector('conversations-list[data-test-id="all-conversations"]') !== null ||
                           navElement.querySelector('side-nav-action-button[data-test-id="new-chat-button"]') !== null ||
                           navElement.querySelector('button[aria-label="New chat"]') !== null;
    // console.log('[GeminiUI Enhancer] isNavValid: Checking - isOpenStyled:', isOpenStyled, ', isDomVisible:', isDomVisible, ', hasKeyContent:', hasKeyContent);
    return isOpenStyled && isDomVisible && hasKeyContent;
  }

  let nav = document.querySelector('bard-sidenav[role="navigation"]');
  // console.log('[GeminiUI Enhancer] ensureSidebarOpen: Initial check for bard-sidenav[role="navigation"]':', nav);

  if (isNavValid(nav)) {
    console.log('[GeminiUI Enhancer] ensureSidebarOpen: Sidebar (bard-sidenav) is already present and valid.');
    return true;
  } else if (nav) {
    // console.log('[GeminiUI Enhancer] ensureSidebarOpen: Sidebar (bard-sidenav) found, but isNavValid false. Style width:', nav.style.width);
  } else {
    // console.log('[GeminiUI Enhancer] ensureSidebarOpen: Sidebar (bard-sidenav) not found initially.');
  }

  // console.log('[GeminiUI Enhancer] ensureSidebarOpen: Attempting to find menu button.');
  let menuBtn = document.querySelector('button[data-test-id="side-nav-menu-button"]');

  if (!menuBtn) {
    menuBtn = document.querySelector('button[aria-label="Main menu"]');
  }
  if (!menuBtn) {
    menuBtn = Array.from(document.querySelectorAll('button')).find(
      btn => btn.textContent && btn.textContent.trim() === 'Main menu'
    );
  }
  if (!menuBtn) {
    menuBtn = document.querySelector('button[aria-label*="menu" i][aria-expanded]');
  }

  if (menuBtn) {
    // console.log('[GeminiUI Enhancer] ensureSidebarOpen: Menu button found:', menuBtn);
    const ariaExpanded = menuBtn.getAttribute('aria-expanded');
    // console.log('[GeminiUI Enhancer] ensureSidebarOpen: Menu button aria-expanded state:', ariaExpanded);

    if (ariaExpanded === 'true') {
        // console.log('[GeminiUI Enhancer] ensureSidebarOpen: Menu button aria-expanded is true. Re-evaluating sidebar.');
        await sleep(100);
        nav = document.querySelector('bard-sidenav[role="navigation"]');
        if (isNavValid(nav)) {
            console.log('[GeminiUI Enhancer] ensureSidebarOpen: Sidebar is valid after aria-expanded check. No click needed.');
            return true;
        }
        // console.log('[GeminiUI Enhancer] ensureSidebarOpen: Sidebar still not valid despite aria-expanded true.');
    } else {
      // console.log('[GeminiUI Enhancer] ensureSidebarOpen: Clicking menu button. Aria-expanded:', ariaExpanded);
      menuBtn.click();
      // console.log('[GeminiUI Enhancer] ensureSidebarOpen: Menu button clicked. Waiting for sidebar.');
      for (let i = 0; i < 20; i++) {
        await sleep(300);
        nav = document.querySelector('bard-sidenav[role="navigation"]');
        // let navStatus = 'null';
        // if (nav && nav.style) { navStatus = 'width: ' + nav.style.width; }
        // console.log('[GeminiUI Enhancer] ensureSidebarOpen: Wait attempt ', i + 1, '. Found bard-sidenav:', navStatus);
        if (isNavValid(nav)) {
          console.log('[GeminiUI Enhancer] ensureSidebarOpen: Sidebar appeared and is valid after click, attempt ', i + 1);
          return true;
        }
      }
      // console.log('[GeminiUI Enhancer] ensureSidebarOpen: Sidebar did not become valid after click and waiting.');
    }
  } else {
    console.log('[GeminiUI Enhancer] ensureSidebarOpen: Menu button not found after all attempts.');
  }

  nav = document.querySelector('bard-sidenav[role="navigation"]');
  console.log('[GeminiUI Enhancer] ensureSidebarOpen: Final check for bard-sidenav[role="navigation"]', nav);
  if (isNavValid(nav)) {
    console.log('[GeminiUI Enhancer] ensureSidebarOpen: Sidebar is valid on final check.');
    return true;
  }

  console.error('[GeminiUI Enhancer] ensureSidebarOpen: Sidebar (bard-sidenav) could not be reliably opened/confirmed.');
  return false;
}

// Extracts conversation data from the left-hand menu
async function extractAllConversations() {
  const conversations = [];
  const seen = new Set();
  console.log('[GeminiUI Enhancer] Starting conversation extraction...');

  // Ensure sidebar is open (assuming conversations-list might be in a sidebar)
  const sidebarReady = await ensureSidebarOpen();
  if (!sidebarReady) {
    console.error('[GeminiUI Enhancer] Sidebar could not be opened or found.');
    return conversations;
  }

  // Retry mechanism for finding the conversations-list element
  let conversationListEl = null;
  const maxListRetries = 5; // Try up to 5 times
  const listRetryDelay = 500; // 0.5 seconds delay between retries

  for (let i = 0; i < maxListRetries; i++) {
    conversationListEl = document.querySelector('conversations-list[data-test-id="all-conversations"]');
    if (conversationListEl) {
      console.log(`[GeminiUI Enhancer] Found conversation list element after ${i} retries.`);
      break;
    }
    console.log(`[GeminiUI Enhancer] Conversation list not found (attempt ${i + 1}/${maxListRetries}), retrying in ${listRetryDelay}ms...`);
    await sleep(listRetryDelay);
  }

  if (!conversationListEl) {
    console.error('[GeminiUI Enhancer] "conversations-list[data-test-id=\"all-conversations\"]" element not found after retries. Cannot extract conversations.');
    // Attempt to find all divs with jslog as a last resort, but this is less targeted
    const allDivsWithJslog = Array.from(document.querySelectorAll('div[jslog]'));
    if (allDivsWithJslog.length > 0) {
        console.log(`[GeminiUI Enhancer] Fallback: Found ${allDivsWithJslog.length} divs with jslog attribute (less reliable).`);
    }
    return conversations;
  }
  // If found, conversationListEl is now assigned. Original console log for finding it is covered by the loop's success message.

  // Handle "Show more" button with improved robustness
  console.log('[GeminiUI Enhancer] Starting "Show more" button handling logic.');
  let showMoreButtonVisibleAndActionable = true;
  let initialButtonFindAttempts = 0;
  const MAX_INITIAL_FIND_ATTEMPTS = 3; // How many times to check for button if not immediately visible
  const RETRY_DELAY_MS = 500; // Delay for retrying to find the button

  // eslint-disable-next-line no-constant-condition
  while (showMoreButtonVisibleAndActionable) {
    let currentShowMoreBtn = conversationListEl.querySelector('button[data-test-id="show-more-button"]');

    if (currentShowMoreBtn) {
      // Button is present
      initialButtonFindAttempts = 0; // Reset counter once button is found

      if (currentShowMoreBtn.textContent && currentShowMoreBtn.textContent.trim().toLowerCase() === 'show more') {
        console.log('[GeminiUI Enhancer] Clicking "Show more" button:', currentShowMoreBtn);
        currentShowMoreBtn.click();
        await sleep(1500); // Wait a bit longer for new items to load
        // Loop continues to check for the button again
      } else {
        // Button exists, but not "Show more" (e.g. "Show less", or different text)
        console.log('[GeminiUI Enhancer] "Show more" button found, but text is not "Show more". Current text:', currentShowMoreBtn.textContent, '. Assuming all items shown.');
        showMoreButtonVisibleAndActionable = false; // Stop the process
      }
    } else {
      // Button is not present
      if (initialButtonFindAttempts < MAX_INITIAL_FIND_ATTEMPTS) {
        initialButtonFindAttempts++;
        console.log(`[GeminiUI Enhancer] "Show more" button not found. Attempt ${initialButtonFindAttempts}/${MAX_INITIAL_FIND_ATTEMPTS}. Waiting ${RETRY_DELAY_MS}ms...`);
        await sleep(RETRY_DELAY_MS);
        // Continue loop to try finding the button again
      } else {
        // Button not found after several attempts
        console.log('[GeminiUI Enhancer] "Show more" button not found after retries. Assuming all items shown or button not available.');
        showMoreButtonVisibleAndActionable = false; // Stop the process
      }
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
setTimeout(runScraper, 2000); 

console.log('[GeminiUI Enhancer] Content script loaded and running.');
