import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppProvider, useApp } from './contexts/AppContext';
import { ErrorBoundary } from './components/ErrorBoundary';

// Public Pages
import { LandingPage } from './pages/public/LandingPage';
import { WelcomePage } from './pages/public/WelcomePage';
import { LoginPage, RegisterPage, ResetPasswordPage } from './pages/public/AuthPages';
import { ContactPage, PrivacyPolicyPage, TermsPage } from './pages/public/LegalPages';

// User Pages
import { OnboardingPage } from './pages/user/OnboardingPage';
import { NearbyPage } from './pages/user/NearbyPage';
import { DiscoverPage } from './pages/user/DiscoverPage';
import { LikesMatchesPage } from './pages/user/LikesMatchesPage';
import { MessagesPage } from './pages/user/MessagesPage';
import { UserProfileViewPage } from './pages/user/UserProfileViewPage';
import { ProfileHubPage } from './pages/user/ProfileHubPage';
import { ProfileEditPage } from './pages/user/ProfileEditPage';
import { PhotoGalleryPage } from './pages/user/PhotoGalleryPage';
import { ContactsManagementPage } from './pages/user/ContactsManagementPage';
import { LocationSettingsPage, PreferencesPage } from './pages/user/PreferencesLocationPages';
import {
  AccountSettingsPage,
  LanguageSettingsPage,
  NotificationsPage,
} from './pages/user/AccountLanguagePages';
import { PaymentHistoryPage, SubscriptionPage } from './pages/user/SubscriptionPages';

// Admin Page
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';

const RequireAuth: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { firebaseUser, authLoading } = useApp();
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0D1018] text-white flex items-center justify-center text-sm">
        Loading...
      </div>
    );
  }
  if (!firebaseUser) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/welcome" element={<WelcomePage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/contact" element={<ContactPage />} />

            {/* Authenticated User Routes */}
            <Route
              path="/onboarding"
              element={
                <RequireAuth>
                  <OnboardingPage />
                </RequireAuth>
              }
            />
            <Route
              path="/nearby"
              element={
                <RequireAuth>
                  <NearbyPage initialMode="cards" />
                </RequireAuth>
              }
            />
            <Route
              path="/nearby/radar"
              element={
                <RequireAuth>
                  <NearbyPage initialMode="radar" />
                </RequireAuth>
              }
            />
            <Route
              path="/discover"
              element={
                <RequireAuth>
                  <DiscoverPage />
                </RequireAuth>
              }
            />
            <Route
              path="/likes"
              element={
                <RequireAuth>
                  <LikesMatchesPage initialTab="matches" />
                </RequireAuth>
              }
            />
            <Route
              path="/matches"
              element={
                <RequireAuth>
                  <LikesMatchesPage initialTab="matches" />
                </RequireAuth>
              }
            />
            <Route
              path="/messages"
              element={
                <RequireAuth>
                  <MessagesPage />
                </RequireAuth>
              }
            />
            <Route
              path="/messages/:conversationId"
              element={
                <RequireAuth>
                  <MessagesPage />
                </RequireAuth>
              }
            />
            <Route
              path="/notifications"
              element={
                <RequireAuth>
                  <NotificationsPage />
                </RequireAuth>
              }
            />

            {/* Profile Management Routes */}
            <Route
              path="/profile"
              element={
                <RequireAuth>
                  <ProfileHubPage />
                </RequireAuth>
              }
            />
            <Route
              path="/profile/edit"
              element={
                <RequireAuth>
                  <ProfileEditPage />
                </RequireAuth>
              }
            />
            <Route
              path="/profile/photos"
              element={
                <RequireAuth>
                  <PhotoGalleryPage />
                </RequireAuth>
              }
            />
            <Route
              path="/profile/contacts"
              element={
                <RequireAuth>
                  <ContactsManagementPage />
                </RequireAuth>
              }
            />
            <Route
              path="/profile/privacy"
              element={
                <RequireAuth>
                  <ContactsManagementPage />
                </RequireAuth>
              }
            />
            <Route
              path="/profile/location"
              element={
                <RequireAuth>
                  <LocationSettingsPage />
                </RequireAuth>
              }
            />
            <Route
              path="/profile/preferences"
              element={
                <RequireAuth>
                  <PreferencesPage />
                </RequireAuth>
              }
            />
            <Route
              path="/profile/settings"
              element={
                <RequireAuth>
                  <AccountSettingsPage />
                </RequireAuth>
              }
            />
            <Route
              path="/profile/language"
              element={
                <RequireAuth>
                  <LanguageSettingsPage />
                </RequireAuth>
              }
            />
            <Route
              path="/profile/:uid"
              element={
                <RequireAuth>
                  <UserProfileViewPage />
                </RequireAuth>
              }
            />

            {/* Subscription Routes */}
            <Route
              path="/subscription"
              element={
                <RequireAuth>
                  <SubscriptionPage />
                </RequireAuth>
              }
            />
            <Route
              path="/subscription/history"
              element={
                <RequireAuth>
                  <PaymentHistoryPage />
                </RequireAuth>
              }
            />

            {/* Admin Route */}
            <Route
              path="/admin/*"
              element={
                <RequireAuth>
                  <AdminDashboardPage />
                </RequireAuth>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AppProvider>
    </ErrorBoundary>
  );
}
