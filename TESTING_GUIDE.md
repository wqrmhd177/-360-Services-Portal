# Testing Guide - Role-Based Access Control

## Quick Test Scenarios

### Test User Setup
Create test users with different roles:
- `growth@test.com` - Role: growth
- `approver@test.com` - Role: approver
- `finance@test.com` - Role: finance
- `procurement@test.com` - Role: procurement
- `admin@test.com` - Role: admin (with isAdmin: true)

---

## Scenario 1: Happy Path - Complete Workflow

### Steps:
1. **Login as Growth User** (`growth@test.com`)
   - Navigate to Quotation Requests
   - Create a new QR
   - Verify QR appears in "My Quotation Requests"
   - Check: Only your QRs visible

2. **Login as Procurement User** (`procurement@test.com`)
   - Navigate to Quotation Requests
   - Find the QR created by Growth
   - Click "Respond" and submit pricing
   - Verify QR status changes to "responded"
   - Check: All QRs from all users visible

3. **Login as Growth User** (again)
   - Navigate to Quotation Requests
   - Find your QR (now "responded")
   - Click "Convert to PR"
   - Verify PR is created
   - Navigate to Purchase Requests
   - Check: Only your PRs visible
   - Check: PR status shows "Pending"

4. **Login as Approver User** (`approver@test.com`)
   - Navigate to Quotation Requests
   - Check: All QRs visible (read-only, no action buttons)
   - Navigate to Purchase Requests
   - Find the PR created by Growth
   - Click "Approve" with remarks
   - Verify PR status changes to "Approved"
   - Check: All PRs visible

5. **Login as Finance User** (`finance@test.com`)
   - Navigate to dashboard
   - Check: NO Quotation Request link in navigation
   - Navigate to Purchase Requests
   - Check: Only "approved" PRs visible (not pending ones)
   - Find the approved PR
   - Click "Verify Payment"
   - Enter reference files and verify
   - Verify PR status changes to "Verified"

6. **Login as Procurement User** (again)
   - Navigate to Purchase Requests
   - Find the verified PR
   - Check: Row has green background with checkmark icon
   - Check: Both "Approver Status" and "Finance Status" show green badges
   - Click "Convert to PO"
   - Fill in supplier and delivery details
   - Submit PO creation
   - Navigate to Purchase Orders
   - Verify PO is created

7. **Login as Growth User** (again)
   - Navigate to Purchase Orders (new tab!)
   - Check: Can see the PO created from your PR
   - Check: Read-only view (no edit buttons)
   - Click "View Details" to see full PO information

8. **Login as Approver User** (again)
   - Navigate to Purchase Orders (new tab!)
   - Check: Can see all POs
   - Check: "Created By" column shows Growth user email
   - Check: Read-only view

---

## Scenario 2: Rejection Path - Approver Rejects

### Steps:
1. **Login as Growth User**
   - Create a new PR

2. **Login as Approver User**
   - Find the PR
   - Click "Reject"
   - Enter rejection reason
   - Submit

3. **Login as Finance User**
   - Navigate to Purchase Requests
   - Check: Rejected PR is NOT visible (Finance only sees approved)

4. **Login as Procurement User**
   - Navigate to Purchase Requests
   - Find the rejected PR
   - Check: Cannot convert to PO
   - Check: Status shows "Rejected"

---

## Scenario 3: Rejection Path - Finance Rejects

### Steps:
1. **Login as Growth User**
   - Create a new PR

2. **Login as Approver User**
   - Approve the PR

3. **Login as Finance User**
   - Find the approved PR
   - Click "Reject"
   - Submit rejection

4. **Login as Procurement User**
   - Navigate to Purchase Requests
   - Find the PR (Approver: Approved, Finance: Rejected)
   - Try to convert to PO
   - Check: Blocked with error message showing both statuses

---

## Scenario 4: Unauthorized Access Tests

### Test A: Finance tries to access QRs
1. **Login as Finance User**
   - Check: No "Quotation Requests" link in navigation
   - Try to manually navigate to `/dashboard/finance/quotation-requests`
   - Check: Should not exist or redirect

