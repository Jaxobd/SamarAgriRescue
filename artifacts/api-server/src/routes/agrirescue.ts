import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { randomBytes, timingSafeEqual } from "node:crypto";
import {
  activitiesTable,
  db,
  messagesTable,
  notificationsTable,
  productsTable,
  reportsTable,
  reservationsTable,
  usersTable,
  type User,
} from "@workspace/db";
import {
  AdminDeleteProductParams,
  CreateProductBody,
  CreateReportBody,
  CreateReservationBody,
  DeleteProductParams,
  GetAdminProductsQueryParams,
  GetAdminUsersQueryParams,
  GetCurrentUserResponse,
  GetMessagesResponse,
  GetProductParams,
  GetProductResponse,
  GetProductsQueryParams,
  GetProductsResponse,
  GetProfileParams,
  GetReservationsResponse,
  GetStatsResponse,
  LoginBody,
  LoginResponse,
  MarkMessageReadParams,
  MarkProductSoldParams,
  RegisterBody,
  RegisterResponse,
  SendMessageBody,
  UpdateAdminReportBody,
  UpdateAdminReportParams,
  UpdateAdminUserBody,
  UpdateAdminUserParams,
  UpdateProductBody,
  UpdateProductParams,
  UpdateProfileBody,
  UpdateReservationBody,
  UpdateReservationParams,
} from "@workspace/api-zod";
import {
  currentUser,
  exchangeGoogleCode,
  findOrCreateGoogleUser,
  getGoogleOAuthConfig,
  hashPassword,
  listProducts,
  logActivity,
  notify,
  notifyMany,
  productWithProducer,
  producerFor,
  sessionCookie,
  toNotification,
  toProduct,
  toUser,
  userIdFromCookie,
  verifyGoogleIdToken,
  verifyPassword,
} from "../lib/agrirescue";

const router: IRouter = Router();
const cookieOptions = "Path=/; HttpOnly; SameSite=Lax; Max-Age=604800";
const clearCookie = "Path=/; HttpOnly; SameSite=Lax; Max-Age=0";
const asId = (value: string | string[]) => Number(Array.isArray(value) ? value[0] : value);

async function requireUser(req: Request, res: Response) {
  const user = await currentUser(req.headers.cookie);
  if (!user) {
    res.status(401).json({ error: "Please sign in to continue." });
    return null;
  }
  return user;
}

async function requireAdmin(req: Request, res: Response) {
  const user = await requireUser(req, res);
  if (!user) return null;
  if (user.userType !== "Administrator") {
    res.status(403).json({ error: "Administrator access required." });
    return null;
  }
  return user;
}

function validId(value: string | string[]) {
  const id = asId(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function normalizeGallery(images?: string[] | null, cover?: string | null) {
  const gallery = (images ?? []).map((url) => url.trim()).filter(Boolean).slice(0, 6);
  const legacyCover = cover?.trim();
  if (legacyCover && !gallery.includes(legacyCover)) gallery.unshift(legacyCover);
  return { images: gallery, image: gallery[0] ?? null };
}

// ---------------------------------------------------------------------------
// Public Stats
// ---------------------------------------------------------------------------

router.get("/stats", async (_req, res): Promise<void> => {
  const [products, producers, rescued, buyers, allUsers, totalProducts] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(productsTable).where(eq(productsTable.status, "Available")),
    db.select({ count: sql<number>`count(*)` }).from(usersTable).where(or(eq(usersTable.userType, "Farmer"), eq(usersTable.userType, "Fisherfolk"))),
    db.select({ count: sql<number>`count(*)` }).from(reservationsTable).where(eq(reservationsTable.status, "Completed")),
    db.select({ count: sql<number>`count(*)` }).from(usersTable).where(and(eq(usersTable.userType, "Buyer"), eq(usersTable.isActive, true))),
    db.select({ count: sql<number>`count(*)` }).from(usersTable),
    db.select({ count: sql<number>`count(*)` }).from(productsTable),
  ]);
  res.json(GetStatsResponse.parse({
    availableProducts: Number(products[0]?.count ?? 0),
    registeredProducers: Number(producers[0]?.count ?? 0),
    productsRescued: Number(rescued[0]?.count ?? 0),
    activeBuyers: Number(buyers[0]?.count ?? 0),
    totalUsers: Number(allUsers[0]?.count ?? 0),
    totalProducts: Number(totalProducts[0]?.count ?? 0),
  }));
});

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

router.get("/auth/me", async (req, res): Promise<void> => {
  const user = await currentUser(req.headers.cookie);
  res.json(GetCurrentUserResponse.parse({ user: user ? toUser(user) : null }));
});

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(or(eq(usersTable.username, parsed.data.username), eq(usersTable.email, parsed.data.email)))
    .limit(1);

  if (existing.length) {
    res.status(400).json({ error: "That username or email is already in use." });
    return;
  }
  const [user] = await db.insert(usersTable).values({
    ...parsed.data,
    passwordHash: hashPassword(parsed.data.password),
  }).returning();

  await logActivity({
    userId: user.id,
    type: "auth",
    action: "User registered",
    details: `New ${user.userType} account created for ${user.fullName} (@${user.username})`,
    entityId: user.id,
    entityType: "user",
  });

  await notify({
    userId: user.id,
    type: "system",
    title: "Welcome to Samar AgriRescue",
    body:
      user.userType === "Buyer"
        ? "Browse rescue listings near you and reserve fresh produce before it goes to waste."
        : "Post your surplus and keep track of reservations, messages, and updates in one place.",
    link: user.userType === "Buyer" ? "/products" : "/dashboard",
  });

  res.setHeader("Set-Cookie", `samar_session=${sessionCookie(user.id)}; ${cookieOptions}`);
  res.status(201).json(RegisterResponse.parse({ user: toUser(user) }));
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, parsed.data.username));
  if (!user || !user.isActive || !verifyPassword(parsed.data.password, user.passwordHash)) {
    res.status(401).json({ error: "Invalid username or password." });
    return;
  }

  await logActivity({
    userId: user.id,
    type: "auth",
    action: "User signed in",
    details: `User @${user.username} signed in successfully`,
    entityId: user.id,
    entityType: "user",
  });

  res.setHeader("Set-Cookie", `samar_session=${sessionCookie(user.id)}; ${cookieOptions}`);
  res.json(LoginResponse.parse({ user: toUser(user) }));
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  const user = await currentUser(req.headers.cookie);
  if (user) {
    await logActivity({
      userId: user.id,
      type: "auth",
      action: "User logged out",
      details: `User @${user.username} logged out`,
      entityId: user.id,
      entityType: "user",
    });
  }
  res.setHeader("Set-Cookie", `samar_session=; ${clearCookie}`);
  res.sendStatus(204);
});

// Google Authentication

