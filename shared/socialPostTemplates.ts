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
    label: "DJ & Music Services spotlight",
    imagePath: "/manus-storage/ologycrew-dj-music-distinct_a53ec1e5.jpg",
    alt: "Illustrative OlogyCrew DJ & Music Services card: Set the scene with music; a DJ and customer discuss an event beside a mixing deck.",
    destination: "/category/dj-music-services",
  },
} as const;
export type SocialPostTemplate = keyof typeof SOCIAL_POST_TEMPLATES;
export const OLOGYCREW_ORIGIN = "https://ologycrew.com";
