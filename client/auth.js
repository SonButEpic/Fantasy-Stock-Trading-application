(function() {
    const USER_KEY = 'fantastock_currentUser';
    const API_BASE = '/api/auth';

    // --- State Management ---
    function getCurrentUser() {
        return localStorage.getItem(USER_KEY);
    }

    function setCurrentUser(username) {
        localStorage.setItem(USER_KEY, username);
    }

    function clearCurrentUser() {
        localStorage.removeItem(USER_KEY);
    }

    // --- UI Helpers ---
    function createMessageElement() {
        let message = document.getElementById('authMessage');
        if (!message) {
            const form = document.querySelector('.authenticationForm');
            if (!form) return null;

            message = document.createElement('div');
            message.id = 'authMessage';
            message.style.marginBottom = '16px';
            message.style.fontWeight = '600';
            message.style.textAlign = 'center';
            form.parentNode.insertBefore(message, form);
        }
        return message;
    }

    function showAuthMessage(text, isError) {
        const message = createMessageElement();
        if (!message) return;

        message.textContent = text;
        message.style.color = isError ? '#dc2626' : '#16a34a';
        message.style.display = text ? 'block' : 'none';
    }

    // --- Header & Navigation ---
    function renderAuthButtons() {
        const container = document.querySelector('.AuthenticatorButton');
        if (!container) return;

        const currentUser = getCurrentUser();
        container.innerHTML = '';

        if (currentUser) {
            // --- LOGGED IN VIEW ---
            const greeting = document.createElement('span');
            greeting.textContent = `Hello, ${currentUser}`;
            greeting.style.alignSelf = 'center';
            greeting.style.fontWeight = '600';
            greeting.style.color = '#4b5563';

            const logoutButton = document.createElement('button');
            logoutButton.className = 'loginButton'; 
            logoutButton.textContent = 'Logout';
            logoutButton.addEventListener('click', handleLogout);

            container.appendChild(greeting);
            container.appendChild(logoutButton);
        } else {
            // --- LOGGED OUT VIEW ---
            const signupBtn = document.createElement('button');
            signupBtn.className = 'buttonSignup';
            signupBtn.textContent = 'Create Account';
            signupBtn.onclick = () => window.location.href = 'createAccount.html';

            const loginBtn = document.createElement('button');
            loginBtn.className = 'loginButton';
            loginBtn.textContent = 'Log in';
            loginBtn.onclick = () => window.location.href = 'login.html';

            container.appendChild(signupBtn);
            container.appendChild(loginBtn);
        }
    }

    function handleLogout() {
        clearCurrentUser();
        window.location.href = 'landingPage.html';
    }

    // --- Form Handlers ---
    async function handleAuthSubmit(event, type) {
        event.preventDefault();
        
        // Manually grabbing values by ID to match your HTML
        const username = document.getElementById('username')?.value.trim();
        const password = document.getElementById('password')?.value;
        const email = document.getElementById('email')?.value.trim();

        // Validation logic
        if (!username || !password || (type === 'register' && !email)) {
            showAuthMessage('Please fill in all required fields.', true);
            return;
        }

        const submitBtn = event.target.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;
        showAuthMessage('', false);

        const payload = { username, password };
        if (type === 'register') payload.email = email;

        try {
            const response = await fetch(`${API_BASE}/${type}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || `Failed to ${type}`);
            }

            setCurrentUser(result.username);
            window.location.href = 'portfolioPage.html';
        } catch (error) {
            showAuthMessage(error.message || 'Connection error. Please try again.', true);
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
    }

    // --- Initialization ---
    function init() {
        const path = window.location.pathname.split('/').pop();
        const currentUser = getCurrentUser();

        renderAuthButtons();

        // Hero section check
        const heroContainer = document.querySelector('.mainAreaSupreme');
        if (currentUser && heroContainer) {
            heroContainer.innerHTML = `<button class="mainButton" onclick="window.location.href='portfolioPage.html'">Go to Portfolio</button>`;
        }

        // Logic for Login and Create Account pages
        if (path === 'login.html' || path === 'createAccount.html') {
            if (currentUser) {
                window.location.href = 'portfolioPage.html';
                return;
            }

            const form = document.querySelector('form.authenticationForm');
            if (form) {
                const type = path === 'login.html' ? 'login' : 'register';
                form.addEventListener('submit', (e) => handleAuthSubmit(e, type));
            }
        }
    }

    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();