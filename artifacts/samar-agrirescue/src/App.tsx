import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import { QueryClient, QueryClientProvider, useMutation, useQueryClient } from "@tanstack/react-query";
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
  ArrowRight,
  Bell,
  Check,
  ChevronDown,
  ChevronLeft,
  CircleAlert,
  CircleUserRound,
  Clock3,
  Fish,
  HeartHandshake,
  Home,
  Leaf,
  LogOut,
  Menu,
  MessageCircle,
  Package,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBasket,
  Sprout,
  Store,
  Trash2,
  TrendingUp,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { Link, Route, Switch, useLocation } from "wouter";
import "./index.css";

const queryClient = new QueryClient();

const categories = ["All categories", "Vegetables", "Fruits", "Rice & Grains", "Fish", "Seafood", "Livestock", "Other"];
const locations = ["All Samar", "Calbayog City", "Catbalogan City", "Basey", "Guiuan", "Borongan City"];
const units = ["kilogram", "sack", "basket", "piece", "bundle", "crate", "box"];

function errorMessage(error: unknown, fallback = "Something went wrong. Please try again.") {
  if (error && typeof error === "object" && "data" in error) {
    const data = (error as { data?: { error?: string } }).data;
    if (data?.error) return data.error;
  }
  return fallback;
}

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

  if (isLoading && !publicPage) return <div className="loading-screen"><Sprout size={28} /><span>Loading Samar AgriRescue…</span></div>;
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
          <Route path="/profile" component={() => <ProfilePage user={user} />} />
          <Route path="/profile/:id" component={({ params }) => <PublicProfilePage id={Number(params.id)} />} />
          <Route path="/admin" component={() => <AdminPage section="summary" user={user} />} />
          <Route path="/admin/users" component={() => <AdminPage section="users" user={user} />} />
          <Route path="/admin/products" component={() => <AdminPage section="products" user={user} />} />
          <Route path="/admin/reports" component={() => <AdminPage section="reports" user={user} />} />
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
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoHoldTriggered = useRef(false);
  const logout = useLogout({ mutation: { onSuccess: () => { queryClient.setQueryData(getGetCurrentUserQueryKey(), { user: null }); navigate("/"); } } });
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
          aria-label="Samar AgriRescue home. Press and hold to open admin access."
        ><span className="brand-mark"><Sprout size={21} /></span><span><strong>Samar</strong><em>AgriRescue</em></span></Link>
        <button className="mobile-menu" onClick={() => setOpen(!open)} aria-label="Toggle navigation">{open ? <X /> : <Menu />}</button>
        <nav className={`main-nav ${open ? "nav-open" : ""}`}>
          <Link href="/" onClick={() => setOpen(false)}>Home</Link>
          <Link href="/products" onClick={() => setOpen(false)}>Browse</Link>
          <Link href="/rescue" onClick={() => setOpen(false)} className="rescue-link">Rescue Now</Link>
          <Link href="/about" onClick={() => setOpen(false)}>About</Link>
          {user ? (
            <>
              <Link href="/dashboard" onClick={() => setOpen(false)}>Dashboard</Link>
              <Link href="/messages" onClick={() => setOpen(false)} className="nav-icon-link"><MessageCircle size={16} /> Messages</Link>
              <button className="header-profile" onClick={() => navigate(user.userType === "Administrator" ? "/admin" : "/profile")}><span className="avatar">{initials(user.fullName)}</span>{user.fullName.split(" ")[0]}<ChevronDown size={14} /></button>
              <button className="logout-btn" onClick={() => logout.mutate()} aria-label="Log out"><LogOut size={16} /></button>
            </>
          ) : (
            <div className="auth-links"><Link href="/login">Log in</Link><Link href="/register" className="button button-small">Join the network <ArrowRight size={15} /></Link></div>
          )}
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return <footer className="site-footer"><div className="footer-inner"><div><div className="brand footer-brand"><span className="brand-mark"><Sprout size={19} /></span><span><strong>Samar</strong><em>AgriRescue</em></span></div><p>Rescue the harvest. Support local. Reduce waste.</p></div><div className="footer-note"><span><ShieldCheck size={15} /> Local exchange, community powered</span><small>Buyers and sellers arrange payment and pickup directly.</small></div></div></footer>;
}

