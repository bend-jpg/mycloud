// Plans tarifaires par défaut (seedés en DB au premier démarrage)
// 1 Go = 1_073_741_824 octets

export const DEFAULT_PLANS = [
  {
    slug: "starter",
    name: "Starter",
    descriptionFr: "Pour commencer. Idéal pour les documents et photos.",
    descriptionEn: "To get started. Perfect for documents and photos.",
    descriptionEs: "Para empezar. Ideal para documentos y fotos.",
    descriptionHe: "להתחיל איתו. מושלם למסמכים ותמונות.",
    storageBytes: BigInt(50) * BigInt(1_073_741_824), // 50 Go
    maxMembers: 1,
    maxShareLinks: 50,
    maxShareDays: 7,
    websiteHosting: false,
    claudeCodeHosting: false,
    priceMonthlyEur: 299,    // 2,99 €
    priceYearlyEur: 2990,    // 29,90 €
    priceMonthlyUsd: 349,
    priceYearlyUsd: 3490,
    sortOrder: 1,
    highlighted: false,
  },
  {
    slug: "family",
    name: "Famille",
    descriptionFr: "Pour toute la famille. Espace partagé + 5 membres.",
    descriptionEn: "For the whole family. Shared space + 5 members.",
    descriptionEs: "Para toda la familia. Espacio compartido + 5 miembros.",
    descriptionHe: "לכל המשפחה. מרחב משותף + 5 חברים.",
    storageBytes: BigInt(500) * BigInt(1_073_741_824), // 500 Go
    maxMembers: 5,
    maxShareLinks: 200,
    maxShareDays: 30,
    websiteHosting: false,
    claudeCodeHosting: false,
    priceMonthlyEur: 799,    // 7,99 €
    priceYearlyEur: 7990,    // 79,90 €
    priceMonthlyUsd: 899,
    priceYearlyUsd: 8990,
    sortOrder: 2,
    highlighted: true,
  },
  {
    slug: "pro",
    name: "Pro",
    descriptionFr: "Pour les indépendants. Plus d'espace, hébergement de sites inclus.",
    descriptionEn: "For freelancers. More space, website hosting included.",
    descriptionEs: "Para autónomos. Más espacio, alojamiento de sitios web incluido.",
    descriptionHe: "לעצמאיים. יותר מקום, אחסון אתרים כלול.",
    storageBytes: BigInt(2) * BigInt(1024) * BigInt(1_073_741_824), // 2 To
    maxMembers: 10,
    maxShareLinks: 1000,
    maxShareDays: 90,
    websiteHosting: true,
    claudeCodeHosting: false,
    priceMonthlyEur: 1999,   // 19,99 €
    priceYearlyEur: 19990,   // 199,90 €
    priceMonthlyUsd: 2199,
    priceYearlyUsd: 21990,
    sortOrder: 3,
    highlighted: false,
  },
  {
    slug: "business",
    name: "Business",
    descriptionFr: "Pour les équipes. Hébergement Claude Code, support prioritaire.",
    descriptionEn: "For teams. Claude Code hosting, priority support.",
    descriptionEs: "Para equipos. Alojamiento Claude Code, soporte prioritario.",
    descriptionHe: "לצוותים. אחסון Claude Code, תמיכה מועדפת.",
    storageBytes: BigInt(10) * BigInt(1024) * BigInt(1_073_741_824), // 10 To
    maxMembers: 50,
    maxShareLinks: 10000,
    maxShareDays: 365,
    websiteHosting: true,
    claudeCodeHosting: true,
    priceMonthlyEur: 4999,   // 49,99 €
    priceYearlyEur: 49990,   // 499,90 €
    priceMonthlyUsd: 5499,
    priceYearlyUsd: 54990,
    sortOrder: 4,
    highlighted: false,
  },
];
