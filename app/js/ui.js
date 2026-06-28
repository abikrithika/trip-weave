import { openAuthModal, closeAuthModal, toggleAuthMode } from "./auth.js";
export function showNotification(message, type = "success") {
  const container = document.getElementById("toastContainer");
  container.innerHTML = "";
  const toast = document.createElement("div");
  const bgColor = type === "success" ? "bg-green-600" : "bg-red-600";
  const icon = type === "success" ? "✅" : "⚠️";

  toast.className = `transform transition-all duration-300 translate-y-[-20px] opacity-0 text-white px-6 py-3 rounded-xl shadow-xl flex items-center gap-3 pointer-events-auto ${bgColor}`;
  toast.innerHTML = `
        <span class="text-lg">${icon}</span>
        <span class="font-medium text-sm flex-1">${message}</span>
        <button onclick="this.parentElement.remove()" class="ml-4 font-bold text-white/80 hover:text-white transition">×</button>
    `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.remove("translate-y-[-20px]", "opacity-0");
    toast.classList.add("translate-y-0", "opacity-100");
  }, 10);

  setTimeout(() => {
    toast.classList.remove("translate-y-0", "opacity-100");
    toast.classList.add("translate-y-[-20px]", "opacity-0");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

export function toggleDrawer() {
  const drawer = document.getElementById("savedFlightsDrawer");
  if (drawer) drawer.classList.toggle("open");
}

window.toggleDrawer = toggleDrawer;
window.openAuthModal = openAuthModal;
window.closeAuthModal = closeAuthModal;
window.toggleAuthMode = toggleAuthMode;
