// Listen for cookie changes and broadcast them to extension pages (popup / options)
chrome.cookies.onChanged.addListener((changeInfo) => {
  chrome.runtime.sendMessage({
    type: 'COOKIE_CHANGE',
    data: {
      removed: changeInfo.removed,
      cookie: changeInfo.cookie,
      cause: changeInfo.cause
    }
  }).catch(() => {
    // Ignore error when no extension views are open
  });
});

// Message hub for operations requiring extension background permissions
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, url, cookieDetails } = message;

  if (type === 'GET_COOKIES') {
    chrome.cookies.getAll({ url }, (cookies) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true, cookies });
      }
    });
    return true; // async
  } 
  
  else if (type === 'SET_COOKIE') {
    const { name, value, domain, path, secure, httpOnly, expirationDate } = cookieDetails;
    const details = {
      url,
      name,
      value,
      path: path || '/',
      secure: secure || false,
      httpOnly: httpOnly || false
    };
    
    // If domain starts with a dot, we need to handle it or omit it to let chrome set it for the url
    if (domain) {
      // Removing leading dot if it's there, chrome cookies.set doesn't like it sometimes
      // actually, Chrome requires domain matching the url host
      details.domain = domain;
    }
    
    if (expirationDate) {
      details.expirationDate = expirationDate;
    }

    chrome.cookies.set(details, (cookie) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true, cookie });
      }
    });
    return true; // async
  } 
  
  else if (type === 'REMOVE_COOKIE') {
    const { name } = cookieDetails;
    chrome.cookies.remove({ url, name }, (details) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true, details });
      }
    });
    return true; // async
  }

  else if (type === 'OPEN_OPTIONS_PAGE') {
    chrome.runtime.openOptionsPage(() => {
      sendResponse({ success: true });
    });
    return true;
  }
});