function HomePage({ user }: { user?: User | null }) {
  const { data: stats } = useGetStats();
  const { data: products = [] } = useGetProducts({ rescue: true, sort: "newest" });
  return <div className="home-page">
    <section className="hero">
      <div className="hero-copy">
        <span className="eyebrow"><span className="pulse-dot" /> A better way to buy local</span>
        <h1>Good food should<br /><i>find a home.</i></h1>
        <p>We connect Samar farmers and fisherfolk with nearby buyers so surplus produce finds a market instead of going to waste.</p>
        <div className="hero-actions"><Link href="/products" className="button button-primary">Browse surplus <ArrowRight size={17} /></Link><Link href={user ? "/products/new" : "/register"} className="button button-quiet">Sell your surplus <Plus size={17} /></Link></div>
        <div className="hero-trust"><div className="mini-avatars"><span>JD</span><span>LM</span><span>MS</span><b>+</b></div><span>Trusted by Samar’s local food community</span></div>
      </div>
      <div className="hero-art" aria-label="Illustration of local produce">
        <div className="sun-orb" /><div className="hill hill-back" /><div className="hill hill-front" />
        <div className="produce-card produce-tomato"><span>●</span><small>Fresh today</small><strong>Tomatoes</strong></div>
        <div className="produce-card produce-fish"><Fish size={22} /><small>Just landed</small><strong>Fresh catch</strong></div>
        <div className="basket"><div className="basket-leaf leaf-one" /><div className="basket-leaf leaf-two" /><div className="basket-fruit fruit-one" /><div className="basket-fruit fruit-two" /></div>
        <div className="hero-sticker"><HeartHandshake size={17} /><span>Every listing<br /><b>makes a difference</b></span></div>
      </div>
    </section>
    <section className="stats-strip">
      <Stat value={stats?.availableProducts ?? 0} label="Available products" /><Stat value={stats?.registeredProducers ?? 0} label="Local producers" /><Stat value={stats?.productsRescued ?? 0} label="Products rescued" /><Stat value={stats?.activeBuyers ?? 0} label="Active buyers" />
    </section>
    <section className="section featured-section">
      <SectionHeading eyebrow="Needs a home soon" title="Rescue listings" action={<Link href="/rescue" className="text-link">See all rescue listings <ArrowRight size={16} /></Link>} />
      {products.length ? <div className="product-grid">{products.slice(0, 3).map((p) => <ProductCard key={p.id} product={p} />)}</div> : <EmptyState title="The rescue board is quiet" copy="Check back soon for new surplus listings." />}
    </section>
    <section className="section how-section"><SectionHeading eyebrow="Simple by design" title="From extra to enjoyed" /><div className="steps"><Step number="01" icon={<Store />} title="Producers post surplus" copy="List what you have, where it is, and when it's ready." /><Step number="02" icon={<Search />} title="Buyers discover locally" copy="Find fresh food near you and reserve what you need." /><Step number="03" icon={<HeartHandshake />} title="Everyone wins" copy="Arrange pickup directly and keep good food in the community." /></div></section>
    <section className="cta-section"><div><span className="eyebrow eyebrow-light">Have extra to share?</span><h2>Turn your surplus<br /><i>into someone’s next meal.</i></h2><p>Join the local network of producers making a difference in Samar.</p></div><Link href={user ? "/products/new" : "/register"} className="button button-light">List your surplus <ArrowRight size={17} /></Link></section>
  </div>;
}

