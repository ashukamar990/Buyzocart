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

    page.goto("http://localhost:8008/index.html")
    page.wait_for_timeout(2000)

    # Place an order
    page.evaluate("""() => {
        const mockOrder = {
            orderId: 'DEBUG-ORDER-123',
            name: 'Debug Product',
            image: 'https://via.placeholder.com/150',
            price: 500,
            date: '01/01/2026',
            address: '123 Debug Lane, Debug City',
            productId: 'debug-p1',
            quantity: 1,
            size: 'M',
            status: 'Confirmed'
        };
        localStorage.setItem('orders', JSON.stringify([mockOrder]));
        console.log('Manually injected order into localStorage');

        // Trigger UI
        if (window.showMyOrders) {
            window.showMyOrders();
            console.log('Called showMyOrders()');
        }

        if (window.showPage) {
            window.showPage('myOrdersPage');
            console.log('Called showPage(myOrdersPage)');
        }
    }""")

    page.wait_for_timeout(2000)

    # Check if orders are displayed
    count = page.locator(".order-card").count()
    print(f"Number of order cards: {count}")

    page.screenshot(path="/home/jules/verification/screenshots/manual_inject_test.png")

    if count == 0:
        print("FAILURE: No order cards found even after manual injection!")
    else:
        print("SUCCESS: Order cards found with manual injection!")

if __name__ == "__main__":
    server = subprocess.Popen(["python3", "-m", "http.server", "8008"])
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
