// background.js
// CAPSHURE Backend - Handles API calls to VirusTotal

//  API KEY
const VT_API_KEY = "661561a933a6bdc2b6cc2cfdcd67805bdcaa180bcf3d7c7458b147859c62db9b";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "VT_SCAN_URLS") {
    const urls = message.urls || [];
    
    // Call the scanner
    scanUrlsWithVirusTotal(urls)
      .then((results) => {
        sendResponse({ results });
      })
      .catch((err) => {
        console.error("Global Background Error:", err);
        // Return an error state so content.js can show the Yellow Banner
        sendResponse({ results: [{ error: true }] }); 
      });

    return true; // Keep channel open for async response
  }
});

async function scanUrlsWithVirusTotal(urls) {
  const results = [];

  for (const url of urls) {
    // --- 🚨 CHEAT CODE FOR TESTING 🚨 ---
    // This forces a RED BANNER when you visit "example.com"
    if (url.includes("example.com")) {
      console.log("Testing Trigger: Forcing MALICIOUS result for", url);
      results.push({
        url,
        malicious: true, 
        score: 99
      });
      continue; 
    }
    // ------------------------------------

    // 1. Validate Key
    if (!VT_API_KEY) {
      results.push({ url, error: true, message: "Missing API Key" });
      continue;
    }

    // 2. Call VirusTotal API
    try {
      const apiUrl = "https://www.virustotal.com/vtapi/v2/url/report" +
        "?apikey=" + encodeURIComponent(VT_API_KEY) +
        "&resource=" + encodeURIComponent(url);

      const res = await fetch(apiUrl);
      
      // Handle HTTP Errors (like 204 Quota Exceeded or 403 Forbidden)
      if (!res.ok) {
         console.warn("VirusTotal API Error Status:", res.status);
         results.push({ url, error: true, status: res.status });
         continue;
      }

      const data = await res.json();
      
      // Check for "positives" count
      const positives = data.positives || 0;
      
      results.push({
        url,
        malicious: positives > 0, // TRUE if virus found
        score: positives,
        error: false
      });

    } catch (err) {
      console.error("Network/Parse Error for:", url, err);
      results.push({ url, error: true });
    }
  }

  return results;
}