function Stat({ value, label }: { value: number; label: string }) { return <div className="stat"><strong>{value.toString().padStart(2, "0")}</strong><span>{label}</span></div>; }
function Step({ number, icon, title, copy }: { number: string; icon: ReactNode; title: string; copy: string }) { return <div className="step"><span className="step-number">{number}</span><div className="step-icon">{icon}</div><h3>{title}</h3><p>{copy}</p></div>; }
function SectionHeading({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) { return <div className="section-heading"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div>{action}</div>; }

function ProductsPage() {
  const [filters, setFilters] = useState<GetProductsParams>({ sort: "newest" });
  const [search, setSearch] = useState("");
  const { data: products = [], isLoading } = useGetProducts({ ...filters, search: search || undefined });
  return <div className="content-page"><PageIntro eyebrow="The local marketplace" title="Browse surplus products" copy="Fresh, local, and ready to find a new home. Search what's available near you." action={<Link href="/rescue" className="button button-primary">Rescue Now <ArrowRight size={16} /></Link>} />
    <div className="marketplace-toolbar"><div className="search-box"><Search size={18} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search produce, producer, or location" /></div><select value={filters.category ?? "All categories"} onChange={(e) => setFilters({ ...filters, category: e.target.value === "All categories" ? undefined : e.target.value })}>{categories.map((c) => <option key={c}>{c}</option>)}</select><select value={filters.location ?? "All Samar"} onChange={(e) => setFilters({ ...filters, location: e.target.value === "All Samar" ? undefined : e.target.value })}>{locations.map((l) => <option key={l}>{l}</option>)}</select><select value={filters.sort ?? "newest"} onChange={(e) => setFilters({ ...filters, sort: e.target.value as GetProductsParams["sort"] })}><option value="newest">Newest first</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option></select></div>
    <div className="results-row"><span>{isLoading ? "Finding listings…" : `${products.length} listings available`}</span><label className="toggle-label"><input type="checkbox" checked={filters.rescue ?? false} onChange={(e) => setFilters({ ...filters, rescue: e.target.checked || undefined })} /><span className="toggle" /> Rescue only</label></div>
    {products.length ? <div className="product-grid">{products.map((p) => <ProductCard key={p.id} product={p} />)}</div> : <EmptyState title={search ? "No listings match that search" : "No products found in this view"} copy="Try a different category, location, or search term." action={<button className="button button-outline" onClick={() => { setFilters({ sort: "newest" }); setSearch(""); }}>Clear filters</button>} />}
  </div>;
}

function RescuePage() { const { data: products = [] } = useGetProducts({ rescue: true, sort: "newest" }); return <div className="content-page rescue-page"><div className="rescue-banner"><div><span className="rescue-kicker"><CircleAlert size={16} /> Time-sensitive surplus</span><h1>Rescue Now</h1><p>Good food, ready to move. These listings need a buyer soon.</p></div><div className="rescue-count"><strong>{products.length}</strong><span>active rescue<br />listings</span></div></div><div className="notice"><ShieldCheck size={17} /><span>Rescue listings are community-posted. Please confirm quality, quantity, payment, and pickup details with the producer.</span></div>{products.length ? <div className="product-grid rescue-grid">{products.map((p) => <ProductCard key={p.id} product={p} rescue />)}</div> : <EmptyState title="No rescue listings right now" copy="That means the community is moving food quickly. Check back soon." />}</div>; }

function ProductCard({ product, rescue = false }: { product: Product; rescue?: boolean }) {
  return <Link href={`/products/${product.id}`} className={`product-card ${rescue ? "product-card-rescue" : ""}`}><div className={`product-image image-${product.category.toLowerCase().replace(/\W/g, "-")}`}>{product.image ? <img src={product.image} alt={product.name} /> : <ProductIllustration category={product.category} />}{product.isRescue && <span className="rescue-badge"><CircleAlert size={12} /> Rescue</span>}<span className="image-arrow"><ArrowRight size={16} /></span></div><div className="product-meta"><div className="product-topline"><span>{product.category}</span><span className={`status status-${product.status.toLowerCase()}`}>{product.status}</span></div><h3>{product.name}</h3><p className="producer-line"><span className="avatar avatar-small">{initials(product.producerName)}</span>{product.producerName} <span className="middot">·</span> {product.location.split(",")[0]}</p><div className="product-bottom"><strong>₱{product.price.toLocaleString()} <small>/ {product.unit}</small></strong><span>{product.quantity} {product.unit} left</span></div></div></Link>;
}

function ProductIllustration({ category }: { category: string }) { const Icon = category === "Fish" || category === "Seafood" ? Fish : category === "Vegetables" ? Leaf : category === "Fruits" ? Sprout : Package; return <div className="product-illustration"><Icon size={55} strokeWidth={1.25} /></div>; }

function ProductDetailPage({ id, user }: { id: number; user?: User | null }) {
  const { data: product, isLoading } = useGetProduct(id);
  const [quantity, setQuantity] = useState(1);
  const [messageOpen, setMessageOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const reserve = useCreateReservation({ mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetProductQueryKey(id) }); queryClient.invalidateQueries({ queryKey: getGetReservationsQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetProductsQueryKey() }); } } });
  const report = useCreateReport({ mutation: { onSuccess: () => setReportOpen(false) } });
  if (isLoading) return <LoadingState />;
  if (!product) return <NotFoundPage />;
  const isOwner = user?.id === product.producerId;
  return <div className="detail-page"><Link href="/products" className="back-link"><ChevronLeft size={16} /> Back to browse</Link><div className="detail-layout"><div className="detail-visual"><div className="detail-image"><ProductIllustration category={product.category} />{product.isRescue && <span className="rescue-badge"><CircleAlert size={13} /> Rescue listing</span>}</div><div className="image-caption"><span><Clock3 size={14} /> Posted {relativeDate(product.createdAt)}</span><span>Demo listing</span></div></div><div className="detail-copy"><div className="product-topline"><span>{product.category}</span><span className={`status status-${product.status.toLowerCase()}`}>{product.status}</span></div><h1>{product.name}</h1><p className="detail-description">{product.description || "A local listing from a Samar producer."}</p><div className="detail-price">₱{product.price.toLocaleString()} <small>per {product.unit}</small></div><div className="detail-facts"><div><span>Available</span><strong>{product.quantity} {product.unit}</strong></div><div><span>Location</span><strong>{product.location}</strong></div><div><span>Ready from</span><strong>{product.availabilityDate || "Today"}</strong></div></div><div className="producer-box"><span className="avatar avatar-large">{initials(product.producerName)}</span><div><span>Listed by</span><Link href={`/profile/${product.producerId}`}>{product.producerName}</Link><small>{product.producerType || "Local producer"}</small></div><Link href={`/profile/${product.producerId}`} className="icon-circle"><ArrowRight size={16} /></Link></div>{isOwner ? <div className="detail-actions"><Link href={`/products/${id}/edit`} className="button button-primary"><Pencil size={16} /> Edit listing</Link><button className="button button-outline" onClick={() => setMessageOpen(true)}>View interest</button></div> : user?.userType === "Buyer" ? <div className="detail-actions"><div className="quantity-input"><button onClick={() => setQuantity(Math.max(1, quantity - 1))}>−</button><strong>{quantity}</strong><button onClick={() => setQuantity(Math.min(product.quantity, quantity + 1))}>+</button><span>{product.unit}</span></div><button disabled={product.status !== "Available" || reserve.isPending} className="button button-primary button-grow" onClick={() => reserve.mutate({ data: { productId: id, quantity } })}>{reserve.isSuccess ? <><Check size={17} /> Reserved</> : <>Reserve product <ArrowRight size={17} /></>}</button><button className="button button-outline icon-button" onClick={() => setMessageOpen(true)}><MessageCircle size={17} /></button></div> : <div className="detail-actions"><Link href="/login" className="button button-primary button-grow">Log in to reserve <ArrowRight size={17} /></Link></div>}{reserve.isError && <p className="form-error">{errorMessage(reserve.error)}</p>}<div className="detail-links"><button onClick={() => setReportOpen(true)}>Report this listing</button><span>·</span><span>Payment and pickup arranged directly</span></div></div></div>{messageOpen && <MessageComposer product={product} onClose={() => setMessageOpen(false)} user={user} />}{reportOpen && <ReportDialog product={product} onClose={() => setReportOpen(false)} mutation={report} />}</div>;
}

function MessageComposer({ product, user, onClose }: { product: Product; user?: User | null; onClose: () => void }) { const send = useSendMessage({ mutation: { onSuccess: onClose } }); const [message, setMessage] = useState(`Hi ${product.producerName}, I’m interested in your ${product.name}. Is it still available?`); if (!user) return <Dialog title="Sign in to contact the producer" onClose={onClose}><Link className="button button-primary" href="/login">Log in</Link></Dialog>; return <Dialog title={`Message ${product.producerName}`} onClose={onClose}><p className="dialog-copy">Start a conversation about this listing.</p><textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} /><button className="button button-primary" disabled={send.isPending || !message.trim()} onClick={() => send.mutate({ data: { receiverId: product.producerId, productId: product.id, message } })}>Send message <ArrowRight size={16} /></button></Dialog>; }
function ReportDialog({ product, onClose, mutation }: { product: Product; onClose: () => void; mutation: ReturnType<typeof useCreateReport> }) { const [reason, setReason] = useState("Listing information is inaccurate"); const [description, setDescription] = useState(""); return <Dialog title="Report this listing" onClose={onClose}><p className="dialog-copy">Help us keep Samar AgriRescue useful and safe.</p><select value={reason} onChange={(e) => setReason(e.target.value)}><option>Listing information is inaccurate</option><option>Inappropriate content</option><option>Suspicious activity</option><option>Other concern</option></select><textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Additional details (optional)" rows={3} /><button className="button button-primary" disabled={mutation.isPending} onClick={() => mutation.mutate({ data: { productId: product.id, reason, description: description || undefined } })}>Submit report <ArrowRight size={16} /></button></Dialog>; }
function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) { return <div className="dialog-backdrop" onClick={onClose}><div className="dialog" onClick={(e) => e.stopPropagation()}><button className="dialog-close" onClick={onClose}><X size={18} /></button><h2>{title}</h2>{children}</div></div>; }

