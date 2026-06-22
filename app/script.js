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
        const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
        
        if (!passwordRegex.test(password)) {
            alert("Password must be at least 8 characters long and include both letters and numbers.");
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

        alert(isLoginMode ? 'Login successful!' : 'Registration successful!');
        closeAuthModal();
        updateNavUI(); // Updates the top navigation button

    } catch (error) {
        console.error('Auth Error:', error);
        alert(error.message);
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
            alert('You have been logged out.');
        };
    } else {
        authNavBtn.innerText = 'Sign In';
        authNavBtn.onclick = openAuthModal;
    }
}

// Initialize the Nav button when the script loads
updateNavUI();