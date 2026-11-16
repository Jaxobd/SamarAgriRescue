import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("agri_users", {
  id: serial("id").primaryKey(),
  fullName: varchar("full_name", { length: 160 }).notNull(),
  username: varchar("username", { length: 80 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  phone: varchar("phone", { length: 40 }),
  location: varchar("location", { length: 160 }),
  userType: varchar("user_type", { length: 30 }).notNull(),
  profileImage: text("profile_image"),
  bio: text("bio"),
  googleId: varchar("google_id", { length: 128 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const productsTable = pgTable("agri_products", {
  id: serial("id").primaryKey(),
  producerId: integer("producer_id").notNull().references(() => usersTable.id),
  name: varchar("name", { length: 160 }).notNull(),
  category: varchar("category", { length: 80 }).notNull(),
  description: text("description"),
  price: numeric("price", { precision: 12, scale: 2 }).notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
  unit: varchar("unit", { length: 40 }).notNull(),
  location: varchar("location", { length: 160 }).notNull(),
  image: text("image"),
  images: jsonb("images").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  availabilityDate: date("availability_date", { mode: "string" }),
  status: varchar("status", { length: 30 }).notNull().default("Available"),
  isRescue: boolean("is_rescue").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reservationsTable = pgTable("agri_reservations", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  buyerId: integer("buyer_id").notNull().references(() => usersTable.id),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
  status: varchar("status", { length: 30 }).notNull().default("Pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const messagesTable = pgTable("agri_messages", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").notNull().references(() => usersTable.id),
  receiverId: integer("receiver_id").notNull().references(() => usersTable.id),
  productId: integer("product_id").references(() => productsTable.id),
  message: text("message").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reportsTable = pgTable("agri_reports", {
  id: serial("id").primaryKey(),
  reporterId: integer("reporter_id").notNull().references(() => usersTable.id),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  reason: varchar("reason", { length: 160 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 30 }).notNull().default("Open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const activitiesTable = pgTable("agri_activities", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id),
  type: varchar("type", { length: 50 }).notNull(),
  action: varchar("action", { length: 255 }).notNull(),
  details: text("details"),
  entityId: integer("entity_id"),
  entityType: varchar("entity_type", { length: 50 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notificationsTable = pgTable("agri_notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  actorId: integer("actor_id").references(() => usersTable.id),
  type: varchar("type", { length: 50 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body"),
  link: text("link"),
  productId: integer("product_id").references(() => productsTable.id),
  entityId: integer("entity_id"),
  entityType: varchar("entity_type", { length: 50 }),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
});
export const insertProductSchema = createInsertSchema(productsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertReservationSchema = createInsertSchema(reservationsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertMessageSchema = createInsertSchema(messagesTable).omit({
  id: true,
  createdAt: true,
});
export const insertReportSchema = createInsertSchema(reportsTable).omit({
  id: true,
  createdAt: true,
});
export const insertActivitySchema = createInsertSchema(activitiesTable).omit({
  id: true,
  createdAt: true,
});
export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({
  id: true,
  createdAt: true,
});

export type User = typeof usersTable.$inferSelect;
export type Product = typeof productsTable.$inferSelect;
export type Reservation = typeof reservationsTable.$inferSelect;
export type Message = typeof messagesTable.$inferSelect;
export type Report = typeof reportsTable.$inferSelect;
export type Activity = typeof activitiesTable.$inferSelect;
export type Notification = typeof notificationsTable.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type InsertReservation = z.infer<typeof insertReservationSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type InsertReport = z.infer<typeof insertReportSchema>;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
