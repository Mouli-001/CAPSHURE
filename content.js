// content.js
// CAPSHURE Frontend - Scans page and displays UI

(() => {
  const BANNER_ID = "capshure-banner";
  // Regex to detect CAPTCHA keywords
  const CAPTCHA_TEXT_REGEX = /(i.?m not a robot|i am not a robot|captcha|verify you are human|select all images with|type the characters you see)/i;

  let scanInProgress = false;
  let hasShownBanner = false;

  // Check settings before running
  chrome.storage.sync.get({ detectorEnabled: true }, (data) => {
    if (!data.detectorEnabled) return;
    initDetector();
  });

  function initDetector() {
    // Wait 1 second for page to load, then scan
    setTimeout(runCheck, 1000);
  }

  function extractAllPageUrls() {
    const urls = new Set();
    // Get Links
    document.querySelectorAll("a[href]").forEach((a) => {
      if (/^https?:\/\//i.test(a.href)) urls.add(a.href);
    });
    // Get Scripts
    document.querySelectorAll("script[src]").forEach((s) => {
      if (/^https?:\/\//i.test(s.src)) urls.add(s.src);
    });

    // Limit to 5 URLs to save your API Quota
    return Array.from(urls).slice(0, 2); 
  }

  function findCaptchaContainer() {
    if (!document.body) return null;
    // Check for "I am not a robot" text
    if (CAPTCHA_TEXT_REGEX.test(document.body.innerText)) {
        return true;
    }
    // Check for iframe signatures
    const iframe = Array.from(document.querySelectorAll("iframe")).find((f) => 
      /recaptcha|hcaptcha|\/captcha/i.test(f.src || "")
    );
    return !!iframe;
  }

  function scanLinksWithVT(urls) {
    return new Promise((resolve) => {
      if (!urls.length) return resolve([]);
      chrome.runtime.sendMessage({ type: "VT_SCAN_URLS", urls }, (response) => {
        resolve((response && response.results) ? response.results : []);
      });
    });
  }

  // --- UI GENERATION ---
  function createBaseBanner(styleOverrides = {}) {
    const existing = document.getElementById(BANNER_ID);
    if (existing) existing.remove();

    const banner = document.createElement("div");
    banner.id = BANNER_ID;
    Object.assign(banner.style, {
      position: "fixed",
      top: "0",
      left: "0",
      right: "0",
      zIndex: "2147483647",
      display: "flex",
      alignItems: "center",
      gap: "12px",
      padding: "12px 16px",
      fontFamily: "sans-serif",
      fontSize: "14px",
      fontWeight: "bold",
      color: "#fff",
      boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
      ...styleOverrides
    });

    // Logo Image
    const img = document.createElement("img");
    // NOTE: Ensure you have 'assets/capshure-logo.jpg' in your folder!
    img.src = chrome.runtime.getURL("assets/capshure-logo.jpg"); 
    img.style.width = "24px";
    img.style.height = "24px";
    img.style.borderRadius = "4px";

    const text = document.createElement("span");
    text.style.flex = "1";

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "×";
    Object.assign(closeBtn.style, {
      border: "none",
      background: "transparent",
      color: "white",
      fontSize: "20px",
      cursor: "pointer",
      marginLeft: "10px"
    });
    closeBtn.onclick = () => banner.remove();

    banner.append(img, text, closeBtn);
    return { banner, text };
  }

  function showAccessGranted(msg) {
    const { banner, text } = createBaseBanner({ background: "#059669" }); // GREEN
    text.textContent = msg;
    document.body.prepend(banner);
    hasShownBanner = true;
    setTimeout(() => banner.remove(), 4000);
  }

  function showMalwareAlert(msg) {
    const { banner, text } = createBaseBanner({ background: "#DC2626" }); // RED
    text.textContent = "⚠️ " + msg;
    document.body.prepend(banner);
    hasShownBanner = true;
  }

  function showWarningBanner(msg) {
    const { banner, text } = createBaseBanner({ background: "#D97706" }); // YELLOW
    text.textContent = "⚠️ " + msg;
    document.body.prepend(banner);
    hasShownBanner = true;
    setTimeout(() => banner.remove(), 5000);
  }

  // --- MAIN LOGIC ---
  async function runCheck() {
    if (!document.body || scanInProgress || hasShownBanner) return;
    scanInProgress = true;

    try {
      const hasCaptcha = findCaptchaContainer();
      const urlsToScan = extractAllPageUrls();

      if (urlsToScan.length === 0) {
          // No links to scan? Just say safe.
          if (hasCaptcha) showAccessGranted("CAPTCHA detected. No external links found.");
          return;
      }

      const results = await scanLinksWithVT(urlsToScan);

      // Sort results
      const malicious = results.filter(r => r.malicious);
      const errors = results.filter(r => r.error);

      // DECISION TREE
      if (malicious.length > 0) {
        // 1. RED: Malware found
        showMalwareAlert(`MALWARE DETECTED! ${malicious.length} suspicious link(s) found.`);
      } else if (errors.length > 0) {
        // 2. YELLOW: API Failed (Quota or Network)
        showWarningBanner("Scan Incomplete. VirusTotal API connection failed.");
      } else {
        // 3. GREEN: All clean
        showAccessGranted("Scan Complete. No threats detected.");
      }

    } finally {
      scanInProgress = false;
    }
  }
})();