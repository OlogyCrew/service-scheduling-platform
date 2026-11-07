import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import Stripe from "stripe";
import { ENV } from "./_core/env";
import * as invoiceDb from "./db/invoices";
import { getProviderByUserId } from "./db/providers";
import { getUserById } from "./db/users";
import { getProviderTier } from "./db/payments";
import { providerHasFeature } from "@shared/entitlements";
import { queueCrmInvoiceProjection } from "./crm/sourceHooks";
import { assertPaymentActorCanInitiate } from "./paymentAuthorization";
import { assertPaymentVelocityAllowed, throwIfPaymentVelocityBlocked } from "./paymentVelocity";

// Helper: check if provider has paid tier (Basic or Premium)
async function requirePaidTier(providerId: number) {
  const tier = await getProviderTier(providerId);
  if (!providerHasFeature(tier, "invoicing")) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Invoicing is available for Pro and Business subscribers. Upgrade your plan to create and send invoices.",
    });
  }
  return tier;
}
import { generateInvoicePdf } from "./services/invoicePdf";
import { sendNotification } from "./notifications";

const stripe = new Stripe(ENV.stripeSecretKey, { apiVersion: "2026-01-28.clover" as any });

export const invoiceRouter = router({
  // Provider: create a new invoice
  create: protectedProcedure
    .input(z.object({
      customerId: z.number().optional(), // 0 or omitted for non-system customers
      customerName: z.string().optional(), // For non-system customers
      lineItems: z.array(z.object({
        description: z.string().min(1),
        quantity: z.number().min(0.01),
        unitPrice: z.number().min(0), // cents
        serviceId: z.number().optional(),
      })).min(1),
      taxRate: z.number().min(0).max(100).default(0),
      dueDate: z.string().optional(), // ISO date
      notes: z.string().optional(),
      customerEmail: z.string().email().optional(),
      customerPhone: z.string().optional(),
      customerAddress: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const provider = await getProviderByUserId(ctx.user.id);
      if (!provider) throw new TRPCError({ code: "FORBIDDEN", message: "Provider profile required" });
      await requirePaidTier(provider.id);

      // Must have either a system customer or a customer name
      if (!input.customerId && !input.customerName) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Please provide a customer name or select an existing customer" });
      }

      // Look up customer details if existing customer selected
      let resolvedCustomerName = input.customerName || null;
      let resolvedCustomerEmail = input.customerEmail || null;
      let resolvedCustomerPhone = input.customerPhone || null;
      let resolvedCustomerAddress = input.customerAddress || null;
      if (input.customerId) {
        const customer = await getUserById(input.customerId);
        if (customer) {
          if (!resolvedCustomerName) {
            resolvedCustomerName = customer.name || 
              [customer.firstName, customer.lastName].filter(Boolean).join(" ") || null;
          }
          if (!resolvedCustomerEmail && customer.email) {
            resolvedCustomerEmail = customer.email;
          }
          if (!resolvedCustomerPhone && customer.phone) {
            resolvedCustomerPhone = customer.phone;
          }
          if (!resolvedCustomerAddress) {
            const addressParts = [
              (customer as any).billingAddressLine1,
              (customer as any).billingAddressLine2,
              [(customer as any).billingCity, (customer as any).billingState, (customer as any).billingPostalCode].filter(Boolean).join(", "),
            ].filter(Boolean);
            if (addressParts.length > 0) {
              resolvedCustomerAddress = addressParts.join(", ");
            }
          }
        }
      }

      const invoiceNumber = await invoiceDb.getNextInvoiceNumber(provider.id);

      // Calculate totals
      const lineItems = input.lineItems.map((item) => ({
        description: item.description,
        quantity: String(item.quantity),
        unitPrice: item.unitPrice,
        amount: Math.round(item.quantity * item.unitPrice),
        serviceId: item.serviceId || null,
      }));

      const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
      const taxAmount = Math.round(subtotal * (input.taxRate / 100));
      const total = subtotal + taxAmount;

      const result = await invoiceDb.createInvoice(
        {
          invoiceNumber,
          type: "invoice",
          providerId: provider.id,
          customerId: input.customerId || 0,
          status: "draft",
          subtotal,
          taxRate: String(input.taxRate),
          taxAmount,
          total,
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          notes: input.notes || null,
          customerEmail: resolvedCustomerEmail,
          customerName: resolvedCustomerName,
          customerPhone: resolvedCustomerPhone,
          customerAddress: resolvedCustomerAddress,
          issueDate: new Date(),
          bookingId: null,
          promotionId: null,
          paymentId: null,
          stripePaymentIntentId: null,
          stripeCheckoutSessionId: null,
          pdfUrl: null,
          originalInvoiceId: null,
          paidAt: null,
        },
        lineItems
      );
      if (input.customerId) queueCrmInvoiceProjection(result.id);

      return result;
    }),

  // Provider: get all their invoices (paid tiers only)
  getMyInvoices: protectedProcedure.query(async ({ ctx }) => {
      const provider = await getProviderByUserId(ctx.user.id);
      if (!provider) return { invoices: [], tier: "free" as const, canUseInvoices: false };
      const tier = await getProviderTier(provider.id);
      if (!providerHasFeature(tier, "invoicing")) return { invoices: [], tier: "free" as const, canUseInvoices: false };
    const invoices = await invoiceDb.getInvoicesByProvider(provider.id);
    return { invoices, tier, canUseInvoices: true };
  }),

  // Provider: get unique customers for invoice form (paid tiers only)
  getMyCustomers: protectedProcedure.query(async ({ ctx }) => {
    const provider = await getProviderByUserId(ctx.user.id);
    if (!provider) return [];
    await requirePaidTier(provider.id);
    const { getDb } = await import("./db/connection");
    const { bookings, users } = await import("../drizzle/schema");
    const { eq, desc } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) return [];
    const results = await db.select({
      customerId: bookings.customerId,
      customerName: users.name,
      customerFirstName: users.firstName,
      customerLastName: users.lastName,
      customerEmail: users.email,
      customerPhone: users.phone,
      billingAddressLine1: users.billingAddressLine1,
      billingAddressLine2: users.billingAddressLine2,
      billingCity: users.billingCity,
      billingState: users.billingState,
      billingPostalCode: users.billingPostalCode,
    }).from(bookings)
      .leftJoin(users, eq(bookings.customerId, users.id))
      .where(eq(bookings.providerId, provider.id))
      .orderBy(desc(bookings.createdAt));
    // Deduplicate and resolve names
    const seen = new Map<number, { id: number; name: string; email: string; phone: string; billingAddress: string }>();
    for (const r of results) {
      if (!seen.has(r.customerId)) {
        const name = r.customerName || 
          [r.customerFirstName, r.customerLastName].filter(Boolean).join(" ") || 
          "";
        // Compose billing address from parts
        const addressParts = [
          r.billingAddressLine1,
          r.billingAddressLine2,
          [r.billingCity, r.billingState, r.billingPostalCode].filter(Boolean).join(", "),
        ].filter(Boolean);
        seen.set(r.customerId, {
          id: r.customerId,
          name,
          email: r.customerEmail || "",
          phone: r.customerPhone || "",
          billingAddress: addressParts.join(", "),
        });
      }
    }
    return Array.from(seen.values());
  }),

  // Customer: get all their receipts and invoices
  getMyReceipts: protectedProcedure.query(async ({ ctx }) => {
    return invoiceDb.getInvoicesByCustomer(ctx.user.id, ctx.user.email || undefined);
  }),

  // Get single invoice by ID (for both provider and customer)
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const invoice = await invoiceDb.getInvoiceById(input.id);
      if (!invoice) throw new TRPCError({ code: "NOT_FOUND" });

      // Verify access: must be the provider or the customer
      const provider = await getProviderByUserId(ctx.user.id);
      const isProvider = provider && provider.id === invoice.providerId;
      const isCustomer = invoice.customerId === ctx.user.id;

      if (!isProvider && !isCustomer) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // If customer is viewing a sent invoice, mark as viewed
      if (isCustomer && invoice.status === "sent") {
        await invoiceDb.updateInvoiceStatus(invoice.id, "viewed");
        invoice.status = "viewed";
        queueCrmInvoiceProjection(invoice.id);
      }

      return invoice;
    }),

  // Provider: send invoice to customer (paid tiers only)
  send: protectedProcedure
    .input(z.object({ invoiceId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const provider = await getProviderByUserId(ctx.user.id);
      if (!provider) throw new TRPCError({ code: "FORBIDDEN" });
      await requirePaidTier(provider.id);

      const invoice = await invoiceDb.getInvoiceById(input.invoiceId);
      if (!invoice) throw new TRPCError({ code: "NOT_FOUND" });
      if (invoice.providerId !== provider.id) throw new TRPCError({ code: "FORBIDDEN" });
      if (invoice.status !== "draft") throw new TRPCError({ code: "BAD_REQUEST", message: "Can only send draft invoices" });

      // Get customer and provider user info for PDF
      const customer = invoice.customerId ? await getUserById(invoice.customerId) : null;
      const providerUser = await getUserById(provider.userId);
      // Use stored customerName first (for non-system customers), then fall back to system user
      const customerName = (invoice as any).customerName || 
        (customer ? `${customer.firstName || ""} ${customer.lastName || ""}`.trim() || customer.name || "Customer" : "Customer");
      const customerEmail = invoice.customerEmail || customer?.email || undefined;
      const providerAddress = [provider.addressLine1, provider.city, provider.state, provider.postalCode].filter(Boolean).join(", ") || undefined;

      // Generate PDF
      const pdfUrl = await generateInvoicePdf({
        invoice,
        providerName: provider.businessName || "Provider",
        providerEmail: providerUser?.email || undefined,
        providerPhone: providerUser?.phone || undefined,
        providerAddress,
        providerLogoUrl: provider.businessLogoUrl || undefined,
        customerName,
        customerEmail,
      });

      // Update status and PDF URL
      await invoiceDb.updateInvoiceStatus(input.invoiceId, "sent", { pdfUrl });
      await invoiceDb.updateInvoicePdfUrl(input.invoiceId, pdfUrl);
      queueCrmInvoiceProjection(input.invoiceId);

      // Send email notification to customer (works for both system and non-system customers)
      if (customerEmail) {
        // Try to resolve userId by email if customer is null (non-system customer flow)
        let recipientUserId = customer?.id || 0;
        if (!recipientUserId && customerEmail) {
          const { getUserByEmail } = await import("./db/users");
          const userByEmail = await getUserByEmail(customerEmail);
          if (userByEmail) recipientUserId = userByEmail.id;
        }
        await sendNotification({
          type: "invoice_sent",
          channel: "email",
          recipient: {
            userId: recipientUserId,
            email: customerEmail,
            name: customerName,
          },
          data: {
            invoiceNumber: invoice.invoiceNumber,
            providerName: provider.businessName || "Provider",
            customerName,
            amount: (invoice.total / 100).toFixed(2),
            dueDate: invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : undefined,
          },
        });
      }

      return { success: true, pdfUrl };
    }),

  // Provider: generate PDF for any invoice (paid tiers only)
  generatePdf: protectedProcedure
    .input(z.object({ invoiceId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const provider = await getProviderByUserId(ctx.user.id);
      if (!provider) throw new TRPCError({ code: "FORBIDDEN" });
      await requirePaidTier(provider.id);

      const invoice = await invoiceDb.getInvoiceById(input.invoiceId);
      if (!invoice) throw new TRPCError({ code: "NOT_FOUND" });
      if (invoice.providerId !== provider.id) throw new TRPCError({ code: "FORBIDDEN" });

      const customer = invoice.customerId ? await getUserById(invoice.customerId) : null;
      const providerUser = await getUserById(provider.userId);
      const customerName = (invoice as any).customerName || 
        (customer ? `${customer.firstName || ""} ${customer.lastName || ""}`.trim() || customer.name || "Customer" : "Customer");
      const providerAddress = [provider.addressLine1, provider.city, provider.state, provider.postalCode].filter(Boolean).join(", ") || undefined;

      const pdfUrl = await generateInvoicePdf({
        invoice,
        providerName: provider.businessName || "Provider",
        providerEmail: providerUser?.email || undefined,
        providerPhone: providerUser?.phone || undefined,
        providerAddress,
        providerLogoUrl: provider.businessLogoUrl || undefined,
        customerName,
        customerEmail: invoice.customerEmail || customer?.email || undefined,
      });

      await invoiceDb.updateInvoicePdfUrl(input.invoiceId, pdfUrl);
      return { pdfUrl };
    }),

  // Customer: get a Stripe checkout link to pay an invoice
  getPaymentLink: protectedProcedure
    .input(z.object({ invoiceId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const invoice = await invoiceDb.getInvoiceById(input.invoiceId);
      if (!invoice) throw new TRPCError({ code: "NOT_FOUND" });
      if (invoice.customerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      assertPaymentActorCanInitiate(ctx.user, "invoice");
      if (invoice.status === "paid" || invoice.status === "cancelled") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invoice already " + invoice.status });
      }
      const velocity = await assertPaymentVelocityAllowed({
        actorId: ctx.user.id,
        subjects: [
          { dimension: "account", key: String(ctx.user.id) },
          { dimension: "email", key: ctx.user.email || `user:${ctx.user.id}` },
          ...(invoice.providerId ? [{ dimension: "provider" as const, key: String(invoice.providerId) }] : []),
          { dimension: "ip", key: ctx.req.ip || ctx.req.headers["x-forwarded-for"]?.toString().split(",")[0] || "unknown" },
        ],
      });
      throwIfPaymentVelocityBlocked(velocity);

      // Create Stripe checkout session
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: invoice.lineItems.map((item) => ({
          price_data: {
            currency: "usd",
            product_data: { name: item.description },
            unit_amount: item.unitPrice,
          },
          quantity: Math.round(Number(item.quantity)),
        })),
        metadata: {
          type: "invoice_payment",
          invoiceId: String(invoice.id),
          invoiceNumber: invoice.invoiceNumber,
        },
        success_url: `https://www.ologycrew.com/receipts?paid=${invoice.id}`,
        cancel_url: `https://www.ologycrew.com/receipts`,
      });

      // Store session ID on invoice
      await invoiceDb.updateInvoiceStatus(invoice.id, invoice.status as any, {
        stripeCheckoutSessionId: session.id,
      });

      return { url: session.url };
    }),

  // Provider: mark invoice as paid manually (paid tiers only)
  markPaid: protectedProcedure
    .input(z.object({ invoiceId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const provider = await getProviderByUserId(ctx.user.id);
      if (!provider) throw new TRPCError({ code: "FORBIDDEN" });
      await requirePaidTier(provider.id);

      const invoice = await invoiceDb.getInvoiceById(input.invoiceId);
      if (!invoice) throw new TRPCError({ code: "NOT_FOUND" });
      if (invoice.providerId !== provider.id) throw new TRPCError({ code: "FORBIDDEN" });

      await invoiceDb.updateInvoiceStatus(input.invoiceId, "paid", { paidAt: new Date() });
      queueCrmInvoiceProjection(input.invoiceId);
      return { success: true };
    }),

  // Provider: cancel an invoice (paid tiers only)
  cancel: protectedProcedure
    .input(z.object({ invoiceId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const provider = await getProviderByUserId(ctx.user.id);
      if (!provider) throw new TRPCError({ code: "FORBIDDEN" });
      await requirePaidTier(provider.id);

      const invoice = await invoiceDb.getInvoiceById(input.invoiceId);
      if (!invoice) throw new TRPCError({ code: "NOT_FOUND" });
      if (invoice.providerId !== provider.id) throw new TRPCError({ code: "FORBIDDEN" });
      if (invoice.status === "paid") throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot cancel a paid invoice" });

      await invoiceDb.updateInvoiceStatus(input.invoiceId, "cancelled");
      queueCrmInvoiceProjection(input.invoiceId);
      return { success: true };
    }),
});
