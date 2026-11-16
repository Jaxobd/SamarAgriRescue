import { FormEvent, ReactNode, useEffect, useRef, useState, useMemo } from "react";
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getGetAdminProductsQueryKey,
  getGetAdminReportsQueryKey,
  getGetAdminSummaryQueryKey,
  getGetAdminUsersQueryKey,
  getGetCurrentUserQueryKey,
  getGetMessagesQueryKey,
  getGetProductQueryKey,
  getGetProductsQueryKey,
  getGetReservationsQueryKey,
  getGetStatsQueryKey,
  getGetProfileQueryKey,
  useAdminDeleteProduct,
  useCreateProduct,
  useCreateReport,
  useCreateReservation,
  useGetAdminProducts,
  useGetAdminReports,
  useGetAdminSummary,
  useGetAdminUsers,
  useGetCurrentUser,
  useGetMessages,
  useGetProduct,
  useGetProducts,
  useGetReservations,
  useGetStats,
  useGetProfile,
  useLogin,
  useLogout,
  useMarkMessageRead,
  useMarkProductSold,
  useRegister,
  useSendMessage,
  useUpdateAdminReport,
  useUpdateAdminUser,
  useUpdateProduct,
  useUpdateProfile,
  useUpdateReservation,
  type AdminSummary,
  type GetProductsParams,
  type Message,
  type Product,
  type ProductInput,
  type Profile,
  type Reservation,
  type User,
} from "@workspace/api-client-react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleUserRound,
  Clock3,
  Copy,
  Database,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Filter,
  Fish,
  HeartHandshake,
  History,
  Home,
  Image as ImageIcon,
  KeyRound,
  Layers,
  Leaf,
  LogOut,
  Menu,
  MessageCircle,
  Moon,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShoppingBasket,
  Sprout,
  Store,
  Sun,
  Trash2,
  TrendingUp,
  Upload,
  UserCheck,
  UserPlus,
  UserRound,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { Link, Route, Switch, useLocation } from "wouter";
import "./index.css";
import "./theme-and-admin.css";
import "./notifications.css";

const queryClient = new QueryClient();

const categories = ["All categories", "Vegetables", "Fruits", "Rice & Grains", "Fish", "Seafood", "Livestock", "Other"];
const locations = ["All Samar", "Calbayog City", "Catbalogan City", "Basey", "Guiuan", "Borongan City"];
const units = ["kilogram", "sack", "basket", "piece", "bundle", "crate", "box"];

function errorMessage(error: unknown, fallback = "Something went wrong. Please try again.") {
  if (error && typeof error === "object" && "data" in error) {
    const data = (error as { data?: { error?: string } }).data;
    if (data?.error) return data.error;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

// ---------------------------------------------------------------------------
// Theme Management Hook (Dark Mode / Light Mode - Requirement 3)
// ---------------------------------------------------------------------------
function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("samar_theme");
      if (saved === "dark" || saved === "light") return saved;
      if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
        return "dark";
      }
    }
    return "light";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("samar_theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  return { theme, toggleTheme };
}

// ---------------------------------------------------------------------------
// Activity notifications
// ---------------------------------------------------------------------------
type AppNotification = {
  id: number;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  productId?: number | null;
  entityId?: number | null;
  entityType?: string | null;
  isRead: boolean;
  createdAt: string;
};

async function fetchNotifications(): Promise<AppNotification[]> {
  const res = await fetch("/api/notifications?limit=50");
  if (!res.ok) return [];
  const json = await res.json();
  return Array.isArray(json) ? json : [];
}

function useNotifications(enabled = true) {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
    enabled,
    staleTime: 10_000,
  });
}

function useUnreadNotifications(enabled = true) {
  return useQuery({
    queryKey: ["notifications-unread"],
    queryFn: async () => {
      const res = await fetch("/api/notifications/unread-count");
      if (!res.ok) return { count: 0 };
      return (await res.json()) as { count: number };
    },
    enabled,
    refetchInterval: 30_000,
  });
}

