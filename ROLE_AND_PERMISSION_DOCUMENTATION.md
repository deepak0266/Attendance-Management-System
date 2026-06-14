# Attendance System: Roles, Permissions, Visibility, and Limits

This document explains the current role model, capabilities, and visibility rules implemented in the Attendance System. It is based on the backend role config, auth middleware, route access rules, and frontend routes.

## Roles Overview

### 1. SUPER_ADMIN
- Highest privilege role.
- Can access and manage everything in the system.
- Can view all system logs, audit logs, and all user data.
- Can manage HR, Manager, and Employee accounts.
- Can revoke/restore permissions and perform system-level actions.
- Can approve or reject any approval request.

### 2. HR
- High-level administrator focused on people and payroll.
- Can view and manage most employee and manager data.
- Can create and update policies, shifts, and geo-fence settings.
- Can approve or reject HR-level or escalated approval requests.
- Can access system logs, but cannot see actions marked as Super Admin actions.
- Cannot manage or access Super Admin user data.

### 3. MANAGER
- Team-level supervisor.
- Can view team attendance data and team reports.
- Can approve, reject, or escalate requests for team members.
- Can access pending approvals and approval history for their team.
- Can manage employees who are directly assigned to them.
- Cannot access global admin pages or HR-only admin features.

### 4. EMPLOYEE
- Regular user.
- Can view own attendance and profile data.
- Can submit regularization/approval requests.
- Can view own report data.
- Cannot access approvals dashboard, reports dashboard, or admin pages reserved for HR/Super Admin.

## Frontend Route Access

### Public route
- `/login` - only for unauthenticated users.

### Authenticated pages for all roles
- `/dashboard` - available to `SUPER_ADMIN`, `HR`, `MANAGER`, `EMPLOYEE`.
- `/attendance` - available to all authenticated roles.
- `/profile` - available to all authenticated roles.

### Restricted pages
- `/approvals` - available to `SUPER_ADMIN`, `HR`, `MANAGER` only.
- `/reports` - available to `SUPER_ADMIN`, `HR`, `MANAGER` only.
- `/admin` - available to `SUPER_ADMIN`, `HR` only.

### Admin section tabs
- `/admin/users` - `SUPER_ADMIN`, `HR`
- `/admin/shifts` - `SUPER_ADMIN`, `HR`
- `/admin/policies` - `SUPER_ADMIN`, `HR`
- `/admin/geofence` - `SUPER_ADMIN`, `HR`
- `/admin/logs` - `SUPER_ADMIN`, `HR`
- `/admin/permissions` - `SUPER_ADMIN` only

## Backend Route Authorization

### General auth rules
- `authMiddleware` validates a valid access token from either:
  - `Authorization: Bearer <token>` header, or
  - `accessToken` cookie.
- It ensures user exists, is active, not locked, and not revoked from login.

### Role-based authorization
- `authorize('SUPER_ADMIN', 'HR')` or similar is used in admin routes.
- `checkPermission(permission)` checks role-specific permission maps plus revocation state.

### Approval rules
- `/api/approvals/pending` - any authenticated user reaches pending approvals, but effective results depend on role.
- `/api/approvals/history` - available for authenticated users.
- `/api/approvals/regularization` - only employees can create requests.
- `/api/approvals/:id/approve` - accessible to `SUPER_ADMIN`, `HR`, `MANAGER` via `canApproveRequest`.
- `/api/approvals/:id/reject` - same as approve.
- `/api/approvals/:id/escalate` - managers can escalate to HR.
- `/api/approvals/:id/cancel` - employees can cancel their own requests.
- `/api/approvals/bulk-approve` - HR, Super Admin, Manager via permission check.
- `/api/approvals/user/:userId` - HR, Super Admin, Manager can read approval history for specific users.

### Admin routes
- `/api/admin/dashboard`, `/api/admin/attendance-trend`, `/api/admin/department-distribution` - only `SUPER_ADMIN` and `HR`.
- `/api/admin/permissions/revoke` and `/api/admin/permissions/restore/:revocationId` - `SUPER_ADMIN` only.
- `/api/admin/logs` - `SUPER_ADMIN` and `HR` only.
- `/api/admin/audit-logs` - `SUPER_ADMIN` only.
- `/api/admin/shifts` - `SUPER_ADMIN` and `HR` only.
- `/api/admin/policies`, `/api/admin/geofence` - `SUPER_ADMIN` and `HR` only.

## Visibility Rules

### System Logs
- `SUPER_ADMIN` sees all logs.
- `HR` sees logs filtered to exclude Super Admin actions.
- `MANAGER` can only see logs for their direct team members:
  - actions where `actor_user_id` or `target_user_id` is in the manager's team.
