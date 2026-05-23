// Webhook Stripe — sync les events vers notre DB.
// URL à enregistrer dans Stripe : https://[ton-domaine]/api/billing/webhook
// Events écoutés : checkout.session.completed, customer.subscription.*, invoice.payment_*

import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { notify } from "@/lib/notifications";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import { log } from "@/lib/log";
import { getAppUrl } from "@/lib/url";

export const runtime = "nodejs";

const SIGNING_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";

async function userIdFromCustomer(customerId: string | null | undefined): Promise<string | null> {
  if (!customerId) return null;
  const sub = await db.subscription.findFirst({ where: { stripeCustomerId: customerId } });
  if (sub) return sub.userId;
  // Fallback : récupère le user via Stripe metadata
  const stripe = getStripe();
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted) return null;
  const userId = customer.metadata?.mycloudUserId;
  return userId ?? null;
}

async function upsertSubscriptionFromStripe(subscription: Stripe.Subscription): Promise<void> {
  const userId = (subscription.metadata?.mycloudUserId as string | undefined) ?? (await userIdFromCustomer(subscription.customer as string));
  if (!userId) {
    console.warn("[billing] subscription event sans mycloudUserId", subscription.id);
    return;
  }

  // Trouve le plan : Stripe stocke price.id, on cherche dans nos colonnes
  const priceId = subscription.items.data[0]?.price.id;
  const plan = priceId
    ? await db.plan.findFirst({
        where: {
          OR: [
            { stripePriceMonthlyEurId: priceId },
            { stripePriceYearlyEurId: priceId },
            { stripePriceMonthlyUsdId: priceId },
            { stripePriceYearlyUsdId: priceId },
          ],
        },
      })
    : null;
  if (!plan) {
    console.warn("[billing] subscription avec price inconnu", priceId);
    return;
  }

  const recurring = subscription.items.data[0]?.price.recurring;
  const cycle = recurring?.interval === "year" ? "YEARLY" : "MONTHLY";
  const currency = subscription.items.data[0]?.price.currency.toUpperCase() ?? "EUR";

  const status =
    subscription.status === "active" || subscription.status === "trialing"
      ? "ACTIVE"
      : subscription.status === "past_due"
      ? "PAST_DUE"
      : subscription.status === "paused"
      ? "PAUSED"
      : "CANCELED";

  // Period dates : Stripe 2024+ les met sur items, fallback sur subscription
  const item = subscription.items.data[0];
  const periodStart = new Date(((item?.current_period_start ?? subscription.start_date) as number) * 1000);
  const periodEnd = new Date(((item?.current_period_end ?? (subscription.start_date + 30 * 86400)) as number) * 1000);

  await db.$transaction([
    db.subscription.upsert({
      where: { userId },
      create: {
        userId,
        planId: plan.id,
        status,
        cycle,
        currency,
        stripeCustomerId: subscription.customer as string,
        stripeSubId: subscription.id,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
      },
      update: {
        planId: plan.id,
        status,
        cycle,
        currency,
        stripeSubId: subscription.id,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
      },
    }),
    db.user.update({
      where: { id: userId },
      data: { planId: plan.id, storageQuota: plan.storageBytes },
    }),
  ]);
}

export async function POST(req: Request) {
  if (!SIGNING_SECRET) {
    return NextResponse.json({ error: "WEBHOOK_NOT_CONFIGURED" }, { status: 500 });
  }
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "MISSING_SIGNATURE" }, { status: 400 });

  const stripe = getStripe();
  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, SIGNING_SECRET);
  } catch (err) {
    console.error("[billing] webhook signature invalide", err);
    return NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription" && session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string);
          await upsertSubscriptionFromStripe(sub);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        await upsertSubscriptionFromStripe(event.data.object as Stripe.Subscription);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = await userIdFromCustomer(sub.customer as string);
        if (userId) {
          // Marque la subscription comme canceled (idempotent — peut ne pas exister)
          await db.subscription
            .update({ where: { userId }, data: { status: "CANCELED" } })
            .catch(() => undefined);
          // Rétrograde vers Starter
          const starter = await db.plan.findUnique({ where: { slug: "starter" } });
          if (starter) {
            await db.user.update({
              where: { id: userId },
              data: { planId: starter.id, storageQuota: starter.storageBytes },
            });
          }
        }
        break;
      }
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const userId = await userIdFromCustomer(invoice.customer as string);
        if (userId && invoice.amount_paid > 0) {
          // Idempotent : externalRef = invoice.id est UNIQUE en DB, donc un retry
          // de Stripe sur le même event ne crée pas de doublon (catch).
          try {
            await db.payment.create({
              data: {
                userId,
                amount: invoice.amount_paid,
                currency: invoice.currency.toUpperCase(),
                method: "CARD_STRIPE",
                status: "SUCCEEDED",
                externalRef: invoice.id,
                invoiceNumber: invoice.number ?? `INV-${invoice.id}`,
                invoiceUrl: invoice.hosted_invoice_url ?? null,
                paidAt: new Date((invoice.status_transitions.paid_at ?? Math.floor(Date.now() / 1000)) * 1000),
              },
            });
            // Notification au user
            await notify({
              userId,
              type: "PAYMENT_SUCCEEDED",
              title: "Paiement reçu ✓",
              body: `${(invoice.amount_paid / 100).toFixed(2)} ${invoice.currency.toUpperCase()} encaissés.`,
              link: "/billing",
            }).catch(() => undefined);
            log.info("billing.payment_succeeded", { userId, amount: invoice.amount_paid, invoice: invoice.id });
          } catch (e) {
            // Conflit UNIQUE → c'est un retry. Pas grave.
            log.warn("billing.payment_succeeded.duplicate", { invoice: invoice.id, error: e instanceof Error ? e.message : "unknown" });
          }
        }
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const userId = await userIdFromCustomer(invoice.customer as string);
        if (userId) {
          await db.subscription.update({
            where: { userId },
            data: { status: "PAST_DUE" },
          }).catch(() => undefined);

          // Trace + notification + email
          log.warn("billing.payment_failed", { userId, invoice: invoice.id });
          await notify({
            userId,
            type: "PAYMENT_FAILED",
            title: "Échec de paiement",
            body: "Ton dernier paiement n'est pas passé. Vérifie ta carte dans Mon plan.",
            link: "/billing",
          }).catch(() => undefined);

          if (isEmailConfigured()) {
            const user = await db.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
            if (user?.email) {
              sendEmail({
                to: user.email,
                subject: "Échec de paiement — MyTitanCloud",
                html: `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:24px;background:#0a0a14;color:#f5f5f7;">
                <div style="max-width:480px;margin:0 auto;background:#14141f;border-radius:16px;padding:32px;">
                <h1 style="font-size:22px;">Échec de paiement</h1>
                <p style="color:#a1a1aa;line-height:1.6;">Bonjour ${user.name ?? ""},</p>
                <p style="color:#a1a1aa;line-height:1.6;">Ton dernier paiement MyTitanCloud n'est pas passé (carte refusée, fonds insuffisants ou expirée).</p>
                <p style="color:#a1a1aa;line-height:1.6;">Mets à jour ta carte rapidement pour éviter une suspension :</p>
                <a href="${getAppUrl()}/billing" style="display:inline-block;background:#38bdf8;color:#0a0a14;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;margin-top:16px;">Vérifier ma carte</a>
                </div></body></html>`,
              }).catch(() => undefined);
            }
          }
        }
        break;
      }
    }
  } catch (err) {
    console.error("[billing] erreur traitement webhook", event.type, err);
    return NextResponse.json({ error: "PROCESSING_ERROR" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