### Test B: Growth tries to convert another user's QR
1. **Login as Growth User #1**
   - Create a QR
   - Note the QR ID

2. **Login as Growth User #2**
   - Try to navigate to `/dashboard/growth/qr/{id}/convert` (use ID from User #1)
   - Check: "Access Denied" message appears
   - Check: Cannot convert

### Test C: Procurement tries to convert PR with single approval
1. **Login as Growth User**
   - Create a PR

2. **Login as Approver User**
   - Approve the PR (but Finance hasn't verified yet)

3. **Login as Procurement User**
   - Try to convert the PR to PO
   - Check: Blocked with error showing both statuses
   - Check: Clear message indicating both approvals needed

### Test D: Finance tries to view pending PR
1. **Login as Growth User**
   - Create a PR (leave it pending)

2. **Login as Finance User**
   - Navigate to Purchase Requests
   - Check: Pending PR is NOT visible in the list

---

## Scenario 5: Admin Override Tests

### Steps:
1. **Login as Admin User** (`admin@test.com`)
   - Check: All role sections visible in navigation
   - Navigate to each role's dashboard

2. **QR Tests**
   - Navigate to Growth → Quotation Requests
   - Check: Can see ALL QRs (not just admin's own)
   - Create a QR as another user
   - Try to convert ANY QR (not just admin's)
   - Check: Can convert successfully

3. **PR Tests**
   - Navigate to Finance → Purchase Requests
   - Check: Can see ALL PRs (including pending and rejected)
   - Navigate to Approver → Purchase Requests
   - Approve a PR as Approver
   - Navigate to Finance → Purchase Requests
   - Verify the same PR as Finance

4. **PO Tests**
   - Navigate to Growth → Purchase Orders
   - Check: Can see ALL POs (not just from admin's PRs)
   - Navigate to Procurement → Purchase Orders
   - Check: Can manage POs

---

## Scenario 6: Visual Indicators Test

### Steps:
1. **Setup: Create PRs with different statuses**
   - PR #1: Pending (not approved by anyone)
   - PR #2: Approved by Approver only
   - PR #3: Approved by Approver, Rejected by Finance
   - PR #4: Approved by Approver, Verified by Finance (ready!)

2. **Login as Procurement User**
   - Navigate to Purchase Requests
   - Check visual indicators:
     - PR #1: Yellow badges for both columns
     - PR #2: Green "Approver Status", Yellow "Finance Status"
     - PR #3: Green "Approver Status", Red "Finance Status"
     - PR #4: **Green background**, **Checkmark icon**, Green badges for both
   
3. **Filter Test**
   - Click "Verified – ready for PO" filter
   - Check: Only PR #4 appears

---

## Scenario 7: Notification Flow Test

### Steps:
1. **Login as Growth User**
   - Create a QR
   - Check notifications bell

2. **Login as Procurement User**
   - Respond to the QR
   - Check notifications bell

3. **Login as Growth User** (again)
   - Check notifications bell
   - Verify: "QR Responded" notification appears

4. **Convert QR to PR**

5. **Login as Approver User**
   - Check notifications bell
   - Verify: "PR Created" notification appears
   - Approve the PR

6. **Login as Finance User**
   - Check notifications bell
   - Verify: "PR Ready for Verification" notification appears
   - Verify the PR

7. **Login as Procurement User**
   - Check notifications bell
   - Verify: "PR Verified, Ready for PO" notification appears
   - Convert to PO

8. **Login as Finance User**
   - Check notifications bell
   - Verify: "PO Created" notification appears

9. **Login as Growth User**
   - Check notifications bell
   - Verify: "PO Created from your PR" notification appears

---

## Expected Results Summary

### ✅ What Should Work

| User | Can Do | Cannot Do |
|------|--------|-----------|
| **Growth** | Create QR, Convert own QR, Create PR, View own PRs/POs | Convert others' QRs, Approve PRs, View all POs |
| **Approver** | View all QRs/PRs/POs, Approve/Reject PRs | Create QR/PR, Respond to QR, Verify PR, Create PO |
| **Finance** | View approved PRs, Verify/Reject PRs, View all POs | Access QRs, View pending PRs, Create anything |
| **Procurement** | View all QRs/PRs, Respond to QRs, Convert verified PRs to POs, Manage POs | Create QR/PR, Approve/Verify PRs |
| **Admin** | Everything above | Nothing - full access |

### ✅ Key Checks

1. **Navigation Links**
   - Growth: QR, PR, PO tabs
   - Approver: QR, PR, PO tabs
   - Finance: PR, PO Payments tabs (NO QR)
   - Procurement: QR, PR, PO tabs
   - Admin: All tabs

2. **Data Filtering**
   - Growth QRs: Only own
   - Growth PRs: Only own
   - Growth POs: Only from own PRs
   - Finance PRs: Only approved
   - Others: See all

3. **Conversion Rules**
   - QR to PR: Creator only (or Admin)
   - PR to PO: Both approvals required (Approver + Finance)

4. **Status Display**
   - Procurement PR list: Shows BOTH approval columns
   - Ready PRs: Green background + checkmark icon

5. **Error Messages**
   - Clear and informative
   - Shows current status when blocked

---

## Automated Test Checklist

```bash
# API Endpoint Tests
✅ GET /api/growth/qrs - Returns only user's own QRs
✅ GET /api/growth/pos - Returns only POs from user's PRs
✅ GET /api/approver/qrs - Returns all QRs
✅ GET /api/approver/pos - Returns all POs
✅ GET /api/finance/history - Returns only approved PRs
✅ POST /api/growth/pr/create - Only Growth can create
✅ POST /api/approver/pr/[id]/approve - Sets approval_status
✅ POST /api/approver/pr/[id]/reject - Sets rejected status
✅ POST /api/procurement/qr/[id]/respond - Changes QR status

# Page Protection Tests
✅ /dashboard/growth/qr/[id]/convert - Blocks non-creators
✅ /dashboard/procurement/pr/[id]/convert - Checks both approvals
✅ /dashboard/finance/* - No QR routes

# Admin Override Tests
✅ Admin bypasses all role checks
✅ Admin sees all data regardless of filters

# Notification Tests
✅ Correct users receive notifications
✅ PR rejection only notifies creator (not all Growth users)
✅ PO creation notifies Finance team + PR creator
```

---

## Troubleshooting

### Issue: Finance user can see pending PRs
**Fix:** Check `/app/dashboard/finance/history/page.tsx` - should have `.eq("approval_status", "approved")` filter

### Issue: Growth user can convert another user's QR
**Fix:** Check `/app/dashboard/growth/qr/[id]/convert/page.tsx` - should have creator check

### Issue: Procurement can convert PR with only one approval
**Fix:** Check `/app/dashboard/procurement/pr/[id]/convert/page.tsx` - should check both `approval_status` AND `finance_verification_status`

### Issue: Admin sees filtered data
**Fix:** Check if `session.isAdmin` override is present in queries

### Issue: Visual indicators not showing in Procurement PR list
**Fix:** Check `/app/dashboard/procurement/pr/page.tsx` - should have "Approver Status" and "Finance Status" columns

---

## Test Data Setup Script

```sql
-- Insert test users (adjust based on your auth system)
INSERT INTO profiles (email, full_name, role) VALUES
  ('growth@test.com', 'Test Growth User', 'growth'),
  ('approver@test.com', 'Test Approver User', 'approver'),
  ('finance@test.com', 'Test Finance User', 'finance'),
  ('procurement@test.com', 'Test Procurement User', 'procurement'),
  ('admin@test.com', 'Test Admin User', 'admin');

-- Create sample QR
INSERT INTO qr (created_by_email, reseller_code, reseller_contact_no, reseller_country, service_needed, countries, shipping_type, movement_type_by_country, purchase_details, status)
VALUES
  ('growth@test.com', 'RESL001', '+1234567890', 'US', 'Import', ARRAY['US', 'UK'], 'sea', 
   '{"US": "air", "UK": "sea"}'::jsonb,
   '[{"productName": "Test Product", "hsnCode": "123456", "quantity": 100}]'::jsonb,
   'open');
```
