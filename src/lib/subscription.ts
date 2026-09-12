export type SubscriptionPlan = "trial" | "pro" | "lifetime";
export type SubscriptionStatus = "trial" | "active" | "expired";

export interface SubscriptionInfo {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  trialEndsAt: Date | null;
  subscriptionEndsAt: Date | null;
  daysLeft: number;
  isTrial: boolean;
  isPro: boolean;
  isExpired: boolean;
  isAdmin: boolean;
}

/**
 * Calculates current subscription state for a tenant profile.
 * Admins are permanently granted VIP Lifetime status.
 */
export function calculateSubscription(profileData: any, isAdminUser: boolean = false): SubscriptionInfo {
  if (isAdminUser) {
    return {
      plan: "pro",
      status: "active",
      trialEndsAt: null,
      subscriptionEndsAt: null,
      daysLeft: 9999,
      isTrial: false,
      isPro: true,
      isExpired: false,
      isAdmin: true,
    };
  }

  const now = new Date();
  const plan: SubscriptionPlan = profileData?.plan || "trial";

  // Lifetime plan
  if (plan === "lifetime") {
    return {
      plan: "lifetime",
      status: "active",
      trialEndsAt: null,
      subscriptionEndsAt: null,
      daysLeft: 9999,
      isTrial: false,
      isPro: true,
      isExpired: false,
      isAdmin: false,
    };
  }

  // Paid Pro subscription
  if (plan === "pro") {
    let subEnd: Date | null = null;
    if (profileData?.subscription_ends_at) {
      subEnd = new Date(profileData.subscription_ends_at);
    }

    if (!subEnd || isNaN(subEnd.getTime())) {
      // Pro with no explicit end date is treated as active
      return {
        plan: "pro",
        status: "active",
        trialEndsAt: null,
        subscriptionEndsAt: null,
        daysLeft: 365,
        isTrial: false,
        isPro: true,
        isExpired: false,
        isAdmin: false,
      };
    }

    const diffMs = subEnd.getTime() - now.getTime();
    const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

    if (diffMs > 0) {
      return {
        plan: "pro",
        status: "active",
        trialEndsAt: null,
        subscriptionEndsAt: subEnd,
        daysLeft,
        isTrial: false,
        isPro: true,
        isExpired: false,
        isAdmin: false,
      };
    } else {
      return {
        plan: "pro",
        status: "expired",
        trialEndsAt: null,
        subscriptionEndsAt: subEnd,
        daysLeft: 0,
        isTrial: false,
        isPro: false,
        isExpired: true,
        isAdmin: false,
      };
    }
  }

  // Trial plan (default for all new signups)
  let trialEnd: Date | null = null;
  if (profileData?.trial_ends_at) {
    trialEnd = new Date(profileData.trial_ends_at);
  } else if (profileData?.created_at) {
    // Fallback for legacy accounts: 30 days from creation
    trialEnd = new Date(new Date(profileData.created_at).getTime() + 30 * 24 * 60 * 60 * 1000);
  } else {
    // If no created_at, default 30 days from now
    trialEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  }

  const diffMs = trialEnd.getTime() - now.getTime();
  const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

  if (diffMs > 0) {
    return {
      plan: "trial",
      status: "trial",
      trialEndsAt: trialEnd,
      subscriptionEndsAt: null,
      daysLeft,
      isTrial: true,
      isPro: false,
      isExpired: false,
      isAdmin: false,
    };
  } else {
    return {
      plan: "trial",
      status: "expired",
      trialEndsAt: trialEnd,
      subscriptionEndsAt: null,
      daysLeft: 0,
      isTrial: true,
      isPro: false,
      isExpired: true,
      isAdmin: false,
    };
  }
}
