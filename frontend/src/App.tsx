import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import { useUser, useAuth } from "@clerk/react";
import { useApi } from "./hooks/useApi";
import { RealtimeProvider } from "./context/RealtimeContext";
import { WatchlistProvider } from "./context/WatchlistContext";

import PublicLayout from "./layouts/PublicLayout";
import AdminLayout from "./layouts/AdminLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import RoleRoute from "./components/RoleRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import NotFoundPage from "./pages/NotFoundPage";

import Landing from "./pages/Landing";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import CatalogPage from "./pages/CatalogPage";
import VehicleDetailPage from "./pages/VehicleDetailPage";
import MyBidsPage from "./pages/MyBidsPage";
import MyPurchasesPage from "./pages/MyPurchasesPage";
import MyWatchlistPage from "./pages/MyWatchlistPage";
import AccountPage from "./pages/AccountPage";
import NotificationsPage from "./pages/NotificationsPage";
import CheckoutResultPage from "./pages/CheckoutResultPage";
import ReceiptPage from "./pages/ReceiptPage";
import EntregaDetailPage from "./pages/EntregaDetailPage";
import CustodioInspeccion from "./pages/CustodioInspeccion";
import TermsPage from "./pages/TermsPage";
import PrivacyPage from "./pages/PrivacyPage";
import ContactPage from "./pages/ContactPage";
import McpConsentPage from "./pages/McpConsentPage";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminVehicles from "./pages/admin/AdminVehicles";
import AdminBids from "./pages/admin/AdminBids";
import AdminReports from "./pages/admin/AdminReports";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminAudit from "./pages/admin/AdminAudit";
import AdminAcreditaciones from "./pages/admin/AdminAcreditaciones";
import AdminEntregasBloqueadas from "./pages/admin/AdminEntregasBloqueadas";

function SyncUser() {
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const api = useApi();

  useEffect(() => {
    if (isLoaded && isSignedIn && user) {
      const name =
        [user.firstName, user.lastName].filter(Boolean).join(" ") ||
        user.emailAddresses[0]?.emailAddress ||
        "Usuario";
      const email = user.emailAddresses[0]?.emailAddress || "";
      // El backend toma el clerkId del token de Clerk, no del body
      api.post("/api/users/sync", { name, email }).catch(() => {});
    }
  }, [isLoaded, isSignedIn, user?.id]);

  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
      <RealtimeProvider>
      <WatchlistProvider>
      <SyncUser />
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Landing />} />
          <Route path="/login/*" element={<LoginPage />} />
          <Route path="/register/*" element={<RegisterPage />} />
          <Route path="/vehicles" element={<CatalogPage />} />
          <Route path="/vehicles/:id" element={<VehicleDetailPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route
            path="/my-bids"
            element={
              <ProtectedRoute>
                <MyBidsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-purchases"
            element={
              <ProtectedRoute>
                <MyPurchasesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <NotificationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/watchlist"
            element={
              <ProtectedRoute>
                <MyWatchlistPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/account"
            element={
              <ProtectedRoute>
                <AccountPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/receipt/:paymentId"
            element={
              <ProtectedRoute>
                <ReceiptPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/entrega/:id"
            element={
              <ProtectedRoute>
                <EntregaDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/custodio"
            element={
              <RoleRoute roles={["custodio", "admin"]}>
                <CustodioInspeccion />
              </RoleRoute>
            }
          />
          <Route
            path="/custodio/entregas/:id"
            element={
              <RoleRoute roles={["custodio", "admin"]}>
                <CustodioInspeccion />
              </RoleRoute>
            }
          />
          <Route
            path="/checkout/success"
            element={
              <ProtectedRoute>
                <CheckoutResultPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/checkout/cancel"
            element={
              <ProtectedRoute>
                <CheckoutResultPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mcp-consent"
            element={
              <ProtectedRoute>
                <McpConsentPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="vehicles" element={<AdminVehicles />} />
          <Route path="bids" element={<AdminBids />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="acreditaciones" element={<AdminAcreditaciones />} />
          <Route path="entregas-bloqueadas" element={<AdminEntregasBloqueadas />} />
          <Route path="audit" element={<AdminAudit />} />
        </Route>
      </Routes>
      </WatchlistProvider>
      </RealtimeProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