function DashboardPage({ user }: { user?: User | null }) {
  if (!user) return <AuthRequired title="Your dashboard is waiting" copy="Log in to see your reservations, listings, and messages." />;
  const { data: products = [] } = useGetProducts({ includeUnavailable: true, sort: "newest" }, { query: { enabled: user.userType !== "Buyer", queryKey: getGetProductsQueryKey({ includeUnavailable: true, sort: "newest" }) } });
  const { data: reservations = [] } = useGetReservations({ query: { enabled: !!user, queryKey: getGetReservationsQueryKey() } });
  const producer = user.userType === "Farmer" || user.userType === "Fisherfolk";
  const own = products.filter((p) => p.producerId === user.id);
  return <div className="dashboard-page"><div className="dashboard-welcome"><div><span className="eyebrow">Good morning, {user.fullName.split(" ")[0]}</span><h1>{producer ? "Your local harvest hub." : "Your food, closer to home."}</h1><p>{producer ? "Keep your listings fresh and see who is looking for your products." : "Discover the latest surplus and keep track of what you’ve reserved."}</p></div><Link href={producer ? "/products/new" : "/products"} className="button button-primary">{producer ? <><Plus size={17} /> Add a listing</> : <>Browse products <ArrowRight size={17} /></>}</Link></div><div className="dashboard-cards"><MetricCard icon={<Package />} label={producer ? "Total listings" : "Reservations"} value={producer ? own.length : reservations.length} tone="green" /><MetricCard icon={<Clock3 />} label={producer ? "Available now" : "Pending"} value={producer ? own.filter((p) => p.status === "Available").length : reservations.filter((r) => r.status === "Pending").length} tone="yellow" /><MetricCard icon={<HeartHandshake />} label={producer ? "Rescued" : "Confirmed"} value={producer ? own.filter((p) => p.isRescue).length : reservations.filter((r) => r.status === "Confirmed").length} tone="blue" /></div><div className="dashboard-grid"><div className="panel"><div className="panel-heading"><div><span className="eyebrow">Keep an eye on it</span><h2>{producer ? "Your recent listings" : "Your recent reservations"}</h2></div><Link href={producer ? "/my-products" : "/reservations"} className="text-link">View all <ArrowRight size={15} /></Link></div>{producer ? own.slice(0, 3).map((p) => <MiniProduct key={p.id} product={p} />) : reservations.slice(0, 3).map((r) => <ReservationRow key={r.id} reservation={r} />)}{!(producer ? own.length : reservations.length) && <EmptyState title="Nothing here yet" copy={producer ? "Your first listing can help rescue a harvest." : "Reserve a product to see it here."} />}</div><div className="panel dashboard-tip"><div className="tip-illustration"><Leaf size={31} /></div><span className="eyebrow">A little reminder</span><h2>Local food travels less, and means more.</h2><p>When you buy from a nearby producer, more value stays in the community.</p><Link href="/about" className="text-link">Learn about our mission <ArrowRight size={15} /></Link></div></div></div>;
}
function MetricCard({ icon, label, value, tone }: { icon: ReactNode; label: string; value: number; tone: string }) { return <div className={`metric-card metric-${tone}`}><span className="metric-icon">{icon}</span><div><strong>{value.toString().padStart(2, "0")}</strong><span>{label}</span></div></div>; }
function MiniProduct({ product }: { product: Product }) { return <Link href={`/products/${product.id}`} className="mini-row"><span className="mini-product-icon"><ProductIllustration category={product.category} /></span><span><strong>{product.name}</strong><small>{product.location}</small></span><b>₱{product.price.toLocaleString()}</b><ArrowRight size={15} /></Link>; }
function ReservationRow({ reservation }: { reservation: Reservation }) { return <div className="mini-row"><span className="mini-product-icon"><Package size={20} /></span><span><strong>{reservation.productName}</strong><small>{reservation.quantity} {reservation.unit} · {reservation.producerName}</small></span><span className={`status status-${reservation.status.toLowerCase()}`}>{reservation.status}</span></div>; }

function MyProductsPage({ user }: { user?: User | null }) { const params = { includeUnavailable: true, sort: "newest" as const }; const { data: products = [], isLoading } = useGetProducts(params, { query: { enabled: !!user, queryKey: getGetProductsQueryKey(params) } }); const mine = products.filter((p) => p.producerId === user?.id); return <div className="content-page"><PageIntro eyebrow="Producer space" title="My products" copy="Keep your listings up to date so buyers know what is fresh and available." action={<Link href="/products/new" className="button button-primary"><Plus size={17} /> Add product</Link>} />{isLoading ? <LoadingState /> : mine.length ? <div className="manage-list">{mine.map((product) => <ManageProduct key={product.id} product={product} />)}</div> : <EmptyState title="Your marketplace is ready" copy="Post your first surplus listing and connect with a nearby buyer." action={<Link className="button button-primary" href="/products/new">Create a listing <ArrowRight size={16} /></Link>} />}</div>; }
function ManageProduct({ product }: { product: Product }) { const queryClient = useQueryClient(); const sold = useMarkProductSold({ mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetProductsQueryKey() }); } } }); const remove = useMutation({ mutationFn: () => fetch(`/api/products/${product.id}`, { method: "DELETE" }), onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetProductsQueryKey() }) }); return <div className="manage-product"><span className="manage-image"><ProductIllustration category={product.category} /></span><div className="manage-info"><div className="product-topline"><span>{product.category}</span><span className={`status status-${product.status.toLowerCase()}`}>{product.status}</span></div><h3>{product.name}</h3><p>{product.location} · {product.quantity} {product.unit} · ₱{product.price.toLocaleString()}/{product.unit}</p></div><div className="manage-actions"><Link href={`/products/${product.id}/edit`} className="icon-action" aria-label="Edit"><Pencil size={16} /></Link>{product.status !== "Sold" && <button className="icon-action" onClick={() => sold.mutate({ id: product.id })} aria-label="Mark as sold"><Check size={16} /></button>}<button className="icon-action danger" onClick={() => remove.mutate()} aria-label="Delete"><Trash2 size={16} /></button></div></div>; }

