import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import {
  db,
  messagesTable,
  productsTable,
  reportsTable,
  reservationsTable,
  usersTable,
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
  hashPassword,
  listProducts,
  productWithProducer,
  producerFor,
  sessionCookie,
  toProduct,
  toUser,
  userIdFromCookie,
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

router.get("/stats", async (_req, res): Promise<void> => {
  const [products, producers, rescued, buyers] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(productsTable).where(eq(productsTable.status, "Available")),
    db.select({ count: sql<number>`count(*)` }).from(usersTable).where(or(eq(usersTable.userType, "Farmer"), eq(usersTable.userType, "Fisherfolk"))),
    db.select({ count: sql<number>`count(*)` }).from(reservationsTable).where(eq(reservationsTable.status, "Completed")),
    db.select({ count: sql<number>`count(*)` }).from(usersTable).where(and(eq(usersTable.userType, "Buyer"), eq(usersTable.isActive, true))),
  ]);
  res.json(GetStatsResponse.parse({
    availableProducts: Number(products[0]?.count ?? 0),
    registeredProducers: Number(producers[0]?.count ?? 0),
    productsRescued: Number(rescued[0]?.count ?? 0),
    activeBuyers: Number(buyers[0]?.count ?? 0),
  }));
});

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
  const existing = await db.select({ id: usersTable.id }).from(usersTable).where(or(eq(usersTable.username, parsed.data.username), eq(usersTable.email, parsed.data.email))).limit(1);
  if (existing.length) {
    res.status(400).json({ error: "That username or email is already in use." });
    return;
  }
  const [user] = await db.insert(usersTable).values({
    ...parsed.data,
    passwordHash: hashPassword(parsed.data.password),
  }).returning();
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
  res.setHeader("Set-Cookie", `samar_session=${sessionCookie(user.id)}; ${cookieOptions}`);
  res.json(LoginResponse.parse({ user: toUser(user) }));
});

router.post("/auth/logout", (_req, res): void => {
  res.setHeader("Set-Cookie", `samar_session=; ${clearCookie}`);
  res.sendStatus(204);
});

router.get("/products", async (req, res): Promise<void> => {
  const parsed = GetProductsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const products = await listProducts({
    ...parsed.data,
    availableOnly: !parsed.data.status || parsed.data.status === "Available",
  });
  res.json(GetProductsResponse.parse(products));
});

router.post("/products", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  if (user.userType !== "Farmer" && user.userType !== "Fisherfolk") {
    res.status(403).json({ error: "Only farmers and fisherfolk can create listings." });
    return;
  }
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [product] = await db.insert(productsTable).values({
    producerId: user.id,
    name: parsed.data.name,
    category: parsed.data.category,
    description: parsed.data.description,
    price: String(parsed.data.price),
    quantity: String(parsed.data.quantity),
    unit: parsed.data.unit,
    location: parsed.data.location,
    image: parsed.data.image,
    availabilityDate: parsed.data.availabilityDate,
    isRescue: parsed.data.isRescue ?? false,
  }).returning();
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
  const [product] = await db.update(productsTable).set({
    ...parsed.data,
    price: parsed.data.price == null ? existing.price : String(parsed.data.price),
    quantity: parsed.data.quantity == null ? existing.quantity : String(parsed.data.quantity),
    updatedAt: new Date(),
  }).where(eq(productsTable.id, id)).returning();
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
  res.json(GetProductResponse.parse(await productWithProducer(product)));
});

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
  const result = rows.map(({ reservation, product, buyer }) => ({
    id: reservation.id,
    productId: product.id,
    productName: product.name,
    productImage: product.image,
    producerName: "producer",
    buyerId: buyer.id,
    buyerName: buyer.fullName,
    quantity: Number(reservation.quantity),
    unit: product.unit,
    status: reservation.status,
    createdAt: reservation.createdAt.toISOString(),
  }));
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
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, parsed.data.productId));
  if (!product || product.status !== "Available" || Number(product.quantity) < parsed.data.quantity) {
    res.status(400).json({ error: "That quantity is no longer available." });
    return;
  }
  const remaining = Number(product.quantity) - parsed.data.quantity;
  const [reservation] = await db.insert(reservationsTable).values({
    productId: product.id,
    buyerId: user.id,
    quantity: String(parsed.data.quantity),
  }).returning();
  await db.update(productsTable).set({
    quantity: String(remaining),
    status: remaining <= 0 ? "Reserved" : "Available",
    updatedAt: new Date(),
  }).where(eq(productsTable.id, product.id));
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
  const [row] = await db.select({
    reservation: reservationsTable,
    product: productsTable,
    buyer: usersTable,
  }).from(reservationsTable).innerJoin(productsTable, eq(reservationsTable.productId, productsTable.id)).innerJoin(usersTable, eq(reservationsTable.buyerId, usersTable.id)).where(eq(reservationsTable.id, id));
  if (!row) {
    res.status(404).json({ error: "Reservation not found." });
    return;
  }
  if (row.buyer.id !== user.id && row.product.producerId !== user.id && user.userType !== "Administrator") {
    res.status(403).json({ error: "You cannot update this reservation." });
    return;
  }
  const [reservation] = await db.update(reservationsTable).set({ status: parsed.data.status, updatedAt: new Date() }).where(eq(reservationsTable.id, id)).returning();
  res.json({
    id: reservation.id,
    productId: row.product.id,
    productName: row.product.name,
    productImage: row.product.image,
    producerName: (await producerFor(row.product.producerId))?.fullName ?? "producer",
    buyerId: row.buyer.id,
    buyerName: row.buyer.fullName,
    quantity: Number(reservation.quantity),
    unit: row.product.unit,
    status: reservation.status,
    createdAt: reservation.createdAt.toISOString(),
  });
});

