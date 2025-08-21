// script.js

// Top 30 US Fast Food Restaurants
const TOP_RESTAURANTS = [
  "McDonald's", "Starbucks", "Wendy's", "Burger King", "Chick-fil-A",
  "Taco Bell", "Subway", "Domino's", "Pizza Hut", "Little Caesars",
  "Dunkin'", "KFC", "Chipotle", "Panera Bread", "Popeyes",
  "Arby's", "Jack in the Box", "Carl's Jr.", "Hardee's", "Sonic Drive-In",
  "Five Guys", "In-N-Out Burger", "Shake Shack", "Raising Cane's", "Zaxby's",
  "Wingstop", "Dairy Queen", "Panda Express", "Whataburger", "Jimmy John's"
];

let allDeals = [];
let selectedRestaurants = new Set(TOP_RESTAURANTS); // Start with all restaurants selected to see all emails

async function fetchDeals() {
  try {
    console.log("🔍 Fetching deals from API...");
    const res = await fetch("http://localhost:3000/api/deals");
    if (!res.ok) throw new Error("Failed to fetch deals");
    const deals = await res.json();
    console.log("✅ Fetched deals:", deals);
    return deals;
  } catch (err) {
    console.error("❌ Error fetching deals:", err);
    return [];
  }
}

function renderRestaurantFilter() {
  const container = document.getElementById("chipContainer");
  container.innerHTML = "";

  TOP_RESTAURANTS.forEach(restaurant => {
    const chip = document.createElement("button");
    chip.className = `chip ${selectedRestaurants.has(restaurant) ? 'active' : ''}`;
    chip.textContent = restaurant;
    
    chip.addEventListener("click", () => {
      if (selectedRestaurants.has(restaurant)) {
        selectedRestaurants.delete(restaurant);
        chip.classList.remove('active');
      } else {
        selectedRestaurants.add(restaurant);
        chip.classList.add('active');
      }
      renderDeals(getFilteredDeals());
    });
    
    container.appendChild(chip);
  });
}

function getFilteredDeals() {
  if (selectedRestaurants.size === 0) return [];
  return allDeals.filter(deal => selectedRestaurants.has(deal.chain));
}

function renderDeals(deals) {
  const container = document.getElementById("grid");
  container.innerHTML = ""; // clear old cards

  if (deals.length === 0) {
    container.innerHTML = `<p style="text-align: center; color: var(--muted); font-size: 18px; padding: 40px;">
      ${selectedRestaurants.size === 0 ? 'No restaurants selected. Please select at least one restaurant to see deals.' : 'No deals found for the selected restaurants.'}
    </p>`;
    return;
  }

  deals.forEach((deal) => {
    // Use the template from HTML
    const template = document.getElementById("cardTemplate");
    const card = template.content.cloneNode(true);
    
    // Set the image
    const img = card.querySelector(".img");
    img.src = deal.image;
    img.alt = deal.title;
    
    // Set the restaurant chain
    const chain = card.querySelector(".chain");
    chain.textContent = deal.chain;
    const logo = card.querySelector('.chain-logo');
    if (logo && deal.logo) logo.src = deal.logo;
    
    // Set the title
    const title = card.querySelector(".card-title");
    title.textContent = deal.title;
    
    // Set the badge
    const badge = card.querySelector(".badge");
    badge.textContent = deal.badge;
    
    // Set the expiration
    const expires = card.querySelector(".expires");
    expires.textContent = deal.expiration || 'No expiration';
    
    container.appendChild(card);
  });
}

// 🚀 Init
document.addEventListener("DOMContentLoaded", async () => {
  allDeals = await fetchDeals();
  renderRestaurantFilter();
  renderDeals(getFilteredDeals());
  // sorting handlers
  document.querySelectorAll('.pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const mode = btn.dataset.sort;
      let deals = getFilteredDeals();
      if (mode === 'expiration') {
        deals = deals.slice().sort((a,b)=>{
          const ax = a.expiration ? new Date(a.expiration) : Infinity;
          const bx = b.expiration ? new Date(b.expiration) : Infinity;
          return ax - bx;
        });
      } else if (mode === 'savings') {
        // naive: prioritize ones with $ or % in title/snippet
        const score = d => {
          const t = (d.title + ' ' + (d.snippet||'')).toLowerCase();
          let s = 0; if (t.includes('%')) s+=2; if (t.match(/\$\d+/)) s+=2; if (t.includes('bogo')) s+=1; return -s;
        };
        deals = deals.slice().sort((a,b)=> score(a)-score(b));
      }
      renderDeals(deals);
    });
  });
});