// Google only accepts public HTTPS redirect URIs (localhost is the sole HTTP exception),
// so a configured private/LAN address falls back to the host serving this request.
function isPublicHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname;
    const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":");
    return url.protocol === "https:" && host.includes(".") && !isIp;
  } catch {
    return false;
  }
}

// Public base URL of the SPA for redirects after OAuth. A localhost/LAN value
// (a common leftover from development) would send browsers to an unreachable
// address, so only a public HTTPS origin is honoured; otherwise redirects stay
// relative and resolve against the host that served the request.
function frontendBase(req: Request) {
  const configured = process.env.FRONTEND_URL?.trim();
  if (configured && isPublicHttpsUrl(configured)) return configured.replace(/\/+$/, "");
  return "";
}

function googleRedirectUri(req: Request) {
  const configured = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (configured && isPublicHttpsUrl(configured)) return configured;
  return `${req.protocol}://${req.get("host")}/api/auth/google/callback`;
}

// Only these roles may be requested through the public sign-up flow. Without
// this guard a crafted ?role=Administrator would mint an administrator on the
// first Google sign-in.
const SELF_SERVE_ROLES = ["Farmer", "Fisherfolk", "Buyer"] as const;
type SelfServeRole = (typeof SELF_SERVE_ROLES)[number];

function selfServeRole(value: unknown): SelfServeRole {
  return SELF_SERVE_ROLES.includes(value as SelfServeRole) ? (value as SelfServeRole) : "Buyer";
}

function readCookie(header: string | undefined, name: string) {
  const raw = header?.split(";").find((part) => part.trim().startsWith(`${name}=`));
  return raw ? raw.trim().slice(name.length + 1) : null;
}

const oauthStateCookie = (nonce: string) =>
  `samar_oauth_state=${nonce}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`;
const clearOAuthStateCookie = "samar_oauth_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";

router.get("/auth/google/config", (_req, res): void => {
  res.json(getGoogleOAuthConfig());
});

router.get("/auth/google", (req, res): void => {
  const config = getGoogleOAuthConfig();
  if (!config.enabled || !config.clientId) {
    res.status(400).json({
      error: "Google OAuth is not configured on the server. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.",
    });
    return;
  }

  const role = selfServeRole(req.query.role);
  const nonce = randomBytes(16).toString("hex");
  const state = Buffer.from(JSON.stringify({ nonce, role })).toString("base64url");

  const redirectUri = googleRedirectUri(req);

  const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      access_type: "online",
      state,
      prompt: "select_account",
    }).toString();

  res.setHeader("Set-Cookie", oauthStateCookie(nonce));
  res.redirect(authUrl);
});

router.get("/auth/google/callback", async (req, res): Promise<void> => {
  try {
    const { code, state, error } = req.query;
    const base = frontendBase(req);
    if (error) {
      res.setHeader("Set-Cookie", clearOAuthStateCookie);
      res.redirect(`${base}/login?error=${encodeURIComponent(String(error))}`);
      return;
    }
    if (!code || typeof code !== "string") {
      res.setHeader("Set-Cookie", clearOAuthStateCookie);
      res.redirect(`${base}/login?error=Missing+Google+authorization+code`);
      return;
    }

    // The state must match the nonce stored in the browser when sign-in began.
    // This blocks login-CSRF and stops a tampered state from choosing a role.
    const expectedNonce = readCookie(req.headers.cookie, "samar_oauth_state");
    let role: SelfServeRole = "Buyer";
    let stateValid = false;
    if (state && typeof state === "string" && expectedNonce) {
      try {
        const decoded = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
        if (
          typeof decoded.nonce === "string" &&
          decoded.nonce.length === expectedNonce.length &&
          timingSafeEqual(Buffer.from(decoded.nonce), Buffer.from(expectedNonce))
        ) {
          stateValid = true;
          role = selfServeRole(decoded.role);
        }
      } catch {
        // Invalid state payload; handled below.
      }
    }
    if (!stateValid) {
      res.setHeader("Set-Cookie", clearOAuthStateCookie);
      res.redirect(`${base}/login?error=${encodeURIComponent("Your Google sign-in session expired. Please try again.")}`);
      return;
    }

    const redirectUri = googleRedirectUri(req);

    const profile = await exchangeGoogleCode(code, redirectUri);
    const user = await findOrCreateGoogleUser({
      googleId: profile.googleId,
      email: profile.email,
      fullName: profile.fullName,
      profileImage: profile.profileImage,
      userType: role,
    });

    await logActivity({
      userId: user.id,
      type: "auth",
      action: "Google OAuth sign-in",
      details: `User @${user.username} signed in with Google (${user.email})`,
      entityId: user.id,
      entityType: "user",
    });

    res.setHeader("Set-Cookie", [
      `samar_session=${sessionCookie(user.id)}; ${cookieOptions}`,
      clearOAuthStateCookie,
    ]);
    res.redirect(user.userType === "Administrator" ? `${base}/admin` : `${base}/dashboard`);
  } catch (err: any) {
    res.redirect(`${frontendBase(req)}/login?error=${encodeURIComponent(err.message || "Google authentication failed")}`);
  }
});

router.post("/auth/google/token", async (req, res): Promise<void> => {
  try {
    const { token, userType } = req.body;
    if (!token || typeof token !== "string") {
      res.status(400).json({ error: "Missing Google ID token." });
      return;
    }

    const profile = await verifyGoogleIdToken(token);
    const user = await findOrCreateGoogleUser({
      googleId: profile.googleId,
      email: profile.email,
      fullName: profile.fullName,
      profileImage: profile.profileImage,
      userType: selfServeRole(userType),
    });

    await logActivity({
      userId: user.id,
      type: "auth",
      action: "Google Sign-In",
      details: `User @${user.username} authenticated with Google token (${user.email})`,
      entityId: user.id,
      entityType: "user",
    });

    res.setHeader("Set-Cookie", `samar_session=${sessionCookie(user.id)}; ${cookieOptions}`);
    res.json({ user: toUser(user) });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Google token verification failed." });
  }
});

// Forgot / Reset Password
router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const { identifier } = req.body;
  if (!identifier || typeof identifier !== "string") {
    res.status(400).json({ error: "Please provide your username or email address." });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(or(eq(usersTable.username, identifier.trim()), eq(usersTable.email, identifier.trim().toLowerCase())));

  // Do not reveal whether the account exists, and only allow the next step
  // when the caller may actually change that password: an administrator, or
  // the signed-in owner of the account.
  const caller = await currentUser(req.headers.cookie);
  const canReset = Boolean(
    caller && user && (caller.userType === "Administrator" || caller.id === user.id),
  );

  if (user) {
    await logActivity({
      userId: user.id,
      type: "auth",
      action: "Password reset requested",
      details: `Password reset requested for @${user.username}`,
      entityId: user.id,
      entityType: "user",
    });
  }

  res.json({
    success: true,
    canReset,
    message: canReset
      ? "Choose a new secure password for this account."
      : "For security, only an administrator can reset a password. Please contact the site administrator.",
  });
});