- `EMPLOYEE` can only see logs where they are actor or target.

### User data access
- `SUPER_ADMIN` can access any user.
- `HR` can access any non-Super Admin user.
- `MANAGER` can access data only for users in their team and themselves.
- `EMPLOYEE` can access only own data.

### Approval management visibility
- `MANAGER` can manage only pending team member requests and escalate to HR.
- `HR` can manage escalated requests and HR-level requests.
- `SUPER_ADMIN` can manage all approvals.
- `EMPLOYEE` can only create or cancel their own requests.

## Capability vs Permission

The system separates role-permissions and explicit capabilities. These are present in backend config and frontend permission checks.

### Role capabilities
- `SUPER_ADMIN` - all capabilities.
- `HR` - broad people and payroll capabilities, including attendance override, policy setup, payroll lock/unlock, report export, and limited system logs.
- `MANAGER` - team view, approval handling, team report access.
- `EMPLOYEE` - request creation and self-view only.

### Revocable capabilities
- Permissions such as `override_attendance`, `upload_employees`, `lock_payroll`, `define_policies`, `approve_requests`, `view_reports`, and `manage_users` can be revoked by Super Admin.
- Revoked capabilities are enforced both on backend route checks and logged as denied attempts.

## Practical “Kya dikhega aur kya kar paayega” summary

### SUPER_ADMIN
- Dikhega:
  - Dashboard data, attendance, approvals, reports, admin panels, logs, audit logs.
  - Full user list including HR, managers, employees.
- Kar paayega:
  - Manage all users.
  - Revoke/restore permissions.
  - View and export all reports.
  - Approve/reject any request.
  - View all system and audit logs.

### HR
- Dikhega:
  - Dashboard data, attendance summaries, approvals, reports, most admin panels, limited logs.
  - All users except Super Admin-level details.
- Kar paayega:
  - Create and update shifts, policies, geo-fence.
  - Approve/reject escalated or HR requests.
  - View payroll and export reports.
  - View system logs excluding Super Admin actions.

### MANAGER
- Dikhega:
  - Team dashboard and attendance.
  - Pending approvals for team members.
  - Team reports.
- Kar paayega:
  - Approve/reject team member requests.
  - Escalate requests to HR.
  - Access team-specific data only.

### EMPLOYEE
- Dikhega:
  - Own dashboard, attendance records, own profile.
  - Own reports and request forms.
- Kar paayega:
  - Submit regularization or attendance requests.
  - Cancel own requests.
  - View only own data.

## Known limitations / current behavior

- Frontend currently does not expose `/admin` or `/reports` navigation to `EMPLOYEE`.
- HR cannot view Super Admin-specific system actions, even if they can access almost all other logs.
- Manager admin pages are not shown; managers interact through approval and report routes only.
- Role permission maps in frontend and backend are similar but not identical:
  - Frontend `hasPermission()` uses a focused set of capability names.
  - Backend `checkPermission()` uses a larger permission map and explicit route-based checks.
- Any role-level capability revoked in `RevokedPermission` can block behavior even when the role would otherwise allow it.

## Where the rules are implemented

- `backend/src/config/roles.js` — role definitions, permission matrix, helper functions.
- `backend/src/middleware/auth.js` — token auth, role authorization, permission checks.
- `backend/src/middleware/rbac.js` — resource access, log visibility, approval rules, user management rules.
- `backend/src/routes/adminRoutes.js` — admin page access restrictions.
- `backend/src/routes/approvalRoutes.js` — approval workflow permissions.
- `frontend/src/App.jsx` — route guards and allowedRoles configuration.
- `frontend/src/components/common/Sidebar.jsx` — role-based navigation visibility.
- `frontend/src/services/auth.jsx` — frontend permission checks and current user handling.

## Quick reference table

| Role | Main access | Can approve/reject | Can manage users | System logs | Admin panels | Report access |
|------|-------------|--------------------|------------------|-------------|--------------|---------------|
| SUPER_ADMIN | All data | Yes (all) | Yes | All logs | Yes | All reports |
| HR | Employee + manager data | Yes (HR/escalated) | Yes, except Super Admin | Limited logs | Yes | All reports |
| MANAGER | Team data | Yes (team) | Manage direct employees | No admin logs | No | Team reports |
| EMPLOYEE | Own data | No | No | Own logs only | No | Self report |

---

For any changes, update both backend auth rules and frontend `allowedRoles`/sidebar visibility together to keep UI and API access in sync.
