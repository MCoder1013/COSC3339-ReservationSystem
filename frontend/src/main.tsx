import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./AuthContext";
import App from "./App";
import SignIn from "./SignIn";
import Register from "./Register";
import Inventory from "./Inventory";
import ReservationTable from "./ReservationViewTable";
import UserReservationTable from "./UserReservationViewTable";
import Reservation from "./Reservation";
import ViewUsers from "./ViewAllUsers"
import Analytics from "./Analytics";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/register" element={<Register />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/reservations" element={<ReservationTable />} />
          <Route path="/user-reservations" element={<UserReservationTable />} />
          <Route path="/reservation" element={<Reservation />} />
          <Route path="/view-users" element={<ViewUsers />} />
          <Route path="/analytics" element={<Analytics />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);