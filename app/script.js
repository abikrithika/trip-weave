// ==========================================
// CUSTOM NOTIFICATIONS (TOASTS)
// ==========================================
function showNotification(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    
    // Choose colors based on success or error
    const bgColor = type === 'success' ? 'bg-green-600' : 'bg-red-600';
    const icon = type === 'success' ? '✅' : '⚠️';

    // Tailwind classes for styling and animation
    toast.className = `transform transition-all duration-300 translate-y-[-20px] opacity-0 text-white px-6 py-3 rounded-xl shadow-xl flex items-center gap-3 pointer-events-auto ${bgColor}`;
    
    toast.innerHTML = `
        <span class="text-lg">${icon}</span>
        <span class="font-medium text-sm flex-1">${message}</span>
        <button onclick="this.parentElement.remove()" class="ml-4 font-bold text-white/80 hover:text-white transition">&times;</button>
    `;

    container.appendChild(toast);

    // Animate IN
    setTimeout(() => {
        toast.classList.remove('translate-y-[-20px]', 'opacity-0');
        toast.classList.add('translate-y-0', 'opacity-100');
    }, 10);

    // Auto-remove after 3 seconds
    setTimeout(() => {
        toast.classList.remove('translate-y-0', 'opacity-100');
        toast.classList.add('translate-y-[-20px]', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ==========================================
// AUTHENTICATION & MODAL LOGIC
// ==========================================

let isLoginMode = true;

// 1. Modal Toggle Functions
function openAuthModal() {
    document.getElementById('authModal').style.display = 'block';
}

function closeAuthModal() {
    document.getElementById('authModal').style.display = 'none';
    document.getElementById('authForm').reset();
}

function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    const title = document.getElementById('authTitle');
    const submitBtn = document.getElementById('authSubmitBtn');
    const toggleBtn = document.getElementById('toggleAuthModeBtn');
    
    // Make sure you have a div wrapping your name input with id="nameInputGroup" in your HTML!
    const nameGroup = document.getElementById('nameInputGroup'); 
    const nameInput = document.getElementById('nameInput');

    if (isLoginMode) {
        title.innerText = 'Sign In';
        submitBtn.innerText = 'Sign In';
        toggleBtn.innerText = 'Need an account? Sign Up';
        nameGroup.style.display = 'none';
        nameInput.removeAttribute('required');
    } else {
        title.innerText = 'Sign Up';
        submitBtn.innerText = 'Create Account';
        toggleBtn.innerText = 'Already have an account? Sign In';
        nameGroup.style.display = 'block';
        nameInput.setAttribute('required', 'true');
    }
}

// 2. Main Form Submission & Validation (Task 2)
async function submitAuthForm(e) {
    e.preventDefault(); // Prevents the page from refreshing

    const email = document.getElementById('emailInput').value.trim();
    const password = document.getElementById('passwordInput').value;
    const name = document.getElementById('nameInput') ? document.getElementById('nameInput').value.trim() : "";

    // TASK 2: Password Security Rules (Only enforced during Sign Up)
    if (!isLoginMode) {
        // Regex: At least 8 characters, 1 letter, and 1 number
        const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
        
        if (!passwordRegex.test(password)) {
            showNotification("Password must be at least 8 characters long, contain at least one letter and one number. Special characters are allowed!", "error");
            return; // Stops the function from sending data to the backend
        }
    }

    const endpoint = isLoginMode ? '/api/auth/login' : '/api/auth/signup';
    
    // Build the payload (include the name only if we are signing up)
    const payload = { email, password };
    if (!isLoginMode) {
        payload.name = name; 
    }

    try {
        const response = await fetch(`http://localhost:5050${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Authentication failed');
        }

        // Success! Save token
        localStorage.setItem('userToken', data.token);
        
        // Task 3 Prep: Save the currency if the backend sends it
        if (data.user && data.user.currency) {
            localStorage.setItem('userCurrency', data.user.currency.code);
        }

        // Replaced the alert with a success notification
        showNotification(isLoginMode ? 'Login successful!' : 'Registration successful!', 'success');
        
        closeAuthModal();
        updateNavUI(); // Updates the top navigation button

    } catch (error) {
        console.error('Auth Error:', error);
        showNotification(error.message, "error");
    }
}

// 3. UI Navigation Update (Changes Sign In -> Log Out)
function updateNavUI() {
    const authNavBtn = document.getElementById('authNavBtn');
    const token = localStorage.getItem('userToken');
    
    if (token) {
        authNavBtn.innerText = 'Log Out';
        authNavBtn.onclick = () => {
            localStorage.removeItem('userToken');
            localStorage.removeItem('userCurrency');
            updateNavUI();
            
            // Fixed the logout message here
            showNotification('You have been logged out.', 'success');
        };
    } else {
        authNavBtn.innerText = 'Sign In';
        authNavBtn.onclick = openAuthModal;
    }
}

// Initialize the Nav button when the script loads
updateNavUI();