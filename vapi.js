// Buyzo Cart - Vapi AI Voice Assistant (Updated)

// ============================================================
//  CONFIGURATION — Add your keys here
// ============================================================
const VAPI_PUBLIC_KEY    = "YOUR_VAPI_PUBLIC_KEY";     // <-- Replace this
const VAPI_ASSISTANT_ID  = "YOUR_VAPI_ASSISTANT_ID";   // <-- Replace this
// ============================================================

let vapiInstance    = null;
let vapiCallActive  = false;

function vapiOpenModal() {
  document.getElementById("vapiModal").classList.add("open");
  const keysSet = VAPI_PUBLIC_KEY !== "YOUR_VAPI_PUBLIC_KEY";
  document.getElementById("vapiConfigNotice").style.display = keysSet ? "none" : "block";
}

function vapiCloseModal() {
  if (vapiCallActive) vapiEndCall();
  document.getElementById("vapiModal").classList.remove("open");
}

document.getElementById("vapiModal").addEventListener("click", function(e) {
  if (e.target === this) vapiCloseModal();
});

function vapiStartCall() {
  if (VAPI_PUBLIC_KEY === "YOUR_VAPI_PUBLIC_KEY") {
    setVapiStatus("⚠️ Please configure VAPI keys first", "");
    return;
  }

  try {
    vapiInstance = new Vapi(VAPI_PUBLIC_KEY);
    bindVapiEvents();
    vapiInstance.start(VAPI_ASSISTANT_ID);
    vapiCallActive = true;
    setVapiUI("calling");
    setVapiStatus("Connecting...", "calling-state");
    document.getElementById("vapiTranscript").textContent = "Starting call...";
  } catch (err) {
    console.error("Vapi start error:", err);
    setVapiStatus("❌ Could not start call. Check your API key.", "");
  }
}

function vapiEndCall() {
  if (vapiInstance) {
    try { vapiInstance.stop(); } catch(e) {}
    vapiInstance = null;
  }
  vapiCallActive = false;
  setVapiUI("idle");
  setVapiStatus("Call ended. Tap below to start again.", "");
  document.getElementById("vapiTranscript").textContent =
    'Say something like: "Show me t-shirts under ₹500" or "Open my account"';
}

function bindVapiEvents() {
  vapiInstance.on("call-start", () => {
    setVapiStatus("🟢 Connected — Speak now!", "listening-state");
    document.getElementById("vapiTranscript").textContent = "Listening...";
  });

  vapiInstance.on("speech-start", () => {
    setVapiStatus("🎙️ You are speaking...", "listening-state");
  });

  vapiInstance.on("speech-end", () => {
    setVapiStatus("🤔 Processing with AI...", "calling-state");
  });

  vapiInstance.on("message", async (msg) => {
    if (msg.type === "transcript" && msg.role === "user") {
      const userText = msg.transcript || "";
      setVapiStatus("You said: " + userText, "listening-state");

      try {
        const aiResponse = await callAIBackend(userText);
        executeAction(aiResponse);

        if (aiResponse.reply) {
          vapiInstance.send({
            type: "add-message",
            message: { role: "assistant", content: aiResponse.reply }
          });
        }
      } catch (e) {
        console.error("AI Backend error:", e);
      }
    }

    if (msg.type === "transcript" && msg.role === "assistant") {
      document.getElementById("vapiTranscript").textContent = msg.transcript || "";
    }
  });

  vapiInstance.on("call-end", () => {
    vapiCallActive = false;
    setVapiUI("idle");
    setVapiStatus("Call ended. Tap below to start again.", "");
  });

  vapiInstance.on("error", (err) => {
    console.error("Vapi error:", err);
    setVapiStatus("❌ Error: " + (err.message || "Something went wrong"), "");
    vapiEndCall();
  });
}

async function callAIBackend(userQuery) {
  try {
    // Local dev:      http://localhost:3000/api/ai-command
    // Render.com:     https://your-app.onrender.com/api/ai-command
    // Railway:        https://your-app.up.railway.app/api/ai-command
    const BACKEND_URL = window.AI_BACKEND_URL || 'http://localhost:3000/api/ai-command';

    const response = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: userQuery })
    });

    if (!response.ok) throw new Error('Server error: ' + response.status);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("AI Backend error:", error);
    return { action: "ERROR", reply: "Sorry, I couldn't process that." };
  }
}