router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const { identifier, newPassword } = req.body;
  if (!identifier || !newPassword) {
    res.status(400).json({ error: "Identifier and new password are required." });
    return;
  }
  if (typeof newPassword !== "string" || newPassword.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters long." });
    return;
  }

  // Require a session: this endpoint has no email/token delivery, so an
  // anonymous caller could otherwise set a new password for any account.
  const caller = await currentUser(req.headers.cookie);
  if (!caller) {
    res.status(403).json({
      error: "Password resets require an administrator. Please ask the site administrator to reset this password.",
    });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(or(eq(usersTable.username, identifier.trim()), eq(usersTable.email, identifier.trim().toLowerCase())));

  if (!user || !user.isActive) {
    res.status(404).json({ error: "No active account found for that username or email." });
    return;
  }

  if (caller.userType !== "Administrator" && caller.id !== user.id) {
    res.status(403).json({ error: "Only an administrator can reset another member's password." });
    return;
  }

  await db
    .update(usersTable)
    .set({ passwordHash: hashPassword(newPassword) })
    .where(eq(usersTable.id, user.id));

  await logActivity({
    userId: user.id,
    type: "auth",
    action: "Password reset completed",
    details: `Password changed for @${user.username}`,
    entityId: user.id,
    entityType: "user",
  });

  res.json({ success: true, message: "Password updated successfully. You can now log in with your new password." });
});

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

router.get("/products", async (req, res): Promise<void> => {
  const parsed = GetProductsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const products = await listProducts({
    ...parsed.data,
    availableOnly: !parsed.data.includeUnavailable && (!parsed.data.status || parsed.data.status === "Available"),
  });
  res.json(GetProductsResponse.parse(products));
});

router.post("/products", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  if (user.userType !== "Farmer" && user.userType !== "Fisherfolk" && user.userType !== "Administrator") {
    res.status(403).json({ error: "Only farmers, fisherfolk, and administrators can create listings." });
    return;
  }
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const gallery = normalizeGallery(parsed.data.images, parsed.data.image);
  const [product] = await db.insert(productsTable).values({
    producerId: user.id,
    name: parsed.data.name,
    category: parsed.data.category,
    description: parsed.data.description,
    price: String(parsed.data.price),
    quantity: String(parsed.data.quantity),
    unit: parsed.data.unit,
    location: parsed.data.location,
    image: gallery.image,
    images: gallery.images,
    availabilityDate: parsed.data.availabilityDate,
    isRescue: parsed.data.isRescue ?? false,
  }).returning();

  await logActivity({
    userId: user.id,
    type: "product",
    action: "Product listing created",
    details: `${product.name} listed at ₱${product.price}/${product.unit}`,
    entityId: product.id,
    entityType: "product",
  });

  res.status(201).json(GetProductResponse.parse(await productWithProducer(product)));
});

router.get("/products/:id", async (req, res): Promise<void> => {
  const id = validId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid product id." });
    return;
  }
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id));
  if (!product) {
    res.status(404).json({ error: "Product not found." });
    return;
  }
  res.json(GetProductResponse.parse(await productWithProducer(product)));
});

router.patch("/products/:id", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  const id = validId(req.params.id);
  const parsed = UpdateProductBody.safeParse(req.body);
  if (!id || !parsed.success) {
    res.status(400).json({ error: parsed.success ? "Invalid product id." : parsed.error.message });
    return;
  }
  const [existing] = await db.select().from(productsTable).where(eq(productsTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Product not found." });
    return;
  }
  if (existing.producerId !== user.id && user.userType !== "Administrator") {
    res.status(403).json({ error: "You can only edit your own listings." });
    return;
  }
  const gallery =
    parsed.data.images == null
      ? { image: parsed.data.image ?? existing.image, images: (existing.images as string[] | null) ?? [] }
      : normalizeGallery(parsed.data.images, parsed.data.image);
  const [product] = await db.update(productsTable).set({
    ...parsed.data,
    price: parsed.data.price == null ? existing.price : String(parsed.data.price),
    quantity: parsed.data.quantity == null ? existing.quantity : String(parsed.data.quantity),
    image: gallery.image,
    images: gallery.images,
    updatedAt: new Date(),
  }).where(eq(productsTable.id, id)).returning();

  await logActivity({
    userId: user.id,
    type: "product",
    action: "Product listing updated",
    details: `Updated details for ${product.name}`,
    entityId: product.id,
    entityType: "product",
  });

  res.json(GetProductResponse.parse(await productWithProducer(product)));
});

router.delete("/products/:id", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  const id = validId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid product id." });
    return;
  }
  const [existing] = await db.select().from(productsTable).where(eq(productsTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Product not found." });
    return;
  }
  if (existing.producerId !== user.id && user.userType !== "Administrator") {
    res.status(403).json({ error: "You can only remove your own listings." });
    return;
  }
  await db.delete(productsTable).where(eq(productsTable.id, id));

  await logActivity({
    userId: user.id,
    type: "product",
    action: "Product listing deleted",
    details: `Removed product listing ${existing.name}`,
    entityId: id,
    entityType: "product",
  });

  res.sendStatus(204);
});

router.post("/products/:id/sold", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  const id = validId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid product id." });
    return;
  }
  const [existing] = await db.select().from(productsTable).where(eq(productsTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Product not found." });
    return;
  }
  if (existing.producerId !== user.id && user.userType !== "Administrator") {
    res.status(403).json({ error: "You can only update your own listings." });
    return;
  }
  const [product] = await db.update(productsTable).set({ status: "Sold", updatedAt: new Date() }).where(eq(productsTable.id, id)).returning();

  await logActivity({
    userId: user.id,
    type: "product",
    action: "Product marked as sold",
    details: `${product.name} marked as sold out`,
    entityId: product.id,
    entityType: "product",
  });

  const waiting = await db
    .select({ buyerId: reservationsTable.buyerId })
    .from(reservationsTable)
    .where(and(eq(reservationsTable.productId, id), or(eq(reservationsTable.status, "Pending"), eq(reservationsTable.status, "Confirmed"))));
  await notifyMany(
    waiting.map((row: { buyerId: number }) => row.buyerId),
    {
      actorId: user.id,
      type: "product",
      title: `${product.name} is now sold`,
      body: "A listing you reserved has been marked sold. Coordinate pickup with the producer.",
      link: `/products/${product.id}`,
      productId: product.id,
      entityId: product.id,
      entityType: "product",
    },
  );
  if (user.id !== product.producerId) {
    await notify({
      userId: product.producerId,
      actorId: user.id,
      type: "product",
      title: "Listing marked sold by admin",
      body: `"${product.name}" is now marked as sold.`,
      link: `/products/${product.id}`,
      productId: product.id,
      entityId: product.id,
      entityType: "product",
    });
  }

  res.json(GetProductResponse.parse(await productWithProducer(product)));
});

