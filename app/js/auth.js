import { showNotification } from './ui.js';
import { loadChatHistory } from './chat.js';

let isLoginMode = true;

export function openAuthModal() { 
    document.getElementById("authModal").classList.remove("hidden"); 
}

export function closeAuthModal() { 
    document.getElementById("authModal").classList.add("hidden"); 
    document.getElementById("authForm").reset(); 
    
    // if (!isLoginMode) toggleAuthMode(); 
}

export function toggleAuthMode() {
  console.log('Toggling auth mode');
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
    nameGroup.classList.add("hidden"); 
    nameInput.removeAttribute("required");
  } else {
    title.innerText = "Sign Up";
    submitBtn.innerText = "Create Account";
    toggleBtn.innerText = "Already have an account? Sign In";
    nameGroup.classList.remove("hidden"); 
    nameInput.setAttribute("required", "true");
  }
}

export async function submitAuthForm(e) {
   const submitBtn = document.getElementById("authSubmitBtn");
   if (submitBtn.disabled) return;
  e.preventDefault();
 
  
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerText = "Processing...";
  }

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
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = "Create Account";
      }
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

    // Save the currency
    if (data.user && data.user.currency) {
      localStorage.setItem("userCurrency", data.user.currency.code);
    } else {
      localStorage.setItem("userCurrency", "USD");
    }

    // Correctly show notification based on mode
    showNotification(
      isLoginMode ? "Login successful!" : "Registration successful!",
      "success"
    );
    console.log("I'm submitting the auth form and it worked!");
    closeAuthModal();
    updateNavUI();
    loadChatHistory();
    
  } catch (error) {
    console.error("Auth Error:", error);
    showNotification(error.message, "error");
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerText = isLoginMode ? "Sign In" : "Create Account";
    }
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