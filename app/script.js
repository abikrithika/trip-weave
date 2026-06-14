document.addEventListener("DOMContentLoaded", () => {
   
    const sendBtn = document.getElementById("sendBtn");
    const userInput = document.getElementById("userInput");
    const chatHistory = document.querySelector(".chat-history"); 

   
    const handleSendMessage = () => {
        const text = userInput.value.trim();
        if (!text) return; 
        appendMessage(text, "user");

        
        userInput.value = "";

        
        setTimeout(() => {
            appendMessage("I am checking the Duffel system for those flights right now...", "ai");
        }, 1000);
    };

    
    const appendMessage = (text, sender) => {
      
        const messageBubble = document.createElement("div");
        
    
        messageBubble.classList.add("message");
        
       
        if (sender === "user") {
            messageBubble.classList.add("user-message");
        } else {
            messageBubble.classList.add("ai-message");
        }

        
        messageBubble.textContent = text;

      
        chatHistory.appendChild(messageBubble);

      
        chatHistory.scrollTop = chatHistory.scrollHeight;
    };

  
    sendBtn.addEventListener("click", handleSendMessage);

    
    userInput.addEventListener("keypress", (event) => {
        if (event.key === "Enter") {
            handleSendMessage();
        }
    });
});