const { chromium, devices } = require('playwright');
const assert = require('assert');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext(devices['iPhone 12 Pro']);
  const page = await context.newPage();

  // Bypass anti-automation
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    window.self = window.top;
  });

  console.log('--- Testing Order Placement and Persistence ---');
  await page.goto('http://localhost:8000/index.html');

  // Mock products if not loaded, but assume they are for now.
  // We need to place an order.

  // 1. Login
  await page.evaluate(() => {
    localStorage.setItem('firebase:authUser:buyzocart', JSON.stringify({
      uid: 'test-user',
      email: 'test@example.com',
      displayName: 'Test User'
    }));
    location.reload();
  });
  await page.waitForTimeout(1000);

  // 2. Select a product and order
  // Use a product from the featured list
  const productCard = page.locator('.product-card').first();
  await productCard.click();
  await page.waitForSelector('#productDetailPage.active');

  // Order Now
  await page.click('#detailOrderBtn');
  await page.waitForSelector('#orderPage.active');

  // Select Size
  await page.click('.size-option:has-text("M")');
  await page.click('#toUserInfo');
  await page.waitForSelector('#userPage.active');

  // Fill User Info
  await page.fill('#fullname', 'Test User');
  await page.fill('#mobile', '1234567890');
  await page.fill('#pincode', '123456');
  await page.fill('#city', 'Test City');
  await page.fill('#state', 'Test State');
  await page.fill('#house', '123 Test Street');
  await page.click('#toPayment');
  await page.waitForSelector('#paymentPage.active');

  // Confirm Order
  await page.click('#confirmOrder');
  await page.waitForSelector('#successPage.active');

  const orderId = await page.innerText('#orderIdDisplay');
  console.log('Placed Order ID:', orderId);

  // 3. Check "My Orders" in index.html (Real-time)
  await page.click('#viewOrders');
  await page.waitForSelector('#myOrdersPage.active');

  const orderCardInIndex = page.locator('.order-card').first();
  const orderIdInIndex = await orderCardInIndex.locator('.order-id').innerText();
  console.log('Order ID in Index My Orders:', orderIdInIndex);
  assert.strictEqual(orderIdInIndex, orderId, 'Order ID mismatch in Index');

  // Verify Cancel button is present for Confirmed order
  const cancelBtn = orderCardInIndex.locator('.cancel');
  const cancelVisible = await cancelBtn.isVisible();
  console.log('Cancel button visible for Confirmed order:', cancelVisible);
  assert.ok(cancelVisible, 'Cancel button should be visible');

  // 4. Check "My Orders" in account.html (Persistence)
  await page.goto('http://localhost:8000/account.html');
  await page.click('.menu-item:has-text("My Orders")');
  await page.waitForSelector('#ordersPage.active');

  const orderCardInAccount = page.locator('.order-card').first();
  const orderIdInAccount = await orderCardInAccount.locator('.order-id').innerText();
  console.log('Order ID in Account My Orders:', orderIdInAccount);
  assert.strictEqual(orderIdInAccount, orderId, 'Order ID mismatch in Account');

  // Take screenshot
  await page.screenshot({ path: 'final_verification_account_orders.png' });

  // 5. Test status change (manual update in localStorage for test)
  console.log('--- Testing Status Logic Gating ---');
  await page.evaluate((id) => {
    const orders = JSON.parse(localStorage.getItem('orders'));
    const order = orders.find(o => o.orderId === id);
    if (order) order.status = 'Delivered';
    localStorage.setItem('orders', JSON.stringify(orders));
  }, orderId);

  await page.reload();
  await page.click('.menu-item:has-text("My Orders")');

  const orderCardDelivered = page.locator('.order-card').first();
  const returnBtn = orderCardDelivered.locator('.return');
  const returnVisible = await returnBtn.isVisible();
  const cancelBtnDelivered = orderCardDelivered.locator('.cancel');
  const cancelVisibleDelivered = await cancelBtnDelivered.isVisible();

  console.log('Return button visible for Delivered order:', returnVisible);
  console.log('Cancel button visible for Delivered order:', cancelVisibleDelivered);

  assert.ok(returnVisible, 'Return button should be visible for Delivered');
  assert.ok(!cancelVisibleDelivered, 'Cancel button should NOT be visible for Delivered');

  // 6. Test empty state
  console.log('--- Testing Empty State ---');
  await page.evaluate(() => {
    localStorage.setItem('orders', JSON.stringify([]));
  });
  await page.reload();
  await page.click('.menu-item:has-text("My Orders")');

  const emptyState = page.locator('.empty-state');
  const emptyVisible = await emptyState.isVisible();
  console.log('Empty state visible:', emptyVisible);
  assert.ok(emptyVisible, 'Empty state should be visible when no orders exist');

  await page.screenshot({ path: 'final_verification_empty_state.png' });

  await browser.close();
  console.log('--- All Tests Passed ---');
})();
