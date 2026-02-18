import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./styles.css";
import ModifyRecord from "./pages/ModifyRecord.jsx";
import RecordsAdmin from "./pages/RecordsAdmin.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/modifyRecord" element={<ModifyRecord />} />
        <Route path="/recordsAdmin" element={<RecordsAdmin />} />
        <Route path="*" element={<Navigate to="/modifyRecord" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
