/* BillKit routes: public website + authenticated web app in one connected SPA. © 2026 Shaik Gouse Kareem. */
import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';
import { MarketingLayout } from './layouts/MarketingLayout';
import { AppLayout } from './layouts/AppLayout';
import Home from './pages/marketing/Home';
import Contact from './pages/marketing/Contact';
import { About, Faq, Features, HowItWorks, Legal, NotFound, PrivacySecurity, Technology } from './pages/marketing/Pages';
import { ForgotPassword, Login, Register, ResetPassword } from './pages/auth/Auth';
import { LoadingBlock } from './components/Empty';

const Dashboard = lazy(() => import('./pages/app/Dashboard'));
const Scan = lazy(() => import('./pages/app/Scan'));
const ScanDetail = lazy(() => import('./pages/app/ScanDetail'));
const Bills = lazy(() => import('./pages/app/Bills').then((m) => ({ default: m.Bills })));
const BillDetail = lazy(() => import('./pages/app/Bills').then((m) => ({ default: m.BillDetail })));
const Analytics = lazy(() => import('./pages/app/Other').then((m) => ({ default: m.Analytics })));
const Categories = lazy(() => import('./pages/app/Other').then((m) => ({ default: m.Categories })));
const Settings = lazy(() => import('./pages/app/Other').then((m) => ({ default: m.Settings })));
const Admin = lazy(() => import('./pages/app/Other').then((m) => ({ default: m.Admin })));

const page = (el: React.ReactNode) => <Suspense fallback={<LoadingBlock />}>{el}</Suspense>;

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<MarketingLayout />}>
        <Route index element={<Home />} />
        <Route path="features" element={<Features />} />
        <Route path="how-it-works" element={<HowItWorks />} />
        <Route path="technology" element={<Technology />} />
        <Route path="privacy-security" element={<PrivacySecurity />} />
        <Route path="about" element={<About />} />
        <Route path="faq" element={<Faq />} />
        <Route path="contact" element={<Contact />} />
        <Route path="legal/:slug" element={<Legal />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route path="login" element={<Login />} />
      <Route path="register" element={<Register />} />
      <Route path="forgot-password" element={<ForgotPassword />} />
      <Route path="reset-password" element={<ResetPassword />} />
      <Route path="app" element={<AppLayout />}>
        <Route index element={page(<Dashboard />)} />
        <Route path="scan" element={page(<Scan />)} />
        <Route path="scan/:id" element={page(<ScanDetail />)} />
        <Route path="bills" element={page(<Bills />)} />
        <Route path="bills/:id" element={page(<BillDetail />)} />
        <Route path="analytics" element={page(<Analytics />)} />
        <Route path="categories" element={page(<Categories />)} />
        <Route path="settings" element={page(<Settings />)} />
        <Route path="admin" element={page(<Admin />)} />
      </Route>
    </Routes>
  );
}