function ReservationsPage({ user }: { user?: User | null }) { const { data: reservations = [] } = useGetReservations({ query: { enabled: !!user, queryKey: getGetReservationsQueryKey() } }); const update = useUpdateReservation({ mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetReservationsQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetProductsQueryKey() }); } } }); if (!user) return <AuthRequired title="Your reservations are private" copy="Log in to view and manage your reservations." />; return <div className="content-page"><PageIntro eyebrow={user.userType === "Buyer" ? "Your buying activity" : "Producer activity"} title="Reservations" copy={user.userType === "Buyer" ? "Keep track of the products you’ve asked to reserve." : "See who is interested in your products and update reservation status."} />{reservations.length ? <div className="reservation-list">{reservations.map((r) => <div className="reservation-card" key={r.id}><div className="reservation-icon"><Package size={21} /></div><div className="reservation-main"><div className="product-topline"><span>{user.userType === "Buyer" ? `From ${r.producerName}` : `Buyer: ${r.buyerName}`}</span><span className={`status status-${r.status.toLowerCase()}`}>{r.status}</span></div><h3>{r.productName}</h3><p>{r.quantity} {r.unit} · {relativeDate(r.createdAt)}</p></div>{user.userType !== "Buyer" && r.status === "Pending" && <div className="reservation-actions"><button className="button button-small button-primary" onClick={() => update.mutate({ id: r.id, data: { status: "Confirmed" } })}>Confirm</button><button className="button button-small button-outline" onClick={() => update.mutate({ id: r.id, data: { status: "Cancelled" } })}>Decline</button></div>}{user.userType === "Buyer" && (r.status === "Pending" || r.status === "Confirmed") && <div className="reservation-actions"><button className="button button-small button-outline" onClick={() => update.mutate({ id: r.id, data: { status: "Cancelled" } })}>Cancel reservation</button></div>}</div>)}</div> : <EmptyState title="No reservations yet" copy={user.userType === "Buyer" ? "Browse the marketplace when you’re ready to find something nearby." : "Reservations from buyers will appear here."} action={<Link href="/products" className="button button-primary">Browse products <ArrowRight size={16} /></Link>} />}</div>; }

function MessagesPage({ user }: { user?: User | null }) { const { data: messages = [] } = useGetMessages({ query: { enabled: !!user, queryKey: getGetMessagesQueryKey() } }); const markRead = useMarkMessageRead({ mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetMessagesQueryKey() }) } }); if (!user) return <AuthRequired title="Your conversations are private" copy="Log in to see your messages." />; return <div className="content-page"><PageIntro eyebrow="Stay connected" title="Messages" copy="Talk directly with producers and buyers about listings, pickup, and details." />{messages.length ? <div className="messages-list">{messages.map((m) => <div className={`message-card ${!m.isRead && m.receiverId === user.id ? "unread" : ""}`} key={m.id}><span className="avatar avatar-large">{initials(m.senderId === user.id ? m.receiverName : m.senderName)}</span><div><div className="message-header"><strong>{m.senderId === user.id ? `To ${m.receiverName}` : m.senderName}</strong><small>{relativeDate(m.createdAt)}</small></div><p>{m.message}</p>{m.productName && <span className="message-product"><Package size={13} /> {m.productName}</span>}</div>{!m.isRead && m.receiverId === user.id && <button className="mark-read" onClick={() => markRead.mutate({ id: m.id })}>Mark read</button>}</div>)}</div> : <EmptyState title="No messages yet" copy="When you ask about a listing, your conversation will show up here." />}</div>; }