// ---------------------------------------------------------------------------
// Reservations
// ---------------------------------------------------------------------------

router.get("/reservations", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  const rows = await db.select({
    reservation: reservationsTable,
    product: productsTable,
    buyer: usersTable,
  }).from(reservationsTable)
    .innerJoin(productsTable, eq(reservationsTable.productId, productsTable.id))
    .innerJoin(usersTable, eq(reservationsTable.buyerId, usersTable.id))
    .where(user.userType === "Buyer" ? eq(reservationsTable.buyerId, user.id) : eq(productsTable.producerId, user.id))
    .orderBy(desc(reservationsTable.createdAt));

  const result = await Promise.all(rows.map(async ({ reservation, product, buyer }: any) => ({
    id: reservation.id,
    productId: product.id,
    productName: product.name,
    productImage: product.image,
    producerName: (await producerFor(product.producerId))?.fullName ?? "producer",
    buyerId: buyer.id,
    buyerName: buyer.fullName,
    quantity: Number(reservation.quantity),
    unit: product.unit,
    status: reservation.status,
    createdAt: reservation.createdAt.toISOString(),
  })));
  res.json(GetReservationsResponse.parse(result));
});

router.post("/reservations", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  if (user.userType !== "Buyer") {
    res.status(403).json({ error: "Only buyers can reserve products." });
    return;
  }
  const parsed = CreateReservationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const result = await db.transaction(async (tx: any) => {
    const [product] = await tx.select().from(productsTable)
      .where(eq(productsTable.id, parsed.data.productId))
      .for("update");
    if (!product || product.status !== "Available" || Number(product.quantity) < parsed.data.quantity) {
      return { unavailable: true as const };
    }
    const remaining = Number(product.quantity) - parsed.data.quantity;
    const [reservation] = await tx.insert(reservationsTable).values({
      productId: product.id,
      buyerId: user.id,
      quantity: String(parsed.data.quantity),
    }).returning();
    await tx.update(productsTable).set({
      quantity: String(remaining),
      status: remaining <= 0 ? "Reserved" : "Available",
      updatedAt: new Date(),
    }).where(eq(productsTable.id, product.id));
    return { unavailable: false as const, product, reservation };
  });
  if (result.unavailable) {
    res.status(400).json({ error: "That quantity is no longer available." });
    return;
  }
  const { product, reservation } = result;

  await logActivity({
    userId: user.id,
    type: "reservation",
    action: "Product reserved",
    details: `${Number(reservation.quantity)} ${product.unit} of ${product.name} reserved by ${user.fullName}`,
    entityId: reservation.id,
    entityType: "reservation",
  });

  await notify({
    userId: product.producerId,
    actorId: user.id,
    type: "reservation",
    title: "New reservation",
    body: `${user.fullName} reserved ${Number(reservation.quantity)} ${product.unit} of ${product.name}.`,
    link: "/reservations",
    productId: product.id,
    entityId: reservation.id,
    entityType: "reservation",
  });

  res.status(201).json({
    id: reservation.id,
    productId: product.id,
    productName: product.name,
    productImage: product.image,
    producerName: (await producerFor(product.producerId))?.fullName ?? "producer",
    buyerId: user.id,
    buyerName: user.fullName,
    quantity: Number(reservation.quantity),
    unit: product.unit,
    status: reservation.status,
    createdAt: reservation.createdAt.toISOString(),
  });
});

router.patch("/reservations/:id", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  const id = validId(req.params.id);
  const parsed = UpdateReservationBody.safeParse(req.body);
  if (!id || !parsed.success) {
    res.status(400).json({ error: parsed.success ? "Invalid reservation id." : parsed.error.message });
    return;
  }
  const result = await db.transaction(async (tx: any) => {
    const [reservation] = await tx.select().from(reservationsTable)
      .where(eq(reservationsTable.id, id))
      .for("update");
    if (!reservation) return { missing: true as const };

    const [product] = await tx.select().from(productsTable)
      .where(eq(productsTable.id, reservation.productId))
      .for("update");
    const [buyer] = await tx.select().from(usersTable).where(eq(usersTable.id, reservation.buyerId));
    if (!product || !buyer) return { missing: true as const };
    if (buyer.id !== user.id && product.producerId !== user.id && user.userType !== "Administrator") {
      return { forbidden: true as const };
    }
    if (
      (reservation.status === "Cancelled" && parsed.data.status !== "Cancelled") ||
      (reservation.status === "Completed" && parsed.data.status === "Cancelled")
    ) {
      return { invalidTransition: true as const };
    }

    if (parsed.data.status === "Cancelled" && reservation.status !== "Cancelled" && product.status !== "Sold") {
      const restoredQuantity = Number(product.quantity) + Number(reservation.quantity);
      await tx.update(productsTable).set({
        quantity: String(restoredQuantity),
        status: "Available",
        updatedAt: new Date(),
      }).where(eq(productsTable.id, product.id));
    }
    const [updatedReservation] = await tx.update(reservationsTable)
      .set({ status: parsed.data.status, updatedAt: new Date() })
      .where(eq(reservationsTable.id, id))
      .returning();
    return { missing: false as const, reservation: updatedReservation, product, buyer };
  });
  if ("missing" in result && result.missing) {
    res.status(404).json({ error: "Reservation not found." });
    return;
  }
  if ("forbidden" in result && result.forbidden) {
    res.status(403).json({ error: "You cannot update this reservation." });
    return;
  }
  if ("invalidTransition" in result && result.invalidTransition) {
    res.status(400).json({ error: "A cancelled reservation cannot be reopened." });
    return;
  }
  const { reservation, product, buyer } = result;

  await logActivity({
    userId: user.id,
    type: "reservation",
    action: `Reservation ${reservation.status.toLowerCase()}`,
    details: `Reservation #${reservation.id} for ${product.name} changed to ${reservation.status}`,
    entityId: reservation.id,
    entityType: "reservation",
  });

  const counterpartId = user.id === buyer.id ? product.producerId : buyer.id;
  if (counterpartId !== user.id) {
    await notify({
      userId: counterpartId,
      actorId: user.id,
      type: "reservation",
      title: `Reservation ${reservation.status.toLowerCase()}`,
      body: `${user.fullName} marked reservation #${reservation.id} for ${product.name} as ${reservation.status}.`,
      link: "/reservations",
      productId: product.id,
      entityId: reservation.id,
      entityType: "reservation",
    });
  }

  res.json({
    id: reservation.id,
    productId: product.id,
    productName: product.name,
    productImage: product.image,
    producerName: (await producerFor(product.producerId))?.fullName ?? "producer",
    buyerId: buyer.id,
    buyerName: buyer.fullName,
    quantity: Number(reservation.quantity),
    unit: product.unit,
    status: reservation.status,
    createdAt: reservation.createdAt.toISOString(),
  });
});

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

