# Security Specification: Shasthobondhu (স্বাস্থ্যবন্ধু)

## 1. Data Invariants
1. **User Data Isolation (Zero Cross-Tenant Leakage)**: All user data (patients, medicines, schedules, stock, dose logs, settings) resides strictly in subcollections under `/users/{userId}/`. Only the authenticated user whose `request.auth.uid == userId` can read, create, update, or delete any resource within their tree.
2. **Immutable Identity**: `userId` in path must match `request.auth.uid`. A user cannot forge another user's identity or access another user's prescriptions or medical logs.
3. **Field Validation**:
   - Medicines must have non-empty `id`, `brandName`, `type`, `schedules` list, and `assignedPatientId`.
   - Patient profiles must have non-empty `id`, `name`, `relation`, and positive `age`.
   - Dose logs must include `id`, `medicineId`, `patientId`, `scheduledDate`, `timeSlot`, and `status` ('taken' | 'skipped' | 'missed').
4. **Boundary & Injection Defense**: All IDs and string fields are strictly bounded by size checks (`<= 128` or `<= 256` chars).

## 2. The "Dirty Dozen" Payloads (Must be rejected with PERMISSION_DENIED)
1. **Unauthenticated Read**: Attempting to read `/users/user-123/medicines/med-1` without auth.
2. **Cross-User Snooping**: Authenticated user `user-abc` attempting to read `/users/user-xyz/patients/pat-1`.
3. **Cross-User Modification**: Authenticated user `user-abc` attempting to update `/users/user-xyz/medicines/med-1`.
4. **Cross-User Deletion**: Authenticated user `user-abc` attempting to delete `/users/user-xyz/doseLogs/log-1`.
5. **ID Poisoning / Denial-of-Wallet**: Writing an ID longer than 128 characters or containing SQL/XSS characters.
6. **Ghost Field Injection**: Attempting to inject administrative or hidden escalation fields into medicine documents.
7. **Negative Age / Negative Stock**: Writing invalid types or corrupt numbers.
8. **Invalid Dose Status**: Setting doseLog status to arbitrary string instead of 'taken', 'skipped', or 'missed'.
9. **Blanket Query Scraping**: Attempting a collectionGroup query across all users' medicines.
10. **Orphaned User Document Creation**: Writing to another user's root document.
11. **Oversized String Flooding**: Submitting a 500KB medicine brandName to exhaust database quota.
12. **Tampering with Audit Logs**: Modifying someone else's compliance records.