function ProductFormPage({ user, productId }: { user?: User | null; productId?: number }) {
  const editing = !!productId;
  const { data: existing, isLoading } = useGetProduct(productId ?? 0, { query: { enabled: editing, queryKey: getGetProductQueryKey(productId ?? 0) } });
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
  });
  useEffect(() => {
    if (!existing || initializedProductId.current === existing.id) return;
    initializedProductId.current = existing.id;
    setForm({
      name: existing.name,
      category: existing.category,
      description: existing.description ?? "",
      price: existing.price,
      quantity: existing.quantity,
      unit: existing.unit,
      location: existing.location,
      image: existing.image ?? "",
      availabilityDate: existing.availabilityDate ?? "",
      isRescue: existing.isRescue,
    });
  }, [existing]);
  const update = useUpdateProduct({ mutation: { onSuccess: (p) => { queryClient.invalidateQueries({ queryKey: getGetProductsQueryKey() }); window.location.href = `/products/${p.id}`; } } });
  const create = useCreateProduct({ mutation: { onSuccess: (p) => { queryClient.invalidateQueries({ queryKey: getGetProductsQueryKey() }); window.location.href = `/products/${p.id}`; } } });
  const setField = <K extends keyof ProductInput>(key: K, value: ProductInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  if (!user) return <AuthRequired title="Sign in to list your surplus" copy="Producer accounts can share fresh local products with nearby buyers." />;
  if (editing && isLoading) return <LoadingState />;
  if (editing && !existing) return <NotFoundPage />;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (editing && !existing) return;
    const data = { ...form, price: Number(form.price), quantity: Number(form.quantity) };
    if (editing) update.mutate({ id: productId!, data });
    else create.mutate({ data });
  };

  return <div className="form-page">
    <Link href={editing ? `/products/${productId}` : "/my-products"} className="back-link"><ChevronLeft size={16} /> {editing ? "Back to listing" : "Back to my products"}</Link>
    <div className="form-heading"><span className="eyebrow">{editing ? "Update listing" : "Share your harvest"}</span><h1>{editing ? "Edit product" : "Add a product"}</h1><p>{editing ? "Keep the details accurate so buyers can make confident choices." : "Tell nearby buyers what you have available."}</p></div>
    <form className="product-form" onSubmit={submit}>
      <div className="form-section"><h2>Listing details</h2><div className="form-grid">
        <Field label="Product name" required><input required value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="e.g. Fresh tomatoes" /></Field>
        <Field label="Category" required><select value={form.category} onChange={(e) => setField("category", e.target.value)}>{categories.slice(1).map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Description" wide><textarea value={form.description ?? ""} onChange={(e) => setField("description", e.target.value)} placeholder="What should buyers know about this product?" rows={4} /></Field>
      </div></div>
      <div className="form-section"><h2>Availability</h2><div className="form-grid">
        <Field label="Price (₱)" required><input required min="0" type="number" value={form.price} onChange={(e) => setField("price", Number(e.target.value))} /></Field>
        <Field label="Quantity" required><input required min="0.01" step="0.01" type="number" value={form.quantity} onChange={(e) => setField("quantity", Number(e.target.value))} /></Field>
        <Field label="Unit" required><select value={form.unit} onChange={(e) => setField("unit", e.target.value)}>{units.map((u) => <option key={u}>{u}</option>)}</select></Field>
        <Field label="Location" required><input required value={form.location} onChange={(e) => setField("location", e.target.value)} /></Field>
        <Field label="Available from"><input type="date" value={form.availabilityDate ?? ""} onChange={(e) => setField("availabilityDate", e.target.value)} /></Field>
        <Field label="Product image URL"><input value={form.image ?? ""} onChange={(e) => setField("image", e.target.value)} placeholder="Optional photo URL" /></Field>
      </div>
      <label className="rescue-check"><input type="checkbox" checked={form.isRescue ?? false} onChange={(e) => setField("isRescue", e.target.checked)} /><span className="check-box">{form.isRescue && <Check size={13} />}</span><span><strong>Mark as Rescue Listing</strong><small>Highlight this product for buyers who want to act quickly.</small></span></label></div>
      <div className="form-foot"><p><ShieldCheck size={15} /> Be accurate about your quantity and location. Buyers and sellers arrange payment and pickup directly.</p><button className="button button-primary" disabled={create.isPending || update.isPending}>{editing ? "Save changes" : "Publish listing"} <ArrowRight size={16} /></button></div>
      {(create.isError || update.isError) && <p className="form-error">{errorMessage(create.error || update.error)}</p>}
    </form>
  </div>;
}
function Field({ label, required, wide, children }: { label: string; required?: boolean; wide?: boolean; children: ReactNode }) { return <label className={`field ${wide ? "field-wide" : ""}`}><span>{label}{required && <b> *</b>}</span>{children}</label>; }

function ProfilePage({ user }: { user?: User | null }) { const update = useUpdateProfile({ mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() }) } }); if (!user) return <AuthRequired title="Your profile is private" copy="Log in to update your profile." />; return <div className="profile-page"><div className="profile-header"><span className="avatar avatar-profile">{initials(user.fullName)}</span><div><span className="eyebrow">{user.userType} account</span><h1>{user.fullName}</h1><p>Member since {new Date(user.createdAt).toLocaleDateString("en-PH", { month: "long", year: "numeric" })}</p></div></div><form className="profile-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); update.mutate({ data: { fullName: String(f.get("fullName")), phone: String(f.get("phone")), location: String(f.get("location")), bio: String(f.get("bio")) } }); }}><Field label="Full name"><input name="fullName" defaultValue={user.fullName} /></Field><Field label="Phone number"><input name="phone" defaultValue={user.phone ?? ""} /></Field><Field label="Location"><input name="location" defaultValue={user.location ?? ""} /></Field><Field label="About you" wide><textarea name="bio" defaultValue={user.bio ?? ""} rows={4} /></Field><div className="form-foot"><span>{update.isSuccess && <span className="success-message"><Check size={15} /> Profile saved</span>}</span><button className="button button-primary" disabled={update.isPending}>Save profile <ArrowRight size={16} /></button></div></form></div>; }
function PublicProfilePage({ id }: { id: number }) { const { data: profile } = useGetProfile(id); if (!profile) return <LoadingState />; return <div className="profile-page"><Link href="/products" className="back-link"><ChevronLeft size={16} /> Back to marketplace</Link><div className="profile-header"><span className="avatar avatar-profile">{initials(profile.fullName)}</span><div><span className="eyebrow">{profile.userType} · {profile.location}</span><h1>{profile.fullName}</h1><p>{profile.bio || "A local producer in the Samar food community."}</p></div></div><SectionHeading eyebrow="Available from this producer" title="Current listings" />{profile.products.length ? <div className="product-grid">{profile.products.map((p) => <ProductCard key={p.id} product={p} />)}</div> : <EmptyState title="No active listings" copy="This producer doesn't have any listings available right now." />}</div>; }

