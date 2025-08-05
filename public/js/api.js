// API Testing Functionality

let currentMaxIndex = 10000000000; // Default fallback

// Fetch current database limits
async function fetchCurrentLimits() {
    try {
        const response = await fetch(window.location.origin + '/prime-generator/stats');
        const stats = await response.json();
        currentMaxIndex = stats.database.max_prime_index || 0;
        
        // Update the UI
        const limitDisplay = document.getElementById('current-limit');
        if (limitDisplay) {
            const statusEmoji = stats.database.status === 'completed' ? '✅' : 
                              stats.database.status === 'in_progress' ? '🔄' : '⏳';
            const progressText = stats.database.status === 'in_progress' ? 
                ` (${((stats.database.max_prime_index / stats.database.target_count) * 100).toFixed(1)}% complete)` : '';
            
            limitDisplay.textContent = `${statusEmoji} Current limit: ${currentMaxIndex.toLocaleString()}${progressText}`;
        }
        
        // Update input max attribute
        const primeIndexInput = document.getElementById('prime-index');
        if (primeIndexInput) {
            primeIndexInput.max = currentMaxIndex;
        }
        
    } catch (error) {
        console.warn('Could not fetch current limits:', error);
        const limitDisplay = document.getElementById('current-limit');
        if (limitDisplay) {
            limitDisplay.textContent = '⚠️ Could not load current limit';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const primeIndexInput = document.getElementById('prime-index');
    const testUrlDisplay = document.getElementById('test-url-display');
    
    // Always use the API endpoint regardless of current page
    const baseUrl = window.location.origin + '/prime-generator/api';
    
    // Fetch current limits on page load
    fetchCurrentLimits();
    
    // Auto-refresh limits every 30 seconds if database is building
    setInterval(async () => {
        try {
            const response = await fetch(window.location.origin + '/prime-generator/stats');
            const stats = await response.json();
            if (stats.database.status === 'in_progress') {
                fetchCurrentLimits();
            }
        } catch (error) {
            // Silently fail - not critical
        }
    }, 30000);
    
    // Update URL display when input changes
    primeIndexInput.addEventListener('input', updateTestUrl);
    
    function updateTestUrl() {
        const index = primeIndexInput.value || '10';
        const url = `${baseUrl}?pi=${index}`;
        testUrlDisplay.textContent = url;
    }
    
    // Initialize with default value
    updateTestUrl();
    
    // Add event listener for test button
    const testButton = document.getElementById('test-btn');
    if (testButton) {
        testButton.addEventListener('click', (e) => {
            console.log('Test button clicked!');
            e.preventDefault();
            testAPI();
        });
        console.log('Test button event listener added successfully');
        
        // Also make function globally accessible for debugging
        window.testAPI = testAPI;
        console.log('testAPI function made globally accessible');
    } else {
        console.error('Test button not found!');
    }
});

async function testAPI() {
    console.log('testAPI function called!');
    
    const primeIndexInput = document.getElementById('prime-index');
    const testBtn = document.getElementById('test-btn');
    const responseStatus = document.getElementById('response-status');
    const testResponse = document.getElementById('test-response');
    
    console.log('Elements found:', {
        primeIndexInput: !!primeIndexInput,
        testBtn: !!testBtn,
        responseStatus: !!responseStatus,
        testResponse: !!testResponse
    });
    
    const index = parseInt(primeIndexInput.value);
    console.log('Testing with index:', index);
    
    // Check if all required elements exist
    if (!primeIndexInput || !testBtn || !responseStatus || !testResponse) {
        console.error('Missing required DOM elements');
        alert('Error: Some page elements are missing. Please refresh the page.');
        return;
    }

    // Validate input with dynamic maximum
    if (isNaN(index) || index < 1) {
        responseStatus.className = 'status-badge error';
        responseStatus.textContent = 'Error';
        testResponse.textContent = 'Invalid index. Please enter a positive integer.';
        return;
    }
    
    if (index > currentMaxIndex) {
        responseStatus.className = 'status-badge error';
        responseStatus.textContent = 'Out of Range';
        testResponse.textContent = `Index ${index.toLocaleString()} exceeds current maximum of ${currentMaxIndex.toLocaleString()}. Database may still be building.`;
        return;
    }
    
    // Disable button and show loading state
    testBtn.disabled = true;
    testBtn.textContent = 'Testing...';
    responseStatus.className = 'status-badge loading';
    responseStatus.textContent = 'Loading';
    testResponse.textContent = 'Making API request...';
    
    try {
        // Always use the API endpoint
        const baseUrl = window.location.origin + '/prime-generator/api';
        
        const url = `${baseUrl}?pi=${index}`;
        
        // Debug: Log URL construction
        console.log('API Test - Final URL:', url);
        
        const startTime = Date.now();
        
        const response = await fetch(url);
        const responseTime = Date.now() - startTime;
        
        // Debug: Log response details
        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers.get('content-type'));
        
        const responseText = await response.text();
        console.log('Response body:', responseText);
        
        // Try to parse as JSON
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            throw new Error(`Invalid JSON response: ${parseError.message}\\nResponse: ${responseText.substring(0, 200)}...`);
        }
        
        if (response.ok) {
            // Success
            responseStatus.className = 'status-badge success';
            responseStatus.textContent = `Success (${responseTime}ms)`;
            
            // Format the response nicely
            const formattedResponse = JSON.stringify(data, null, 2);
            testResponse.textContent = formattedResponse;
        } else {
            // Error response
            responseStatus.className = 'status-badge error';
            responseStatus.textContent = `Error ${response.status}`;
            testResponse.textContent = JSON.stringify(data, null, 2);
        }
        
    } catch (error) {
        // Network or parsing error
        responseStatus.className = 'status-badge error';
        responseStatus.textContent = 'Network Error';
        testResponse.textContent = `Error: ${error.message}\\n\\nThis could be due to:
• Network connectivity issues
• Server temporarily unavailable
• CORS policy restrictions
• Invalid response format`;
    } finally {
        // Re-enable button
        testBtn.disabled = false;
        testBtn.textContent = 'Test API';
    }
}

