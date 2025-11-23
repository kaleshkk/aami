import { Route, Routes } from "react-router-dom";

import { Layout } from "./components/layout/Layout";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { VaultPage } from "./pages/VaultPage";
import { SettingsPage } from "./pages/SettingsPage";
import { OTViewPage } from "./pages/OTViewPage";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/vault" element={<VaultPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/ot/:id" element={<OTViewPage />} />
        <Route path="*" element={<LoginPage />} />
      </Routes>
    </Layout>
  );
}


