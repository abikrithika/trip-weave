import { showNotification } from './ui.js';

export async function loadChatHistory() {
  const token = localStorage.getItem("userToken");

  // If it is a guest user, just render the greeting and stop!
  if (!token) {
    const chatHistory = document.querySelector(".chat-history");
    if (chatHistory) chatHistory.innerHTML = ""; 
    appendChatMessage("Hi! Where would you like to fly today?", "ai", false);
    return; 
  }

  try {
    // 1. Ask the backend for THIS user's specific conversation ID
    const convRes = await fetch(`http://localhost:5050/api/conversations/current`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!convRes.ok) return;
    
    const convData = await convRes.json();
    const conversationId = convData.id;
    
    // Save their real ID to localStorage so saveMessageToDB() uses it!
    localStorage.setItem("conversationId", conversationId); 

    // 2. Now fetch the messages using their REAL ID
    const response = await fetch(`http://localhost:5050/api/conversations/${conversationId}/messages`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    
    if (!response.ok) return;

    const messages = await response.json();
    const chatHistory = document.querySelector(".chat-history");
    if (chatHistory) chatHistory.innerHTML = ""; 

    appendChatMessage("Hi! Where would you like to fly today?", "ai", false);

    // 3. Render their private history
    messages.forEach(msg => {
      const uiRole = msg.senderRole === "user" ? "user" : "ai";
      appendChatMessage(msg.textContent, uiRole, false); 
    });
  } catch (error) {
    console.error("Failed to load chat history:", error);
  }
}

export async function saveMessageToDB(dbRole, text) {
  const token = localStorage.getItem("userToken");
  const conversationId = localStorage.getItem("conversationId"); 

  if (!token || !conversationId) return; // Skip if guest or no chat ID

  try {
    await fetch(`http://localhost:5050/api/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ senderRole: dbRole, textContent: text })
    });
  } catch (error) {
    console.error("Failed to save message to DB:", error);
  }
}

export function appendChatMessage(text, role, saveToDb = false) {
  const chatHistory = document.querySelector(".chat-history");
  if (!chatHistory) return;
  
  const msgDiv = document.createElement("div");
  msgDiv.className =
    role === "user"
      ? "message user-message bg-blue-600 text-white max-w-[80%] p-3 rounded-2xl rounded-tr-none text-sm shadow-sm ml-auto mb-4"
      : "message ai-message bg-blue-50 text-blue-900 max-w-[80%] p-3 rounded-2xl rounded-tl-none text-sm shadow-sm mb-4";
  msgDiv.innerText = text;
  chatHistory.appendChild(msgDiv);
  chatHistory.scrollTop = chatHistory.scrollHeight;

  // NEW: Trigger database save if requested
  if (saveToDb) {
    const dbRole = role === "user" ? "user" : "assistant"; // Formats role for Prisma enum
    saveMessageToDB(dbRole, text);
  }
}