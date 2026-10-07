export const SOCIAL_POST_TEMPLATES = {
  customer: {
    label: "For customers",
    imagePath: "/manus-storage/ologycrew-find-services_87aa5845.jpg",
    alt: "Illustrative OlogyCrew card: Find the right person for the job; two people discuss a service project.",
    destination: "/browse",
  },
  provider: {
    label: "For providers",
    imagePath: "/manus-storage/ologycrew-for-providers_ee456d77.jpg",
    alt: "Illustrative OlogyCrew card: Your craft deserves to be found; two professionals work together.",
    destination: "/for-providers",
  },
  spotlight: {
    label: "Category spotlight",
    imagePath: "/manus-storage/ologycrew-people-first-social-1200x630_05d25d5b.jpg",
    alt: "Illustrative OlogyCrew card: Good work starts with people; a professional works with a customer.",
    destination: "/browse",
  },
} as const;
export type SocialPostTemplate = keyof typeof SOCIAL_POST_TEMPLATES;
export const OLOGYCREW_ORIGIN = "https://ologycrew.com";
