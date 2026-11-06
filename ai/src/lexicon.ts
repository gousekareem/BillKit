/*
 * BillKit — Every bill, in your pocket.
 * © 2026 Shaik Gouse Kareem. All rights reserved.
 *
 * Hand-written lexicons used by the rule-based categoriser and merchant
 * finder. Brand names are used only as text patterns for recognition; BillKit
 * has no affiliation with or integration into any of these businesses.
 */
import type { BuiltInCategory } from '@billkit/shared';

export interface MerchantEntry {
  name: string;
  pattern: string;
  category: BuiltInCategory;
  subcategory: string | null;
}

export const KNOWN_MERCHANTS: MerchantEntry[] = [
  { name: 'DMart', pattern: 'd\\s?-?mart|avenue\\s?supermarts', category: 'Groceries', subcategory: 'Supermarket' },
  { name: 'Reliance Fresh', pattern: 'reliance\\s?(fresh|smart|retail)', category: 'Groceries', subcategory: 'Supermarket' },
  { name: 'More Supermarket', pattern: 'more\\s?(supermarket|retail|megastore)', category: 'Groceries', subcategory: 'Supermarket' },
  { name: 'Spencer\'s', pattern: "spencer'?s", category: 'Groceries', subcategory: 'Supermarket' },
  { name: 'Big Bazaar', pattern: 'big\\s?bazaar', category: 'Groceries', subcategory: 'Supermarket' },
  { name: 'SPAR', pattern: 'spar\\s?(hypermarket)?', category: 'Groceries', subcategory: 'Supermarket' },
  { name: 'Ratnadeep', pattern: 'ratnadeep', category: 'Groceries', subcategory: 'Supermarket' },
  { name: 'Nature\'s Basket', pattern: "nature'?s\\s?basket", category: 'Groceries', subcategory: 'Supermarket' },
  { name: 'Swiggy', pattern: 'swiggy', category: 'Food', subcategory: 'Food delivery' },
  { name: 'Zomato', pattern: 'zomato', category: 'Food', subcategory: 'Food delivery' },
  { name: 'Domino\'s', pattern: "domino'?s", category: 'Food', subcategory: 'Fast food' },
  { name: 'McDonald\'s', pattern: "mc\\s?donald'?s", category: 'Food', subcategory: 'Fast food' },
  { name: 'KFC', pattern: 'kfc', category: 'Food', subcategory: 'Fast food' },
  { name: 'Starbucks', pattern: 'starbucks', category: 'Food', subcategory: 'Cafe' },
  { name: 'Cafe Coffee Day', pattern: 'cafe\\s?coffee\\s?day|ccd', category: 'Food', subcategory: 'Cafe' },
  { name: 'Haldiram\'s', pattern: "haldiram'?s", category: 'Food', subcategory: 'Bakery & sweets' },
  { name: 'Indian Oil', pattern: 'indian\\s?oil|iocl', category: 'Fuel', subcategory: 'Petrol' },
  { name: 'Bharat Petroleum', pattern: 'bharat\\s?petroleum|bpcl', category: 'Fuel', subcategory: 'Petrol' },
  { name: 'Hindustan Petroleum', pattern: 'hindustan\\s?petroleum|hpcl', category: 'Fuel', subcategory: 'Petrol' },
  { name: 'Shell', pattern: 'shell\\s?(india|petrol|station)', category: 'Fuel', subcategory: 'Petrol' },
  { name: 'Apollo Pharmacy', pattern: 'apollo\\s?pharmacy', category: 'Healthcare', subcategory: 'Pharmacy' },
  { name: 'MedPlus', pattern: 'med\\s?plus', category: 'Healthcare', subcategory: 'Pharmacy' },
  { name: 'Airtel', pattern: 'airtel|bharti\\s?airtel', category: 'Utilities', subcategory: 'Mobile' },
  { name: 'Jio', pattern: 'reliance\\s?jio|jio\\s?(fiber|postpaid|prepaid)', category: 'Utilities', subcategory: 'Mobile' },
  { name: 'BSNL', pattern: 'bsnl', category: 'Utilities', subcategory: 'Internet' },
  { name: 'Vodafone Idea', pattern: 'vodafone|\\bvi\\s?postpaid', category: 'Utilities', subcategory: 'Mobile' },
  { name: 'Uber', pattern: 'uber', category: 'Transportation', subcategory: 'Taxi / ride-hailing' },
  { name: 'Ola', pattern: 'ola\\s?(cabs|electric)?\\b', category: 'Transportation', subcategory: 'Taxi / ride-hailing' },
  { name: 'Rapido', pattern: 'rapido', category: 'Transportation', subcategory: 'Taxi / ride-hailing' },
  { name: 'IRCTC', pattern: 'irctc', category: 'Travel', subcategory: 'Rail' },
  { name: 'PVR INOX', pattern: 'pvr|inox', category: 'Entertainment', subcategory: 'Movies' },
  { name: 'Decathlon', pattern: 'decathlon', category: 'Shopping', subcategory: 'General retail' },
  { name: 'Croma', pattern: 'croma', category: 'Shopping', subcategory: 'Electronics' },
  { name: 'Reliance Digital', pattern: 'reliance\\s?digital', category: 'Shopping', subcategory: 'Electronics' },
  { name: 'Lifestyle', pattern: 'lifestyle\\s?international', category: 'Shopping', subcategory: 'Clothing' },
  { name: 'Westside', pattern: 'westside', category: 'Shopping', subcategory: 'Clothing' },
];

