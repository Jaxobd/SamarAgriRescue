import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  or,
  sql,
} from "drizzle-orm";
import {
  activitiesTable,
  db,
  messagesTable,
  notificationsTable,
  productsTable,
  reportsTable,
  reservationsTable,
  usersTable,
  type Activity,
  type Notification,
  type Product,
  type User,
} from "@workspace/db";

// Only local development may fall back to the well-known demo key. Any other
// environment (including hosts that leave NODE_ENV unset, such as Render) gets
// a random per-process key so published source can never forge a session.
const configuredSessionSecret = process.env.SESSION_SECRET;
const sessionSecret = configuredSessionSecret
  ?? (process.env.NODE_ENV === "development"
    ? "samar-agrirescue-development-secret"
    : randomBytes(32).toString("hex"));
if (!configuredSessionSecret) {
  console.warn(
    "[session] SESSION_SECRET is not set; using a random per-process key, so logins will not survive a restart.",
  );
}

export type SessionUser = User;

const iso = (value: Date | string | null | undefined) =>
  value instanceof Date ? value.toISOString() : value ?? null;
const numberValue = (value: string | number | null | undefined) =>
  value == null ? 0 : Number(value);

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 32).toString("hex")}`;
}

export function verifyPassword(password: string, encoded: string): boolean {
  const [salt, expected] = encoded.split(":");
  if (!salt || !expected) return false;
  const actual = scryptSync(password, salt, 32).toString("hex");
  return actual.length === expected.length && timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

function sign(value: string): string {
  return createHmac("sha256", sessionSecret).update(value).digest("hex");
}

export function sessionCookie(userId: number): string {
  const value = String(userId);
  return `${value}.${sign(value)}`;
}

export function userIdFromCookie(header: string | undefined): number | null {
  const raw = header?.split(";").find((part) => part.trim().startsWith("samar_session="));
  if (!raw) return null;
  const value = raw.trim().slice("samar_session=".length);
  const [id, signature] = value.split(".");
  if (!id || !signature || signature !== sign(id) || !/^\d+$/.test(id)) return null;
  return Number(id);
}

export async function currentUser(cookieHeader: string | undefined): Promise<User | null> {
  const id = userIdFromCookie(cookieHeader);
  if (!id) return null;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  return user?.isActive ? user : null;
}

export function toUser(user: User) {
  return {
    id: user.id,
    fullName: user.fullName,
    username: user.username,
    email: user.email,
    phone: user.phone,
    location: user.location,
    userType: user.userType,
    profileImage: user.profileImage,
    bio: user.bio,
    googleId: user.googleId ?? null,
    isActive: user.isActive,
    createdAt: iso(user.createdAt),
  };
}

export async function logActivity(options: {
  userId?: number | null;
  type: string;
  action: string;
  details?: string;
  entityId?: number;
  entityType?: string;
}) {
  try {
    await db.insert(activitiesTable).values({
      userId: options.userId ?? null,
      type: options.type,
      action: options.action,
      details: options.details ?? null,
      entityId: options.entityId ?? null,
      entityType: options.entityType ?? null,
    });
  } catch (err) {
    console.error("Activity logging error:", err);
  }
}

export type NotifyInput = {
  userId: number;
  actorId?: number | null;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  productId?: number | null;
  entityId?: number | null;
  entityType?: string | null;
};

export async function notify(options: NotifyInput) {
  try {
    await db.insert(notificationsTable).values({
      userId: options.userId,
      actorId: options.actorId ?? null,
      type: options.type,
      title: options.title,
      body: options.body ?? null,
      link: options.link ?? null,
      productId: options.productId ?? null,
      entityId: options.entityId ?? null,
      entityType: options.entityType ?? null,
    });
  } catch (err) {
    console.error("Notification error:", err);
  }
}

export async function notifyMany(userIds: number[], options: Omit<NotifyInput, "userId">) {
  const unique = [...new Set(userIds)].filter(Boolean);
  await Promise.all(unique.map((userId) => notify({ ...options, userId })));
}

export function toNotification(notification: Notification) {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    link: notification.link,
    productId: notification.productId,
    entityId: notification.entityId,
    entityType: notification.entityType,
    isRead: notification.isRead,
    createdAt: iso(notification.createdAt),
  };
}

export function getGoogleOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "";
  return {
    enabled: Boolean(clientId && clientSecret),
    clientId: clientId || null,
  };
}

export async function verifyGoogleIdToken(idToken: string) {
  const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Invalid Google ID token: ${text}`);
  }
  const payload = (await res.json()) as any;
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  if (clientId && payload.aud !== clientId) {
    throw new Error("Google token audience mismatch");
  }
  return {
    googleId: payload.sub as string,
    email: (payload.email as string).toLowerCase(),
    fullName: (payload.name as string) || (payload.email as string).split("@")[0],
    profileImage: (payload.picture as string) || null,
    emailVerified: payload.email_verified === "true" || payload.email_verified === true,
  };
}

