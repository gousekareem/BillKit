/*
 * BillKit — Every bill, in your pocket.
 * © 2026 Shaik Gouse Kareem. All rights reserved.
 */

/** Built-in expense categories. Food, Utilities and Groceries are the HR-assignment minimum. */
export const BUILT_IN_CATEGORIES = [
  'Food',
  'Groceries',
  'Utilities',
  'Shopping',
  'Transportation',
  'Fuel',
  'Healthcare',
  'Entertainment',
  'Education',
  'Travel',
  'Housing',
  'Personal care',
  'Other',
] as const;

export type BuiltInCategory = (typeof BUILT_IN_CATEGORIES)[number];

/** "Unknown" is a state, not a category: the system abstains when evidence is insufficient. */
export const UNKNOWN_CATEGORY = 'Unknown' as const;

export const SUBCATEGORIES: Record<BuiltInCategory, readonly string[]> = {
  Food: ['Restaurant', 'Cafe', 'Food delivery', 'Bakery & sweets', 'Fast food'],
  Groceries: ['Supermarket', 'Kirana / general store', 'Fruits & vegetables', 'Dairy', 'Meat & fish'],
  Utilities: ['Electricity', 'Water', 'Gas', 'Internet', 'Mobile', 'DTH / cable'],
  Shopping: ['Clothing', 'Electronics', 'Home & furniture', 'Stationery', 'General retail'],
  Transportation: ['Taxi / ride-hailing', 'Public transport', 'Parking & tolls', 'Vehicle service'],
  Fuel: ['Petrol', 'Diesel', 'CNG / EV charging'],
  Healthcare: ['Pharmacy', 'Hospital', 'Clinic / doctor', 'Diagnostics'],
  Entertainment: ['Movies', 'Events', 'Subscriptions', 'Games'],
  Education: ['Tuition & fees', 'Books', 'Courses'],
  Travel: ['Hotel', 'Flights', 'Rail', 'Bus', 'Travel agency'],
  Housing: ['Rent', 'Maintenance', 'Repairs'],
  'Personal care': ['Salon & spa', 'Cosmetics', 'Fitness'],
  Other: [],
};

export function isBuiltInCategory(value: string): value is BuiltInCategory {
  return (BUILT_IN_CATEGORIES as readonly string[]).includes(value);
}
