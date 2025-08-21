
const cheerio = require('cheerio');

class DealEmailParser {
  constructor(){
    this.chainMapping = {
      mcdonalds:"McDonald's", burgerking:"Burger King", wendys:"Wendy's", tacobell:"Taco Bell",
      subway:"Subway", kfc:"KFC", dominos:"Domino's", pizzahut:"Pizza Hut", chickfila:"Chick-fil-A",
      popeyes:"Popeyes", arbys:"Arby's", dunkin:"Dunkin'", starbucks:"Starbucks", chipotle:"Chipotle",
      fiveguys:"Five Guys", shakeshack:"Shake Shack", innout:"In-N-Out", whataburger:"Whataburger",
      culvers:"Culver's", sonic:"Sonic", panerabread:"Panera Bread"
    };
  }

  async parseEmailContent(html, subject=''){
    try{
      const $ = cheerio.load(html);
      const nodes = $('*:contains("deal"), *:contains("offer"), *:contains("discount"), *:contains("free")');
      const out = [];
      nodes.each((_,el)=>{
        const deal = this.extractDealFromElement($, el, subject);
        if (deal) out.push(deal);
      });
      return out;
    }catch(e){
      console.error(e);
      return [];
    }
  }

  extractDealFromElement($, el, subject){
    const text = $(el).text().trim();
    if (text.length < 10 || text.length > 500) return null;
    const chainId = this.identifyChain(text, subject);
    if (!chainId) return null;
    const info = this.extractDealDetails(text);
    if (!info) return null;
    return {
      id: 'deal_'+Date.now()+'_'+Math.random().toString(36).slice(2,8),
      chainId,
      chainName: this.chainMapping[chainId] || 'Unknown',
      ...info,
      relevanceScore: 70,
      createdAt: new Date().toISOString()
    };
  }

  identifyChain(text, subject){
    const t = (text||'').toLowerCase(); const s=(subject||'').toLowerCase();
    for (const [id,name] of Object.entries(this.chainMapping)){
      const n = name.toLowerCase();
      if (t.includes(n) || s.includes(n)) return id;
    }
    const abbr = { mcd:'mcdonalds', bk:'burgerking', tb:'tacobell', cf:'chickfila', dd:'dunkin' };
    for (const [a,id] of Object.entries(abbr)){ if (t.includes(a) || s.includes(a)) return id; }
    return null;
  }

  extractDealDetails(text){
    const patterns = [
      /(buy one get one|bogo|2 for 1|buy 1 get 1)/i,
      /(\d+%?\s*off)/i,
      /(\$\d+(?:\.\d{2})?\s*off)/i,
      /(free\s+\w+)/i,
      /(\d+%?\s*discount)/i
    ];
    let dealType = ''; let savings='';
    for (const p of patterns){ const m = text.match(p); if (m){ dealType=m[1]; savings=m[1]; break; } }
    const priceMatch = text.match(/\$(\d+(?:\.\d{2})?)/g);
    const originalPrice = priceMatch ? priceMatch[0].replace("$","") : "";
    const dealPrice = priceMatch && priceMatch.length>1 ? priceMatch[1].replace("$","") : originalPrice;
    const foodItems = ['burger','pizza','taco','fries','nuggets','sandwich','coffee','drink','ice cream','milkshake'];
    let foodItem = 'Food Item'; for (const i of foodItems){ if (text.toLowerCase().includes(i)){ foodItem = i[0].toUpperCase()+i.slice(1); break; } }
    let category = 'Special Offer';
    if ((dealType||'').toLowerCase().includes('free')) category='Free Item';
    else if ((dealType||'').includes('%')) category='Percentage Off';
    else if ((dealType||'').toLowerCase().includes('bogo')) category='Buy One Get One';
    else if ((dealType||'').includes('$')) category='Dollar Off';
    const expiry = new Date(); expiry.setDate(expiry.getDate()+14);
    return {
      title: dealType || 'Special Offer',
      description: text.substring(0,100)+'...',
      savings: savings || '',
      originalPrice, dealPrice,
      expiryDate: expiry.toISOString(),
      imageUrl: '/images/placeholder.jpg',
      foodItem, category
    };
  }
}

module.exports = DealEmailParser;
