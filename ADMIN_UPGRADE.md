# TREND ZEE commerce upgrade

This project now includes a significantly expanded customer storefront and commerce-operations admin. The goal of this pass was to make the current architecture useful for day-to-day ecommerce operations without pretending that external payment, refund, shipping, tax, messaging, or identity services are already connected.

## Customer shopping experience

- Open product browsing without forcing a phone number before viewing a product.
- Responsive storefront with collection discovery, search, category filters, price filters, stock filter and sorting.
- Product detail experience with gallery, size/colour options, stock messaging, ratings/reviews, sharing and saved items.
- Wishlist/saved items and recently viewed products.
- Stock-aware shopping bag with quantity controls and coupon support.
- Two-stage checkout with saved delivery details, checkout consent and a clear unpaid-request state while payments are not connected.
- Account area with profile, order history, order timeline, shipment details, support tickets and return cases.
- Customer cancellation for eligible unpaid requests.
- Return requests for eligible delivered paid orders, controlled by the configured return window.
- Verified-purchase product review workflow with admin moderation.
- Customer feedback and support ticket creation.
- Store announcement, support details, shipping note, tax note and maintenance state controlled by admin settings.
- Loading, error, empty and mobile states throughout the core shopping journey.

## Admin capabilities

- Executive dashboard with requested order value/GMV separated from verified paid revenue.
- Date-range analytics for 7, 30 and 90 days plus all-time summary mode.
- Requested-vs-paid trend visualization: daily for 7/30/90-day ranges and monthly for all-time reporting.
- Fulfilment-status, payment-method, city-demand and category-performance visualizations.
- Orders workspace with range-aware search, payment/fulfilment filters, order details, courier/tracking fields, guarded state changes and printable packing slips/operational order records.
- Customers workspace with profiles, order history, requested value, paid value and repeat-customer identification.
- Products workspace with catalogue editing, image upload support, stock, variants/options, range-aware performance metrics, custom categories/types and recoverable product archiving.
- Inventory workspace with low-stock/out-of-stock alerts, inventory value, manual adjustments, required adjustment reasons and movement history.
- Checkout-recovery workspace with consent-aware leads, potential value and follow-up notes/status.
- Returns workspace with return lifecycle, expected refund amount and internal notes.
- Support workspace with ticket categories, statuses and internal notes.
- Feedback and product-review moderation workflows.
- Promotion/coupon creation, enable/disable controls and usage/discount/order-value reporting.
- Store operations settings for announcement, store state, support, return window, stock threshold, shipping and tax notes.
- Audit trail for admin mutations.
- Security baseline UI plus a role blueprint for Owner, Operations, Merchandising, Support and Analyst roles.

## Reporting and exports

The admin can export:

- A real multi-sheet `.xlsx` Excel workbook generated in-browser without an extra spreadsheet dependency.
- CSV exports for orders, customers, products/inventory and checkout recovery.
- A complete JSON operational backup.
- Print-friendly dashboard reporting.

The Excel workbook includes:

1. Executive Summary
2. Value Trend
3. Category Performance
4. City Performance
5. Payment Methods
6. Fulfilment Status
7. Customer Segments
8. Orders
9. Customers
10. Products
11. Archived Products
12. Inventory Movements
13. Checkout Recovery
14. Returns
15. Support
16. Feedback
17. Product Reviews
18. Promotions
19. Audit Log

CSV export values are protected against spreadsheet-formula injection.

## Data integrity rules

The existing checkout does not verify payment-provider transactions. Therefore:

- `Not paid` order requests are **not** counted as revenue.
- Unpaid requests cannot be dispatched by admin.
- Stock is not falsely decremented as if an unpaid request were a completed sale.
- Refunds are tracked operationally only; the UI never claims that money was refunded.
- Expected refund amounts are capped to the original order total.
- Delivery timestamps are preserved when an order is marked delivered so the return window has a stable reference date.
- Maintenance mode blocks checkout server-side as well as communicating maintenance status in the storefront.

## External integrations required for a fully paid production launch

The admin surfaces are ready for these connections, but they require real provider credentials/APIs and should not be faked:

- Payment provider and verified payment webhooks.
- Refund API / payment ledger.
- Shipping rates, serviceability, courier booking and live tracking provider.
- Tax calculation/invoicing rules appropriate for the business.
- Email/SMS/WhatsApp transactional notification provider.
- OTP/customer identity verification for cross-device customer accounts.
- Staff identity provider and role claims for enforced multi-user RBAC.

Until those are connected, the project deliberately labels the relevant states as preview/integration pending.

## Bugs and hardening completed in this pass

- Fixed 90-day analytics so it actually renders 90 days rather than 30.
- Prevented return/refund values from exceeding the original order value.
- Added persistent processing/dispatched/delivered/cancelled timestamps to order lifecycle changes.
- Added a server-side maintenance-mode checkout guard.
- Added stricter workflow-status validation for support, returns and review moderation.
- Added required return reasons.
- Prevented creation of already-expired coupons.
- Added CSV spreadsheet-formula injection protection.

- Fixed a duplicate storefront price-sort branch.
- Made shopper category navigation derive from the live catalogue instead of a hard-coded list.
- Added archived-product restore so catalogue removals are reversible.
- Made order CSV/Excel exports and product/promotion demand metrics respect the selected reporting range.
- Changed all-time value trend reporting to monthly aggregation so it covers the full recorded history.
- Customer-initiated order cancellation now records a stable cancellation timestamp.
- Verified all 25 UI API actions have matching server handlers.

## Validation performed

- `app/page.tsx`: TypeScript/TSX transpile diagnostics: 0 errors.
- `app/admin/page.tsx`: TypeScript/TSX transpile diagnostics: 0 errors.
- `app/api/store/route.ts`: TypeScript transpile diagnostics: 0 errors.
- Storefront/admin page type-check performed with local dependency stubs: passed.
- CSS brace/parenthesis balance: passed.
- UI/server action parity: 25 called actions / 25 matching handlers.
- Custom XLSX ZIP container integrity was tested successfully with `unzip -t` during development.

A full framework production build could not be completed inside this offline workspace because the npm cache does not contain every dependency tarball. In a network-enabled environment run:

```bash
npm run install:ci
npm run build
```

## Secrets

Do not commit `.env.local` or `.dev.vars`. The packaged handoff intentionally excludes those files. Use `.env.example` and configure the real values in the deployment environment.