import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import { useUser, useAuth } from "@clerk/react";
import { useApi } from "./hooks/useApi";

import PublicLayout from "./layouts/PublicLayout";
import AdminLayout from "./layouts/AdminLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";

import Landing from "./pages/Landing";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import CatalogPage from "./pages/CatalogPage";
import VehicleDetailPage from "./pages/VehicleDetailPage";
import MyBidsPage from "./pages/MyBidsPage";
import MyPurchasesPage from "./pages/MyPurchasesPage";
import CheckoutResultPage from "./pages/CheckoutResultPage";
import TermsPage from "./pages/TermsPage";
import PrivacyPage from "./pages/PrivacyPage";
import ContactPage from "./pages/ContactPage";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminVehicles from "./pages/admin/AdminVehicles";
import AdminBids from "./pages/admin/AdminBids";
import AdminReports from "./pages/admin/AdminReports";

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
      api.post("/api/users/sync", { clerkId: user.id, name, email }).catch(() => {});
    }
  }, [isLoaded, isSignedIn, user?.id]);

  return null;
}

export default function App() {
  return (
    <BrowserRouter>
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
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