router.get("/messages", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  const rows = await db.select({
    message: messagesTable,
    sender: usersTable,
  }).from(messagesTable).innerJoin(usersTable, eq(messagesTable.senderId, usersTable.id))
    .where(or(eq(messagesTable.senderId, user.id), eq(messagesTable.receiverId, user.id)))
    .orderBy(desc(messagesTable.createdAt));
  const result = await Promise.all(rows.map(async ({ message, sender }: any) => {
    const [receiver] = await db.select().from(usersTable).where(eq(usersTable.id, message.receiverId));
    const [product] = message.productId ? await db.select().from(productsTable).where(eq(productsTable.id, message.productId)) : [];
    return {
      id: message.id,
      senderId: message.senderId,
      senderName: sender.fullName,
      receiverId: message.receiverId,
      receiverName: receiver?.fullName ?? "User",
      productId: message.productId,
      productName: product?.name ?? null,
      message: message.message,
      isRead: message.isRead,
      createdAt: message.createdAt.toISOString(),
    };
  }));
  res.json(GetMessagesResponse.parse(result));
});

router.post("/messages", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  const parsed = SendMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [message] = await db.insert(messagesTable).values({
    senderId: user.id,
    receiverId: parsed.data.receiverId,
    productId: parsed.data.productId,
    message: parsed.data.message,
  }).returning();
  const [receiver] = await db.select().from(usersTable).where(eq(usersTable.id, message.receiverId));

  if (message.receiverId !== user.id) {
    const [aboutProduct] = message.productId
      ? await db.select({ name: productsTable.name }).from(productsTable).where(eq(productsTable.id, message.productId))
      : [];
    await notify({
      userId: message.receiverId,
      actorId: user.id,
      type: "message",
      title: `New message from ${user.fullName}`,
      body: message.message.length > 160 ? `${message.message.slice(0, 157)}…` : message.message,
      link: aboutProduct ? `/products/${message.productId}` : "/messages",
      productId: message.productId,
      entityId: message.id,
      entityType: "message",
    });
  }
  res.status(201).json({
    id: message.id,
    senderId: user.id,
    senderName: user.fullName,
    receiverId: message.receiverId,
    receiverName: receiver?.fullName ?? "User",
    productId: message.productId,
    productName: null,
    message: message.message,
    isRead: message.isRead,
    createdAt: message.createdAt.toISOString(),
  });
});

router.post("/messages/:id/read", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  const id = validId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid message id." });
    return;
  }
  const [message] = await db.update(messagesTable).set({ isRead: true }).where(and(eq(messagesTable.id, id), eq(messagesTable.receiverId, user.id))).returning();
  if (!message) {
    res.status(404).json({ error: "Message not found." });
    return;
  }
  res.json({ id: message.id, senderId: message.senderId, senderName: "User", receiverId: message.receiverId, receiverName: user.fullName, productId: message.productId, productName: null, message: message.message, isRead: true, createdAt: message.createdAt.toISOString() });
});

// ---------------------------------------------------------------------------
// Notifications (activity feed per user)
// ---------------------------------------------------------------------------

router.get("/notifications", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  const requested = Number(req.query.limit);
  const limit = Number.isFinite(requested) ? Math.min(Math.max(Math.trunc(requested), 1), 100) : 40;
  const rows = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, user.id))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(limit);
  res.json(rows.map(toNotification));
});

router.get("/notifications/unread-count", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(notificationsTable)
    .where(and(eq(notificationsTable.userId, user.id), eq(notificationsTable.isRead, false)));
  res.json({ count: Number(row?.count ?? 0) });
});

router.post("/notifications/read-all", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  const updated = await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(and(eq(notificationsTable.userId, user.id), eq(notificationsTable.isRead, false)))
    .returning({ id: notificationsTable.id });
  res.json({ updated: updated.length });
});

router.post("/notifications/:id/read", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  const id = validId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid notification id." });
    return;
  }
  const [notification] = await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, user.id)))
    .returning();
  if (!notification) {
    res.status(404).json({ error: "Notification not found." });
    return;
  }
  res.json(toNotification(notification));
});

router.delete("/notifications/:id", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  const id = validId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid notification id." });
    return;
  }
  const deleted = await db
    .delete(notificationsTable)
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, user.id)))
    .returning({ id: notificationsTable.id });
  if (!deleted.length) {
    res.status(404).json({ error: "Notification not found." });
    return;
  }
  res.sendStatus(204);
});

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

router.get("/profiles/:id", async (req, res): Promise<void> => {
  const id = validId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid profile id." });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) {
    res.status(404).json({ error: "Profile not found." });
    return;
  }
  const products = await listProducts({ availableOnly: false });
  // Public profiles must not expose private contact details or provider ids.
  res.json({
    ...toUser(user),
    email: "",
    phone: null,
    googleId: null,
    products: products.filter((product: any) => product.producerId === id),
  });
});

router.patch("/profile", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [updated] = await db.update(usersTable).set(parsed.data).where(eq(usersTable.id, user.id)).returning();

  await logActivity({
    userId: user.id,
    type: "profile",
    action: "Profile updated",
    details: `User @${updated.username} updated profile information`,
    entityId: user.id,
    entityType: "user",
  });

  res.json({ ...toUser(updated), products: (await listProducts({ availableOnly: false })).filter((product: any) => product.producerId === user.id) });
});

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

router.post("/reports", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  const parsed = CreateReportBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, parsed.data.productId));
  if (!product) {
    res.status(404).json({ error: "Product not found." });
    return;
  }
  const [report] = await db.insert(reportsTable).values({ ...parsed.data, reporterId: user.id }).returning();

  await logActivity({
    userId: user.id,
    type: "report",
    action: "Report filed",
    details: `Listing "${product.name}" reported: ${report.reason}`,
    entityId: report.id,
    entityType: "report",
  });

  await notify({
    userId: product.producerId,
    actorId: user.id,
    type: "report",
    title: "Your listing was reported",
    body: `"${product.name}" was reported for ${report.reason}. An administrator will review it.`,
    link: `/products/${product.id}`,
    productId: product.id,
    entityId: report.id,
    entityType: "report",
  });
  const admins = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.userType, "Administrator"));
  await notifyMany(
    admins.map((row: { id: number }) => row.id),
    {
      actorId: user.id,
      type: "report",
      title: "New listing report",
      body: `${user.fullName} reported "${product.name}" for ${report.reason}.`,
      link: "/admin/reports",
      productId: product.id,
      entityId: report.id,
      entityType: "report",
    },
  );

  res.status(201).json({ id: report.id, reporterId: user.id, reporterName: user.fullName, productId: product.id, productName: product.name, reason: report.reason, description: report.description, status: report.status, createdAt: report.createdAt.toISOString() });
});