function executeAction(aiResponse) {
  const { action, query, maxPrice, page, reply } = aiResponse;

  if (reply) {
    document.getElementById("vapiTranscript").textContent = reply;
  }

  switch(action) {
    case "SHOW_PRODUCT":
      if (typeof openSearchPanel === "function") {
        vapiCloseModal();
        openSearchPanel();
        const inp = document.getElementById("searchPanelInput");
        if (inp) {
          inp.value = query || "";
          inp.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }
      if (maxPrice) {
        setTimeout(() => {
          const maxPriceInput = document.getElementById("maxPrice");
          if (maxPriceInput) {
            maxPriceInput.value = maxPrice;
            document.getElementById("applyPriceFilter")?.click();
          }
        }, 500);
      }
      setVapiStatus("✅ Searching: " + (query || 'products'), "");
      break;

    case "OPEN_PAGE":
      const pageMap = {
        home: "homePage",
        products: "productsPage",
        orders: "myOrdersPage",
        account: "accountPage",
        wishlist: "wishlistPage",
        offers: "offersPage"
      };
      const targetPage = pageMap[page?.toLowerCase()] || "homePage";

      if (page?.toLowerCase() === "account") {
        vapiCloseModal();
        window.location.href = 'account.html';
      } else if (typeof showPage === "function") {
        vapiCloseModal();
        showPage(targetPage);
      }
      setVapiStatus("✅ Opening " + (page || 'page'), "");
      break;

    case "SHOW_CONTACT":
      document.getElementById("vapiTranscript").innerHTML =
        "📞 <strong>+91-9557987574</strong><br>📧 support@buyzocartshop.com";
      setVapiStatus("📞 Contact info displayed", "");
      break;

    case "SEARCH":
      if (typeof openSearchPanel === "function") {
        vapiCloseModal();
        openSearchPanel();
        const inp = document.getElementById("searchPanelInput");
        if (inp) {
          inp.value = query || "";
          inp.dispatchEvent(new Event("input", { bubbles: true }));
        }
        setVapiStatus("✅ Searching: " + query, "");
      }
      break;

    default:
      console.log("Unknown action:", action);
  }
}

function vapiSendHint(text) {
  document.getElementById("vapiTranscript").textContent = "You: " + text;
  setVapiStatus("Processing...", "listening-state");
  callAIBackend(text).then(aiResponse => executeAction(aiResponse));
}

function setVapiStatus(text, ringClass) {
  const statusEl = document.getElementById("vapiStatusText");
  const ring = document.getElementById("vapiStatusRing");
  if (statusEl) statusEl.textContent = text;
  if (ring) {
    ring.className = "vapi-status-ring" + (ringClass ? " " + ringClass : "");
    if (ringClass === "listening-state") ring.textContent = "🎙️";
    else if (ringClass === "calling-state") ring.textContent = "🤖";
    else ring.textContent = "🎙️";
  }
}

function setVapiUI(state) {
  const fab = document.getElementById("vapiCallFab");
  const startBtn = document.getElementById("vapiStartBtn");
  const endBtn = document.getElementById("vapiEndBtn");
  const phoneIcon = document.getElementById("vapiPhoneIcon");
  const waveIcon = document.getElementById("vapiWaveIcon");
  const hBtn = document.getElementById("headerCallBtn");
  const hPhone = document.getElementById("headerCallPhoneIcon");
  const hWave = document.getElementById("headerCallWaveIcon");
  const hLabel = hBtn?.querySelector(".header-call-label");

  if (state === "calling") {
    fab?.classList.add("calling");
    if (phoneIcon) phoneIcon.style.display = "none";
    if (waveIcon) waveIcon.style.display = "block";
    if (startBtn) startBtn.style.display = "none";
    if (endBtn) endBtn.style.display = "block";
    hBtn?.classList.add("active-call");
    if (hPhone) hPhone.style.display = "none";
    if (hWave) hWave.style.display = "block";
    if (hLabel) hLabel.textContent = "On Call";
  } else {
    fab?.classList.remove("calling");
    if (phoneIcon) phoneIcon.style.display = "block";
    if (waveIcon) waveIcon.style.display = "none";
    if (startBtn) startBtn.style.display = "block";
    if (endBtn) endBtn.style.display = "none";
    hBtn?.classList.remove("active-call");
    if (hPhone) hPhone.style.display = "block";
    if (hWave) hWave.style.display = "none";
    if (hLabel) hLabel.textContent = "AI Call";
  }
}

// ---- Text Input Handler ----
function handleTextCommand() {
  const input = document.getElementById("userInput");
  if (!input) return;
  const query = input.value.trim();
  if (!query) return;

  setVapiStatus("Processing text command...", "listening-state");
  document.getElementById("vapiTranscript").textContent = "You: " + query;

  callAIBackend(query).then(aiResponse => executeAction(aiResponse));
  input.value = "";
}

document.addEventListener('DOMContentLoaded', function() {
  const sendBtn = document.getElementById('sendTextBtn');
  if (sendBtn) sendBtn.addEventListener('click', handleTextCommand);

  const userInput = document.getElementById('userInput');
  if (userInput) {
    userInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') handleTextCommand();
    });
  }
});