export async function exchangeGoogleCode(code: string, redirectUri: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth credentials are not configured on the server.");
  }
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`Google token exchange failed: ${errText}`);
  }
  const tokens = (await tokenRes.json()) as any;
  if (!tokens.id_token) {
    throw new Error("Google authentication response did not contain an id_token.");
  }
  return verifyGoogleIdToken(tokens.id_token);
}

export async function findOrCreateGoogleUser(profile: {
  googleId: string;
  email: string;
  fullName: string;
  profileImage: string | null;
  userType?: string;
}): Promise<User> {
  const email = profile.email.toLowerCase();

  // 1. Try finding by googleId
  const [byGoogle] = await db.select().from(usersTable).where(eq(usersTable.googleId, profile.googleId));
  if (byGoogle) {
    if (!byGoogle.isActive) {
      throw new Error("This account has been deactivated. Please contact an administrator.");
    }
    if (!byGoogle.profileImage && profile.profileImage) {
      await db.update(usersTable).set({ profileImage: profile.profileImage }).where(eq(usersTable.id, byGoogle.id));
      byGoogle.profileImage = profile.profileImage;
    }
    return byGoogle;
  }

  // 2. Try finding by email (prevent duplicate accounts for the same email)
  const [byEmail] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (byEmail) {
    if (!byEmail.isActive) {
      throw new Error("This account has been deactivated. Please contact an administrator.");
    }
    const [updated] = await db.update(usersTable).set({
      googleId: profile.googleId,
      profileImage: byEmail.profileImage || profile.profileImage,
    }).where(eq(usersTable.id, byEmail.id)).returning();
    return updated;
  }

  // 3. Register new account with Google credentials
  const baseUsername = email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "").slice(0, 50) || "user";
  let username = baseUsername;
  let suffix = 1;
  while (true) {
    const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, username)).limit(1);
    if (!existing.length) break;
    username = `${baseUsername}${suffix++}`;
  }

  const unguessablePassword = randomBytes(32).toString("hex");
  const [newUser] = await db.insert(usersTable).values({
    fullName: profile.fullName || username,
    username,
    email,
    passwordHash: hashPassword(unguessablePassword),
    userType: profile.userType || "Buyer",
    profileImage: profile.profileImage,
    googleId: profile.googleId,
    location: "Samar, Philippines",
    bio: "Joined via Google Sign-In.",
    isActive: true,
  }).returning();

  return newUser;
}

export function toProduct(product: Product, producer?: User) {
  const gallery = Array.isArray(product.images) ? product.images.filter(Boolean) : [];
  const cover = product.image || gallery[0] || null;
  return {
    id: product.id,
    producerId: product.producerId,
    producerName: producer?.fullName ?? "Local producer",
    producerType: producer?.userType ?? "Producer",
    name: product.name,
    category: product.category,
    description: product.description,
    price: numberValue(product.price),
    quantity: numberValue(product.quantity),
    unit: product.unit,
    location: product.location,
    image: cover,
    images: gallery.length ? gallery : cover ? [cover] : [],
    availabilityDate: product.availabilityDate,
    status: product.status,
    isRescue: product.isRescue,
    createdAt: iso(product.createdAt),
  };
}

