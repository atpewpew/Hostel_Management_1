import About from "@/pages/About";
import AnnouncementDetailPage from "@/pages/AnnouncementDetailPage";
import AnnouncementsPage from "@/pages/AnnouncementsPage";
import CollegePage from "@/pages/CollegePage";
import ComplaintCreatePage from "@/pages/complaints/ComplaintCreatePage";
import ComplaintDetailPage from "@/pages/complaints/ComplaintDetailPage";
import ComplaintsListPage from "@/pages/complaints/ComplaintsListPage";
import Contact from "@/pages/Contact";
import Dashboard from "@/pages/Dashboard";
import FeesPage from "@/pages/FeesPage";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import ManagerColleges from "@/pages/manager/ManagerColleges";
import ManagerDashboard from "@/pages/manager/ManagerDashboard";
import ManagerLogin from "@/pages/manager/ManagerLogin";
import ManagerPending from "@/pages/manager/ManagerPending";
import LostFoundPage from "@/pages/LostFoundPage";
import MessPage from "@/pages/MessPage";
import Signup from "@/pages/Signup";
import StudentDetailPage from "@/pages/StudentDetailPage";
import TransitPage from "@/pages/TransitPage";
import UserManagementPage from "@/pages/UserManagementPage";
import { Route, Routes } from "react-router-dom";
import OnlyGuests from "./guards/OnlyGuests";
import RequireAuth from "./guards/RequireAuth";
import StudentOnly from "./guards/StudentOnly";

export function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <RequireAuth>
            <Home />
          </RequireAuth>
        }
      />
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <Dashboard />
          </RequireAuth>
        }
      />
      <Route path="/about" element={<About />} />
      <Route path="/contact" element={<Contact />} />
      <Route
        path="/login"
        element={
          <OnlyGuests>
            <Login />
          </OnlyGuests>
        }
      />
      <Route
        path="/signup"
        element={
          <OnlyGuests>
            <Signup />
          </OnlyGuests>
        }
      />
      <Route
        path="/complaints"
        element={
          <RequireAuth>
            <ComplaintsListPage />
          </RequireAuth>
        }
      />
      <Route
        path="/complaints/new"
        element={
          <StudentOnly>
            <ComplaintCreatePage />
          </StudentOnly>
        }
      />
      <Route
        path="/complaints/:id"
        element={
          <RequireAuth>
            <ComplaintDetailPage />
          </RequireAuth>
        }
      />
      <Route
        path="/student/:userId"
        element={
          <RequireAuth>
            <StudentDetailPage />
          </RequireAuth>
        }
      />
      <Route path="/mess" element={<MessPage />} />
      <Route
        path="/lost-found"
        element={
          <RequireAuth>
            <LostFoundPage />
          </RequireAuth>
        }
      />
      <Route path="/announcements" element={<AnnouncementsPage />} />
      <Route path="/announcements/:id" element={<AnnouncementDetailPage />} />
      <Route path="/transit" element={<TransitPage />} />
      <Route
        path="/fees"
        element={
          <RequireAuth>
            <FeesPage />
          </RequireAuth>
        }
      />
      <Route
        path="/users"
        element={
          <RequireAuth>
            <UserManagementPage />
          </RequireAuth>
        }
      />
      <Route
        path="/college"
        element={
          <RequireAuth>
            <CollegePage />
          </RequireAuth>
        }
      />
      {/* Manager routes */}
      <Route
        path="/manager-login"
        element={
          <OnlyGuests>
            <ManagerLogin />
          </OnlyGuests>
        }
      />
      <Route
        path="/manager/dashboard"
        element={
          <RequireAuth>
            <ManagerDashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/manager/colleges"
        element={
          <RequireAuth>
            <ManagerColleges />
          </RequireAuth>
        }
      />
      <Route
        path="/manager/pending"
        element={
          <RequireAuth>
            <ManagerPending />
          </RequireAuth>
        }
      />
    </Routes>
  );
}