// Add keyboard support for testing
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && document.activeElement.id === 'prime-index') {
        testAPI();
    }
});

// Add some example quick-test buttons
document.addEventListener('DOMContentLoaded', () => {
    const testArea = document.querySelector('.test-area');
    
    const quickTestDiv = document.createElement('div');
    quickTestDiv.style.marginTop = '15px';
    quickTestDiv.innerHTML = `
        <div style="margin-bottom: 10px; font-weight: 500; color: #2d3748;">Quick Tests:</div>
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <button data-prime-index="1" class="quick-test-btn">1st Prime</button>
            <button data-prime-index="1000" class="quick-test-btn">1,000th</button>
            <button data-prime-index="100000" class="quick-test-btn">100,000th</button>
            <button data-prime-index="1000000" class="quick-test-btn">1 Million</button>
            <button data-prime-index="100000000" class="quick-test-btn">100 Million</button>
            <button data-prime-index="1000000000" class="quick-test-btn">1 Billion</button>
        </div>
    `;
    
    testArea.appendChild(quickTestDiv);
    
    // Add event listeners to quick test buttons
    const quickTestButtons = quickTestDiv.querySelectorAll('.quick-test-btn');
    quickTestButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const index = parseInt(e.target.getAttribute('data-prime-index'));
            quickTest(index);
        });
    });
    
    // Add styles for quick test buttons
    const style = document.createElement('style');
    style.textContent = `
        .quick-test-btn {
            background: #e2e8f0;
            color: #2d3748;
            border: 1px solid #cbd5e0;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.8rem;
            transition: all 0.2s ease;
        }
        .quick-test-btn:hover {
            background: #cbd5e0;
            border-color: #a0aec0;
        }
    `;
    document.head.appendChild(style);
});

function quickTest(index) {
    const primeIndexInput = document.getElementById('prime-index');
    primeIndexInput.value = index;
    
    // Update URL display
    const event = new Event('input');
    primeIndexInput.dispatchEvent(event);
    
    // Run the test
    testAPI();
}