export async function productWithProducer(product: Product) {
  const [producer] = await db.select().from(usersTable).where(eq(usersTable.id, product.producerId));
  return toProduct(product, producer);
}

export async function listProducts(options: {
  search?: string;
  category?: string;
  location?: string;
  status?: string;
  rescue?: boolean;
  sort?: string;
  availableOnly?: boolean;
}) {
  const conditions = [];
  if (options.availableOnly) conditions.push(eq(productsTable.status, "Available"));
  if (options.category) conditions.push(eq(productsTable.category, options.category));
  if (options.location) conditions.push(ilike(productsTable.location, `%${options.location}%`));
  if (options.status) conditions.push(eq(productsTable.status, options.status));
  if (options.rescue) conditions.push(eq(productsTable.isRescue, true));

  const rows = await db
    .select({ product: productsTable, producer: usersTable })
    .from(productsTable)
    .innerJoin(usersTable, eq(productsTable.producerId, usersTable.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(options.sort === "price_asc" ? asc(productsTable.price) : options.sort === "price_desc" ? desc(productsTable.price) : desc(productsTable.createdAt));

  const search = options.search?.trim().toLowerCase();
  return rows
    .map(({ product, producer }: any) => toProduct(product, producer))
    .filter((product: any) => !search || `${product.name} ${product.description ?? ""} ${product.producerName} ${product.location}`.toLowerCase().includes(search));
}

export const demoPhotoByName: Record<string, string> = {
  "Fresh Tomatoes": "/produce/tomatoes.jpg",
  "Saba Bananas": "/produce/saba-bananas.jpg",
  "Premium Samar Rice": "/produce/rice.jpg",
  "Fresh Tuna": "/produce/tuna.jpg",
  "Morning Squid": "/produce/squid.jpg",
  "Fresh Tilapia": "/produce/tilapia.jpg",
};

async function backfillDemoPhotos() {
  for (const [name, photo] of Object.entries(demoPhotoByName)) {
    await db
      .update(productsTable)
      .set({ image: photo, images: [photo] })
      .where(and(eq(productsTable.name, name), sql`(image IS NULL OR image = '')`))
      .catch((err: unknown) => console.error("Photo backfill error:", err));
  }
}

export async function seedDemoData() {
  const existing = await db.select({ id: usersTable.id }).from(usersTable).limit(1);
  if (existing.length) {
    await backfillDemoPhotos();
    return;
  }

  const [farmer, fisher, buyer, admin] = await db
    .insert(usersTable)
    .values([
      {
        fullName: "Juan Dela Cruz",
        username: "juanfarmer",
        email: "juan@samaragr irescue.local".replace(" ", ""),
        passwordHash: hashPassword("demo123"),
        phone: "0917 555 0142",
        location: "Calbayog City, Samar",
        userType: "Farmer",
        bio: "Local farmer offering fresh vegetables and seasonal crops.",
      },
      {
        fullName: "Lina Marasigan",
        username: "linafisher",
        email: "lina@samaragrirescue.local",
        passwordHash: hashPassword("demo123"),
        phone: "0918 555 0188",
        location: "Guiuan, Eastern Samar",
        userType: "Fisherfolk",
        bio: "Small-scale fisherfolk sharing the morning catch with nearby families.",
      },
      {
        fullName: "Maya Santos",
        username: "mayabuyer",
        email: "maya@samaragrirescue.local",
        passwordHash: hashPassword("demo123"),
        phone: "0919 555 0191",
        location: "Catbalogan City, Samar",
        userType: "Buyer",
        bio: "Local café owner looking for fresh, nearby ingredients.",
      },
      {
        fullName: "AgriRescue Admin",
        username: "admin",
        email: "admin@samaragrirescue.local",
        passwordHash: hashPassword("admin123"),
        phone: "0900 000 0000",
        location: "Catbalogan City, Samar",
        userType: "Administrator",
        bio: "Platform administrator.",
      },
    ])
    .returning();

  await db.insert(productsTable).values([
    {
      producerId: farmer.id,
      name: "Fresh Tomatoes",
      image: "/produce/tomatoes.jpg",
      images: ["/produce/tomatoes.jpg"],
      category: "Vegetables",
      description: "Bright, ripe tomatoes picked this morning from a family farm.",
      price: "85",
      quantity: "24",
      unit: "kilogram",
      location: "Calbayog City, Samar",
      availabilityDate: new Date().toISOString().slice(0, 10),
      isRescue: true,
    },
    {
      producerId: farmer.id,
      name: "Saba Bananas",
      image: "/produce/saba-bananas.jpg",
      images: ["/produce/saba-bananas.jpg"],
      category: "Fruits",
      description: "Naturally ripening saba bananas, ideal for snacks and cooking.",
      price: "60",
      quantity: "12",
      unit: "basket",
      location: "Basey, Samar",
      availabilityDate: new Date().toISOString().slice(0, 10),
      isRescue: false,
    },
    {
      producerId: farmer.id,
      name: "Premium Samar Rice",
      image: "/produce/rice.jpg",
      images: ["/produce/rice.jpg"],
      category: "Rice & Grains",
      description: "Clean, locally grown rice from the latest harvest.",
      price: "1450",
      quantity: "8",
      unit: "sack",
      location: "Catbalogan City, Samar",
      availabilityDate: new Date().toISOString().slice(0, 10),
      isRescue: false,
    },
    {
      producerId: fisher.id,
      name: "Fresh Tuna",
      image: "/produce/tuna.jpg",
      images: ["/produce/tuna.jpg"],
      category: "Fish",
      description: "Fresh catch landed in Guiuan, handled and chilled for pickup.",
      price: "280",
      quantity: "18",
      unit: "kilogram",
      location: "Guiuan, Eastern Samar",
      availabilityDate: new Date().toISOString().slice(0, 10),
      isRescue: true,
    },
    {
      producerId: fisher.id,
      name: "Morning Squid",
      image: "/produce/squid.jpg",
      images: ["/produce/squid.jpg"],
      category: "Seafood",
      description: "Tender morning catch, perfect for grilling or adobo.",
      price: "240",
      quantity: "9",
      unit: "kilogram",
      location: "Borongan City, Eastern Samar",
      availabilityDate: new Date().toISOString().slice(0, 10),
      isRescue: true,
    },
    {
      producerId: fisher.id,
      name: "Fresh Tilapia",
      image: "/produce/tilapia.jpg",
      images: ["/produce/tilapia.jpg"],
      category: "Fish",
      description: "Fresh whole tilapia from a local pond partner.",
      price: "190",
      quantity: "15",
      unit: "kilogram",
      location: "Borongan City, Eastern Samar",
      availabilityDate: new Date().toISOString().slice(0, 10),
      isRescue: false,
    },
  ]);

  await logActivity({
    userId: admin.id,
    type: "system",
    action: "Platform initialized",
    details: "Marketplace seeded with demo producers, buyers, and surplus food listings.",
  });

  await notify({
    userId: buyer.id,
    type: "system",
    title: "Welcome to Samar AgriRescue",
    body: "Browse rescue listings near you and reserve fresh produce before it goes to waste.",
    link: "/products",
  });
  for (const producer of [farmer, fisher]) {
    await notify({
      userId: producer.id,
      type: "system",
      title: "Your listings are live",
      body: "Buyers across Samar can now find your produce. Keep quantities up to date.",
      link: "/my-products",
    });
  }
}

export async function producerFor(id: number) {
  const [producer] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  return producer;
}

export const statusChoices = ["Pending", "Confirmed", "Cancelled", "Completed"] as const;
