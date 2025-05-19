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

  // First, check local storage for existing conversation count
  let storedConversationsCount = 0;
  // Fetch existing stored conversations to check against for early exit
  let storedConversationUrls = new Set();
  try {
    const result = await new Promise((resolve) => {
      chrome.storage.local.get(['geminiConversations'], resolve);
    });
    storedConversationsCount = result.geminiConversations ? result.geminiConversations.length : 0;
    console.log(`[GeminiUI Enhancer] Found ${storedConversationsCount} conversations in local storage.`);
    
    // Build set of stored URLs for early exit check
    if (result.geminiConversations && Array.isArray(result.geminiConversations)) {
      result.geminiConversations.forEach(convo => {
        if (convo.url) {
          storedConversationUrls.add(convo.url);
        }
      });
    }
    console.log(`[GeminiUI Enhancer] Loaded ${storedConversationUrls.size} URLs from local storage for comparison.`);
  } catch (error) {
    console.error('[GeminiUI Enhancer] Error reading from local storage:', error);
  }

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
    // The infinite scroller seems to be a wrapper around the list.
    // We need to find the 'conversations-list' *within* an 'infinite-scroller' if that's the new structure.
    // Based on the HTML, the 'infinite-scroller' is a sibling/parent, not a direct wrapper for the button.
    // The critical element for conversations is 'conversations-list[data-test-id="all-conversations"]'
    // And the scroller element for the whole sidebar content is 'side-navigation-content .overflow-container'
    // or potentially 'infinite-scroller' if it wraps 'conversations-list'.
    // Let's stick to the known 'conversations-list' for finding the "Show more" button.

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
    const allDivsWithJslog = Array.from(document.querySelectorAll('div[jslog]'));
    if (allDivsWithJslog.length > 0) {
        console.log(`[GeminiUI Enhancer] Fallback: Found ${allDivsWithJslog.length} divs with jslog attribute (less reliable).`);
    }
    return conversations;
  }

  const scrollerEl = conversationListEl.closest('infinite-scroller') || conversationListEl.closest('.overflow-container');
  
  // Function to check if we have found enough stored conversations to stop
  const MAX_STORED_TO_FIND_BEFORE_STOPPING = 3;
  let foundStoredConversationsCount = 0;
  
  async function checkCurrentConversationsForEarlyExit() {
    console.log('[GeminiUI Enhancer] Checking current visible conversations for early exit...');
    // Get currently visible conversation items
    const currentContainers = conversationListEl.querySelectorAll('div.conversation-items-container');
    
    for (const container of currentContainers) {
      const jslogEl = container.querySelector('div[role="button"][data-test-id="conversation"][jslog]');
      
      if (jslogEl) {
        const jslog = jslogEl.getAttribute('jslog');
        if (jslog) {
          const jslogPattern = /BardVeMetadataKey:\[(?:[^,\]]*?,){7}\s*\["(?:c_)?([a-zA-Z0-9]+)"/;
          const match = jslog.match(jslogPattern);
          
          if (match && match[1]) { 
            const chatId = match[1];
            const url = `https://gemini.google.com/app/${chatId}`;
            
            // Check if this conversation is already stored
            if (storedConversationUrls.has(url)) {
              foundStoredConversationsCount++;
              const titleEl = jslogEl.querySelector('div.conversation-title');
              const title = titleEl && titleEl.textContent ? titleEl.textContent.trim() : 'Untitled';
              console.log(`[GeminiUI Enhancer] Found a stored conversation during scrolling: "${title}" (${url}). Count: ${foundStoredConversationsCount}/${MAX_STORED_TO_FIND_BEFORE_STOPPING}`);
              
              if (foundStoredConversationsCount >= MAX_STORED_TO_FIND_BEFORE_STOPPING) {
                console.log(`[GeminiUI Enhancer] Found ${MAX_STORED_TO_FIND_BEFORE_STOPPING} stored conversations during scrolling. Stopping further scrolling.`);
                return true; // Signal to stop scrolling
              }
            }
          }
        }
      }
    }
    return false; // Continue scrolling
  }
  
  if (storedConversationsCount <= 600) {
    console.log('[GeminiUI Enhancer] Less than or equal to 600 conversations stored, attempting to load all conversations.');
    if (scrollerEl) {
      let previousScrollHeight = 0;
      let currentScrollHeight = scrollerEl.scrollHeight;
      let attempts = 0;
      const MAX_SCROLL_ATTEMPTS = 30; // Prevent infinite loops
      let noNewContentStreak = 0;
      const MAX_NO_NEW_CONTENT_STREAK = 3; // How many times to tolerate no scroll height change if button also not actionable

      while (attempts < MAX_SCROLL_ATTEMPTS) {
        // Check if we should stop scrolling based on finding stored conversations
        if (await checkCurrentConversationsForEarlyExit()) {
          console.log('[GeminiUI Enhancer] Early exit condition met during scrolling. Stopping scroll process.');
          break;
        }
        
        previousScrollHeight = currentScrollHeight;
        scrollerEl.scrollTop = scrollerEl.scrollHeight; // Scroll to the bottom
        await sleep(2000); // Wait for content to load after scroll (increased from 1500)
        currentScrollHeight = scrollerEl.scrollHeight;

        let showMoreClickedInThisIteration = false;
        // Try to find and click "Show more" button multiple times if needed
        for (let btnAttempt = 0; btnAttempt < 3; btnAttempt++) {
          // Check again for early exit after waiting for content to load
          if (await checkCurrentConversationsForEarlyExit()) {
            console.log('[GeminiUI Enhancer] Early exit condition met during button check. Stopping scroll process.');
            attempts = MAX_SCROLL_ATTEMPTS; // Force exit from outer loop
            break;
          }
          
          const showMoreBtn = conversationListEl.querySelector('button[data-test-id="show-more-button"]');
          if (showMoreBtn && showMoreBtn.offsetParent !== null && showMoreBtn.textContent && showMoreBtn.textContent.trim().toLowerCase() === 'show more') {
            console.log(`[GeminiUI Enhancer] Clicking "Show more" button (Attempt ${btnAttempt + 1}/3 in scroll iteration).`);
            showMoreBtn.click();
            showMoreClickedInThisIteration = true;
            await sleep(4500); // Wait for new items from "Show more" (increased from 3000)
            currentScrollHeight = scrollerEl.scrollHeight; // Re-evaluate scroll height after click
            noNewContentStreak = 0; // Reset streak if button was clicked
            break; // Exit button finding loop
          } else if (btnAttempt < 2) { // Don't log or wait on the last button attempt if it fails
            // console.log(`[GeminiUI Enhancer] "Show more" button not actionable yet (Attempt ${btnAttempt + 1}/3). Waiting briefly.`);
            await sleep(1000); // Brief wait for button to potentially become actionable (increased from 750)
          }
        }

        if (!showMoreClickedInThisIteration && currentScrollHeight === previousScrollHeight) {
          noNewContentStreak++;
          console.log(`[GeminiUI Enhancer] No new content loaded and "Show more" not clicked. Streak: ${noNewContentStreak}/${MAX_NO_NEW_CONTENT_STREAK}.`);
          if (noNewContentStreak >= MAX_NO_NEW_CONTENT_STREAK) {
            console.log('[GeminiUI Enhancer] Reached the end of the scroll or no new content loaded after multiple attempts.');
            break;
          }
        } else if (currentScrollHeight > previousScrollHeight) {
          noNewContentStreak = 0; // Reset if scroll height increased
        }
        
        // Check if we are at the bottom and no more button is available or effective
        const isAtBottom = scrollerEl.scrollTop + scrollerEl.clientHeight >= currentScrollHeight - 10; // थोड़ा टॉलरेंस
        const showMoreBtnFinalCheck = conversationListEl.querySelector('button[data-test-id="show-more-button"]');
        const showMoreActionable = showMoreBtnFinalCheck && showMoreBtnFinalCheck.offsetParent !== null && showMoreBtnFinalCheck.textContent && showMoreBtnFinalCheck.textContent.trim().toLowerCase() === 'show more';

        if (isAtBottom && !showMoreActionable && !showMoreClickedInThisIteration && currentScrollHeight === previousScrollHeight) {
            console.log('[GeminiUI Enhancer] At bottom, and "Show more" button is not actionable or not present. Assuming end of list.');
            break;
        }

        attempts++;
      }
      if (attempts >= MAX_SCROLL_ATTEMPTS) {
        console.warn('[GeminiUI Enhancer] Max scroll attempts reached. Proceeding with extracted conversations.');
      }
    } else {
      console.log('[GeminiUI Enhancer] Scroller element not found. Falling back to "Show more" button logic only.');
      // Fallback to original "Show more" button logic if scrollerEl is not found.
      let showMoreButtonVisibleAndActionable = true;
      let initialButtonFindAttempts = 0;
      const MAX_INITIAL_FIND_ATTEMPTS = 3;
      const RETRY_DELAY_MS = 500;

      // eslint-disable-next-line no-constant-condition
      while (showMoreButtonVisibleAndActionable) {
        // Check if we should stop based on finding stored conversations
        if (await checkCurrentConversationsForEarlyExit()) {
          console.log('[GeminiUI Enhancer] Early exit condition met during fallback button checks. Stopping process.');
          break;
        }
        
        let currentShowMoreBtn = conversationListEl.querySelector('button[data-test-id="show-more-button"]');
        if (currentShowMoreBtn) {
          initialButtonFindAttempts = 0;
          if (currentShowMoreBtn.textContent && currentShowMoreBtn.textContent.trim().toLowerCase() === 'show more') {
            console.log('[GeminiUI Enhancer] Clicking "Show more" button (fallback logic):', currentShowMoreBtn);
            currentShowMoreBtn.click();
            await sleep(1500);
          } else {
            console.log('[GeminiUI Enhancer] "Show more" button found, but text is not "Show more" (fallback logic). Assuming all items shown.');
            showMoreButtonVisibleAndActionable = false;
          }
        } else {
          if (initialButtonFindAttempts < MAX_INITIAL_FIND_ATTEMPTS) {
            initialButtonFindAttempts++;
            console.log(`[GeminiUI Enhancer] "Show more" button not found (fallback logic). Attempt ${initialButtonFindAttempts}/${MAX_INITIAL_FIND_ATTEMPTS}. Waiting ${RETRY_DELAY_MS}ms...`);
            await sleep(RETRY_DELAY_MS);
          } else {
            console.log('[GeminiUI Enhancer] "Show more" button not found after retries (fallback logic). Assuming all items shown or button not available.');
            showMoreButtonVisibleAndActionable = false;
          }
        }
      }
    }
    console.log('[GeminiUI Enhancer] Finished scrolling/ "Show more" logic.');
  } else {
    console.log('[GeminiUI Enhancer] More than 600 conversations stored. Skipping full scroll/ "Show more" to fetch only new ones.');
  }
  
  // Wait a moment for items to render after any scrolling or "Show more" clicks
  console.log('[GeminiUI Enhancer] Waiting for conversation items to render...');
  await sleep(1000); // 1-second delay

  // Iterate over conversation item containers
  // These containers wrap the actual clickable conversation item (div with role="button")
  const conversationItemContainers = conversationListEl.querySelectorAll('div.conversation-items-container');
  console.log(`[GeminiUI Enhancer] Found ${conversationItemContainers.length} potential conversation item containers (div.conversation-items-container).`);

  // Reset counter for final extraction phase
  foundStoredConversationsCount = 0;

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
          
          // Check if this conversation is already stored (for counting only, we still extract all visible)
          if (storedConversationUrls.has(url)) {
            foundStoredConversationsCount++;
            console.log(`[GeminiUI Enhancer] Found a stored conversation during extraction: "${title}" (${url}). Count: ${foundStoredConversationsCount}/${MAX_STORED_TO_FIND_BEFORE_STOPPING}`);
          }
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
  
  console.log(`[GeminiUI Enhancer] Extracted ${conversations.length} conversations. Found ${foundStoredConversationsCount} already stored conversations during extraction.`);
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
  chrome.runtime.sendMessage({ action: 'scrapingStatus', status: 'started' });
  try {
    // If the trigger is manual via event, we don't need to check document.readyState here anymore for auto-run.
    // The event will be dispatched when the user is ready.
    console.log('[GeminiUI Enhancer] Preparing to extract conversations based on trigger.');
    const conversations = await extractAllConversations();
    if (conversations.length >= 0) { // Save even if empty to update timestamp or clear
        saveConversations(conversations);
        console.log(`[GeminiUI Enhancer] Saved ${conversations.length} conversations.`);
    } 
    // No explicit else
    chrome.runtime.sendMessage({ action: 'scrapingStatus', status: 'completed', count: conversations ? conversations.length : 0 });
  } catch (error) {
    console.error('[GeminiUI Enhancer] Error during scraping process:', error);
    chrome.runtime.sendMessage({ action: 'scrapingStatus', status: 'error', errorMessage: error.message });
  }
}

// Listen for manual refresh events
if (!window.__geminiEnhancerListener) {
  window.__geminiEnhancerListener = true;
  document.addEventListener('geminiUiEnhancerRefresh', runScraper);
}

// Initial run - REMOVED for manual trigger
// setTimeout(runScraper, 2000); 

console.log('[GeminiUI Enhancer] Content script loaded. Ready for manual trigger via geminiUiEnhancerRefresh event.');
