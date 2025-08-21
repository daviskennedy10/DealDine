import express from "express";
import dotenv from "dotenv";
import { google } from "googleapis";
import cors from "cors";
import { Buffer } from "buffer";

dotenv.config();
console.log("Refresh Token Loaded:", process.env.GMAIL_REFRESH_TOKEN ? "✅ Yes" : "❌ No");


const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from the public directory
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;

// --- Gmail OAuth Setup ---
const oAuth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  process.env.GMAIL_REDIRECT_URI
);

oAuth2Client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

// --- Restaurant classifier ---
function classifyRestaurant(subject, from, snippet = "") {
  const text = (subject + " " + from + " " + snippet).toLowerCase();

  if (text.includes("mcdonald")) return "McDonald's";
  if (text.includes("burger king")) return "Burger King";
  if (text.includes("domino")) return "Domino's";
  if (text.includes("pizza hut")) return "Pizza Hut";
  if (text.includes("subway")) return "Subway";
  if (text.includes("chipotle")) return "Chipotle";
  if (text.includes("starbucks")) return "Starbucks";
  if (text.includes("taco bell")) return "Taco Bell";
  if (text.includes("wendy")) return "Wendy's";
  if (text.includes("popeyes")) return "Popeyes";
  if (text.includes("kfc")) return "KFC";
  if (text.includes("dunkin")) return "Dunkin'";
  if (text.includes("panera")) return "Panera Bread";
  if (text.includes("arbys")) return "Arby's";

  if (text.includes("little caesar")) return "Little Caesars";
  if (text.includes("chick-fil-a") || text.includes("chick fil a")) return "Chick-fil-A";
  if (text.includes("7-eleven") || text.includes("7eleven")) return "7-Eleven";

  return "Other";
}

// --- Default logos (fallbacks) ---
const chainLogos = {
  "McDonald's": "https://img.icons8.com/emoji/96/hamburger-emoji.png",
  "Burger King": "https://img.icons8.com/emoji/96/hamburger-emoji.png",
  "Domino's": "https://img.icons8.com/emoji/96/pizza-emoji.png",
  "Pizza Hut": "https://img.icons8.com/emoji/96/pizza-emoji.png",
  "Subway": "https://img.icons8.com/emoji/96/sandwich-emoji.png",
  "Chipotle": "https://img.icons8.com/emoji/96/burrito-emoji.png",
  "Starbucks": "https://img.icons8.com/emoji/96/hot-beverage-emoji.png",
  "Taco Bell": "https://img.icons8.com/emoji/96/taco-emoji.png",
  "Wendy's": "https://img.icons8.com/emoji/96/hamburger-emoji.png",
  "Popeyes": "https://img.icons8.com/emoji/96/poultry-leg-emoji.png",
  "KFC": "https://img.icons8.com/emoji/96/poultry-leg-emoji.png",
  "Dunkin'": "https://img.icons8.com/emoji/96/doughnut-emoji.png",
  "Panera Bread": "https://img.icons8.com/emoji/96/bread-emoji.png",
  "Arby's": "https://img.icons8.com/emoji/96/sandwich-emoji.png",
  "Little Caesars": "https://img.icons8.com/emoji/96/pizza-emoji.png",
  "Chick-fil-A": "https://img.icons8.com/emoji/96/poultry-leg-emoji.png",
  "7-Eleven": "https://img.icons8.com/emoji/96/convenience-store-emoji.png",
  Other: "https://img.icons8.com/emoji/96/fork-and-knife-with-plate-emoji.png",
};

// --- Extract first image URL from HTML body (robust) ---
function extractImage(message) {
  function collectHtml(payload) {
    const htmlBodies = [];
    if (!payload) return htmlBodies;
    if (payload.mimeType === "text/html" && payload.body?.data) {
      try {
        htmlBodies.push(Buffer.from(payload.body.data, "base64").toString("utf-8"));
      } catch (_) {}
    }
    const parts = payload.parts || [];
    for (const p of parts) {
      htmlBodies.push(...collectHtml(p));
    }
    return htmlBodies;
  }

  const htmlParts = collectHtml(message.payload);
  for (const html of htmlParts) {
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    const candidates = [];
    let match;
    while ((match = imgRegex.exec(html)) !== null) {
      candidates.push(match[1]);
    }
    const filtered = candidates.filter((src) => {
      const s = src.toLowerCase();
      if (s.startsWith('cid:')) return false; // inline cid not supported via API
      if (s.includes('spacer') || s.includes('pixel') || s.includes('tracking') || s.includes('beacon')) return false;
      if (s.includes('open.aspx')) return false; // obvious tracker
      return true;
    });
    if (filtered.length > 0) {
      filtered.sort((a, b) => {
        const score = (u) => (/\.jpe?g|\.png|\.webp/i.test(u) ? 0 : /\.gif/i.test(u) ? 1 : 2);
        return score(a) - score(b);
      });
      return filtered[0];
    }
  }
  return null;
}

// --- Deal extraction ---
function extractDeal(message) {
  const headers = message.payload.headers;
  const subject = headers.find((h) => h.name === "Subject")?.value || "Untitled Deal";
  const from = headers.find((h) => h.name === "From")?.value || "Unknown Sender";
  const snippet = message.snippet || "";

  const restaurant = classifyRestaurant(subject, from, snippet);

  // Expiration (basic guess)
  let expiration = null;
  if (/today|tonight|ends/i.test(snippet)) expiration = "Today";
  else if (/tomorrow/i.test(snippet)) expiration = "Tomorrow";
  else if (/week/i.test(snippet)) expiration = "This Week";

  let image = extractImage(message);
  if (!image) image = chainLogos[restaurant] || chainLogos["Other"];

  return {
    title: subject,
    from,
    chain: restaurant,
    snippet,
    expiration,
    image,
    logo: chainLogos[restaurant] || chainLogos["Other"],
    badge: "Special Offer",
  };
}

// --- API Route: fetch Gmail deals ---
app.get("/api/deals", async (req, res) => {
  try {
    const response = await gmail.users.messages.list({
      userId: "me",
      labelIds: ["CATEGORY_PROMOTIONS"],
      maxResults: 10,
    });

    const messages = response.data.messages || [];

    const deals = await Promise.all(
      messages.map(async (msg) => {
        const fullMessage = await gmail.users.messages.get({
          userId: "me",
          id: msg.id,
        });
        return extractDeal(fullMessage.data);
      })
    );

    res.json(deals);
  } catch (err) {
    console.error("Error fetching Gmail deals:", err.message, err.stack);
    res.status(500).json({ 
      error: "Failed to fetch deals from Gmail",
      details: err.message
    });
  }
});

// --- Root route to serve the main page ---
app.get("/", (req, res) => {
  res.sendFile('index.html', { root: 'public' });
});

// --- Debug Route: Check if env vars are loaded ---
app.get("/env-check", (req, res) => {
  res.json({
    CLIENT_ID: process.env.GMAIL_CLIENT_ID ? "✅ set" : "❌ missing",
    CLIENT_SECRET: process.env.GMAIL_CLIENT_SECRET ? "✅ set" : "❌ missing",
    REFRESH_TOKEN: process.env.GMAIL_REFRESH_TOKEN ? "✅ set" : "❌ missing",
    REDIRECT_URI: process.env.GMAIL_REDIRECT_URI ? "✅ set" : "❌ missing",
  });
});

// --- Start server ---
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