function AdminPage({ section, user }: { section: "summary" | "users" | "products" | "reports"; user?: User | null }) { if (!user) return <AdminAccessGate />; if (user.userType !== "Administrator") return <AuthRequired title="Administrator access only" copy="This area is reserved for platform administrators. Sign in with an administrator account to continue." />; return <div className="admin-page"><div className="admin-sidebar"><span className="eyebrow">Platform control</span><h1>Admin desk</h1><p>Keep the local marketplace healthy.</p><nav><Link className={section === "summary" ? "active" : ""} href="/admin"><TrendingUp size={16} /> Overview</Link><Link className={section === "users" ? "active" : ""} href="/admin/users"><Users size={16} /> Users</Link><Link className={section === "products" ? "active" : ""} href="/admin/products"><Package size={16} /> Listings</Link><Link className={section === "reports" ? "active" : ""} href="/admin/reports"><CircleAlert size={16} /> Reports</Link></nav></div>{section === "summary" ? <AdminSummaryPanel /> : section === "users" ? <AdminUsersPanel /> : section === "products" ? <AdminProductsPanel /> : <AdminReportsPanel />}</div>; }
function AdminAccessGate() { return <div className="empty-page"><div className="empty-icon"><ShieldCheck /></div><span className="eyebrow">Administrator access</span><h1>Sign in to the admin desk.</h1><p>Open this page directly at <strong>/admin</strong>, or press and hold the Samar AgriRescue logo in the main menu. An administrator account is required.</p><Link href="/login" className="button button-primary">Administrator sign in <ArrowRight size={16} /></Link></div>; }
function AdminSummaryPanel() { const { data } = useGetAdminSummary(); if (!data) return <LoadingState />; const items: [keyof AdminSummary, string][] = [["totalUsers", "Total users"], ["farmers", "Farmers"], ["fisherfolk", "Fisherfolk"], ["buyers", "Buyers"], ["totalProducts", "Total products"], ["availableProducts", "Available"], ["reservedProducts", "Reserved"], ["soldProducts", "Sold"], ["rescueListings", "Rescue listings"], ["totalReservations", "Reservations"], ["openReports", "Open reports"]]; return <div className="admin-panel"><div className="panel-heading"><div><span className="eyebrow">System activity</span><h2>Marketplace overview</h2></div></div><div className="admin-metrics">{items.map(([key, label]) => <MetricCard key={key} label={label} value={data[key]} icon={<TrendingUp />} tone={key === "openReports" ? "yellow" : "green"} />)}</div></div>; }
function AdminUsersPanel() { const [search, setSearch] = useState(""); const { data: users = [] } = useGetAdminUsers({ search: search || undefined }); const update = useUpdateAdminUser({ mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetAdminUsersQueryKey() }) } }); return <div className="admin-panel"><PanelTitle eyebrow="Account management" title="Users" /><div className="search-box compact"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users" /></div><div className="admin-table">{users.map((u) => <div className="admin-row" key={u.id}><span className="avatar avatar-small">{initials(u.fullName)}</span><div><strong>{u.fullName}</strong><small>@{u.username} · {u.userType}</small></div><span className={`status status-${u.isActive ? "available" : "sold"}`}>{u.isActive ? "Active" : "Disabled"}</span><button className="button button-small button-outline" onClick={() => update.mutate({ id: u.id, data: { isActive: !u.isActive } })}>{u.isActive ? "Disable" : "Enable"}</button></div>)}</div></div>; }
function AdminProductsPanel() { const [search, setSearch] = useState(""); const { data: products = [] } = useGetAdminProducts({ search: search || undefined }); const remove = useAdminDeleteProduct({ mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetAdminProductsQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetAdminSummaryQueryKey() }); } } }); return <div className="admin-panel"><PanelTitle eyebrow="Content moderation" title="All listings" /><div className="search-box compact"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search listings" /></div><div className="admin-table">{products.map((p) => <div className="admin-row" key={p.id}><span className="mini-product-icon"><ProductIllustration category={p.category} /></span><div><strong>{p.name}</strong><small>{p.producerName} · {p.location}</small></div><span className={`status status-${p.status.toLowerCase()}`}>{p.status}</span><button className="icon-action danger" onClick={() => remove.mutate({ id: p.id })}><Trash2 size={16} /></button></div>)}</div></div>; }
function AdminReportsPanel() { const { data: reports = [] } = useGetAdminReports(); const update = useUpdateAdminReport({ mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetAdminReportsQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetAdminSummaryQueryKey() }); } } }); return <div className="admin-panel"><PanelTitle eyebrow="Keep it trustworthy" title="Reports" />{reports.length ? <div className="report-list">{reports.map((r) => <div className="report-card" key={r.id}><div><span className={`status status-${r.status.toLowerCase()}`}>{r.status}</span><h3>{r.productName}</h3><p>{r.reason}</p><small>Reported by {r.reporterName} · {relativeDate(r.createdAt)}</small></div>{r.status === "Open" && <button className="button button-small button-primary" onClick={() => update.mutate({ id: r.id, data: { status: "Resolved" } })}>Resolve</button>}</div>)}</div> : <EmptyState title="No reports" copy="The community is looking healthy." />}</div>; }
function PanelTitle({ eyebrow, title }: { eyebrow: string; title: string }) { return <div className="panel-heading"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div></div>; }