// ---------------------------------------------------------------------------
// Administrator Dashboard & Desk
// ---------------------------------------------------------------------------

router.get("/admin/summary", async (req, res): Promise<void> => {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const [
    users,
    administrators,
    farmers,
    fisherfolk,
    buyers,
    products,
    available,
    reserved,
    sold,
    rescue,
    reservations,
    reports,
    recentActivities,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(usersTable),
    db.select({ count: sql<number>`count(*)` }).from(usersTable).where(eq(usersTable.userType, "Administrator")),
    db.select({ count: sql<number>`count(*)` }).from(usersTable).where(eq(usersTable.userType, "Farmer")),
    db.select({ count: sql<number>`count(*)` }).from(usersTable).where(eq(usersTable.userType, "Fisherfolk")),
    db.select({ count: sql<number>`count(*)` }).from(usersTable).where(eq(usersTable.userType, "Buyer")),
    db.select({ count: sql<number>`count(*)` }).from(productsTable),
    db.select({ count: sql<number>`count(*)` }).from(productsTable).where(eq(productsTable.status, "Available")),
    db.select({ count: sql<number>`count(*)` }).from(productsTable).where(eq(productsTable.status, "Reserved")),
    db.select({ count: sql<number>`count(*)` }).from(productsTable).where(eq(productsTable.status, "Sold")),
    db.select({ count: sql<number>`count(*)` }).from(productsTable).where(eq(productsTable.isRescue, true)),
    db.select({ count: sql<number>`count(*)` }).from(reservationsTable),
    db.select({ count: sql<number>`count(*)` }).from(reportsTable).where(eq(reportsTable.status, "Open")),
    db.select().from(activitiesTable).orderBy(desc(activitiesTable.createdAt)).limit(8),
  ]);

  res.json({
    totalUsers: Number(users[0]?.count ?? 0),
    totalAdministrators: Number(administrators[0]?.count ?? 0),
    farmers: Number(farmers[0]?.count ?? 0),
    fisherfolk: Number(fisherfolk[0]?.count ?? 0),
    buyers: Number(buyers[0]?.count ?? 0),
    totalProducts: Number(products[0]?.count ?? 0),
    availableProducts: Number(available[0]?.count ?? 0),
    reservedProducts: Number(reserved[0]?.count ?? 0),
    soldProducts: Number(sold[0]?.count ?? 0),
    rescueListings: Number(rescue[0]?.count ?? 0),
    totalReservations: Number(reservations[0]?.count ?? 0),
    openReports: Number(reports[0]?.count ?? 0),
    recentActivities: recentActivities.map((a: any) => ({
      id: a.id,
      userId: a.userId,
      type: a.type,
      action: a.action,
      details: a.details,
      createdAt: a.createdAt.toISOString(),
    })),
  });
});

// Admin User Management
router.get("/admin/users", async (req, res): Promise<void> => {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const parsed = GetAdminUsersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const role = req.query.role as string | undefined;
  const status = req.query.status as string | undefined;
  const rows = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
  const search = parsed.data.search?.toLowerCase();

  const filtered = rows.filter((user: any) => {
    if (search && !`${user.fullName} ${user.username} ${user.email} ${user.location ?? ""}`.toLowerCase().includes(search)) {
      return false;
    }
    if (role && role !== "All" && user.userType !== role) {
      return false;
    }
    if (status === "active" && !user.isActive) return false;
    if (status === "disabled" && user.isActive) return false;
    return true;
  });

  res.json(filtered.map(toUser));
});

router.get("/admin/users/:id", async (req, res): Promise<void> => {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const id = validId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid user id." });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  const [productsCount, reservationsCount] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(productsTable).where(eq(productsTable.producerId, id)),
    db.select({ count: sql<number>`count(*)` }).from(reservationsTable).where(eq(reservationsTable.buyerId, id)),
  ]);

  res.json({
    ...toUser(user),
    totalProductsListed: Number(productsCount[0]?.count ?? 0),
    totalReservationsMade: Number(reservationsCount[0]?.count ?? 0),
  });
});

router.post("/admin/users", async (req, res): Promise<void> => {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const { fullName, username, email, password, phone, location, userType, bio, isActive } = req.body;
  if (!fullName || !username || !email || !password || !userType) {
    res.status(400).json({ error: "Full name, username, email, password, and user type are required." });
    return;
  }

  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(or(eq(usersTable.username, username.trim()), eq(usersTable.email, email.trim().toLowerCase())))
    .limit(1);

  if (existing.length) {
    res.status(400).json({ error: "Username or email is already taken." });
    return;
  }

  const [newUser] = await db.insert(usersTable).values({
    fullName: fullName.trim(),
    username: username.trim(),
    email: email.trim().toLowerCase(),
    passwordHash: hashPassword(password),
    phone: phone ? phone.trim() : null,
    location: location ? location.trim() : "Samar, Philippines",
    userType,
    bio: bio ? bio.trim() : null,
    isActive: isActive !== false,
  }).returning();

  await logActivity({
    userId: admin.id,
    type: "admin",
    action: "User account created",
    details: `Administrator created user @${newUser.username} (${newUser.userType})`,
    entityId: newUser.id,
    entityType: "user",
  });

  res.status(201).json(toUser(newUser));
});

router.patch("/admin/users/:id", async (req, res): Promise<void> => {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const id = validId(req.params.id);
  const parsed = UpdateAdminUserBody.safeParse(req.body);
  if (!id || !parsed.success) {
    res.status(400).json({ error: parsed.success ? "Invalid user id." : parsed.error.message });
    return;
  }

  const requestedActive = req.body.isActive;
  const requestedRole = req.body.userType;

  // Prevent admin from deactivating their own account
  if (id === admin.id && requestedActive === false) {
    res.status(400).json({ error: "You cannot disable your own administrator account." });
    return;
  }

  // Prevent removing the last admin
  if (id === admin.id && requestedRole && requestedRole !== "Administrator") {
    const [adminCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(usersTable)
      .where(and(eq(usersTable.userType, "Administrator"), eq(usersTable.isActive, true)));
    if (Number(adminCount?.count ?? 0) <= 1) {
      res.status(400).json({ error: "Cannot revoke permissions from the only active administrator." });
      return;
    }
  }

  const updateFields: Record<string, any> = {};
  if (req.body.isActive !== undefined) updateFields.isActive = req.body.isActive;
  if (req.body.userType !== undefined) updateFields.userType = req.body.userType;
  if (req.body.fullName !== undefined) updateFields.fullName = req.body.fullName;
  if (req.body.phone !== undefined) updateFields.phone = req.body.phone;
  if (req.body.location !== undefined) updateFields.location = req.body.location;

  const [user] = await db.update(usersTable).set(updateFields).where(eq(usersTable.id, id)).returning();
  if (!user) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  await logActivity({
    userId: admin.id,
    type: "admin",
    action: "User updated",
    details: `Administrator updated user @${user.username} (Role: ${user.userType}, Active: ${user.isActive})`,
    entityId: user.id,
    entityType: "user",
  });

  if (user.id !== admin.id) {
    const disabled = requestedActive === false;
    await notify({
      userId: user.id,
      actorId: admin.id,
      type: "admin",
      title: disabled ? "Your account was disabled" : "Your account was updated",
      body: disabled
        ? "An administrator disabled your account. Contact the AgriRescue desk for help."
        : `An administrator updated your account details${requestedRole ? ` (role: ${user.userType})` : ""}.`,
      link: "/profile",
      entityId: user.id,
      entityType: "user",
    });
  }

  res.json(toUser(user));
});

router.delete("/admin/users/:id", async (req, res): Promise<void> => {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const id = validId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid user id." });
    return;
  }

  if (id === admin.id) {
    res.status(400).json({ error: "You cannot delete your own administrator account." });
    return;
  }

  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!target) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  await db.delete(usersTable).where(eq(usersTable.id, id));

  await logActivity({
    userId: admin.id,
    type: "admin",
    action: "User deleted",
    details: `Administrator deleted user @${target.username} (${target.fullName})`,
    entityId: id,
    entityType: "user",
  });

  res.sendStatus(204);
});

