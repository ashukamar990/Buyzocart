const express = require('express');
const cors    = require('cors');
const axios   = require('axios');
require('dotenv').config();

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static('./')); // index.html, style.css, *.js serve karega

// ─── DeepSeek Config ─────────────────────────────────────────
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_URL     = 'https://api.deepseek.com/v1/chat/completions';

// ─── AI Command Endpoint ──────────────────────────────────────
app.post('/api/ai-command', async (req, res) => {
  try {
    const userInput = (req.body.query || req.body.message || '').trim();

    if (!userInput) {
      return res.json({
        action: 'UNKNOWN',
        reply: "I didn't catch that. Please repeat!"
      });
    }

    console.log('📝 User Input:', userInput);

    const response = await axios.post(DEEPSEEK_URL, {
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: `You are an AI assistant for "Buyzo Cart" eCommerce website.
Your ONLY job is to output a valid JSON object.

Available actions:
1. SHOW_PRODUCT  – Search/filter products.    Params: query (string), maxPrice (number, optional)
2. OPEN_PAGE     – Navigate to a page.        Params: page (home | products | orders | account | wishlist | offers)
3. SHOW_CONTACT  – Display contact info.      No extra params.
4. SEARCH        – General product search.    Params: query (string)

Rules:
- Always include a friendly "reply" field in Hindi/English mix.
- Respond with ONLY raw JSON — no markdown, no backticks.

Examples:
User: "500 ke andar t-shirt dikhao"
→ {"action":"SHOW_PRODUCT","query":"t-shirt","maxPrice":500,"reply":"Showing t-shirts under ₹500 😊"}

User: "account kholo"
→ {"action":"OPEN_PAGE","page":"account","reply":"Opening your account page!"}

User: "contact number kya hai"
→ {"action":"SHOW_CONTACT","reply":"Our number is +91-9557987574"}

User: "orders dikhao"
→ {"action":"OPEN_PAGE","page":"orders","reply":"Opening your orders page!"}

User: "sneakers dhundho"
→ {"action":"SEARCH","query":"sneakers","reply":"Searching for sneakers..."}`
        },
        {
          role: 'user',
          content: userInput
        }
      ],
      temperature: 0.1,
      max_tokens: 200
    }, {
      headers: {
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    const aiContent = response.data.choices[0].message.content.trim();
    console.log('🤖 AI Response:', aiContent);

    let aiResponse;
    try {
      // Remove any accidental markdown fences
      const clean = aiContent.replace(/```json|```/g, '').trim();
      aiResponse = JSON.parse(clean);
    } catch {
      aiResponse = { action: 'UNKNOWN', reply: aiContent };
    }

    res.json(aiResponse);

  } catch (error) {
    console.error('❌ AI Error:', error.message);
    res.json({
      action: 'ERROR',
      reply: 'Sorry, I encountered an error. Please try again.'
    });
  }
});

// ─── Health Check ─────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'OK', message: 'Buyzo Cart AI Backend is running! 🚀' });
});

// ─── Start ────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀  Server running at  http://localhost:${PORT}`);
  console.log(`📍  AI Endpoint:       http://localhost:${PORT}/api/ai-command`);
  console.log(`❤️   Health Check:     http://localhost:${PORT}/api/health\n`);
});
