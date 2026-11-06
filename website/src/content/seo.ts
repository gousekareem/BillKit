/* SEO metadata for public pages (used by the prerenderer and at runtime). © 2026 Shaik Gouse Kareem. */
export interface PageMeta {
  path: string;
  title: string;
  description: string;
  /** Include in sitemap.xml and prerender. */
  public: boolean;
}

export const SITE_NAME = 'BillKit';
export const DEFAULT_DESCRIPTION = "Scan, understand, verify and organise your bills with BillKit's intelligent document processing and expense-management tools.";

export const PAGES: PageMeta[] = [
  { path: '/', title: 'BillKit — Every Bill, in Your Pocket', description: DEFAULT_DESCRIPTION, public: true },
  { path: '/features', title: 'Features — BillKit', description: 'Bill scanning, bill/non-bill detection, OCR, evidence-backed extraction, uncertainty highlighting, arithmetic validation, history, analytics and export.', public: true },
  { path: '/how-it-works', title: 'How BillKit works', description: 'The twelve steps from photo to verified expense record — the same steps the BillKit server runs.', public: true },
  { path: '/technology', title: 'AI & technology — BillKit', description: 'Computer vision, OCR, layout analysis, optional vision-language models, confidence handling and validation — explained honestly.', public: true },
  { path: '/privacy-security', title: 'Privacy & security — BillKit', description: 'What BillKit stores, where processing happens, what third parties may receive, and how you delete your data.', public: true },
  { path: '/about', title: 'About BillKit', description: 'Why BillKit exists and the principles behind it. Created and developed by Shaik Gouse Kareem.', public: true },
  { path: '/faq', title: 'FAQ — BillKit', description: 'Answers about formats, accuracy, handwriting, offline use, currencies, export and privacy.', public: true },
  { path: '/contact', title: 'Contact — BillKit', description: 'Send a message to the BillKit project.', public: true },
  { path: '/legal/privacy', title: 'Privacy policy (draft) — BillKit', description: 'Draft privacy policy reflecting the BillKit implementation.', public: true },
  { path: '/legal/terms', title: 'Terms of use (draft) — BillKit', description: 'Draft terms of use for BillKit.', public: true },
  { path: '/legal/data-handling', title: 'Data handling policy (draft) — BillKit', description: 'How BillKit handles bill images, extracted data and logs.', public: true },
  { path: '/legal/ai-limitations', title: 'AI limitations notice — BillKit', description: 'What BillKit’s AI can and cannot do.', public: true },
  { path: '/legal/cookies', title: 'Cookie notice — BillKit', description: 'BillKit uses one essential session cookie and no tracking cookies.', public: true },
  { path: '/legal/data-deletion', title: 'Data deletion instructions — BillKit', description: 'How to delete bills, images and your BillKit account.', public: true },
  { path: '/login', title: 'Sign in — BillKit', description: 'Sign in to BillKit.', public: false },
  { path: '/register', title: 'Create your account — BillKit', description: 'Create a BillKit account.', public: false },
];

export function metaFor(path: string): PageMeta {
  return PAGES.find((p) => p.path === path) ?? { path, title: 'BillKit', description: DEFAULT_DESCRIPTION, public: false };
}