// Admin Product Management
router.get("/admin/products", async (req, res): Promise<void> => {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const parsed = GetAdminProductsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  res.json(await listProducts({ availableOnly: false, search: parsed.data.search }));
});

router.post("/admin/products", async (req, res): Promise<void> => {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const { name, category, description, price, quantity, unit, location, image, images, availabilityDate, isRescue, producerId } = req.body;
  if (!name || !category || price == null || quantity == null || !unit || !location) {
    res.status(400).json({ error: "Product name, category, price, quantity, unit, and location are required." });
    return;
  }

  const gallery = normalizeGallery(Array.isArray(images) ? images : undefined, image ? String(image) : null);
  const targetProducerId = producerId ? Number(producerId) : admin.id;
  const [product] = await db.insert(productsTable).values({
    producerId: targetProducerId,
    name: String(name),
    category: String(category),
    description: description ? String(description) : null,
    price: String(price),
    quantity: String(quantity),
    unit: String(unit),
    location: String(location),
    image: gallery.image,
    images: gallery.images,
    availabilityDate: availabilityDate ? String(availabilityDate) : new Date().toISOString().slice(0, 10),
    isRescue: Boolean(isRescue),
  }).returning();

  await logActivity({
    userId: admin.id,
    type: "admin",
    action: "Product created by admin",
    details: `Admin added product "${product.name}" (ID #${product.id})`,
    entityId: product.id,
    entityType: "product",
  });

  res.status(201).json(await productWithProducer(product));
});

router.patch("/admin/products/:id", async (req, res): Promise<void> => {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const id = validId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid product id." });
    return;
  }

  const [existing] = await db.select().from(productsTable).where(eq(productsTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Product not found." });
    return;
  }

  const updateData: Record<string, any> = { updatedAt: new Date() };
  if (req.body.name !== undefined) updateData.name = req.body.name;
  if (req.body.category !== undefined) updateData.category = req.body.category;
  if (req.body.description !== undefined) updateData.description = req.body.description;
  if (req.body.price !== undefined) updateData.price = String(req.body.price);
  if (req.body.quantity !== undefined) updateData.quantity = String(req.body.quantity);
  if (req.body.unit !== undefined) updateData.unit = req.body.unit;
  if (req.body.location !== undefined) updateData.location = req.body.location;
  if (req.body.image !== undefined) updateData.image = req.body.image;
  if (Array.isArray(req.body.images)) {
    const gallery = normalizeGallery(req.body.images, req.body.image ?? existing.image);
    updateData.image = gallery.image;
    updateData.images = gallery.images;
  } else if (req.body.image !== undefined) {
    updateData.images = req.body.image ? [req.body.image] : [];
  }
  if (req.body.availabilityDate !== undefined) updateData.availabilityDate = req.body.availabilityDate;
  if (req.body.status !== undefined) updateData.status = req.body.status;
  if (req.body.isRescue !== undefined) updateData.isRescue = Boolean(req.body.isRescue);

  const [updated] = await db.update(productsTable).set(updateData).where(eq(productsTable.id, id)).returning();

  await logActivity({
    userId: admin.id,
    type: "admin",
    action: "Product updated by admin",
    details: `Admin updated listing "${updated.name}" (ID #${updated.id})`,
    entityId: updated.id,
    entityType: "product",
  });

  res.json(await productWithProducer(updated));
});

router.delete("/admin/products/:id", async (req, res): Promise<void> => {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const id = validId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid product id." });
    return;
  }

  const [existing] = await db.select().from(productsTable).where(eq(productsTable.id, id));
  if (existing) {
    await db.delete(productsTable).where(eq(productsTable.id, id));
    await logActivity({
      userId: admin.id,
      type: "admin",
      action: "Product deleted by admin",
      details: `Admin deleted product "${existing.name}" (ID #${id})`,
      entityId: id,
      entityType: "product",
    });
    await notify({
      userId: existing.producerId,
      actorId: admin.id,
      type: "admin",
      title: "Listing removed",
      body: `An administrator removed your listing "${existing.name}".`,
      link: "/my-products",
      entityId: id,
      entityType: "product",
    });
  }

  res.sendStatus(204);
});

// Admin Reports
router.get("/admin/reports", async (req, res): Promise<void> => {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const rows = await db
    .select({ report: reportsTable, reporter: usersTable, product: productsTable })
    .from(reportsTable)
    .innerJoin(usersTable, eq(reportsTable.reporterId, usersTable.id))
    .innerJoin(productsTable, eq(reportsTable.productId, productsTable.id))
    .orderBy(desc(reportsTable.createdAt));

  res.json(
    rows.map(({ report, reporter, product }: any) => ({
      id: report.id,
      reporterId: reporter.id,
      reporterName: reporter.fullName,
      productId: product.id,
      productName: product.name,
      reason: report.reason,
      description: report.description,
      status: report.status,
      createdAt: report.createdAt.toISOString(),
    }))
  );
});

