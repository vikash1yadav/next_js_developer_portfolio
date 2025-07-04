import { users, type User, type InsertUser, contacts, type Contact, type InsertContact, projects, type Project, type InsertProject, techStack, type TechStack, type InsertTechStack, blogPosts, type BlogPost, type InsertBlogPost, admins, type Admin, type InsertAdmin, adminSessions, type AdminSession } from "@shared/schema";
import { db } from "./db";
import { eq, desc, gt } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto"

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createContact(contact: InsertContact): Promise<Contact>;
  getContacts(): Promise<Contact[]>;
  getProjects(): Promise<Project[]>;
  getProject(id: number): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  getTechStack(): Promise<TechStack[]>;
  createTechStack(tech: InsertTechStack): Promise<TechStack>;
  getBlogPosts(): Promise<BlogPost[]>;
  getBlogPost(id: number): Promise<BlogPost | undefined>;
  getBlogPostBySlug(slug: string): Promise<BlogPost | undefined>;
  createBlogPost(post: InsertBlogPost): Promise<BlogPost>;
  updateBlogPost(id: number, post: Partial<InsertBlogPost>): Promise<BlogPost>;
  deleteBlogPost(id: number): Promise<void>;
  // Admin operations
  createAdmin(admin: InsertAdmin): Promise<Admin>;
  getAdminByUsername(username: string): Promise<Admin | undefined>;
  verifyAdminPassword(username: string, password: string): Promise<Admin | null>;
  createAdminSession(adminId: number): Promise<AdminSession>;
  getAdminSession(sessionId: string): Promise<{ admin: Admin; session: AdminSession } | null>;
  deleteAdminSession(sessionId: string): Promise<void>;
  updateProject(id: number, project: Partial<InsertProject>): Promise<Project>;
  deleteProject(id: number): Promise<void>;
  updateTechStack(id: number, tech: Partial<InsertTechStack>): Promise<TechStack>;
  deleteTechStack(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async createContact(insertContact: InsertContact): Promise<Contact> {
    const [contact] = await db
      .insert(contacts)
      .values(insertContact)
      .returning();
    return contact;
  }

  async getContacts(): Promise<Contact[]> {
    return await db.select().from(contacts).orderBy(contacts.createdAt);
  }

  async getProjects(): Promise<Project[]> {
    return await db.select().from(projects).where(eq(projects.isActive, 1)).orderBy(projects.sortOrder);
  }

  async getProject(id: number): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project || undefined;
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const [project] = await db
      .insert(projects)
      .values(insertProject)
      .returning();
    return project;
  }

  async getTechStack(): Promise<TechStack[]> {
    return await db.select().from(techStack).where(eq(techStack.isActive, 1)).orderBy(techStack.sortOrder);
  }

  async createTechStack(insertTechStack: InsertTechStack): Promise<TechStack> {
    const [tech] = await db
      .insert(techStack)
      .values(insertTechStack)
      .returning();
    return tech;
  }

  async getBlogPosts(): Promise<BlogPost[]> {
    return await db.select().from(blogPosts).where(eq(blogPosts.isPublished, 1)).orderBy(desc(blogPosts.publishedAt));
  }

  async getBlogPost(id: number): Promise<BlogPost | undefined> {
    const [post] = await db.select().from(blogPosts).where(eq(blogPosts.id, id));
    return post || undefined;
  }

  async getBlogPostBySlug(slug: string): Promise<BlogPost | undefined> {
    const [post] = await db.select().from(blogPosts).where(eq(blogPosts.slug, slug));
    return post || undefined;
  }

  async createBlogPost(insertBlogPost: InsertBlogPost): Promise<BlogPost> {
    const [post] = await db
      .insert(blogPosts)
      .values(insertBlogPost)
      .returning();
    return post;
  }

  async updateBlogPost(id: number, updateData: Partial<InsertBlogPost>): Promise<BlogPost> {
    const [post] = await db
      .update(blogPosts)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(blogPosts.id, id))
      .returning();
    return post;
  }

  async deleteBlogPost(id: number): Promise<void> {
    await db.delete(blogPosts).where(eq(blogPosts.id, id));
  }

  // Admin operations
  async createAdmin(insertAdmin: InsertAdmin): Promise<Admin> {
    const hashedPassword = await bcrypt.hash(insertAdmin.password, 10);
    // console.log("hhh", hashedPassword);
    
    const [admin] = await db
      .insert(admins)
      .values({
        ...insertAdmin,
        password: hashedPassword,
      })
      .returning();
    return admin;
  }

  async getAdminByUsername(username: string): Promise<Admin | undefined> {
    const [admin] = await db.select().from(admins).where(eq(admins.username, username));
    return admin || undefined;
  }

  async verifyAdminPassword(username: string, password: string): Promise<Admin | null> {
    const admin = await this.getAdminByUsername(username);
    if (!admin || admin.isActive !== 1) {
      return null;
    }
    
    const isValid = await bcrypt.compare(password, admin.password);
    return isValid ? admin : null;
  }

  async createAdminSession(adminId: number): Promise<AdminSession> {
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    const [session] = await db
      .insert(adminSessions)
      .values({
        id: sessionId,
        adminId,
        expiresAt,
      })
      .returning();
    return session;
  }

  async getAdminSession(sessionId: string): Promise<{ admin: Admin; session: AdminSession } | null> {
    const [result] = await db
      .select({
        admin: admins,
        session: adminSessions,
      })
      .from(adminSessions)
      .innerJoin(admins, eq(adminSessions.adminId, admins.id))
      .where(eq(adminSessions.id, sessionId))
      .where(gt(adminSessions.expiresAt, new Date()));
    
    return result || null;
  }

  async deleteAdminSession(sessionId: string): Promise<void> {
    await db.delete(adminSessions).where(eq(adminSessions.id, sessionId));
  }

  async updateProject(id: number, updateData: Partial<InsertProject>): Promise<Project> {
    const [project] = await db
      .update(projects)
      .set(updateData)
      .where(eq(projects.id, id))
      .returning();
    return project;
  }

  async deleteProject(id: number): Promise<void> {
    await db.delete(projects).where(eq(projects.id, id));
  }

  async updateTechStack(id: number, updateData: Partial<InsertTechStack>): Promise<TechStack> {
    const [tech] = await db
      .update(techStack)
      .set(updateData)
      .where(eq(techStack.id, id))
      .returning();
    return tech;
  }

  async deleteTechStack(id: number): Promise<void> {
    await db.delete(techStack).where(eq(techStack.id, id));
  }
}

export const storage = new DatabaseStorage();
