import { showNotification } from './ui.js';
import { loadChatHistory } from './chat.js';

let isLoginMode = true;

export function openAuthModal() { document.getElementById("authModal").style.display = "block"; }
export function closeAuthModal() { 
    document.getElementById("authModal").style.display = "none"; 
    document.getElementById("authForm").reset(); 
}

export function toggleAuthMode() {
  isLoginMode = !isLoginMode;
  const title = document.getElementById("authTitle");
  const submitBtn = document.getElementById("authSubmitBtn");
  const toggleBtn = document.getElementById("toggleAuthModeBtn");
  const nameGroup = document.getElementById("nameInputGroup");
  const nameInput = document.getElementById("nameInput");

  if (isLoginMode) {
    title.innerText = "Sign In";
    submitBtn.innerText = "Sign In";
    toggleBtn.innerText = "Need an account? Sign Up";
    nameGroup.style.display = "none";
    nameInput.removeAttribute("required");
  } else {
    title.innerText = "Sign Up";
    submitBtn.innerText = "Create Account";
    toggleBtn.innerText = "Already have an account? Sign In";
    nameGroup.style.display = "block";
    nameInput.setAttribute("required", "true");
  }
}

export async function submitAuthForm(e) {
  e.preventDefault();

  const email = document.getElementById("emailInput").value.trim();
  const password = document.getElementById("passwordInput").value;
  const name = document.getElementById("nameInput")
    ? document.getElementById("nameInput").value.trim()
    : "";

  if (!isLoginMode) {
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(password)) {
      showNotification(
        "Password must be at least 8 characters long, contain at least one letter and one number.",
        "error",
      );
      return;
    }
  }

  const endpoint = isLoginMode ? "/api/auth/login" : "/api/auth/signup";
  const payload = { email, password };
  if (!isLoginMode) payload.name = name;

  try {
    const response = await fetch(`http://localhost:5050${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) throw new Error(data.message || "Authentication failed");

    // Success! Save token and force a clean conversation slate
    localStorage.setItem("userToken", data.token);
    localStorage.removeItem("conversationId");

    // TASK 3: Save the currency
    if (data.user && data.user.currency) {
      localStorage.setItem("userCurrency", data.user.currency.code);
    } else {
      localStorage.setItem("userCurrency", "USD");
    }

    showNotification(
      isLoginMode ? "Login successful!" : "Registration successful!",
      "success",
    );
    closeAuthModal();
    updateNavUI();
    
    // NEW: Fetch their private history immediately after modal closes!
    loadChatHistory();
  } catch (error) {
    console.error("Auth Error:", error);
    showNotification(error.message, "error");
  }
}

export function updateNavUI() {
  const authNavBtn = document.getElementById("authNavBtn");
  const token = localStorage.getItem("userToken");
  if (token) {
    authNavBtn.innerText = "Log Out";
    authNavBtn.onclick = () => {
      localStorage.clear();
      window.location.reload();
    };
  } else {
    authNavBtn.innerText = "Sign In";
    authNavBtn.onclick = openAuthModal;
  }
}

window.openAuthModal = openAuthModal;
window.closeAuthModal = closeAuthModal;
window.toggleAuthMode = toggleAuthMode;
window.submitAuthForm = submitAuthForm;