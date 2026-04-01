import os
import subprocess
import time
from playwright.sync_api import sync_playwright

def run_test(page):
    page.add_init_script("""
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        window.self = window.top;
    """)

    page.on("pageerror", lambda exc: print(f"uncaught exception: {exc}"))
    page.on("console", lambda msg: print(f"console {msg.type}: {msg.text}"))

    page.goto("http://localhost:8006/index.html")
    page.wait_for_timeout(2000)

    # Place an order
    page.evaluate("""() => {
        // Mock Login
        window.currentUser = { uid: 'test-user', email: 'test@example.com', displayName: 'Test User' };
        if (window.updateUIForUser) window.updateUIForUser(window.currentUser);

        // Setup a product
        const p = { id: 'p1', name: 'Test Product', price: 100, images: ['https://via.placeholder.com/150'] };
        window.currentProduct = p;

        // Mock user info
        window.userInfo = { fullName: 'Test User', mobile: '1234567890', house: '123', city: 'City', state: 'State', pincode: '123456' };

        // Ensure size options exists for confirmOrder
        document.getElementById('sizeOptions').innerHTML = '<div class="size-option selected" data-value="M">M</div>';

        // Ensure quantity element exists
        document.getElementById('qtySelect').value = 1;

        // Mock pay radio button
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'pay';
        radio.value = 'prepaid';
        radio.checked = true;
        document.body.appendChild(radio);
    }""")

    print("Mocked state. Now placing order...")
    # Confirm order via evaluate
    page.evaluate("confirmOrder()")
    page.wait_for_timeout(2000)

    print("Checking localStorage...")
    orders = page.evaluate("localStorage.getItem('orders')")
    print(f"Orders in localStorage: {orders}")

    print("Navigating to My Orders...")
    page.evaluate("showPage('myOrdersPage')")
    page.wait_for_timeout(2000)

    # Check if orders are displayed
    count = page.locator(".order-card").count()
    print(f"Number of order cards: {count}")

    page.screenshot(path="/home/jules/verification/screenshots/debug_test_v4.png")

    if count == 0:
        print("FAILURE: No order cards found!")
    else:
        print("SUCCESS: Order cards found!")

if __name__ == "__main__":
    server = subprocess.Popen(["python3", "-m", "http.server", "8006"])
    time.sleep(2)
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context()
            page = context.new_page()
            try:
                run_test(page)
            finally:
                context.close()
                browser.close()
    finally:
        server.terminate()