function useNotificationActions() {
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    queryClient.invalidateQueries({ queryKey: ["notifications-unread"] });
  };
  const markRead = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    },
    onSuccess: refresh,
  });
  const markAllRead = useMutation({
    mutationFn: async () => {
      await fetch("/api/notifications/read-all", { method: "POST" });
    },
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/notifications/${id}`, { method: "DELETE" });
    },
    onSuccess: refresh,
  });
  return { markRead, markAllRead, remove };
}

function NotificationIcon({ type }: { type: string }) {
  if (type === "reservation") return <HeartHandshake size={16} />;
  if (type === "message") return <MessageCircle size={16} />;
  if (type === "product") return <Package size={16} />;
  if (type === "report") return <ShieldAlert size={16} />;
  if (type === "admin") return <ShieldCheck size={16} />;
  return <Bell size={16} />;
}

function NotificationBell() {
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { data: unread } = useUnreadNotifications();
  const { data: notifications } = useNotifications();
  const { markRead, markAllRead } = useNotificationActions();
  const count = unread?.count ?? 0;
  const list = (notifications ?? []).slice(0, 6);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const openNotification = (notification: AppNotification) => {
    if (!notification.isRead) markRead.mutate(notification.id);
    setOpen(false);
    navigate(notification.link || "/activity");
  };

  return (
    <div className="notif-wrap" ref={wrapRef}>
      <button
        className="theme-toggle-btn notif-btn"
        onClick={() => setOpen((current) => !current)}
        aria-label={count ? `${count} unread notifications` : "Notifications"}
        aria-expanded={open}
        title="Notifications"
      >
        <Bell size={17} />
        {count > 0 && <span className="notif-badge">{count > 9 ? "9+" : count}</span>}
      </button>
      {open && (
        <div className="notif-panel" role="dialog" aria-label="Notifications">
          <div className="notif-panel-head">
            <strong>Notifications {count > 0 && <span className="notif-count-pill">{count} new</span>}</strong>
            {count > 0 && (
              <button onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending}>
                Mark all read
              </button>
            )}
          </div>
          {list.length ? (
            <div className="notif-panel-list">
              {list.map((notification) => (
                <button
                  key={notification.id}
                  className={`notif-item ${notification.isRead ? "" : "unread"}`}
                  onClick={() => openNotification(notification)}
                >
                  <span className={`notif-icon notif-icon-${notification.type}`}>
                    <NotificationIcon type={notification.type} />
                  </span>
                  <span className="notif-copy">
                    <strong>{notification.title}</strong>
                    {notification.body && <small>{notification.body}</small>}
                    <em>{relativeDate(notification.createdAt)}</em>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="notif-empty">You're all caught up. New reservations, messages, and updates will appear here.</p>
          )}
          <Link href="/activity" className="notif-panel-foot" onClick={() => setOpen(false)}>
            View all activity <ArrowRight size={14} />
          </Link>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Password Visibility Toggle Component (Requirement 2)
// ---------------------------------------------------------------------------
function PasswordInput({
  name,
  value,
  onChange,
  placeholder = "Enter password",
  required = false,
  autoComplete,
  minLength,
  id,
}: {
  name: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  minLength?: number;
  id?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="password-input-wrap">
      <input
        id={id}
        name={name}
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        minLength={minLength}
      />
      <button
        type="button"
        className="password-toggle-btn"
        onClick={() => setShow(!show)}
        aria-label={show ? "Hide password" : "Show password"}
        title={show ? "Hide password" : "Show password"}
        tabIndex={-1}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Google Auth Button Component (Requirement 1)
// ---------------------------------------------------------------------------
function GoogleAuthButton({ mode = "login", role = "Buyer" }: { mode?: "login" | "register"; role?: string }) {
  const { data: config, isLoading } = useQuery({
    queryKey: ["googleAuthConfig"],
    queryFn: async () => {
      const res = await fetch("/api/auth/google/config");
      return res.json() as Promise<{ enabled: boolean; clientId: string | null }>;
    },
  });

  const [showNotice, setShowNotice] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    if (!config?.enabled) {
      e.preventDefault();
      setShowNotice(true);
    }
  };

  return (
    <div className="google-auth-container">
      <a
        href={`/api/auth/google?role=${encodeURIComponent(role)}`}
        onClick={handleClick}
        className="google-btn"
      >
        <svg className="google-icon-svg" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.14z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.13C3.25 21.31 7.31 24 12 24z"
          />
          <path
            fill="#FBBC05"
            d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.6H1.26C.46 8.21 0 10.05 0 12s.46 3.79 1.26 5.4l4.02-3.13z"
          />
          <path
            fill="#EA4335"
            d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.69 1.26 6.6l4.02 3.13c.95-2.83 3.6-4.98 6.72-4.98z"
          />
        </svg>
        <span>
          {mode === "login" ? "Sign in with Google" : "Sign up with Google"}
        </span>
      </a>

      {showNotice && (
        <div className="google-config-notice">
          <ShieldAlert size={15} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong>Google OAuth Configuration:</strong> To enable one-click Google Sign-In, please provide <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> in your server environment variables.
          </div>
        </div>
      )}

      <div className="auth-divider">
        <span>or with username</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Product Image Uploader & Preview Component (Requirement 4)
// ---------------------------------------------------------------------------
function ImageUploader({
  value,
  onChange,
}: {
  value?: string[];
  onChange: (urls: string[]) => void;
}) {
  const images = value ?? [];
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualUrl, setManualUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File) => {
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (!validTypes.includes(file.type.toLowerCase())) {
      throw new Error("Supported formats: JPG, JPEG, PNG, and WEBP.");
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new Error("Each photo must be 5MB or smaller.");
    }
    const formData = new FormData();
    formData.append("image", file);
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || "Failed to upload image.");
    }
    const data = await res.json();
    return String(data.url);
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    const free = 6 - images.length;
    if (free <= 0) {
      setError("You can attach up to 6 photos per listing.");
      return;
    }
    const chosen = Array.from(files).slice(0, free);
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of chosen) uploaded.push(await uploadFile(file));
      onChange([...images, ...uploaded]);
    } catch (err: any) {
      setError(err.message || "Failed to upload image.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeAt = (index: number) => {
    const url = images[index];
    if (url.startsWith("/api/uploads/")) {
      fetch(`/api/upload/${url.replace("/api/uploads/", "")}`, { method: "DELETE" }).catch(() => {});
    }
    onChange(images.filter((_, current) => current !== index));
  };

  const move = (index: number, direction: -1 | 1) => {
    const next = [...images];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const makeCover = (index: number) => {
    onChange([images[index], ...images.filter((_, current) => current !== index)]);
  };

  const addManualUrl = () => {
    const url = manualUrl.trim();
    if (!url) return;
    if (images.length >= 6) {
      setError("You can attach up to 6 photos per listing.");
      return;
    }
    onChange([...images, url]);
    setManualUrl("");
  };

  return (
    <div className="image-upload-wrapper">
      <div className="photo-grid">
        {images.map((url, index) => (
          <div className={`photo-tile ${index === 0 ? "is-cover" : ""}`} key={`${url}-${index}`}>
            <img src={url} alt={`Product photo ${index + 1}`} />
            {index === 0 && <span className="photo-cover-badge">Cover</span>}
            <div className="photo-tile-actions">
              {index > 0 && (
                <button type="button" title="Move earlier" onClick={() => move(index, -1)}>
                  <ChevronLeft size={13} />
                </button>
              )}
              {index < images.length - 1 && (
                <button type="button" title="Move later" onClick={() => move(index, 1)}>
                  <ChevronRight size={13} />
                </button>
              )}
              {index > 0 && (
                <button type="button" title="Make cover photo" onClick={() => makeCover(index)}>
                  <ImageIcon size={13} />
                </button>
              )}
              <button type="button" title="Remove photo" className="danger" onClick={() => removeAt(index)}>
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
        {images.length < 6 && (
          <button
            type="button"
            className="photo-add"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <RefreshCw className="animate-spin" size={18} /> : <Plus size={18} />}
            <span>{uploading ? "Uploading…" : "Add photo"}</span>
            <small>{images.length}/6</small>
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/jpg"
        multiple
        style={{ display: "none" }}
        onChange={(event) => handleFiles(event.target.files)}
      />

      {error && <p className="form-error" style={{ margin: 0 }}>{error}</p>}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button
          type="button"
          onClick={() => setManualMode(!manualMode)}
          style={{ background: "none", border: 0, padding: 0, fontSize: "11px", color: "var(--leaf)", cursor: "pointer", fontWeight: 600 }}
        >
          {manualMode ? "Hide image URL input" : "Or add a direct image URL"}
        </button>
        <span style={{ fontSize: "11px", color: "var(--ink-soft)" }}>
          {images.length ? "First photo is the cover buyers see first." : "JPG, PNG, or WEBP up to 5MB each"}
        </span>
      </div>

      {manualMode && (
        <div className="manual-url-row">
          <input
            value={manualUrl}
            onChange={(event) => setManualUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addManualUrl();
              }
            }}
            placeholder="https://example.com/fresh-produce.jpg"
            style={{ fontSize: "12px" }}
          />
          <button type="button" className="button button-small button-outline" onClick={addManualUrl}>
            Add
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Forgot Password Dialog Component (Requirement 2)
// ---------------------------------------------------------------------------
function ForgotPasswordDialog({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [identifier, setIdentifier] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleStep1 = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to find account.");
      setStatusMsg("Account verified. Please choose a new secure password.");
      setStep(2);
    } catch (err: any) {
      setError(err.message || "Could not verify that account.");
    } finally {
      setLoading(false);
    }
  };

  const handleStep2 = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reset password.");
      setStatusMsg("Password updated successfully! You can now log in with your new password.");
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Password update failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog title="Reset Password" onClose={onClose}>
      {step === 1 ? (
        <form onSubmit={handleStep1}>
          <p className="dialog-copy">
            Enter your username or email address to locate your account and set a new password.
          </p>
          <Field label="Username or Email" required>
            <input
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="e.g. juanfarmer or user@example.com"
              autoFocus
            />
          </Field>
          {error && <p className="form-error">{error}</p>}
          <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button type="button" className="button button-outline" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="button button-primary" disabled={loading || !identifier.trim()}>
              {loading ? "Checking…" : "Continue"} <ArrowRight size={15} />
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleStep2}>
          {statusMsg && <div className="security-badge-banner" style={{ marginBottom: 14 }}><CheckCircle2 size={16} /><span>{statusMsg}</span></div>}
          <p className="dialog-copy">
            Setting new password for: <strong>{identifier}</strong>
          </p>
          <Field label="New password (min. 6 characters)" required>
            <PasswordInput
              name="newPassword"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              required
              minLength={6}
            />
          </Field>
          <div style={{ height: 10 }} />
          <Field label="Confirm new password" required>
            <PasswordInput
              name="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat new password"
              required
              minLength={6}
            />
          </Field>
          {error && <p className="form-error">{error}</p>}
          <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button type="button" className="button button-outline" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="button button-primary" disabled={loading || !newPassword}>
              {loading ? "Updating…" : "Update Password"} <Check size={15} />
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Shell and Navigation
// ---------------------------------------------------------------------------
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Shell />
    </QueryClientProvider>
  );
}

function Shell() {
  const [location] = useLocation();
  const { data: session, isLoading } = useGetCurrentUser();
  const user = session?.user;
  const publicPage = ["/", "/products", "/rescue", "/about", "/login", "/register"].includes(location);

  if (isLoading && !publicPage) {
    return (
      <div className="loading-screen">
        <Sprout size={28} />
        <span>Loading Samar AgriRescue…</span>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Header user={user} />
      <main className="page-wrap">
        <Switch>
          <Route path="/" component={() => <HomePage user={user} />} />
          <Route path="/products" component={() => <ProductsPage />} />
          <Route path="/products/new" component={() => <ProductFormPage user={user} />} />
          <Route path="/products/:id/edit" component={({ params }) => <ProductFormPage user={user} productId={Number(params.id)} />} />
          <Route path="/products/:id" component={({ params }) => <ProductDetailPage id={Number(params.id)} user={user} />} />
          <Route path="/rescue" component={() => <RescuePage />} />
          <Route path="/about" component={() => <AboutPage />} />
          <Route path="/login" component={() => <LoginPage />} />
          <Route path="/register" component={() => <RegisterPage />} />
          <Route path="/dashboard" component={() => <DashboardPage user={user} />} />
          <Route path="/my-products" component={() => <MyProductsPage user={user} />} />
          <Route path="/reservations" component={() => <ReservationsPage user={user} />} />
          <Route path="/messages" component={() => <MessagesPage user={user} />} />
          <Route path="/activity" component={() => <ActivityPage user={user} />} />
          <Route path="/profile" component={() => <ProfilePage user={user} />} />
          <Route path="/profile/:id" component={({ params }) => <PublicProfilePage id={Number(params.id)} />} />
          <Route path="/admin" component={() => <AdminPage section="summary" user={user} />} />
          <Route path="/admin/users" component={() => <AdminPage section="users" user={user} />} />
          <Route path="/admin/products" component={() => <AdminPage section="products" user={user} />} />
          <Route path="/admin/reports" component={() => <AdminPage section="reports" user={user} />} />
          <Route path="/admin/database" component={() => <AdminPage section="database" user={user} />} />
          <Route path="/admin/activities" component={() => <AdminPage section="activities" user={user} />} />
          <Route component={NotFoundPage} />
        </Switch>
      </main>
      <Footer />
    </div>
  );
}

function Header({ user }: { user?: User | null }) {
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoHoldTriggered = useRef(false);

  const logout = useLogout({
    mutation: {
      onSuccess: () => {
        queryClient.setQueryData(getGetCurrentUserQueryKey(), { user: null });
        navigate("/");
      },
    },
  });

  const startLogoHold = () => {
    logoHoldTriggered.current = false;
    holdTimer.current = setTimeout(() => {
      logoHoldTriggered.current = true;
      navigate("/admin");
    }, 650);
  };

  const cancelLogoHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link
          href="/"
          className="brand"
          onPointerDown={startLogoHold}
          onPointerUp={cancelLogoHold}
          onPointerLeave={cancelLogoHold}
          onContextMenu={(event) => event.preventDefault()}
          onClick={(event) => {
            if (logoHoldTriggered.current) {
              event.preventDefault();
              logoHoldTriggered.current = false;
            }
          }}
          aria-label="Samar AgriRescue home. Press and hold for Admin Desk."
        >
          <span className="brand-mark">
            <Sprout size={21} />
          </span>
          <span>
            <strong>Samar</strong>
            <em>AgriRescue</em>
          </span>
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {user && <NotificationBell />}

          {/* Dark / Light Mode Toggle Button (Requirement 3) */}
          <button
            className="theme-toggle-btn"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          <button
            className="mobile-menu"
            onClick={() => setOpen(!open)}
            aria-label="Toggle navigation"
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>

        <nav className={`main-nav ${open ? "nav-open" : ""}`}>
          <Link href="/" onClick={() => setOpen(false)}>Home</Link>
          <Link href="/products" onClick={() => setOpen(false)}>Browse</Link>
          <Link href="/rescue" onClick={() => setOpen(false)} className="rescue-link">Rescue Now</Link>
          <Link href="/about" onClick={() => setOpen(false)}>About</Link>
          {user ? (
            <>
              <Link href="/dashboard" onClick={() => setOpen(false)}>Dashboard</Link>
              <Link href="/messages" onClick={() => setOpen(false)} className="nav-icon-link">
                <MessageCircle size={16} /> Messages
              </Link>
              <Link href="/activity" onClick={() => setOpen(false)} className="nav-icon-link">
                <Bell size={16} /> Activity
              </Link>
              {user.userType === "Administrator" && (
                <Link href="/admin" onClick={() => setOpen(false)} style={{ color: "var(--leaf)", fontWeight: 700 }}>
                  <ShieldCheck size={15} style={{ verticalAlign: "middle", marginRight: 4 }} /> Admin
                </Link>
              )}
              <button
                className="header-profile"
                onClick={() => navigate(user.userType === "Administrator" ? "/admin" : "/profile")}
              >
                <span className="avatar">{initials(user.fullName)}</span>
                {user.fullName.split(" ")[0]}
                <ChevronDown size={14} />
              </button>
              <button
                className="logout-btn"
                onClick={() => logout.mutate()}
                aria-label="Log out"
                title="Log out"
              >
                <LogOut size={16} />
              </button>
            </>
          ) : (
            <div className="auth-links">
              <Link href="/login">Log in</Link>
              <Link href="/register" className="button button-small">
                Join the network <ArrowRight size={15} />
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div>
          <div className="brand footer-brand">
            <span className="brand-mark"><Sprout size={19} /></span>
            <span><strong>Samar</strong><em>AgriRescue</em></span>
          </div>
          <p>Rescue the harvest. Support local. Reduce food waste in Eastern Visayas.</p>
        </div>
        <div className="footer-note">
          <span><ShieldCheck size={15} /> Local exchange, community powered</span>
          <small>Buyers and sellers arrange payment and pickup directly.</small>
        </div>
      </div>
    </footer>
  );
}

// ---------------------------------------------------------------------------
// Home Page
// ---------------------------------------------------------------------------
function HomePage({ user }: { user?: User | null }) {
  const { data: stats } = useGetStats();
  const { data: rawProducts } = useGetProducts({ rescue: true, sort: "newest" });
  const products = Array.isArray(rawProducts) ? rawProducts : [];
  return (
    <div className="home-page">
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow"><span className="pulse-dot" /> A better way to buy local</span>
          <h1>Good food should<br /><i>find a home.</i></h1>
          <p>We connect Samar farmers and fisherfolk with nearby buyers so surplus produce finds a market instead of going to waste.</p>
          <div className="hero-actions">
            <Link href="/products" className="button button-primary">Browse surplus <ArrowRight size={17} /></Link>
            <Link href={user ? "/products/new" : "/register"} className="button button-quiet">Sell your surplus <Plus size={17} /></Link>
          </div>
          <div className="hero-trust">
            <div className="mini-avatars"><span>JD</span><span>LM</span><span>MS</span><b>+</b></div>
            <span>Trusted by Samar’s local food community</span>
          </div>
        </div>
        <div className="hero-art" aria-label="Illustration of local produce">
          <div className="sun-orb" /><div className="hill hill-back" /><div className="hill hill-front" />
          <div className="produce-card produce-tomato"><span>●</span><small>Fresh today</small><strong>Tomatoes</strong></div>
          <div className="produce-card produce-fish"><Fish size={22} /><small>Just landed</small><strong>Fresh catch</strong></div>
          <div className="basket">
            <div className="basket-leaf leaf-one" /><div className="basket-leaf leaf-two" />
            <div className="basket-fruit fruit-one" /><div className="basket-fruit fruit-two" />
          </div>
          <div className="hero-sticker"><HeartHandshake size={17} /><span>Every listing<br /><b>makes a difference</b></span></div>
        </div>
      </section>

      <section className="stats-strip">
        <Stat value={stats?.availableProducts ?? 0} label="Available products" />
        <Stat value={stats?.registeredProducers ?? 0} label="Local producers" />
        <Stat value={stats?.productsRescued ?? 0} label="Products rescued" />
        <Stat value={stats?.activeBuyers ?? 0} label="Active buyers" />
      </section>

      <section className="section featured-section">
        <SectionHeading
          eyebrow="Needs a home soon"
          title="Rescue listings"
          action={<Link href="/rescue" className="text-link">See all rescue listings <ArrowRight size={16} /></Link>}
        />
        {products.length ? (
          <div className="product-grid">{products.slice(0, 3).map((p) => <ProductCard key={p.id} product={p} />)}</div>
        ) : (
          <EmptyState title="The rescue board is quiet" copy="Check back soon for new surplus listings." />
        )}
      </section>

      <section className="section how-section">
        <SectionHeading eyebrow="Simple by design" title="From extra to enjoyed" />
        <div className="steps">
          <Step number="01" icon={<Store />} title="Producers post surplus" copy="List what you have, where it is, and when it's ready." />
          <Step number="02" icon={<Search />} title="Buyers discover locally" copy="Find fresh food near you and reserve what you need." />
          <Step number="03" icon={<HeartHandshake />} title="Everyone wins" copy="Arrange pickup directly and keep good food in the community." />
        </div>
      </section>

      <section className="cta-section">
        <div>
          <span className="eyebrow eyebrow-light">Have extra to share?</span>
          <h2>Turn your surplus<br /><i>into someone’s next meal.</i></h2>
          <p>Join the local network of producers making a difference in Samar.</p>
        </div>
        <Link href={user ? "/products/new" : "/register"} className="button button-light">
          List your surplus <ArrowRight size={17} />
        </Link>
      </section>
    </div>
  );
}

function Stat({ value, label }: { value?: number | null; label: string }) {
  const safeVal = typeof value === "number" && !isNaN(value) ? value : 0;
  return (
    <div className="stat">
      <strong>{safeVal.toString().padStart(2, "0")}</strong>
      <span>{label}</span>
    </div>
  );
}

function Step({ number, icon, title, copy }: { number: string; icon: ReactNode; title: string; copy: string }) {
  return (
    <div className="step">
      <span className="step-number">{number}</span>
      <div className="step-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{copy}</p>
    </div>
  );
}

function SectionHeading({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) {
  return (
    <div className="section-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Browse Products Page
// ---------------------------------------------------------------------------
function ProductsPage() {
  const [filters, setFilters] = useState<GetProductsParams>({ sort: "newest" });
  const [search, setSearch] = useState("");
  const { data: rawProducts, isLoading } = useGetProducts({ ...filters, search: search || undefined });
  const products = Array.isArray(rawProducts) ? rawProducts : [];

  return (
    <div className="content-page">
      <PageIntro
        eyebrow="The local marketplace"
        title="Browse surplus products"
        copy="Fresh, local, and ready to find a new home. Search what's available near you."
        action={<Link href="/rescue" className="button button-primary">Rescue Now <ArrowRight size={16} /></Link>}
      />
      <div className="marketplace-toolbar">
        <div className="search-box">
          <Search size={18} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search produce, producer, or location"
          />
        </div>
        <select
          value={filters.category ?? "All categories"}
          onChange={(e) => setFilters({ ...filters, category: e.target.value === "All categories" ? undefined : e.target.value })}
        >
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select
          value={filters.location ?? "All Samar"}
          onChange={(e) => setFilters({ ...filters, location: e.target.value === "All Samar" ? undefined : e.target.value })}
        >
          {locations.map((l) => <option key={l}>{l}</option>)}
        </select>
        <select
          value={filters.sort ?? "newest"}
          onChange={(e) => setFilters({ ...filters, sort: e.target.value as GetProductsParams["sort"] })}
        >
          <option value="newest">Newest first</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
        </select>
      </div>
      <div className="results-row">
        <span>{isLoading ? "Finding listings…" : `${products.length} listings available`}</span>
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={filters.rescue ?? false}
            onChange={(e) => setFilters({ ...filters, rescue: e.target.checked || undefined })}
          />
          <span className="toggle" /> Rescue only
        </label>
      </div>
      {products.length ? (
        <div className="product-grid">
          {products.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      ) : (
        <EmptyState
          title={search ? "No listings match that search" : "No products found in this view"}
          copy="Try a different category, location, or search term."
          action={<button className="button button-outline" onClick={() => { setFilters({ sort: "newest" }); setSearch(""); }}>Clear filters</button>}
        />
      )}
    </div>
  );
}

function RescuePage() {
  const { data: rawProducts } = useGetProducts({ rescue: true, sort: "newest" });
  const products = Array.isArray(rawProducts) ? rawProducts : [];
  return (
    <div className="content-page rescue-page">
      <div className="rescue-banner">
        <div>
          <span className="rescue-kicker"><CircleAlert size={16} /> Time-sensitive surplus</span>
          <h1>Rescue Now</h1>
          <p>Good food, ready to move. These listings need a buyer soon.</p>
        </div>
        <div className="rescue-count">
          <strong>{products.length}</strong>
          <span>active rescue<br />listings</span>
        </div>
      </div>
      <div className="notice">
        <ShieldCheck size={17} />
        <span>Rescue listings are community-posted. Please confirm quality, quantity, payment, and pickup details with the producer.</span>
      </div>
      {products.length ? (
        <div className="product-grid rescue-grid">
          {products.map((p) => <ProductCard key={p.id} product={p} rescue />)}
        </div>
      ) : (
        <EmptyState title="No rescue listings right now" copy="That means the community is moving food quickly. Check back soon." />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Product Card Component with Image Support (Requirement 4)
// ---------------------------------------------------------------------------
function ProductCard({ product, rescue = false }: { product: Product; rescue?: boolean }) {
  const cover = product.images?.[0] ?? product.image;
  const hasImage = Boolean(cover && cover.trim());
  const photoCount = product.images?.length ?? (hasImage ? 1 : 0);

  return (
    <Link href={`/products/${product.id}`} className={`product-card ${rescue ? "product-card-rescue" : ""}`}>
      <div className={`product-image image-${product.category.toLowerCase().replace(/\W/g, "-")}`}>
        {hasImage ? (
          <img
            src={cover!}
            alt={product.name}
            loading="lazy"
            onError={(e) => {
              // Graceful fallback to illustration if image fails to load
              (e.currentTarget as HTMLElement).style.display = "none";
            }}
          />
        ) : (
          <ProductIllustration category={product.category} />
        )}
        {photoCount > 1 && (
          <span className="photo-count-badge">
            <ImageIcon size={11} /> {photoCount}
          </span>
        )}
        {product.isRescue && (
          <span className="rescue-badge">
            <CircleAlert size={12} /> Rescue
          </span>
        )}
        <span className="image-arrow">
          <ArrowRight size={16} />
        </span>
      </div>
      <div className="product-meta">
        <div className="product-topline">
          <span>{product.category}</span>
          <span className={`status status-${product.status.toLowerCase()}`}>{product.status}</span>
        </div>
        <h3>{product.name}</h3>
        <p className="producer-line">
          <span className="avatar avatar-small">{initials(product.producerName)}</span>
          {product.producerName} <span className="middot">·</span> {product.location.split(",")[0]}
        </p>
        <div className="product-bottom">
          <strong>
            ₱{product.price.toLocaleString()} <small>/ {product.unit}</small>
          </strong>
          <span>{product.quantity} {product.unit} left</span>
        </div>
      </div>
    </Link>
  );
}

function ProductIllustration({ category }: { category: string }) {
  const Icon =
    category === "Fish" || category === "Seafood"
      ? Fish
      : category === "Vegetables"
      ? Leaf
      : category === "Fruits"
      ? Sprout
      : Package;
  return (
    <div className="product-illustration">
      <Icon size={55} strokeWidth={1.25} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Product Detail Page
// ---------------------------------------------------------------------------
function ProductDetailPage({ id, user }: { id: number; user?: User | null }) {
  const { data: product, isLoading } = useGetProduct(id);
  const [quantity, setQuantity] = useState(1);
  const [messageOpen, setMessageOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [activePhoto, setActivePhoto] = useState(0);

  useEffect(() => {
    setActivePhoto(0);
  }, [product?.id]);

  const reserve = useCreateReservation({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetProductQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getGetReservationsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetProductsQueryKey() });
      },
    },
  });

  const report = useCreateReport({
    mutation: {
      onSuccess: () => setReportOpen(false),
    },
  });

  if (isLoading) return <LoadingState />;
  if (!product) return <NotFoundPage />;

  const isOwner = user?.id === product.producerId;
  const gallery = (product.images?.length ? product.images : product.image ? [product.image] : []).filter(Boolean);
  const activeImage = gallery[activePhoto] ?? gallery[0];

  return (
    <div className="detail-page">
      <Link href="/products" className="back-link">
        <ChevronLeft size={16} /> Back to browse
      </Link>
      <div className="detail-layout">
        <div className="detail-visual">
          <div className="detail-image">
            {activeImage ? (
              <img
                src={activeImage}
                alt={`${product.name} photo ${activePhoto + 1}`}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <ProductIllustration category={product.category} />
            )}
            {product.isRescue && (
              <span className="rescue-badge">
                <CircleAlert size={13} /> Rescue listing
              </span>
            )}
            {gallery.length > 1 && (
              <>
                <button
                  type="button"
                  className="gallery-nav gallery-nav-prev"
                  aria-label="Previous photo"
                  onClick={() => setActivePhoto((activePhoto - 1 + gallery.length) % gallery.length)}
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  className="gallery-nav gallery-nav-next"
                  aria-label="Next photo"
                  onClick={() => setActivePhoto((activePhoto + 1) % gallery.length)}
                >
                  <ChevronRight size={18} />
                </button>
                <span className="gallery-counter">{activePhoto + 1} / {gallery.length}</span>
              </>
            )}
          </div>
          {gallery.length > 1 && (
            <div className="gallery-thumbs">
              {gallery.map((url, index) => (
                <button
                  type="button"
                  key={`${url}-${index}`}
                  className={`gallery-thumb ${index === activePhoto ? "active" : ""}`}
                  onClick={() => setActivePhoto(index)}
                  aria-label={`Show photo ${index + 1}`}
                >
                  <img src={url} alt="" />
                </button>
              ))}
            </div>
          )}
          <div className="image-caption">
            <span><Clock3 size={14} /> Posted {relativeDate(product.createdAt)}</span>
            <span>Samar AgriRescue Network</span>
          </div>
        </div>

        <div className="detail-copy">
          <div className="product-topline">
            <span>{product.category}</span>
            <span className={`status status-${product.status.toLowerCase()}`}>{product.status}</span>
          </div>
          <h1>{product.name}</h1>
          <p className="detail-description">{product.description || "A local listing from a Samar producer."}</p>
          <div className="detail-price">
            ₱{product.price.toLocaleString()} <small>per {product.unit}</small>
          </div>
          <div className="detail-facts">
            <div>
              <span>Available</span>
              <strong>{product.quantity} {product.unit}</strong>
            </div>
            <div>
              <span>Location</span>
              <strong>{product.location}</strong>
            </div>
            <div>
              <span>Ready from</span>
              <strong>{product.availabilityDate || "Today"}</strong>
            </div>
          </div>
          <div className="producer-box">
            <span className="avatar avatar-large">{initials(product.producerName)}</span>
            <div>
              <span>Listed by</span>
              <Link href={`/profile/${product.producerId}`}>{product.producerName}</Link>
              <small>{product.producerType || "Local producer"}</small>
            </div>
            <Link href={`/profile/${product.producerId}`} className="icon-circle">
              <ArrowRight size={16} />
            </Link>
          </div>

          {isOwner || user?.userType === "Administrator" ? (
            <div className="detail-actions">
              <Link href={`/products/${id}/edit`} className="button button-primary">
                <Pencil size={16} /> Edit listing
              </Link>
              <button className="button button-outline" onClick={() => setMessageOpen(true)}>
                View interest
              </button>
            </div>
          ) : user?.userType === "Buyer" ? (
            <div className="detail-actions">
              <div className="quantity-input">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))}>−</button>
                <strong>{quantity}</strong>
                <button onClick={() => setQuantity(Math.min(product.quantity, quantity + 1))}>+</button>
                <span>{product.unit}</span>
              </div>
              <button
                disabled={product.status !== "Available" || reserve.isPending}
                className="button button-primary button-grow"
                onClick={() => reserve.mutate({ data: { productId: id, quantity } })}
              >
                {reserve.isSuccess ? (
                  <><Check size={17} /> Reserved</>
                ) : (
                  <>Reserve product <ArrowRight size={17} /></>
                )}
              </button>
              <button className="button button-outline icon-button" onClick={() => setMessageOpen(true)}>
                <MessageCircle size={17} />
              </button>
            </div>
          ) : (
            <div className="detail-actions">
              <Link href="/login" className="button button-primary button-grow">
                Log in to reserve <ArrowRight size={17} />
              </Link>
            </div>
          )}

          {reserve.isError && <p className="form-error">{errorMessage(reserve.error)}</p>}

          <div className="detail-links">
            <button onClick={() => setReportOpen(true)}>Report this listing</button>
            <span>·</span>
            <span>Payment and pickup arranged directly</span>
          </div>
        </div>
      </div>

      {messageOpen && <MessageComposer product={product} onClose={() => setMessageOpen(false)} user={user} />}
      {reportOpen && <ReportDialog product={product} onClose={() => setReportOpen(false)} mutation={report} />}
    </div>
  );
}

function MessageComposer({ product, user, onClose }: { product: Product; user?: User | null; onClose: () => void }) {
  const send = useSendMessage({ mutation: { onSuccess: onClose } });
  const [message, setMessage] = useState(`Hi ${product.producerName}, I’m interested in your ${product.name}. Is it still available?`);
  if (!user) {
    return (
      <Dialog title="Sign in to contact the producer" onClose={onClose}>
        <Link className="button button-primary" href="/login">Log in</Link>
      </Dialog>
    );
  }
  return (
    <Dialog title={`Message ${product.producerName}`} onClose={onClose}>
      <p className="dialog-copy">Start a conversation about this listing.</p>
      <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} />
      <button
        className="button button-primary"
        disabled={send.isPending || !message.trim()}
        onClick={() => send.mutate({ data: { receiverId: product.producerId, productId: product.id, message } })}
      >
        Send message <ArrowRight size={16} />
      </button>
    </Dialog>
  );
}

function ReportDialog({ product, onClose, mutation }: { product: Product; onClose: () => void; mutation: ReturnType<typeof useCreateReport> }) {
  const [reason, setReason] = useState("Listing information is inaccurate");
  const [description, setDescription] = useState("");
  return (
    <Dialog title="Report this listing" onClose={onClose}>
      <p className="dialog-copy">Help us keep Samar AgriRescue useful and safe.</p>
      <select value={reason} onChange={(e) => setReason(e.target.value)}>
        <option>Listing information is inaccurate</option>
        <option>Inappropriate content</option>
        <option>Suspicious activity</option>
        <option>Other concern</option>
      </select>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Additional details (optional)"
        rows={3}
      />
      <button
        className="button button-primary"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate({ data: { productId: product.id, reason, description: description || undefined } })}
      >
        Submit report <ArrowRight size={16} />
      </button>
    </Dialog>
  );
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <button className="dialog-close" onClick={onClose} aria-label="Close dialog">
          <X size={18} />
        </button>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard Page (User / Producer)
// ---------------------------------------------------------------------------
function DashboardPage({ user }: { user?: User | null }) {
  if (!user) return <AuthRequired title="Your dashboard is waiting" copy="Log in to see your reservations, listings, and messages." />;
  const { data: rawProducts } = useGetProducts(
    { includeUnavailable: true, sort: "newest" },
    { query: { enabled: user.userType !== "Buyer", queryKey: getGetProductsQueryKey({ includeUnavailable: true, sort: "newest" }) } }
  );
  const products = Array.isArray(rawProducts) ? rawProducts : [];
  const { data: rawReservations } = useGetReservations({ query: { enabled: !!user, queryKey: getGetReservationsQueryKey() } });
  const reservations = Array.isArray(rawReservations) ? rawReservations : [];
  const producer = user.userType === "Farmer" || user.userType === "Fisherfolk";
  const own = products.filter((p) => p.producerId === user.id);

  return (
    <div className="dashboard-page">
      <div className="dashboard-welcome">
        <div>
          <span className="eyebrow">Good day, {user.fullName.split(" ")[0]}</span>
          <h1>{producer ? "Your harvest hub." : "Your food, closer to home."}</h1>
          <p>{producer ? "Keep your listings fresh and connect with buyers across Samar." : "Discover the latest surplus and keep track of what you’ve reserved."}</p>
        </div>
        <Link href={producer ? "/products/new" : "/products"} className="button button-primary">
          {producer ? <><Plus size={17} /> Add a listing</> : <>Browse products <ArrowRight size={17} /></>}
        </Link>
      </div>

      <div className="dashboard-cards">
        <MetricCard icon={<Package />} label={producer ? "Total listings" : "Reservations"} value={producer ? own.length : reservations.length} tone="green" />
        <MetricCard icon={<Clock3 />} label={producer ? "Available now" : "Pending"} value={producer ? own.filter((p) => p.status === "Available").length : reservations.filter((r) => r.status === "Pending").length} tone="yellow" />
        <MetricCard icon={<HeartHandshake />} label={producer ? "Rescued" : "Confirmed"} value={producer ? own.filter((p) => p.isRescue).length : reservations.filter((r) => r.status === "Confirmed").length} tone="blue" />
      </div>

      <div className="dashboard-grid">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Activity</span>
              <h2>{producer ? "Your recent listings" : "Your recent reservations"}</h2>
            </div>
            <Link href={producer ? "/my-products" : "/reservations"} className="text-link">
              View all <ArrowRight size={15} />
            </Link>
          </div>
          {producer
            ? own.slice(0, 3).map((p) => <MiniProduct key={p.id} product={p} />)
            : reservations.slice(0, 3).map((r) => <ReservationRow key={r.id} reservation={r} />)}
          {!(producer ? own.length : reservations.length) && (
            <EmptyState title="Nothing here yet" copy={producer ? "Your first listing can help rescue a harvest." : "Reserve a product to see it here."} />
          )}
        </div>

        <div className="panel dashboard-tip">
          <div className="tip-illustration"><Leaf size={31} /></div>
          <span className="eyebrow">Community Impact</span>
          <h2>Local food travels less, and means more.</h2>
          <p>When you buy from a nearby producer in Samar, food waste decreases and local livelihoods thrive.</p>
          <Link href="/about" className="text-link">Learn about our mission <ArrowRight size={15} /></Link>
        </div>
      </div>

      <DashboardActivityPanel />
    </div>
  );
}

function DashboardActivityPanel() {
  const [, navigate] = useLocation();
  const { data } = useNotifications();
  const { markRead } = useNotificationActions();
  const list = (data ?? []).slice(0, 4);
  if (!list.length) return null;
  return (
    <div className="panel dashboard-activity">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Notifications</span>
          <h2>Recent activity</h2>
        </div>
        <Link href="/activity" className="text-link">View all <ArrowRight size={15} /></Link>
      </div>
      {list.map((notification) => (
        <button
          key={notification.id}
          className={`mini-row feed-mini ${notification.isRead ? "" : "unread"}`}
          onClick={() => {
            if (!notification.isRead) markRead.mutate(notification.id);
            navigate(notification.link || "/activity");
          }}
        >
          <span className={`notif-icon notif-icon-${notification.type}`}>
            <NotificationIcon type={notification.type} />
          </span>
          <span>
            <strong>{notification.title}</strong>
            <small>{notification.body ?? relativeDate(notification.createdAt)}</small>
          </span>
          <ArrowRight size={15} />
        </button>
      ))}
    </div>
  );
}

function MetricCard({ icon, label, value, tone }: { icon: ReactNode; label: string; value: number; tone: string }) {
  return (
    <div className={`metric-card metric-${tone}`}>
      <span className="metric-icon">{icon}</span>
      <div>
        <strong>{value.toString().padStart(2, "0")}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

function MiniProduct({ product }: { product: Product }) {
  const cover = product.images?.[0] ?? product.image;
  const hasImage = Boolean(cover && cover.trim());
  return (
    <Link href={`/products/${product.id}`} className="mini-row">
      <span className="mini-product-icon">
        {hasImage ? (
          <img src={cover!} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }} />
        ) : (
          <ProductIllustration category={product.category} />
        )}
      </span>
      <span>
        <strong>{product.name}</strong>
        <small>{product.location}</small>
      </span>
      <b>₱{product.price.toLocaleString()}</b>
      <ArrowRight size={15} />
    </Link>
  );
}

function ReservationRow({ reservation }: { reservation: Reservation }) {
  return (
    <div className="mini-row">
      <span className="mini-product-icon"><Package size={20} /></span>
      <span>
        <strong>{reservation.productName}</strong>
        <small>{reservation.quantity} {reservation.unit} · {reservation.producerName}</small>
      </span>
      <span className={`status status-${reservation.status.toLowerCase()}`}>{reservation.status}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Producer "My Products" Page
// ---------------------------------------------------------------------------
function MyProductsPage({ user }: { user?: User | null }) {
  const params = { includeUnavailable: true, sort: "newest" as const };
  const { data: rawProducts, isLoading } = useGetProducts(params, {
    query: { enabled: !!user, queryKey: getGetProductsQueryKey(params) },
  });
  const products = Array.isArray(rawProducts) ? rawProducts : [];
  const mine = products.filter((p) => p.producerId === user?.id);

  return (
    <div className="content-page">
      <PageIntro
        eyebrow="Producer space"
        title="My products"
        copy="Keep your listings up to date so buyers know what is fresh and available."
        action={<Link href="/products/new" className="button button-primary"><Plus size={17} /> Add product</Link>}
      />
      {isLoading ? (
        <LoadingState />
      ) : mine.length ? (
        <div className="manage-list">
          {mine.map((product) => <ManageProduct key={product.id} product={product} />)}
        </div>
      ) : (
        <EmptyState
          title="Your marketplace is ready"
          copy="Post your first surplus listing and connect with a nearby buyer."
          action={<Link className="button button-primary" href="/products/new">Create a listing <ArrowRight size={16} /></Link>}
        />
      )}
    </div>
  );
}

function ManageProduct({ product }: { product: Product }) {
  const queryClient = useQueryClient();
  const sold = useMarkProductSold({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetProductsQueryKey() });
      },
    },
  });
  const remove = useMutation({
    mutationFn: () => fetch(`/api/products/${product.id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetProductsQueryKey() }),
  });

  const cover = product.images?.[0] ?? product.image;
  const hasImage = Boolean(cover && cover.trim());

  return (
    <div className="manage-product">
      <span className="manage-image">
        {hasImage ? (
          <img src={cover!} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }} />
        ) : (
          <ProductIllustration category={product.category} />
        )}
      </span>
      <div className="manage-info">
        <div className="product-topline">
          <span>{product.category}</span>
          <span className={`status status-${product.status.toLowerCase()}`}>{product.status}</span>
        </div>
        <h3>{product.name}</h3>
        <p>{product.location} · {product.quantity} {product.unit} · ₱{product.price.toLocaleString()}/{product.unit}</p>
      </div>
      <div className="manage-actions">
        <Link href={`/products/${product.id}/edit`} className="icon-action" aria-label="Edit">
          <Pencil size={16} />
        </Link>
        {product.status !== "Sold" && (
          <button className="icon-action" onClick={() => sold.mutate({ id: product.id })} aria-label="Mark as sold" title="Mark as sold">
            <Check size={16} />
          </button>
        )}
        <button className="icon-action danger" onClick={() => remove.mutate()} aria-label="Delete" title="Delete">
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reservations & Messages
// ---------------------------------------------------------------------------
function ReservationsPage({ user }: { user?: User | null }) {
  const { data: rawReservations } = useGetReservations({ query: { enabled: !!user, queryKey: getGetReservationsQueryKey() } });
  const reservations = Array.isArray(rawReservations) ? rawReservations : [];
  const update = useUpdateReservation({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetReservationsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetProductsQueryKey() });
      },
    },
  });

  if (!user) return <AuthRequired title="Your reservations are private" copy="Log in to view and manage your reservations." />;

  return (
    <div className="content-page">
      <PageIntro
        eyebrow={user.userType === "Buyer" ? "Your buying activity" : "Producer activity"}
        title="Reservations"
        copy={user.userType === "Buyer" ? "Keep track of the products you’ve asked to reserve." : "See who is interested in your products and update reservation status."}
      />
      {reservations.length ? (
        <div className="reservation-list">
          {reservations.map((r) => (
            <div className="reservation-card" key={r.id}>
              <div className="reservation-icon"><Package size={21} /></div>
              <div className="reservation-main">
                <div className="product-topline">
                  <span>{user.userType === "Buyer" ? `From ${r.producerName}` : `Buyer: ${r.buyerName}`}</span>
                  <span className={`status status-${r.status.toLowerCase()}`}>{r.status}</span>
                </div>
                <h3>{r.productName}</h3>
                <p>{r.quantity} {r.unit} · {relativeDate(r.createdAt)}</p>
              </div>
              {user.userType !== "Buyer" && r.status === "Pending" && (
                <div className="reservation-actions">
                  <button className="button button-small button-primary" onClick={() => update.mutate({ id: r.id, data: { status: "Confirmed" } })}>
                    Confirm
                  </button>
                  <button className="button button-small button-outline" onClick={() => update.mutate({ id: r.id, data: { status: "Cancelled" } })}>
                    Decline
                  </button>
                </div>
              )}
              {user.userType === "Buyer" && (r.status === "Pending" || r.status === "Confirmed") && (
                <div className="reservation-actions">
                  <button className="button button-small button-outline" onClick={() => update.mutate({ id: r.id, data: { status: "Cancelled" } })}>
                    Cancel reservation
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No reservations yet"
          copy={user.userType === "Buyer" ? "Browse the marketplace when you’re ready to find something nearby." : "Reservations from buyers will appear here."}
          action={<Link href="/products" className="button button-primary">Browse products <ArrowRight size={16} /></Link>}
        />
      )}
    </div>
  );
}

function MessagesPage({ user }: { user?: User | null }) {
  const { data: rawMessages } = useGetMessages({ query: { enabled: !!user, queryKey: getGetMessagesQueryKey() } });
  const messages = Array.isArray(rawMessages) ? rawMessages : [];
  const markRead = useMarkMessageRead({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetMessagesQueryKey() }),
    },
  });

  if (!user) return <AuthRequired title="Your conversations are private" copy="Log in to see your messages." />;

  return (
    <div className="content-page">
      <PageIntro
        eyebrow="Stay connected"
        title="Messages"
        copy="Talk directly with producers and buyers about listings, pickup, and details."
      />
      {messages.length ? (
        <div className="messages-list">
          {messages.map((m) => (
            <div className={`message-card ${!m.isRead && m.receiverId === user.id ? "unread" : ""}`} key={m.id}>
              <span className="avatar avatar-large">{initials(m.senderId === user.id ? m.receiverName : m.senderName)}</span>
              <div>
                <div className="message-header">
                  <strong>{m.senderId === user.id ? `To ${m.receiverName}` : m.senderName}</strong>
                  <small>{relativeDate(m.createdAt)}</small>
                </div>
                <p>{m.message}</p>
                {m.productName && <span className="message-product"><Package size={13} /> {m.productName}</span>}
              </div>
              {!m.isRead && m.receiverId === user.id && (
                <button className="mark-read" onClick={() => markRead.mutate({ id: m.id })}>
                  Mark read
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="No messages yet" copy="When you ask about a listing, your conversation will show up here." />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activity page (notifications feed)
// ---------------------------------------------------------------------------
function ActivityPage({ user }: { user?: User | null }) {
  const [, navigate] = useLocation();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const { data: rawNotifications, isLoading, isFetching, refetch } = useNotifications(!!user);
  const { markRead, markAllRead, remove } = useNotificationActions();
  const notifications = Array.isArray(rawNotifications) ? rawNotifications : [];
  const unreadCount = notifications.filter((item) => !item.isRead).length;
  const visible = filter === "unread" ? notifications.filter((item) => !item.isRead) : notifications;

  if (!user) return <AuthRequired title="Sign in to see your activity" copy="Reservations, messages, and listing updates are collected here." />;

  const openItem = (notification: AppNotification) => {
    if (!notification.isRead) markRead.mutate(notification.id);
    navigate(notification.link || "/dashboard");
  };

  return (
    <div className="content-page">
      <PageIntro
        eyebrow="Your activity"
        title="Notifications"
        copy="Reservations, messages, listing changes, and admin updates in one place."
        action={
          <button
            className="button button-outline"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw size={15} className={isFetching ? "animate-spin" : ""} /> Refresh
          </button>
        }
      />

      <div className="activity-filter-bar activity-toolbar">
        <button className={`activity-filter-btn ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>
          All <span>{notifications.length}</span>
        </button>
        <button className={`activity-filter-btn ${filter === "unread" ? "active" : ""}`} onClick={() => setFilter("unread")}>
          Unread <span>{unreadCount}</span>
        </button>
        {unreadCount > 0 && (
          <button className="button button-small button-outline activity-mark-all" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending}>
            <CheckCircle2 size={14} /> Mark all read
          </button>
        )}
      </div>

      {isLoading ? (
        <LoadingState />
      ) : visible.length ? (
        <div className="activity-list">
          {visible.map((notification) => (
            <article key={notification.id} className={`activity-card ${notification.isRead ? "" : "unread"}`}>
              <span className={`activity-icon-badge activity-badge-${notification.type}`}>
                <NotificationIcon type={notification.type} />
              </span>
              <div className="activity-content">
                <div className="activity-title-row">
                  <strong>{notification.title}</strong>
                  <small>{relativeDate(notification.createdAt)}</small>
                </div>
                {notification.body && <p className="activity-details">{notification.body}</p>}
                <div className="feed-item-actions">
                  <button onClick={() => openItem(notification)}>
                    Open <ArrowRight size={13} />
                  </button>
                  {!notification.isRead && (
                    <button onClick={() => markRead.mutate(notification.id)}>Mark read</button>
                  )}
                  <button className="danger" onClick={() => remove.mutate(notification.id)}>
                    Dismiss
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title={filter === "unread" ? "No unread notifications" : "Nothing yet"}
          copy="New reservations, messages, and listing updates will appear here."
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Product Form Page with Image Upload Support (Requirement 4)
// ---------------------------------------------------------------------------
function ProductFormPage({ user, productId }: { user?: User | null; productId?: number }) {
  const editing = !!productId;
  const { data: existing, isLoading } = useGetProduct(productId ?? 0, {
    query: { enabled: editing, queryKey: getGetProductQueryKey(productId ?? 0) },
  });
  const initializedProductId = useRef<number | null>(null);
  const [form, setForm] = useState<ProductInput>({
    name: "",
    category: "Vegetables",
    description: "",
    price: 0,
    quantity: 1,
    unit: "kilogram",
    location: user?.location || "Calbayog City, Samar",
    availabilityDate: new Date().toISOString().slice(0, 10),
    isRescue: false,
    image: "",
    images: [],
  });

  useEffect(() => {
    if (!existing || initializedProductId.current === existing.id) return;
    initializedProductId.current = existing.id;
    const gallery = existing.images?.length
      ? existing.images
      : existing.image
        ? [existing.image]
        : [];
    setForm({
      name: existing.name,
      category: existing.category,
      description: existing.description ?? "",
      price: existing.price,
      quantity: existing.quantity,
      unit: existing.unit,
      location: existing.location,
      image: gallery[0] ?? "",
      images: gallery,
      availabilityDate: existing.availabilityDate ?? "",
      isRescue: existing.isRescue,
    });
  }, [existing]);

  const update = useUpdateProduct({
    mutation: {
      onSuccess: (p) => {
        queryClient.invalidateQueries({ queryKey: getGetProductsQueryKey() });
        window.location.href = `/products/${p.id}`;
      },
    },
  });

  const create = useCreateProduct({
    mutation: {
      onSuccess: (p) => {
        queryClient.invalidateQueries({ queryKey: getGetProductsQueryKey() });
        window.location.href = `/products/${p.id}`;
      },
    },
  });

  const setField = <K extends keyof ProductInput>(key: K, value: ProductInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  if (!user) return <AuthRequired title="Sign in to list your surplus" copy="Producer accounts can share fresh local products with nearby buyers." />;
  if (editing && isLoading) return <LoadingState />;
  if (editing && !existing) return <NotFoundPage />;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (editing && !existing) return;
    const gallery = (form.images ?? []).filter(Boolean);
    const data = {
      ...form,
      image: gallery[0] ?? "",
      images: gallery,
      price: Number(form.price),
      quantity: Number(form.quantity),
    };
    if (editing) update.mutate({ id: productId!, data });
    else create.mutate({ data });
  };

  return (
    <div className="form-page">
      <Link href={editing ? `/products/${productId}` : "/my-products"} className="back-link">
        <ChevronLeft size={16} /> {editing ? "Back to listing" : "Back to my products"}
      </Link>
      <div className="form-heading">
        <span className="eyebrow">{editing ? "Update listing" : "Share your harvest"}</span>
        <h1>{editing ? "Edit product" : "Add a product"}</h1>
        <p>{editing ? "Keep the details accurate so buyers can make confident choices." : "Tell nearby buyers what you have available."}</p>
      </div>

      <form className="product-form" onSubmit={submit}>
        <div className="form-section">
          <h2>Listing details</h2>
          <div className="form-grid">
            <Field label="Product name" required>
              <input required value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="e.g. Fresh tomatoes" />
            </Field>
            <Field label="Category" required>
              <select value={form.category} onChange={(e) => setField("category", e.target.value)}>
                {categories.slice(1).map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Description" wide>
              <textarea value={form.description ?? ""} onChange={(e) => setField("description", e.target.value)} placeholder="What should buyers know about this product?" rows={4} />
            </Field>
          </div>
        </div>

        {/* Product Photo Gallery (Requirement 4) */}
        <div className="form-section">
          <h2>Product photos</h2>
          <p style={{ margin: "0 0 16px", fontSize: "12px", color: "var(--ink-soft)" }}>
            Add up to six authentic photos of your produce. Listings with photos receive up to 3x more reservations.
          </p>
          <ImageUploader
            value={form.images ?? []}
            onChange={(urls) => {
              setForm((current) => ({ ...current, images: urls, image: urls[0] ?? "" }));
            }}
          />
        </div>

        <div className="form-section">
          <h2>Availability & Location</h2>
          <div className="form-grid">
            <Field label="Price (₱)" required>
              <input required min="0" type="number" value={form.price} onChange={(e) => setField("price", Number(e.target.value))} />
            </Field>
            <Field label="Quantity" required>
              <input required min="0.01" step="0.01" type="number" value={form.quantity} onChange={(e) => setField("quantity", Number(e.target.value))} />
            </Field>
            <Field label="Unit" required>
              <select value={form.unit} onChange={(e) => setField("unit", e.target.value)}>
                {units.map((u) => <option key={u}>{u}</option>)}
              </select>
            </Field>
            <Field label="Location" required>
              <input required value={form.location} onChange={(e) => setField("location", e.target.value)} />
            </Field>
            <Field label="Available from">
              <input type="date" value={form.availabilityDate ?? ""} onChange={(e) => setField("availabilityDate", e.target.value)} />
            </Field>
          </div>

          <label className="rescue-check">
            <input type="checkbox" checked={form.isRescue ?? false} onChange={(e) => setField("isRescue", e.target.checked)} />
            <span className="check-box">{form.isRescue && <Check size={13} />}</span>
            <span>
              <strong>Mark as Rescue Listing</strong>
              <small>Highlight this product for buyers who want to act quickly to prevent food waste.</small>
            </span>
          </label>
        </div>

        <div className="form-foot">
          <p><ShieldCheck size={15} /> Be accurate about your quantity and location. Buyers and sellers arrange payment and pickup directly.</p>
          <button className="button button-primary" disabled={create.isPending || update.isPending}>
            {editing ? "Save changes" : "Publish listing"} <ArrowRight size={16} />
          </button>
        </div>
        {(create.isError || update.isError) && <p className="form-error">{errorMessage(create.error || update.error)}</p>}
      </form>
    </div>
  );
}

function Field({ label, required, wide, children }: { label: string; required?: boolean; wide?: boolean; children: ReactNode }) {
  return (
    <label className={`field ${wide ? "field-wide" : ""}`}>
      <span>{label}{required && <b> *</b>}</span>
      {children}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------
function ProfilePage({ user }: { user?: User | null }) {
  const update = useUpdateProfile({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() }),
    },
  });

  if (!user) return <AuthRequired title="Your profile is private" copy="Log in to update your profile." />;

  return (
    <div className="profile-page">
      <div className="profile-header">
        <span className="avatar avatar-profile">{initials(user.fullName)}</span>
        <div>
          <span className="eyebrow">{user.userType} account</span>
          <h1>{user.fullName}</h1>
          <p>Member since {new Date(user.createdAt).toLocaleDateString("en-PH", { month: "long", year: "numeric" })}</p>
        </div>
      </div>
      <form
        className="profile-form"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          update.mutate({
            data: {
              fullName: String(f.get("fullName")),
              phone: String(f.get("phone")),
              location: String(f.get("location")),
              bio: String(f.get("bio")),
            },
          });
        }}
      >
        <Field label="Full name"><input name="fullName" defaultValue={user.fullName} /></Field>
        <Field label="Phone number"><input name="phone" defaultValue={user.phone ?? ""} /></Field>
        <Field label="Location"><input name="location" defaultValue={user.location ?? ""} /></Field>
        <Field label="About you" wide><textarea name="bio" defaultValue={user.bio ?? ""} rows={4} /></Field>
        <div className="form-foot">
          <span>{update.isSuccess && <span className="success-message"><Check size={15} /> Profile saved</span>}</span>
          <button className="button button-primary" disabled={update.isPending}>
            Save profile <ArrowRight size={16} />
          </button>
        </div>
      </form>
    </div>
  );
}

function PublicProfilePage({ id }: { id: number }) {
  const { data: profile } = useGetProfile(id);
  if (!profile) return <LoadingState />;
  return (
    <div className="profile-page">
      <Link href="/products" className="back-link"><ChevronLeft size={16} /> Back to marketplace</Link>
      <div className="profile-header">
        <span className="avatar avatar-profile">{initials(profile.fullName)}</span>
        <div>
          <span className="eyebrow">{profile.userType} · {profile.location}</span>
          <h1>{profile.fullName}</h1>
          <p>{profile.bio || "A local producer in the Samar food community."}</p>
        </div>
      </div>
      <SectionHeading eyebrow="Available from this producer" title="Current listings" />
      {profile.products.length ? (
        <div className="product-grid">{profile.products.map((p) => <ProductCard key={p.id} product={p} />)}</div>
      ) : (
        <EmptyState title="No active listings" copy="This producer doesn't have any listings available right now." />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Administrator Dashboard (Requirements 5, 6, 7 & 8)
// ---------------------------------------------------------------------------
function AdminPage({
  section,
  user,
}: {
  section: "summary" | "users" | "products" | "reports" | "database" | "activities";
  user?: User | null;
}) {
  if (!user) return <AdminAccessGate />;
  if (user.userType !== "Administrator") {
    return (
      <AuthRequired
        title="Administrator access only"
        copy="This area is reserved for platform administrators. Backend role-based authorization prevents unauthorized access."
      />
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-sidebar">
        <span className="eyebrow">Platform control</span>
        <h1>Admin desk</h1>
        <p>Manage users, content, database, and system health.</p>
        <nav>
          <Link className={section === "summary" ? "active" : ""} href="/admin">
            <TrendingUp size={16} /> Overview
          </Link>
          <Link className={section === "users" ? "active" : ""} href="/admin/users">
            <Users size={16} /> Users
          </Link>
          <Link className={section === "products" ? "active" : ""} href="/admin/products">
            <Package size={16} /> Listings
          </Link>
          <Link className={section === "reports" ? "active" : ""} href="/admin/reports">
            <CircleAlert size={16} /> Reports
          </Link>
          <Link className={section === "database" ? "active" : ""} href="/admin/database">
            <Database size={16} /> Database
          </Link>
          <Link className={section === "activities" ? "active" : ""} href="/admin/activities">
            <History size={16} /> Audit Logs
          </Link>
        </nav>
      </div>

      {section === "summary" ? (
        <AdminSummaryPanel />
      ) : section === "users" ? (
        <AdminUsersPanel />
      ) : section === "products" ? (
        <AdminProductsPanel />
      ) : section === "reports" ? (
        <AdminReportsPanel />
      ) : section === "database" ? (
        <AdminDatabaseViewer />
      ) : (
        <AdminActivitiesPanel />
      )}
    </div>
  );
}

function AdminAccessGate() {
  return (
    <div className="empty-page">
      <div className="empty-icon"><ShieldCheck /></div>
      <span className="eyebrow">Administrator Access</span>
      <h1>Sign in to the Admin Desk</h1>
      <p>Open this page directly at <strong>/admin</strong> or log in with an administrator account. Role-based access control is enforced on all APIs.</p>
      <Link href="/login" className="button button-primary">
        Administrator sign in <ArrowRight size={16} />
      </Link>
    </div>
  );
}

function AdminSummaryPanel() {
  const { data, isLoading } = useGetAdminSummary();
  if (isLoading || !data) return <LoadingState />;

  const metricItems: [keyof AdminSummary | string, string, ReactNode, string][] = [
    ["totalUsers", "Total users", <Users />, "green"],
    ["totalAdministrators", "Administrators", <ShieldCheck />, "blue"],
    ["farmers", "Farmers", <Sprout />, "green"],
    ["fisherfolk", "Fisherfolk", <Fish />, "blue"],
    ["buyers", "Buyers", <ShoppingBasket />, "yellow"],
    ["totalProducts", "Total products", <Package />, "green"],
    ["availableProducts", "Available", <Check />, "green"],
    ["reservedProducts", "Reserved", <Clock3 />, "yellow"],
    ["soldProducts", "Sold", <CheckCircle2 />, "blue"],
    ["rescueListings", "Rescue listings", <CircleAlert />, "yellow"],
    ["totalReservations", "Reservations", <HeartHandshake />, "green"],
    ["openReports", "Open reports", <AlertTriangle />, "yellow"],
  ];

  return (
    <div className="admin-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">System activity & statistics</span>
          <h2>Marketplace Overview</h2>
        </div>
      </div>

      <div className="admin-metrics" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {metricItems.map(([key, label, icon, tone]) => (
          <MetricCard
            key={key}
            label={label}
            value={Number((data as any)[key] ?? 0)}
            icon={icon}
            tone={tone}
          />
        ))}
      </div>

      {/* Recent Activities Section */}
      <div style={{ marginTop: 35 }}>
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Audit trail</span>
            <h2>Recent Platform Activity</h2>
          </div>
          <Link href="/admin/activities" className="text-link">
            View full log <ArrowRight size={15} />
          </Link>
        </div>
        <AdminActivitiesPanel limit={5} compact />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Admin User Management Panel (Requirement 5)
// ---------------------------------------------------------------------------
function AdminUsersPanel() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("all");
  const [inspectUser, setInspectUser] = useState<any | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<User | null>(null);

  const { data: rawUsers, isLoading, refetch } = useQuery({
    queryKey: ["adminUsers", search, roleFilter, statusFilter],
    queryFn: async () => {
      const q = new URLSearchParams();
      if (search) q.set("search", search);
      if (roleFilter !== "All") q.set("role", roleFilter);
      if (statusFilter !== "all") q.set("status", statusFilter);
      const res = await fetch(`/api/admin/users?${q.toString()}`);
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json) ? (json as User[]) : [];
    },
  });
  const users = Array.isArray(rawUsers) ? rawUsers : [];

  const update = useUpdateAdminUser({
    mutation: {
      onSuccess: () => {
        refetch();
        queryClient.invalidateQueries({ queryKey: getGetAdminSummaryQueryKey() });
      },
    },
  });

  return (
    <div className="admin-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Account Management</span>
          <h2>User Accounts ({users.length})</h2>
        </div>
        <button className="button button-primary button-small" onClick={() => setAddModalOpen(true)}>
          <UserPlus size={15} /> Add user
        </button>
      </div>

      <div className="marketplace-toolbar" style={{ gridTemplateColumns: "1.5fr 1fr 1fr", marginBottom: 18 }}>
        <div className="search-box">
          <Search size={17} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, username, email, or location"
          />
        </div>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="All">All Roles</option>
          <option value="Farmer">Farmers</option>
          <option value="Fisherfolk">Fisherfolk</option>
          <option value="Buyer">Buyers</option>
          <option value="Administrator">Administrators</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Statuses</option>
          <option value="active">Active Only</option>
          <option value="disabled">Disabled Only</option>
        </select>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : users.length ? (
        <div className="admin-table">
          {users.map((u) => (
            <div className="admin-row" key={u.id}>
              <span className="avatar avatar-small">{initials(u.fullName)}</span>
              <div>
                <strong>{u.fullName}</strong>
                <small>@{u.username} · {u.email} · {u.location || "Samar"}</small>
              </div>
              <span className={`status status-${u.userType.toLowerCase()}`} style={{ marginRight: 8 }}>
                {u.userType}
              </span>
              <span className={`status status-${u.isActive ? "available" : "sold"}`}>
                {u.isActive ? "Active" : "Disabled"}
              </span>
              <div style={{ display: "flex", gap: 6, marginLeft: 12 }}>
                <button
                  className="button button-small button-outline"
                  onClick={() => setInspectUser(u)}
                  title="Inspect user details"
                >
                  Details
                </button>
                <button
                  className="button button-small button-outline"
                  onClick={() => update.mutate({ id: u.id, data: { isActive: !u.isActive } })}
                  title={u.isActive ? "Deactivate user" : "Activate user"}
                >
                  {u.isActive ? "Disable" : "Enable"}
                </button>
                <button
                  className="icon-action danger"
                  onClick={() => setConfirmDelete(u)}
                  title="Delete user"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="No users found" copy="Try adjusting your search or filters." />
      )}

      {/* Inspect User Modal */}
      {inspectUser && (
        <Dialog title="User Profile" onClose={() => setInspectUser(null)}>
          <div className="record-inspector">
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
              <span className="avatar avatar-large">{initials(inspectUser.fullName)}</span>
              <div>
                <strong style={{ fontSize: 16 }}>{inspectUser.fullName}</strong>
                <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>@{inspectUser.username}</div>
                <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                  <span className={`status status-${inspectUser.userType.toLowerCase()}`}>{inspectUser.userType}</span>
                  <span className={`status status-${inspectUser.isActive ? "available" : "sold"}`}>{inspectUser.isActive ? "Active" : "Disabled"}</span>
                </div>
              </div>
            </div>

            <div className="record-fields-list">
              <div className="record-field-item">
                <span className="record-field-name">Email</span>
                <span className="record-field-content">{inspectUser.email}</span>
              </div>
              <div className="record-field-item">
                <span className="record-field-name">Phone</span>
                <span className="record-field-content">{inspectUser.phone || "None provided"}</span>
              </div>
              <div className="record-field-item">
                <span className="record-field-name">Location</span>
                <span className="record-field-content">{inspectUser.location || "Samar, Philippines"}</span>
              </div>
              <div className="record-field-item">
                <span className="record-field-name">Bio</span>
                <span className="record-field-content">{inspectUser.bio || "No bio added"}</span>
              </div>
              <div className="record-field-item">
                <span className="record-field-name">Auth Provider</span>
                <span className="record-field-content">{inspectUser.googleId ? "Google OAuth" : "Email & Password"}</span>
              </div>
              <div className="record-field-item">
                <span className="record-field-name">Joined</span>
                <span className="record-field-content">{new Date(inspectUser.createdAt).toLocaleString()}</span>
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, display: "block", marginBottom: 6 }}>Change Role:</label>
              <div style={{ display: "flex", gap: 8 }}>
                {["Farmer", "Fisherfolk", "Buyer", "Administrator"].map((role) => (
                  <button
                    key={role}
                    type="button"
                    className={`button button-small ${inspectUser.userType === role ? "button-primary" : "button-outline"}`}
                    onClick={async () => {
                      await fetch(`/api/admin/users/${inspectUser.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ userType: role }),
                      });
                      refetch();
                      setInspectUser({ ...inspectUser, userType: role });
                    }}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Dialog>
      )}

      {/* Add User Modal */}
      {addModalOpen && (
        <AdminAddUserDialog onClose={() => setAddModalOpen(false)} onCreated={refetch} />
      )}

      {/* Confirm Delete User Dialog */}
      {confirmDelete && (
        <Dialog title="Delete User Account" onClose={() => setConfirmDelete(null)}>
          <div className="confirm-dialog">
            <p className="confirm-dialog-copy">
              Are you sure you want to permanently delete <strong>{confirmDelete.fullName}</strong> (@{confirmDelete.username})? This will remove all their associated listings and records.
            </p>
            <div className="confirm-dialog-actions">
              <button className="button button-outline" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button
                className="button button-danger"
                onClick={async () => {
                  await fetch(`/api/admin/users/${confirmDelete.id}`, { method: "DELETE" });
                  refetch();
                  setConfirmDelete(null);
                }}
              >
                Delete account
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function AdminAddUserDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userType, setUserType] = useState("Farmer");
  const [location, setLocation] = useState("Calbayog City, Samar");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, username, email, password, userType, location, phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create user.");
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to create user.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog title="Create User Account" onClose={onClose}>
      <form onSubmit={submit}>
        <div style={{ display: "grid", gap: 12 }}>
          <Field label="Full name" required>
            <input required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" />
          </Field>
          <Field label="Username" required>
            <input required value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" />
          </Field>
          <Field label="Email address" required>
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" />
          </Field>
          <Field label="Password" required>
            <PasswordInput name="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </Field>
          <Field label="Role" required>
            <select value={userType} onChange={(e) => setUserType(e.target.value)}>
              <option value="Farmer">Farmer</option>
              <option value="Fisherfolk">Fisherfolk</option>
              <option value="Buyer">Buyer</option>
              <option value="Administrator">Administrator</option>
            </select>
          </Field>
          <Field label="Location">
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Samar municipality" />
          </Field>
        </div>
        {error && <p className="form-error">{error}</p>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
          <button type="button" className="button button-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="button button-primary" disabled={loading}>
            {loading ? "Creating…" : "Create User"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Admin Product Management Panel (Requirement 5)
// ---------------------------------------------------------------------------
function AdminProductsPanel() {
  const [search, setSearch] = useState("");
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Product | null>(null);

  const { data: rawProducts, isLoading, refetch } = useQuery({
    queryKey: ["adminProductsList", search],
    queryFn: async () => {
      const q = search ? `?search=${encodeURIComponent(search)}` : "";
      const res = await fetch(`/api/admin/products${q}`);
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json) ? (json as Product[]) : [];
    },
  });
  const products = Array.isArray(rawProducts) ? rawProducts : [];

  return (
    <div className="admin-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Content Moderation & Inventory</span>
          <h2>All Listings ({products.length})</h2>
        </div>
        <button className="button button-primary button-small" onClick={() => setAddModalOpen(true)}>
          <Plus size={15} /> Add product
        </button>
      </div>

      <div className="search-box compact">
        <Search size={17} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search listings by title, producer, location"
        />
      </div>

      {isLoading ? (
        <LoadingState />
      ) : products.length ? (
        <div className="admin-table">
          {products.map((p) => {
            const hasImage = Boolean(p.image && p.image.trim());
            return (
              <div className="admin-row" key={p.id}>
                <span className="mini-product-icon">
                  {hasImage ? (
                    <img src={p.image!} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }} />
                  ) : (
                    <ProductIllustration category={p.category} />
                  )}
                </span>
                <div>
                  <strong>{p.name}</strong>
                  <small>{p.producerName} · {p.location} · ₱{p.price}/{p.unit} · {p.quantity} {p.unit} left</small>
                </div>
                {p.isRescue && (
                  <span className="rescue-badge" style={{ position: "static", padding: "4px 8px" }}>
                    <CircleAlert size={11} /> Rescue
                  </span>
                )}
                <span className={`status status-${p.status.toLowerCase()}`}>{p.status}</span>
                <div style={{ display: "flex", gap: 6, marginLeft: 10 }}>
                  <button
                    className="icon-action"
                    onClick={() => setEditProduct(p)}
                    title="Edit listing"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    className="icon-action danger"
                    onClick={() => setConfirmDelete(p)}
                    title="Delete listing"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState title="No products found" copy="Try a different search term or add a new listing." />
      )}

      {/* Edit Product Modal */}
      {editProduct && (
        <AdminProductModal
          product={editProduct}
          onClose={() => setEditProduct(null)}
          onSaved={() => {
            refetch();
            setEditProduct(null);
          }}
        />
      )}

      {/* Add Product Modal */}
      {addModalOpen && (
        <AdminProductModal
          onClose={() => setAddModalOpen(false)}
          onSaved={() => {
            refetch();
            setAddModalOpen(false);
          }}
        />
      )}

      {/* Confirm Delete Product Dialog */}
      {confirmDelete && (
        <Dialog title="Delete Product Listing" onClose={() => setConfirmDelete(null)}>
          <div className="confirm-dialog">
            <p className="confirm-dialog-copy">
              Are you sure you want to delete <strong>{confirmDelete.name}</strong>? This action will remove the listing from the marketplace.
            </p>
            <div className="confirm-dialog-actions">
              <button className="button button-outline" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button
                className="button button-danger"
                onClick={async () => {
                  await fetch(`/api/admin/products/${confirmDelete.id}`, { method: "DELETE" });
                  refetch();
                  setConfirmDelete(null);
                }}
              >
                Delete listing
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function AdminProductModal({
  product,
  onClose,
  onSaved,
}: {
  product?: Product;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEditing = Boolean(product);
  const [name, setName] = useState(product?.name || "");
  const [category, setCategory] = useState(product?.category || "Vegetables");
  const [description, setDescription] = useState(product?.description || "");
  const [price, setPrice] = useState(product ? String(product.price) : "100");
  const [quantity, setQuantity] = useState(product ? String(product.quantity) : "10");
  const [unit, setUnit] = useState(product?.unit || "kilogram");
  const [location, setLocation] = useState(product?.location || "Catbalogan City, Samar");
  const [images, setImages] = useState<string[]>(
    product?.images?.length ? product.images : product?.image ? [product.image] : [],
  );
  const [status, setStatus] = useState(product?.status || "Available");
  const [isRescue, setIsRescue] = useState(product?.isRescue || false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const payload = {
        name,
        category,
        description,
        price: Number(price),
        quantity: Number(quantity),
        unit,
        location,
        image: images[0] ?? "",
        images,
        status,
        isRescue,
      };

      const url = isEditing ? `/api/admin/products/${product!.id}` : "/api/admin/products";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to save product.");
      }

      onSaved();
    } catch (err: any) {
      setError(err.message || "Failed to save product.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog title={isEditing ? "Edit Product Listing" : "Add Product Listing"} onClose={onClose}>
      <form onSubmit={submit}>
        <div style={{ display: "grid", gap: 12, maxHeight: "70vh", overflowY: "auto", paddingRight: 4 }}>
          <Field label="Product Name" required>
            <input required value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Category" required>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.slice(1).map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Product Photos">
            <ImageUploader value={images} onChange={setImages} />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Price (₱)" required>
              <input required type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} />
            </Field>
            <Field label="Quantity" required>
              <input required type="number" min="0.01" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </Field>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Unit" required>
              <select value={unit} onChange={(e) => setUnit(e.target.value)}>
                {units.map((u) => <option key={u}>{u}</option>)}
              </select>
            </Field>
            <Field label="Status" required>
              <select value={status} onChange={(e) => setStatus(e.target.value as "Available" | "Reserved" | "Sold")}>
                <option value="Available">Available</option>
                <option value="Reserved">Reserved</option>
                <option value="Sold">Sold</option>
              </select>
            </Field>
          </div>
          <Field label="Location" required>
            <input required value={location} onChange={(e) => setLocation(e.target.value)} />
          </Field>
          <Field label="Description">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </Field>
          <label className="rescue-check">
            <input type="checkbox" checked={isRescue} onChange={(e) => setIsRescue(e.target.checked)} />
            <span className="check-box">{isRescue && <Check size={13} />}</span>
            <span>
              <strong>Mark as Rescue Listing</strong>
              <small>Time-sensitive surplus requiring rapid pickup.</small>
            </span>
          </label>
        </div>
        {error && <p className="form-error">{error}</p>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
          <button type="button" className="button button-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="button button-primary" disabled={loading}>
            {loading ? "Saving…" : isEditing ? "Save changes" : "Create listing"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Admin Reports Panel
// ---------------------------------------------------------------------------
function AdminReportsPanel() {
  const { data: rawReports, refetch } = useGetAdminReports();
  const reports = Array.isArray(rawReports) ? rawReports : [];
  const update = useUpdateAdminReport({
    mutation: {
      onSuccess: () => {
        refetch();
        queryClient.invalidateQueries({ queryKey: getGetAdminSummaryQueryKey() });
      },
    },
  });

  return (
    <div className="admin-panel">
      <PanelTitle eyebrow="Keep it trustworthy" title="Moderation Reports" />
      {reports.length ? (
        <div className="report-list">
          {reports.map((r) => (
            <div className="report-card" key={r.id}>
              <div>
                <span className={`status status-${r.status.toLowerCase()}`}>{r.status}</span>
                <h3>{r.productName}</h3>
                <p>{r.reason}</p>
                {r.description && <small style={{ display: "block", marginTop: 4, fontStyle: "italic" }}>"{r.description}"</small>}
                <small>Reported by {r.reporterName} · {relativeDate(r.createdAt)}</small>
              </div>
              {r.status === "Open" && (
                <button
                  className="button button-small button-primary"
                  onClick={() => update.mutate({ id: r.id, data: { status: "Resolved" } })}
                >
                  <Check size={14} /> Resolve
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="No active reports" copy="The community listings are verified and healthy." />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Direct Database Management / Database Viewer (Requirement 6)
// ---------------------------------------------------------------------------
function compactDbValue(val: string | null | undefined) {
  if (val == null) return val;
  if (val.length <= 400) return val;
  return `${val.slice(0, 240)}… [truncated, ${(val.length / 1024).toFixed(1)} KB]`;
}

function AdminDatabaseViewer() {
  const [selectedTable, setSelectedTable] = useState("agri_users");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [inspectRecord, setInspectRecord] = useState<any | null>(null);

  // Fetch list of tables with row counts and column info
  const { data: rawTables, isLoading: loadingTables, refetch: refetchTables } = useQuery({
    queryKey: ["adminDbTables"],
    queryFn: async () => {
      const res = await fetch("/api/admin/database/tables");
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json) ? json : [];
    },
  });
  const tables = Array.isArray(rawTables) ? rawTables : [];

  // Fetch paginated, sanitized rows for selected table
  const { data: tableData, isLoading: loadingRows, refetch: refetchRows } = useQuery({
    queryKey: ["adminDbTableData", selectedTable, page, search],
    queryFn: async () => {
      const q = new URLSearchParams({
        page: String(page),
        limit: "15",
      });
      if (search) q.set("search", search);
      const res = await fetch(`/api/admin/database/${selectedTable}?${q.toString()}`);
      return res.json() as Promise<{
        table: string;
        displayName: string;
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        columns: string[];
        rows: any[];
      }>;
    },
  });

  const currentTableMeta = tables.find((t) => t.id === selectedTable);

  return (
    <div className="admin-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Direct Database Management</span>
          <h2>Database Viewer</h2>
        </div>
        <button
          className="button button-small button-outline"
          onClick={() => {
            refetchTables();
            refetchRows();
          }}
          title="Refresh database records"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Security Assurance Banner (Requirement 6 & 7) */}
      <div className="security-badge-banner">
        <ShieldCheck size={18} />
        <div>
          <strong>Server-Enforced Authorization:</strong> Only verified administrators can access database records. Sensitive credentials such as <code>password_hash</code> and session tokens are strictly redacted before transmission.
        </div>
      </div>

      {/* Table Selector Tabs */}
      <div className="db-tables-nav">
        {tables.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`db-table-pill ${selectedTable === t.id ? "active" : ""}`}
            onClick={() => {
              setSelectedTable(t.id);
              setPage(1);
              setSearch("");
            }}
          >
            <Database size={13} />
            <span>{t.id}</span>
            <span className="db-pill-count">{t.rowCount}</span>
          </button>
        ))}
      </div>

      {/* Toolbar & Search */}
      <div className="db-viewer-toolbar">
        <div>
          <strong style={{ fontSize: 14 }}>{currentTableMeta?.name || selectedTable}</strong>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--ink-soft)" }}>
            {currentTableMeta?.description || "PostgreSQL application table"}
          </p>
        </div>

        <div className="search-box compact" style={{ margin: 0 }}>
          <Search size={16} />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={`Search ${selectedTable} records…`}
          />
        </div>
      </div>

      {/* Database Records Table */}
      {loadingRows ? (
        <LoadingState />
      ) : tableData && tableData.rows.length ? (
        <>
          <div className="db-table-scroll">
            <table className="db-raw-table">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>Action</th>
                  {tableData.columns.map((col) => (
                    <th key={col}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableData.rows.map((row, idx) => (
                  <tr key={row.id ?? idx}>
                    <td>
                      <button
                        className="button button-small button-outline"
                        style={{ padding: "4px 8px", fontSize: 10 }}
                        onClick={() => setInspectRecord(row)}
                        title="Inspect full record details"
                      >
                        Inspect
                      </button>
                    </td>
                    {tableData.columns.map((col) => {
                      const val = row[col];
                      return (
                        <td key={col}>
                          {col === "id" ? (
                            <span className="db-id-val">#{val}</span>
                          ) : col === "passwordHash" ? (
                            <span className="db-redacted-val">[REDACTED]</span>
                          ) : /(At|Date)$/.test(col) ? (
                            <span className="db-date-val">{val ? new Date(val).toLocaleDateString() : "—"}</span>
                          ) : typeof val === "boolean" ? (
                            <span className={`status status-${val ? "available" : "sold"}`}>{val ? "TRUE" : "FALSE"}</span>
                          ) : col === "price" ? (
                            <strong>₱{Number(val).toLocaleString()}</strong>
                          ) : val === null || val === undefined ? (
                            <span style={{ color: "var(--ink-soft)", fontStyle: "italic" }}>null</span>
                          ) : Array.isArray(val) ? (
                            <span className="db-id-val">[{val.length} item{val.length === 1 ? "" : "s"}]</span>
                          ) : (
                            compactDbValue(String(val))
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="db-pagination-bar">
            <span>
              Showing {((page - 1) * tableData.limit) + 1}–{Math.min(page * tableData.limit, tableData.total)} of {tableData.total} records
            </span>
            <div className="db-pagination-btns">
              <button
                className="button button-small button-outline"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft size={14} /> Previous
              </button>
              <span style={{ fontWeight: 600 }}>
                Page {page} of {tableData.totalPages}
              </span>
              <button
                className="button button-small button-outline"
                disabled={page >= tableData.totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </>
      ) : (
        <EmptyState
          title="No records found"
          copy={search ? "No records match that search query." : "This table does not contain any records yet."}
        />
      )}

      {/* Record Inspector Modal */}
      {inspectRecord && (
        <Dialog title={`Record Detail: ${selectedTable} #${inspectRecord.id ?? ""}`} onClose={() => setInspectRecord(null)}>
          <div className="record-inspector">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="eyebrow">Database Row</span>
              <span className="db-id-val">Table: {selectedTable}</span>
            </div>

            <div className="record-fields-list">
              {Object.entries(inspectRecord).map(([key, val]) => (
                <div className="record-field-item" key={key}>
                  <span className="record-field-name">{key}</span>
                  <span className="record-field-content">
                    {key === "passwordHash" ? (
                      <span className="db-redacted-val">[REDACTED_PASSWORD_HASH]</span>
                    ) : val === null || val === undefined ? (
                      <span style={{ color: "var(--ink-soft)", fontStyle: "italic" }}>null</span>
                    ) : typeof val === "object" ? (
                      JSON.stringify(val).length > 400
                        ? `[${Array.isArray(val) ? val.length + " items" : "object"} · ${(JSON.stringify(val).length / 1024).toFixed(1)} KB]`
                        : JSON.stringify(val)
                    ) : (
                      compactDbValue(String(val))
                    )}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 10 }}>
              <span className="eyebrow" style={{ marginBottom: 6 }}>Raw JSON Object</span>
              <pre className="record-json-block">
                {JSON.stringify(
                  inspectRecord,
                  (_key, value) =>
                    typeof value === "string" && value.length > 400
                      ? `${value.slice(0, 120)}… [truncated, ${(value.length / 1024).toFixed(1)} KB]`
                      : value,
                  2
                )}
              </pre>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// System Audit Logs / Activities Panel
// ---------------------------------------------------------------------------
function AdminActivitiesPanel({ limit, compact = false }: { limit?: number; compact?: boolean }) {
  const { data: rawActivities, isLoading, refetch } = useQuery({
    queryKey: ["adminActivities"],
    queryFn: async () => {
      const res = await fetch("/api/admin/activities");
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json) ? json : [];
    },
  });
  const activities = Array.isArray(rawActivities) ? rawActivities : [];

  const displayed = limit ? activities.slice(0, limit) : activities;

  if (isLoading) return <LoadingState />;

  return (
    <div className={compact ? "" : "admin-panel"}>
      {!compact && (
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Audit Trail</span>
            <h2>Platform Activity Log ({activities.length})</h2>
          </div>
          <button className="button button-small button-outline" onClick={() => refetch()}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      )}

      {displayed.length ? (
        <div className="activity-list">
          {displayed.map((a) => (
            <div className="activity-card" key={a.id}>
              <div className={`activity-icon-badge activity-badge-${a.type.toLowerCase()}`}>
                {a.type === "auth" ? (
                  <KeyRound size={17} />
                ) : a.type === "admin" ? (
                  <ShieldCheck size={17} />
                ) : a.type === "product" ? (
                  <Package size={17} />
                ) : a.type === "upload" ? (
                  <ImageIcon size={17} />
                ) : (
                  <Activity size={17} />
                )}
              </div>
              <div className="activity-content">
                <div className="activity-title-row">
                  <strong>{a.action}</strong>
                  <small>{relativeDate(a.createdAt)}</small>
                </div>
                {a.details && <p className="activity-details">{a.details}</p>}
                <div style={{ display: "flex", gap: 10, marginTop: 4, fontSize: 10, color: "var(--ink-soft)" }}>
                  <span>Actor: <strong>{a.userName}</strong> ({a.userType})</span>
                  <span>·</span>
                  <span>{new Date(a.createdAt).toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="No activities logged yet" copy="Audit events will appear here as users and admins interact with the platform." />
      )}
    </div>
  );
}

function PanelTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="panel-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Login Page with Password Toggle & Google Auth (Requirements 1 & 2)
// ---------------------------------------------------------------------------
function LoginPage() {
  const [, navigate] = useLocation();
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [password, setPassword] = useState("");

  const login = useLogin({
    mutation: {
      onSuccess: (data) => {
        queryClient.setQueryData(getGetCurrentUserQueryKey(), data);
        navigate(data.user?.userType === "Administrator" ? "/admin" : "/dashboard");
      },
    },
  });

  return (
    <AuthLayout eyebrow="Welcome back" title="Good to see you again.">
      {/* Google Sign-In Button */}
      <GoogleAuthButton mode="login" />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          login.mutate({
            data: {
              username: String(f.get("username")),
              password,
            },
          });
        }}
      >
        <Field label="Username or Email" required>
          <input name="username" required autoComplete="username" placeholder="your username" />
        </Field>

        <Field label="Password" required>
          <PasswordInput
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            required
            autoComplete="current-password"
          />
        </Field>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={() => setForgotPasswordOpen(true)}
            style={{
              background: "none",
              border: 0,
              padding: 0,
              fontSize: 11,
              color: "var(--leaf)",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Forgot password?
          </button>
        </div>

        {login.isError && <p className="form-error">{errorMessage(login.error, "We couldn't sign you in.")}</p>}

        <button className="button button-primary button-grow" disabled={login.isPending}>
          Log in <ArrowRight size={17} />
        </button>

        <p className="form-hint">
          Demo producer: <b>juanfarmer</b> / demo123 · Demo buyer: <b>mayabuyer</b> / demo123 · Demo admin: <b>admin</b> / admin123
        </p>
      </form>

      {forgotPasswordOpen && <ForgotPasswordDialog onClose={() => setForgotPasswordOpen(false)} />}
    </AuthLayout>
  );
}

// ---------------------------------------------------------------------------
// Register Page with Password Confirmation & Validation (Requirements 1 & 2)
// ---------------------------------------------------------------------------
function RegisterPage() {
  const [, navigate] = useLocation();
  const [password, setPassword] = useState("");
  const [passwordConfirm, setConfirmPassword] = useState("");
  const [userRole, setUserRole] = useState<"Farmer" | "Fisherfolk" | "Buyer">("Farmer");
  const [passwordMismatch, setPasswordMismatch] = useState(false);

  const register = useRegister({
    mutation: {
      onSuccess: (data) => {
        queryClient.setQueryData(getGetCurrentUserQueryKey(), data);
        navigate("/dashboard");
      },
    },
  });

  const hasLength = password.length >= 6;
  const hasLetters = /[a-zA-Z]/.test(password);
  const passwordsMatch = password.length > 0 && password === passwordConfirm;

  return (
    <AuthLayout eyebrow="Join the local network" title="Make good food move.">
      {/* Google Sign-Up Button */}
      <GoogleAuthButton mode="register" role={userRole} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          if (password !== passwordConfirm) {
            setPasswordMismatch(true);
            return;
          }
          setPasswordMismatch(false);
          register.mutate({
            data: {
              fullName: String(f.get("fullName")),
              username: String(f.get("username")),
              email: String(f.get("email")),
              password,
              phone: String(f.get("phone")),
              location: String(f.get("location")),
              userType: userRole,
            },
          });
        }}
      >
        <div className="form-grid">
          <Field label="Full name" required>
            <input name="fullName" required placeholder="Your full name" />
          </Field>
          <Field label="Username" required>
            <input name="username" required autoComplete="username" placeholder="Choose a username" />
          </Field>
          <Field label="Email" required>
            <input name="email" required type="email" placeholder="you@example.com" />
          </Field>
          <Field label="Phone number" required>
            <input name="phone" required placeholder="09XX XXX XXXX" />
          </Field>
          <Field label="Location" required>
            <input name="location" required placeholder="City or municipality, Samar" />
          </Field>
          <Field label="I am a" required>
            <select
              name="userType"
              value={userRole}
              onChange={(e) => setUserRole(e.target.value as "Farmer" | "Fisherfolk" | "Buyer")}
            >
              <option value="Farmer">Farmer (Sell agricultural surplus)</option>
              <option value="Fisherfolk">Fisherfolk (Sell morning catch)</option>
              <option value="Buyer">Buyer (Reserve fresh produce)</option>
            </select>
          </Field>

          {/* Password with Visibility Toggle (Requirement 2) */}
          <Field label="Password" required wide>
            <PasswordInput
              name="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setPasswordMismatch(false);
              }}
              placeholder="At least 6 characters"
              required
              minLength={6}
              autoComplete="new-password"
            />
          </Field>

          {/* Password Requirements Checklist */}
          {password.length > 0 && (
            <div className="field-wide password-checklist">
              <span className={`password-check-item ${hasLength ? "valid" : "invalid"}`}>
                {hasLength ? <CheckCircle2 size={13} /> : <CircleAlert size={13} />} At least 6 characters
              </span>
              <span className={`password-check-item ${hasLetters ? "valid" : "invalid"}`}>
                {hasLetters ? <CheckCircle2 size={13} /> : <CircleAlert size={13} />} Contains letters
              </span>
            </div>
          )}

          {/* Confirm Password with Visibility Toggle (Requirement 2) */}
          <Field label="Confirm password" required wide>
            <PasswordInput
              name="passwordConfirm"
              value={passwordConfirm}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setPasswordMismatch(false);
              }}
              placeholder="Repeat your password"
              required
              minLength={6}
              autoComplete="new-password"
            />
          </Field>

          {passwordConfirm.length > 0 && (
            <div className="field-wide" style={{ fontSize: 11, marginTop: -6 }}>
              {passwordsMatch ? (
                <span style={{ color: "var(--leaf)", display: "flex", alignItems: "center", gap: 5, fontWeight: 600 }}>
                  <CheckCircle2 size={13} /> Passwords match
                </span>
              ) : (
                <span style={{ color: "#c96d51", display: "flex", alignItems: "center", gap: 5 }}>
                  <XCircle size={13} /> Passwords do not match
                </span>
              )}
            </div>
          )}
        </div>

        {passwordMismatch && <p className="form-error">The passwords do not match.</p>}
        {register.isError && <p className="form-error">{errorMessage(register.error, "We couldn't create that account.")}</p>}

        <button
          className="button button-primary button-grow"
          disabled={register.isPending || !hasLength || (passwordConfirm.length > 0 && !passwordsMatch)}
          style={{ marginTop: 12 }}
        >
          Create account <ArrowRight size={17} />
        </button>
      </form>
    </AuthLayout>
  );
}

function AuthLayout({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <div className="auth-page">
      <div className="auth-art">
        <div className="auth-sun" />
        <Sprout size={62} strokeWidth={1} />
        <span>Good food<br /><i>stays local.</i></span>
      </div>
      <div className="auth-card">
        <Link href="/" className="back-link"><ChevronLeft size={16} /> Back home</Link>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p className="auth-subtitle">Samar AgriRescue is a simple way to connect with your local food community.</p>
        {children}
        <p className="auth-switch">
          {title.includes("back") ? "New here?" : "Already have an account?"}{" "}
          <Link href={title.includes("back") ? "/register" : "/login"}>
            {title.includes("back") ? "Create an account" : "Log in"}
          </Link>
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// About Page
// ---------------------------------------------------------------------------
function AboutPage() {
  return (
    <div className="about-page">
      <div className="about-hero">
        <span className="eyebrow">Why we exist</span>
        <h1>Good food, shared<br /><i>closer to home.</i></h1>
        <p>Samar AgriRescue connects farmers and fisherfolk in Samar with nearby buyers, giving surplus products a market before they become waste.</p>
      </div>
      <div className="about-grid">
        <div className="about-card about-green">
          <Sprout size={28} />
          <h2>For producers</h2>
          <p>Find buyers for what you’ve grown or caught, with a listing that takes just a few minutes.</p>
        </div>
        <div className="about-card about-cream">
          <ShoppingBasket size={28} />
          <h2>For buyers</h2>
          <p>Discover fresh products in your area, reserve what you need, and support local livelihoods.</p>
        </div>
        <div className="about-card about-dark">
          <ShieldCheck size={28} />
          <h2>A simple exchange</h2>
          <p>We facilitate listings, search, reservations, and communication. Payment, pickup, and quality checks stay between buyers and sellers.</p>
        </div>
      </div>
      <div className="limitations">
        <span className="eyebrow">Our promise</span>
        <h2>Local connection, not complicated logistics.</h2>
        <p>AgriRescue does not provide delivery, transportation, payment processing, certification, weather forecasts, or guarantees of quality, freshness, or quantity. Buyers and sellers are responsible for arranging pickup, payment, and verifying details directly.</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers & Utilities
// ---------------------------------------------------------------------------
function PageIntro({ eyebrow, title, copy, action }: { eyebrow: string; title: string; copy: string; action?: ReactNode }) {
  return (
    <div className="page-intro">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{copy}</p>
      </div>
      {action}
    </div>
  );
}

function AuthRequired({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="empty-page">
      <div className="empty-icon"><CircleUserRound /></div>
      <h1>{title}</h1>
      <p>{copy}</p>
      <Link href="/login" className="button button-primary">Log in <ArrowRight size={16} /></Link>
    </div>
  );
}

function EmptyState({ title, copy, action }: { title: string; copy: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <span className="empty-icon"><Leaf size={22} /></span>
      <h3>{title}</h3>
      <p>{copy}</p>
      {action}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="loading-state">
      <Sprout size={22} />
      <span>Loading…</span>
    </div>
  );
}

function NotFoundPage() {
  return (
    <div className="empty-page">
      <div className="empty-icon"><CircleAlert /></div>
      <h1>That page wandered off.</h1>
      <p>We couldn’t find what you were looking for.</p>
      <Link href="/" className="button button-primary">Back home <ArrowRight size={16} /></Link>
    </div>
  );
}

function initials(name?: string | null) {
  if (!name || typeof name !== "string") return "AR";
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "AR"
  );
}

function relativeDate(date?: string | null) {
  if (!date) return "Recently";
  const parsed = new Date(date).getTime();
  if (isNaN(parsed)) return "Recently";
  const hours = Math.round((Date.now() - parsed) / 3600000);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default App;
