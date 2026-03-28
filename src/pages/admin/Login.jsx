import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

// no login needed for admin, redirect immediately
export default function AdminLogin() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate("/admin", { replace: true });
  }, [navigate]);
  return null;
}
