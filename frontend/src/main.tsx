import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import SignIn from "./SignIn";
import Register from "./Register";
import Inventory from "./Inventory";
import ReservationTable from "./ReservationViewTable";
import UserReservationTable from "./UserReservationViewTable";
import Reservation from "./Reservation";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/register" element={<Register />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/reservations" element={<ReservationTable />} />
        <Route path="/user-reservations" element={<UserReservationTable />} />
        <Route path="/reservation" element={<Reservation />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);