router.get("/messages", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  const rows = await db.select({
    message: messagesTable,
    sender: usersTable,
  }).from(messagesTable).innerJoin(usersTable, eq(messagesTable.senderId, usersTable.id))
    .where(or(eq(messagesTable.senderId, user.id), eq(messagesTable.receiverId, user.id)))
    .orderBy(desc(messagesTable.createdAt));
  const result = await Promise.all(rows.map(async ({ message, sender }) => {
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
  res.json({ ...toUser(user), products: products.filter((product) => product.producerId === id) });
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
  res.json({ ...toUser(updated), products: (await listProducts({ availableOnly: false })).filter((product) => product.producerId === user.id) });
});

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
  res.status(201).json({ id: report.id, reporterId: user.id, reporterName: user.fullName, productId: product.id, productName: product.name, reason: report.reason, description: report.description, status: report.status, createdAt: report.createdAt.toISOString() });
});

router.get("/admin/summary", async (req, res): Promise<void> => {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const [users, farmers, fisherfolk, buyers, products, available, reserved, sold, rescue, reservations, reports] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(usersTable),
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
  ]);
  res.json({ totalUsers: Number(users[0]?.count ?? 0), farmers: Number(farmers[0]?.count ?? 0), fisherfolk: Number(fisherfolk[0]?.count ?? 0), buyers: Number(buyers[0]?.count ?? 0), totalProducts: Number(products[0]?.count ?? 0), availableProducts: Number(available[0]?.count ?? 0), reservedProducts: Number(reserved[0]?.count ?? 0), soldProducts: Number(sold[0]?.count ?? 0), rescueListings: Number(rescue[0]?.count ?? 0), totalReservations: Number(reservations[0]?.count ?? 0), openReports: Number(reports[0]?.count ?? 0) });
});

router.get("/admin/users", async (req, res): Promise<void> => {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const parsed = GetAdminUsersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const rows = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
  const search = parsed.data.search?.toLowerCase();
  res.json(rows.filter((user) => !search || `${user.fullName} ${user.username} ${user.email} ${user.location ?? ""}`.toLowerCase().includes(search)).map(toUser));
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
  const [user] = await db.update(usersTable).set(parsed.data).where(eq(usersTable.id, id)).returning();
  if (!user) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  res.json(toUser(user));
});

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

router.delete("/admin/products/:id", async (req, res): Promise<void> => {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const id = validId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid product id." });
    return;
  }
  await db.delete(productsTable).where(eq(productsTable.id, id));
  res.sendStatus(204);
});

router.get("/admin/reports", async (req, res): Promise<void> => {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const rows = await db.select({ report: reportsTable, reporter: usersTable, product: productsTable }).from(reportsTable).innerJoin(usersTable, eq(reportsTable.reporterId, usersTable.id)).innerJoin(productsTable, eq(reportsTable.productId, productsTable.id)).orderBy(desc(reportsTable.createdAt));
  res.json(rows.map(({ report, reporter, product }) => ({ id: report.id, reporterId: reporter.id, reporterName: reporter.fullName, productId: product.id, productName: product.name, reason: report.reason, description: report.description, status: report.status, createdAt: report.createdAt.toISOString() })));
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
  res.json({ id: report.id, reporterId: report.reporterId, reporterName: reporter?.fullName ?? "User", productId: report.productId, productName: product?.name ?? "Removed listing", reason: report.reason, description: report.description, status: report.status, createdAt: report.createdAt.toISOString() });
});

export default router;