export interface KeywordRule {
  re: RegExp;
  weight: number;
  subcategory?: string;
  /** "merchant" rules look at the header/merchant line; "item" rules at item rows; "any" at the full text. */
  scope: 'merchant' | 'item' | 'any';
}

export const CATEGORY_RULES: Record<Exclude<BuiltInCategory, 'Other'>, KeywordRule[]> = {
  Food: [
    { re: /\b(restaurant|resto|dhaba|bistro|eatery|kitchen|biryani|darbar|bhavan|tiffin|mess|canteen|food\s?court|grill|bar\s?&?\s?restaurant)\b/i, weight: 3, subcategory: 'Restaurant', scope: 'merchant' },
    { re: /\b(cafe|caf[eé]|coffee|chai|tea\s?(house|point|stall)|bakery|bakers|sweets?|mithai|confectionery|juice|ice\s?cream|pizza|burger)\b/i, weight: 3, subcategory: 'Cafe', scope: 'merchant' },
    { re: /\b(table\s?(no)?|covers?|kot|steward|waiter|dine[\s-]?in|take\s?away|service\s?charge)\b/i, weight: 2, subcategory: 'Restaurant', scope: 'any' },
    { re: /\b(biryani|paneer|chicken|mutton|tikka|masala|naan|roti|dosa|idli|vada|thali|meals?|curry|fried\s?rice|noodles|manchurian|soup|starter|lassi|coffee|cappuccino|latte|tea|samosa|pizza|burger|fries|sandwich|dessert|mocktail|soft\s?drink|pepsi|coke)\b/i, weight: 1.2, scope: 'item' },
  ],
  Groceries: [
    { re: /\b(supermarket|hypermarket|super\s?mart|mart|grocery|groceries|kirana|provision(s|al)?|general\s?stores?|departmental\s?store|fresh|daily\s?needs|vegetables?|fruits?)\b/i, weight: 3, subcategory: 'Supermarket', scope: 'merchant' },
    { re: /\b(rice|atta|wheat|flour|dal|toor|moong|sugar|salt|oil|ghee|milk|curd|paneer|butter|eggs?|bread|onion|potato|tomato|vegetable|fruit|banana|apple|biscuit|soap|detergent|shampoo|toothpaste|tea\s?powder|masala|spices|poha|rava|sooji|besan|jaggery)\b/i, weight: 1.2, scope: 'item' },
    { re: /\b\d+(\.\d+)?\s?(kg|kgs|gm|gms|g|ltr|l|ml)\b/i, weight: 0.8, scope: 'item' },
  ],
  Utilities: [
    { re: /\b(electricity|power\s?(distribution|supply)|discom|tneb|tangedco|bescom|msedcl|tsspdcl|apspdcl|kseb|cesc|tata\s?power|adani\s?electricity|bses|kwh|units?\s?consumed|meter\s?(no|reading)|sanctioned\s?load)\b/i, weight: 4, subcategory: 'Electricity', scope: 'any' },
    { re: /\b(water\s?(supply|board|charges|bill)|jal\s?board|sewerage)\b/i, weight: 4, subcategory: 'Water', scope: 'any' },
    { re: /\b(gas\s?(bill|connection|agency)|lpg|png\s?bill|indane|hp\s?gas|bharat\s?gas|cylinder)\b/i, weight: 4, subcategory: 'Gas', scope: 'any' },
    { re: /\b(broadband|fiber|fibre|internet|wi-?fi|data\s?plan|isp)\b/i, weight: 3, subcategory: 'Internet', scope: 'any' },
    { re: /\b(postpaid|prepaid|recharge|mobile\s?(bill|services)|telecom|sim)\b/i, weight: 3, subcategory: 'Mobile', scope: 'any' },
    { re: /\b(dth|tata\s?play|dish\s?tv|cable\s?tv|set\s?top\s?box)\b/i, weight: 3, subcategory: 'DTH / cable', scope: 'any' },
    { re: /\b(billing\s?period|due\s?date|consumer\s?(no|number|id)|account\s?(no|number))\b/i, weight: 1, scope: 'any' },
  ],
  Shopping: [
    { re: /\b(fashion|apparel|garments?|textiles?|clothing|boutique|footwear|shoes|electronics|mobiles?\s?(store|shop)|appliances|furniture|home\s?decor|stationery|book\s?store|gift|toys?|mall|retail)\b/i, weight: 3, subcategory: 'General retail', scope: 'merchant' },
    { re: /\b(shirt|t-?shirt|jeans|trouser|kurta|saree|dress|shoe|sandal|charger|cable|earphones?|headphones?|mouse|keyboard|notebook|pen|bag|watch)\b/i, weight: 1.2, scope: 'item' },
  ],
  Transportation: [
    { re: /\b(taxi|cab|auto\s?rickshaw|ride|trip\s?fare|metro|bus\s?pass|parking|toll|fastag)\b/i, weight: 3, subcategory: 'Taxi / ride-hailing', scope: 'any' },
    { re: /\b(service\s?centre|car\s?wash|tyres?|puncture|garage|workshop|motors?)\b/i, weight: 2, subcategory: 'Vehicle service', scope: 'merchant' },
  ],
  Fuel: [
    { re: /\b(petrol|diesel|fuel|filling\s?station|petroleum|pump|cng|nozzle|litres?\s?(dispensed)?|density|ms\s?\(petrol\)|hsd|ev\s?charging)\b/i, weight: 4, subcategory: 'Petrol', scope: 'any' },
  ],
  Healthcare: [
    { re: /\b(pharmacy|pharma|chemist|druggist|medical\s?(store|hall|shop)|medicals)\b/i, weight: 4, subcategory: 'Pharmacy', scope: 'merchant' },
    { re: /\b(hospital|clinic|nursing\s?home|diagnostics?|pathology|laboratory|lab\s?test|dental|doctor|dr\.|consultation|opd|ipd)\b/i, weight: 4, subcategory: 'Hospital', scope: 'any' },
    { re: /\b(tablets?|tab\.?|capsules?|cap\.?|syrup|injection|ointment|mg|batch\s?no|exp(iry)?\s?date|schedule\s?h|rx)\b/i, weight: 1.2, scope: 'item' },
  ],
  Entertainment: [
    { re: /\b(cinema|cinemas|multiplex|movie|theatre|theater|tickets?|show\s?time|screen\s?\d|amusement|gaming|bowling|concert|event)\b/i, weight: 3, subcategory: 'Movies', scope: 'any' },
    { re: /\b(netflix|prime\s?video|spotify|hotstar|subscription)\b/i, weight: 3, subcategory: 'Subscriptions', scope: 'any' },
  ],
  Education: [
    { re: /\b(school|college|university|academy|institute|tuition|coaching|course|exam\s?fee|admission|semester|library)\b/i, weight: 3, subcategory: 'Tuition & fees', scope: 'any' },
  ],
  Travel: [
    { re: /\b(hotel|resort|lodge|inn|guest\s?house|homestay|room\s?(no|tariff|charges)|check[\s-]?in|check[\s-]?out|night\s?stay)\b/i, weight: 3, subcategory: 'Hotel', scope: 'any' },
    { re: /\b(airline|airways|flight|boarding|pnr|air\s?fare|airport)\b/i, weight: 3, subcategory: 'Flights', scope: 'any' },
    { re: /\b(railway|train|coach|berth|irctc)\b/i, weight: 3, subcategory: 'Rail', scope: 'any' },
    { re: /\b(travels|tours|holidays|bus\s?ticket|seat\s?no)\b/i, weight: 2, subcategory: 'Bus', scope: 'any' },
  ],
  Housing: [
    { re: /\b(rent|rental|lease|maintenance\s?charges?|society|apartment|housing|plumber|electrician|carpenter)\b/i, weight: 3, subcategory: 'Rent', scope: 'any' },
  ],
  'Personal care': [
    { re: /\b(salon|saloon|spa|parlour|parlor|beauty|barber|unisex|grooming|haircut|facial|manicure|pedicure|gym|fitness)\b/i, weight: 3, subcategory: 'Salon & spa', scope: 'any' },
  ],
};
