import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import API from "../services/api";
import "../stylecss/customers.css";

const ROLES = ["admin", "manager", "driver"];

const ROLE_STYLES = {
  admin:   { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
  manager: { bg: "#fffbeb", color: "#d97706", border: "#fcd34d" },
  driver:  { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
};

const EMPTY_USER_FORM = {
  username: "",
  full_name: "",
  email: "",
  password: "",
  role: "driver",
};

export default function Settings() {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === "admin";

  // Active tab
  const [activeTab, setActiveTab] = useState(isAdmin ? "users" : "profile");

  // ── Users tab state ──────────────────────────────────────
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState(null);

  // Add user modal
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [userForm, setUserForm] = useState(EMPTY_USER_FORM);
  const [userFormError, setUserFormError] = useState(null);
  const [savingUser, setSavingUser] = useState(false);

  // Edit user
  const [editingUser, setEditingUser] = useState(null);
  const [editUserForm, setEditUserForm] = useState({});
  const [editUserError, setEditUserError] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete user
  const [deleteUserTarget, setDeleteUserTarget] = useState(null);

  // Reset password
  const [resetPasswordTarget, setResetPasswordTarget] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetError, setResetError] = useState(null);
  const [resetting, setResetting] = useState(false);

  // ── Profile tab state ────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [passError, setPassError] = useState(null);
  const [passSuccess, setPassSuccess] = useState(false);
  const [savingPass, setSavingPass] = useState(false);

  // ── Fetch users ──────────────────────────────────────────
  const fetchUsers = async () => {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const res = await API.get("/auth/users");
      setUsers(res.data);
    } catch {
      setUsersError("Could not load users.");
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin && activeTab === "users") fetchUsers();
  }, [isAdmin, activeTab]);

  // ── Add user ─────────────────────────────────────────────
  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!userForm.username.trim()) { setUserFormError("Username is required."); return; }
    if (!userForm.password.trim()) { setUserFormError("Password is required."); return; }
    setSavingUser(true);
    setUserFormError(null);
    try {
      await API.post("/auth/register", userForm);
      setAddUserOpen(false);
      setUserForm(EMPTY_USER_FORM);
      fetchUsers();
    } catch (err) {
      setUserFormError(err.response?.data?.detail || "Could not create user.");
    } finally {
      setSavingUser(false);
    }
  };

  // ── Edit user ────────────────────────────────────────────
  const openEdit = (user) => {
    setEditingUser(user);
    setEditUserForm({
      full_name: user.full_name || "",
      email: user.email || "",
      role: user.role,
      is_active: user.is_active,
    });
    setEditUserError(null);
  };

  const handleEditUser = async (e) => {
    e.preventDefault();
    setSavingEdit(true);
    setEditUserError(null);
    try {
      await API.patch(`/auth/users/${editingUser.id}`, editUserForm);
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      setEditUserError(err.response?.data?.detail || "Could not update user.");
    } finally {
      setSavingEdit(false);
    }
  };

  // ── Delete user ──────────────────────────────────────────
  const handleDeleteUser = async () => {
    if (!deleteUserTarget) return;
    try {
      await API.delete(`/auth/users/${deleteUserTarget.id}`);
      setDeleteUserTarget(null);
      fetchUsers();
    } catch (err) {
      setUsersError(err.response?.data?.detail || "Could not delete user.");
      setDeleteUserTarget(null);
    }
  };

  // ── Reset password ───────────────────────────────────────
  const handleResetPassword = async () => {
    if (!newPassword.trim()) { setResetError("Password is required."); return; }
    if (newPassword.length < 6) { setResetError("Password must be at least 6 characters."); return; }
    setResetting(true);
    setResetError(null);
    try {
      await API.patch(`/auth/users/${resetPasswordTarget.id}`, { password: newPassword });
      setResetPasswordTarget(null);
      setNewPassword("");
    } catch (err) {
      setResetError(err.response?.data?.detail || "Could not reset password.");
    } finally {
      setResetting(false);
    }
  };

  // ── Change own password ──────────────────────────────────
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!currentPassword) { setPassError("Current password is required."); return; }
    if (newPass.length < 6) { setPassError("New password must be at least 6 characters."); return; }
    if (newPass !== confirmPass) { setPassError("Passwords do not match."); return; }
    setSavingPass(true);
    setPassError(null);
    try {
      await API.patch("/auth/me/password", {
        current_password: currentPassword,
        new_password: newPass,
      });
      setCurrentPassword("");
      setNewPass("");
      setConfirmPass("");
      setPassSuccess(true);
      setTimeout(() => setPassSuccess(false), 3000);
    } catch (err) {
      setPassError(err.response?.data?.detail || "Could not change password.");
    } finally {
      setSavingPass(false);
    }
  };

  // ── Role badge ───────────────────────────────────────────
  const RoleBadge = ({ role }) => {
    const s = ROLE_STYLES[role] || ROLE_STYLES.driver;
    return (
      <span style={{
        background: s.bg, color: s.color,
        border: `1px solid ${s.border}`,
        padding: "3px 10px", borderRadius: "999px",
        fontSize: "12px", fontWeight: "700",
        textTransform: "capitalize",
      }}>{role}</span>
    );
  };

  // ── Tabs ─────────────────────────────────────────────────
  const TABS = [
    ...(isAdmin ? [{ id: "users", label: "👥 User Management" }] : []),
    { id: "profile", label: "🔑 My Profile" },
  ];

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="customers-page">

      {/* Header */}
      <div className="customers-header">
        <div>
          <h1 className="customers-title">Settings</h1>
          <p className="customers-subtitle">
            {isAdmin ? "Manage users and your account" : "Manage your account"}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "28px", borderBottom: "2px solid #e5e7eb", paddingBottom: "0" }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "10px 20px",
              border: "none",
              background: "none",
              fontSize: "14px",
              fontWeight: activeTab === tab.id ? "700" : "500",
              color: activeTab === tab.id ? "#2d7a4f" : "#6b7280",
              borderBottom: activeTab === tab.id ? "2px solid #2d7a4f" : "2px solid transparent",
              marginBottom: "-2px",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── USERS TAB ── */}
      {activeTab === "users" && isAdmin && (
        <div>
          <div className="customers-header" style={{ marginBottom: "20px" }}>
            <div>
              <h2 style={{ fontSize: "18px", fontWeight: "700", color: "#1a1a2e", margin: 0 }}>
                Users
              </h2>
              <p style={{ fontSize: "14px", color: "#6b7280", margin: "4px 0 0" }}>
                {users.length} registered user{users.length !== 1 ? "s" : ""}
              </p>
            </div>
            <button className="btn-primary" onClick={() => { setAddUserOpen(true); setUserFormError(null); setUserForm(EMPTY_USER_FORM); }}>
              + Add User
            </button>
          </div>

          {usersError && <div className="error-banner">{usersError}</div>}

          {/* Users table */}
          <div className="table-wrapper">
            <table className="customers-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Full Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {usersLoading ? (
                  <tr><td colSpan={6} className="table-state">Loading...</td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan={6} className="table-state">No users found.</td></tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="table-row">
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div style={{
                            width: "32px", height: "32px", borderRadius: "50%",
                            background: u.id === currentUser?.id ? "#2d7a4f" : "#e5e7eb",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "12px", fontWeight: "700",
                            color: u.id === currentUser?.id ? "#fff" : "#6b7280",
                            flexShrink: 0,
                          }}>
                            {u.username.slice(0, 2).toUpperCase()}
                          </div>
                          <span style={{ fontWeight: "600", color: "#1a1a2e" }}>
                            {u.username}
                            {u.id === currentUser?.id && (
                              <span style={{ fontSize: "11px", color: "#2d7a4f", marginLeft: "6px" }}>
                                (you)
                              </span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td>{u.full_name || "—"}</td>
                      <td style={{ color: "#6b7280" }}>{u.email || "—"}</td>
                      <td><RoleBadge role={u.role} /></td>
                      <td>
                        <span style={{
                          background: u.is_active ? "#f0fdf4" : "#f9fafb",
                          color: u.is_active ? "#15803d" : "#9ca3af",
                          padding: "3px 10px", borderRadius: "999px",
                          fontSize: "12px", fontWeight: "600",
                        }}>
                          {u.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="td-actions" style={{ width: "180px" }}>
                        <button className="btn-edit" onClick={() => openEdit(u)}>Edit</button>
                        <button
                          className="btn-edit"
                          onClick={() => { setResetPasswordTarget(u); setNewPassword(""); setResetError(null); }}
                          style={{ background: "#fffbeb", color: "#d97706" }}
                        >
                          🔑 Reset
                        </button>
                        {u.id !== currentUser?.id && (
                          <button className="btn-delete" onClick={() => setDeleteUserTarget(u)}>
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── PROFILE TAB ── */}
      {activeTab === "profile" && (
        <div style={{ maxWidth: "560px" }}>

          {/* Current user info */}
          <div style={{
            background: "#fff", border: "1.5px solid #e5e7eb",
            borderRadius: "14px", padding: "24px",
            marginBottom: "24px",
            display: "flex", alignItems: "center", gap: "16px",
          }}>
            <div style={{
              width: "56px", height: "56px", borderRadius: "50%",
              background: "#2d7a4f",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "20px", fontWeight: "800", color: "#fff", flexShrink: 0,
            }}>
              {currentUser?.full_name
                ? currentUser.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
                : currentUser?.username?.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p style={{ fontSize: "18px", fontWeight: "700", color: "#1a1a2e", margin: "0 0 4px" }}>
                {currentUser?.full_name || currentUser?.username}
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "13px", color: "#6b7280" }}>@{currentUser?.username}</span>
                <RoleBadge role={currentUser?.role} />
              </div>
            </div>
          </div>

          {/* Change password */}
          <div style={{
            background: "#fff", border: "1.5px solid #e5e7eb",
            borderRadius: "14px", padding: "24px",
          }}>
            <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#1a1a2e", margin: "0 0 20px" }}>
              Change Password
            </h3>
            <form onSubmit={handleChangePassword} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="form-group">
                <label>Current Password</label>
                <input
                  type="password"
                  placeholder="Enter current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>New Password</label>
                <input
                  type="password"
                  placeholder="Enter new password (min 6 chars)"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Confirm New Password</label>
                <input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                />
              </div>

              {passError && <p className="form-error">{passError}</p>}
              {passSuccess && (
                <div style={{
                  background: "#f0fdf4", border: "1px solid #86efac",
                  borderRadius: "8px", padding: "10px 14px",
                  color: "#15803d", fontSize: "14px", fontWeight: "600",
                }}>
                  ✓ Password changed successfully
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button type="submit" className="btn-primary" disabled={savingPass}>
                  {savingPass ? "Saving..." : "Change Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Add User Modal ── */}
      {addUserOpen && (
        <div className="modal-overlay" onClick={() => setAddUserOpen(false)}>
          <div className="modal" style={{ maxWidth: "520px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New User</h2>
              <button className="modal-close" onClick={() => setAddUserOpen(false)}>✕</button>
            </div>
            <form className="modal-form" onSubmit={handleAddUser}>

              <div className="form-row">
                <div className="form-group form-group--grow">
                  <label>Username <span className="required">*</span></label>
                  <input type="text" placeholder="e.g. maria.garcia"
                    value={userForm.username}
                    onChange={(e) => setUserForm({ ...userForm, username: e.target.value })} />
                </div>
                <div className="form-group form-group--grow">
                  <label>Full Name</label>
                  <input type="text" placeholder="Maria Garcia"
                    value={userForm.full_name}
                    onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })} />
                </div>
              </div>

              <div className="form-group">
                <label>Email</label>
                <input type="email" placeholder="maria@recial.com"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} />
              </div>

              <div className="form-group">
                <label>Password <span className="required">*</span></label>
                <input type="password" placeholder="Minimum 6 characters"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} />
              </div>

              <div className="form-group">
                <label>Role</label>
                <div style={{ display: "flex", gap: "8px" }}>
                  {ROLES.map((role) => (
                    <button key={role} type="button"
                      onClick={() => setUserForm({ ...userForm, role })}
                      style={{
                        flex: 1, padding: "9px", borderRadius: "8px", border: "1.5px solid",
                        borderColor: userForm.role === role ? ROLE_STYLES[role].border : "#e5e7eb",
                        background: userForm.role === role ? ROLE_STYLES[role].bg : "#fff",
                        color: userForm.role === role ? ROLE_STYLES[role].color : "#6b7280",
                        fontWeight: "600", fontSize: "13px", cursor: "pointer",
                        textTransform: "capitalize",
                      }}
                    >{role}</button>
                  ))}
                </div>
              </div>

              {userFormError && <p className="form-error">{userFormError}</p>}

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setAddUserOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={savingUser}>
                  {savingUser ? "Creating..." : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit User Modal ── */}
      {editingUser && (
        <div className="modal-overlay" onClick={() => setEditingUser(null)}>
          <div className="modal" style={{ maxWidth: "480px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>Edit User</h2>
                <p style={{ fontSize: "13px", color: "#6b7280", margin: "2px 0 0" }}>
                  @{editingUser.username}
                </p>
              </div>
              <button className="modal-close" onClick={() => setEditingUser(null)}>✕</button>
            </div>
            <form className="modal-form" onSubmit={handleEditUser}>

              <div className="form-group">
                <label>Full Name</label>
                <input type="text" value={editUserForm.full_name}
                  onChange={(e) => setEditUserForm({ ...editUserForm, full_name: e.target.value })} />
              </div>

              <div className="form-group">
                <label>Email</label>
                <input type="email" value={editUserForm.email}
                  onChange={(e) => setEditUserForm({ ...editUserForm, email: e.target.value })} />
              </div>

              <div className="form-group">
                <label>Role</label>
                <div style={{ display: "flex", gap: "8px" }}>
                  {ROLES.map((role) => (
                    <button key={role} type="button"
                      onClick={() => setEditUserForm({ ...editUserForm, role })}
                      style={{
                        flex: 1, padding: "9px", borderRadius: "8px", border: "1.5px solid",
                        borderColor: editUserForm.role === role ? ROLE_STYLES[role].border : "#e5e7eb",
                        background: editUserForm.role === role ? ROLE_STYLES[role].bg : "#fff",
                        color: editUserForm.role === role ? ROLE_STYLES[role].color : "#6b7280",
                        fontWeight: "600", fontSize: "13px", cursor: "pointer",
                        textTransform: "capitalize",
                      }}
                    >{role}</button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Status</label>
                <div style={{ display: "flex", gap: "8px" }}>
                  {[true, false].map((val) => (
                    <button key={String(val)} type="button"
                      onClick={() => setEditUserForm({ ...editUserForm, is_active: val })}
                      style={{
                        flex: 1, padding: "9px", borderRadius: "8px", border: "1.5px solid",
                        borderColor: editUserForm.is_active === val ? (val ? "#86efac" : "#fecaca") : "#e5e7eb",
                        background: editUserForm.is_active === val ? (val ? "#f0fdf4" : "#fef2f2") : "#fff",
                        color: editUserForm.is_active === val ? (val ? "#15803d" : "#dc2626") : "#6b7280",
                        fontWeight: "600", fontSize: "13px", cursor: "pointer",
                      }}
                    >{val ? "Active" : "Inactive"}</button>
                  ))}
                </div>
              </div>

              {editUserError && <p className="form-error">{editUserError}</p>}

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setEditingUser(null)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={savingEdit}>
                  {savingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Reset Password Modal ── */}
      {resetPasswordTarget && (
        <div className="modal-overlay" onClick={() => setResetPasswordTarget(null)}>
          <div className="modal modal--confirm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>Reset Password</h2>
                <p style={{ fontSize: "13px", color: "#6b7280", margin: "2px 0 0" }}>
                  @{resetPasswordTarget.username}
                </p>
              </div>
              <button className="modal-close" onClick={() => setResetPasswordTarget(null)}>✕</button>
            </div>
            <div style={{ padding: "16px 24px 24px", display: "flex", flexDirection: "column", gap: "14px" }}>
              <div className="form-group">
                <label>New Password</label>
                <input type="password" placeholder="Minimum 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)} />
              </div>
              {resetError && <p className="form-error">{resetError}</p>}
              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => setResetPasswordTarget(null)}>Cancel</button>
                <button className="btn-primary" onClick={handleResetPassword} disabled={resetting}>
                  {resetting ? "Resetting..." : "Reset Password"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete User Confirmation ── */}
      {deleteUserTarget && (
        <div className="modal-overlay" onClick={() => setDeleteUserTarget(null)}>
          <div className="modal modal--confirm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Delete User</h2>
              <button className="modal-close" onClick={() => setDeleteUserTarget(null)}>✕</button>
            </div>
            <p className="confirm-text">
              Are you sure you want to delete user{" "}
              <strong>@{deleteUserTarget.username}</strong>?
              This action cannot be undone.
            </p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setDeleteUserTarget(null)}>Cancel</button>
              <button className="btn-danger" onClick={handleDeleteUser}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