router.patch("/admin/reports/:id", async (req, res): Promise<void> => {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const id = validId(req.params.id);
  const parsed = UpdateAdminReportBody.safeParse(req.body);
  if (!id || !parsed.success) {
    res.status(400).json({ error: parsed.success ? "Invalid report id." : parsed.error.message });
    return;
  }
  const [report] = await db.update(reportsTable).set(parsed.data).where(eq(reportsTable.id, id)).returning();
  if (!report) {
    res.status(404).json({ error: "Report not found." });
    return;
  }
  const [reporter] = await db.select().from(usersTable).where(eq(usersTable.id, report.reporterId));
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, report.productId));

  await logActivity({
    userId: admin.id,
    type: "admin",
    action: "Report status updated",
    details: `Report #${report.id} updated to ${report.status}`,
    entityId: report.id,
    entityType: "report",
  });

  await notify({
    userId: report.reporterId,
    actorId: admin.id,
    type: "report",
    title: `Report ${report.status.toLowerCase()}`,
    body: `Your report about "${product?.name ?? "a listing"}" is now ${report.status.toLowerCase()}.`,
    link: product ? `/products/${product.id}` : "/products",
    productId: report.productId,
    entityId: report.id,
    entityType: "report",
  });

  res.json({
    id: report.id,
    reporterId: report.reporterId,
    reporterName: reporter?.fullName ?? "User",
    productId: report.productId,
    productName: product?.name ?? "Removed listing",
    reason: report.reason,
    description: report.description,
    status: report.status,
    createdAt: report.createdAt.toISOString(),
  });
});

// Admin Activities (Audit Log)
router.get("/admin/activities", async (req, res): Promise<void> => {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const rows = await db
    .select({
      activity: activitiesTable,
      user: usersTable,
    })
    .from(activitiesTable)
    .leftJoin(usersTable, eq(activitiesTable.userId, usersTable.id))
    .orderBy(desc(activitiesTable.createdAt))
    .limit(100);

  res.json(
    rows.map(({ activity, user }: any) => ({
      id: activity.id,
      userId: activity.userId,
      userName: user?.fullName ?? "System",
      userType: user?.userType ?? "System",
      type: activity.type,
      action: activity.action,
      details: activity.details,
      entityId: activity.entityId,
      entityType: activity.entityType,
      createdAt: activity.createdAt.toISOString(),
    }))
  );
});

// ---------------------------------------------------------------------------
// Database Viewer (Requirement 6 - Secure Direct Database Management)
// ---------------------------------------------------------------------------

const DB_TABLE_MAP: Record<
  string,
  {
    name: string;
    table: any;
    description: string;
    columns: string[];
    sanitizeRow: (row: any) => any;
  }
> = {
  agri_users: {
    name: "Users (agri_users)",
    table: usersTable,
    description: "Registered producers, buyers, and platform administrators",
    columns: ["id", "fullName", "username", "email", "passwordHash", "phone", "location", "userType", "profileImage", "googleId", "isActive", "createdAt"],
    sanitizeRow: (row: any) => ({
      ...row,
      passwordHash: "[REDACTED_PASSWORD_HASH]",
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    }),
  },
  agri_products: {
    name: "Products (agri_products)",
    table: productsTable,
    description: "Surplus agricultural produce and seafood inventory",
    columns: ["id", "producerId", "name", "category", "description", "price", "quantity", "unit", "location", "image", "images", "availabilityDate", "status", "isRescue", "createdAt", "updatedAt"],
    sanitizeRow: (row: any) => ({
      ...row,
      price: row.price != null ? Number(row.price) : 0,
      quantity: row.quantity != null ? Number(row.quantity) : 0,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
    }),
  },
  agri_reservations: {
    name: "Reservations (agri_reservations)",
    table: reservationsTable,
    description: "Buyer reservation requests and status records",
    columns: ["id", "productId", "buyerId", "quantity", "status", "createdAt", "updatedAt"],
    sanitizeRow: (row: any) => ({
      ...row,
      quantity: row.quantity != null ? Number(row.quantity) : 0,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
    }),
  },
  agri_messages: {
    name: "Messages (agri_messages)",
    table: messagesTable,
    description: "Direct community communication between buyers and sellers",
    columns: ["id", "senderId", "receiverId", "productId", "message", "isRead", "createdAt"],
    sanitizeRow: (row: any) => ({
      ...row,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    }),
  },
  agri_reports: {
    name: "Reports (agri_reports)",
    table: reportsTable,
    description: "Marketplace listing reports and community moderation",
    columns: ["id", "reporterId", "productId", "reason", "description", "status", "createdAt"],
    sanitizeRow: (row: any) => ({
      ...row,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    }),
  },
  agri_notifications: {
    name: "Notifications (agri_notifications)",
    table: notificationsTable,
    description: "In-app activity notifications for reservations, messages, and moderation",
    columns: ["id", "userId", "actorId", "type", "title", "body", "link", "productId", "entityId", "entityType", "isRead", "createdAt"],
    sanitizeRow: (row: any) => ({
      ...row,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    }),
  },
  agri_activities: {
    name: "Audit Logs (agri_activities)",
    table: activitiesTable,
    description: "System audit logs, administrative actions, and user events",
    columns: ["id", "userId", "type", "action", "details", "entityId", "entityType", "createdAt"],
    sanitizeRow: (row: any) => ({
      ...row,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    }),
  },
};

router.get("/admin/database/tables", async (req, res): Promise<void> => {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const tables = await Promise.all(
    Object.entries(DB_TABLE_MAP).map(async ([key, meta]) => {
      const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(meta.table);
      return {
        id: key,
        name: meta.name,
        description: meta.description,
        columns: meta.columns,
        rowCount: Number(countResult?.count ?? 0),
      };
    })
  );

  res.json(tables);
});

router.get("/admin/database/:table", async (req, res): Promise<void> => {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const tableName = req.params.table;
  const tableConfig = DB_TABLE_MAP[tableName];
  if (!tableConfig) {
    res.status(404).json({ error: `Table '${tableName}' not found or not permitted.` });
    return;
  }

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const offset = (page - 1) * limit;
  const search = typeof req.query.search === "string" ? req.query.search.trim().toLowerCase() : "";

  const allRows = await db.select().from(tableConfig.table).orderBy(desc(tableConfig.table.id));

  let filteredRows = allRows;
  if (search) {
    filteredRows = allRows.filter((row: any) =>
      Object.values(row).some((val) =>
        String(val ?? "").toLowerCase().includes(search)
      )
    );
  }

  const total = filteredRows.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const pagedRows = filteredRows.slice(offset, offset + limit).map(tableConfig.sanitizeRow);

  res.json({
    table: tableName,
    displayName: tableConfig.name,
    page,
    limit,
    total,
    totalPages,
    columns: tableConfig.columns,
    rows: pagedRows,
  });
});

router.get("/admin/database/:table/:id", async (req, res): Promise<void> => {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const tableName = req.params.table;
  const tableConfig = DB_TABLE_MAP[tableName];
  if (!tableConfig) {
    res.status(404).json({ error: `Table '${tableName}' not found.` });
    return;
  }

  const id = validId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid record id." });
    return;
  }

  const [record] = await db.select().from(tableConfig.table).where(eq(tableConfig.table.id, id));
  if (!record) {
    res.status(404).json({ error: "Record not found." });
    return;
  }

  res.json(tableConfig.sanitizeRow(record));
});

export default router;