function LoginPage() { const [, navigate] = useLocation(); const login = useLogin({ mutation: { onSuccess: (data) => { queryClient.setQueryData(getGetCurrentUserQueryKey(), data); navigate(data.user?.userType === "Administrator" ? "/admin" : "/dashboard"); } } }); return <AuthLayout eyebrow="Welcome back" title="Good to see you again."><form onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); login.mutate({ data: { username: String(f.get("username")), password: String(f.get("password")) } }); }}><Field label="Username" required><input name="username" required autoComplete="username" placeholder="your username" /></Field><Field label="Password" required><input name="password" required type="password" autoComplete="current-password" placeholder="Your password" /></Field>{login.isError && <p className="form-error">{errorMessage(login.error, "We couldn't sign you in.")}</p>}<button className="button button-primary button-grow" disabled={login.isPending}>Log in <ArrowRight size={17} /></button><p className="form-hint">Demo buyer: <b>mayabuyer</b> / demo123 · Demo producer: <b>juanfarmer</b> / demo123 · Demo admin: <b>admin</b> / admin123</p></form></AuthLayout>; }
function RegisterPage() {
  const [, navigate] = useLocation();
  const [passwordMismatch, setPasswordMismatch] = useState(false);
  const register = useRegister({ mutation: { onSuccess: (data) => { queryClient.setQueryData(getGetCurrentUserQueryKey(), data); navigate("/dashboard"); } } });
  return <AuthLayout eyebrow="Join the local network" title="Make good food move.">
    <form onSubmit={(e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      const password = String(f.get("password"));
      if (password !== String(f.get("passwordConfirm"))) {
        setPasswordMismatch(true);
        return;
      }
      setPasswordMismatch(false);
      register.mutate({ data: {
        fullName: String(f.get("fullName")),
        username: String(f.get("username")),
        email: String(f.get("email")),
        password,
        phone: String(f.get("phone")),
        location: String(f.get("location")),
        userType: String(f.get("userType")) as "Farmer" | "Fisherfolk" | "Buyer",
      } });
    }}>
      <div className="form-grid">
        <Field label="Full name" required><input name="fullName" required placeholder="Your full name" /></Field>
        <Field label="Username" required><input name="username" required autoComplete="username" placeholder="Choose a username" /></Field>
        <Field label="Email" required><input name="email" required type="email" placeholder="you@example.com" /></Field>
        <Field label="Phone number" required><input name="phone" required placeholder="09XX XXX XXXX" /></Field>
        <Field label="Location" required><input name="location" required placeholder="City or municipality, Samar" /></Field>
        <Field label="I am a" required><select name="userType"><option>Farmer</option><option>Fisherfolk</option><option>Buyer</option></select></Field>
        <Field label="Password" required wide><input name="password" required minLength={6} type="password" autoComplete="new-password" placeholder="At least 6 characters" onChange={() => setPasswordMismatch(false)} /></Field>
        <Field label="Confirm password" required wide><input name="passwordConfirm" required minLength={6} type="password" autoComplete="new-password" placeholder="Enter your password again" onChange={() => setPasswordMismatch(false)} /></Field>
      </div>
      {passwordMismatch && <p className="form-error">The passwords do not match.</p>}
      {register.isError && <p className="form-error">{errorMessage(register.error, "We couldn't create that account.")}</p>}
      <button className="button button-primary button-grow" disabled={register.isPending}>Create account <ArrowRight size={17} /></button>
    </form>
  </AuthLayout>;
}
function AuthLayout({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) { return <div className="auth-page"><div className="auth-art"><div className="auth-sun" /><Sprout size={62} strokeWidth={1} /><span>Good food<br /><i>stays local.</i></span></div><div className="auth-card"><Link href="/" className="back-link"><ChevronLeft size={16} /> Back home</Link><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p className="auth-subtitle">Samar AgriRescue is a simple way to connect with your local food community.</p>{children}<p className="auth-switch">{title.includes("back") ? "New here?" : "Already have an account?"} <Link href={title.includes("back") ? "/register" : "/login"}>{title.includes("back") ? "Create an account" : "Log in"}</Link></p></div></div>; }

function AboutPage() { return <div className="about-page"><div className="about-hero"><span className="eyebrow">Why we exist</span><h1>Good food, shared<br /><i>closer to home.</i></h1><p>Samar AgriRescue connects farmers and fisherfolk in Samar with nearby buyers, giving surplus products a market before they become waste.</p></div><div className="about-grid"><div className="about-card about-green"><Sprout size={28} /><h2>For producers</h2><p>Find buyers for what you’ve grown or caught, with a listing that takes just a few minutes.</p></div><div className="about-card about-cream"><ShoppingBasket size={28} /><h2>For buyers</h2><p>Discover fresh products in your area, reserve what you need, and support local livelihoods.</p></div><div className="about-card about-dark"><ShieldCheck size={28} /><h2>A simple exchange</h2><p>We facilitate listings, search, reservations, and communication. Payment, pickup, and quality checks stay between buyers and sellers.</p></div></div><div className="limitations"><span className="eyebrow">Our promise</span><h2>Local connection, not complicated logistics.</h2><p>AgriRescue does not provide delivery, transportation, payment processing, certification, weather forecasts, or guarantees of quality, freshness, or quantity. Buyers and sellers are responsible for arranging pickup, payment, and verifying details directly.</p></div></div>; }

function PageIntro({ eyebrow, title, copy, action }: { eyebrow: string; title: string; copy: string; action?: ReactNode }) { return <div className="page-intro"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{copy}</p></div>{action}</div>; }
function AuthRequired({ title, copy }: { title: string; copy: string }) { return <div className="empty-page"><div className="empty-icon"><CircleUserRound /></div><h1>{title}</h1><p>{copy}</p><Link href="/login" className="button button-primary">Log in <ArrowRight size={16} /></Link></div>; }
function EmptyState({ title, copy, action }: { title: string; copy: string; action?: ReactNode }) { return <div className="empty-state"><span className="empty-icon"><Leaf size={22} /></span><h3>{title}</h3><p>{copy}</p>{action}</div>; }
function LoadingState() { return <div className="loading-state"><Sprout size={22} /><span>Loading…</span></div>; }
function NotFoundPage() { return <div className="empty-page"><div className="empty-icon"><CircleAlert /></div><h1>That page wandered off.</h1><p>We couldn’t find what you were looking for.</p><Link href="/" className="button button-primary">Back home <ArrowRight size={16} /></Link></div>; }
function initials(name: string) { return name.split(" ").map((word) => word[0]).slice(0, 2).join("").toUpperCase(); }
function relativeDate(date: string) { const hours = Math.round((Date.now() - new Date(date).getTime()) / 3600000); if (hours < 1) return "Just now"; if (hours < 24) return `${hours}h ago`; return `${Math.round(hours / 24)}d ago`; }

export default App;