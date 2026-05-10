import { normalizeStorefrontSlug } from "../../../shared/storefront.js";

export const BEAUTY_STARTER_IMAGE_SPECS = Object.freeze({
  format: "1:1 ou 4:3",
  minimumResolution: "1024x1024",
  style: "Fotorrealista / Editorial",
  audienceSkinTone: "Africano / Angola",
});

export const BEAUTY_STARTER_PRODUCTS = Object.freeze([
  {
    id: "starter-beauty-manicure",
    name: "Manicure",
    category: "Unhas",
    price: 8000,
    compareAt: 9500,
    featured: true,
    onPromotion: true,
    available: true,
    stock: "",
    description:
      "Manicure profissional com acabamento elegante em tons nude, ideal para clientes que procuram um visual limpo, feminino e sofisticado no dia a dia.",
    image: "",
    images: [],
    imagePrompt:
      "Professional manicure close-up photo, woman's hands with elegant nude nails freshly done, beauty salon setting, soft natural lighting, clean white background, high quality photography, editorial style",
    imageGeneration: BEAUTY_STARTER_IMAGE_SPECS,
  },
  {
    id: "starter-beauty-trancas",
    name: "Trancas",
    category: "Trancas",
    price: 15000,
    compareAt: 0,
    featured: true,
    onPromotion: false,
    available: true,
    stock: "",
    description:
      "Trancas box braids com acabamento profissional, pensadas para destacar presenca, estilo e durabilidade com visual moderno de salao premium.",
    image: "",
    images: [],
    imagePrompt:
      "Beautiful African woman with long box braids hairstyle, professional salon photo, studio lighting, clean background, elegant and modern look, high quality portrait photography",
    imageGeneration: BEAUTY_STARTER_IMAGE_SPECS,
  },
  {
    id: "starter-beauty-make",
    name: "Maquiagem",
    category: "Make",
    price: 12000,
    compareAt: 0,
    featured: false,
    onPromotion: false,
    available: true,
    stock: "",
    description:
      "Maquiagem glam com pele iluminada, acabamento uniforme e labios marcantes para eventos, producoes e clientes que querem chegar prontas para impressionar.",
    image: "",
    images: [],
    imagePrompt:
      "Professional makeup application close-up, African woman with flawless glam makeup, foundation, bold lips, highlighted skin, beauty salon setting, studio lighting, high quality editorial photo",
    imageGeneration: BEAUTY_STARTER_IMAGE_SPECS,
  },
  {
    id: "starter-beauty-bride",
    name: "Pacote noiva",
    category: "Noiva",
    price: 35000,
    compareAt: 0,
    featured: true,
    onPromotion: false,
    available: true,
    stock: "",
    description:
      "Pacote completo para noiva com make e cabelo de impacto, desenhado para transmitir luxo, seguranca e um look memoravel no grande dia.",
    image: "",
    images: [],
    imagePrompt:
      "African bride with elegant bridal makeup and hairstyle, bridal beauty package, soft warm lighting, white dress, professional wedding photography style, luxurious and sophisticated look",
    imageGeneration: BEAUTY_STARTER_IMAGE_SPECS,
  },
  {
    id: "starter-beauty-hair",
    name: "Cabelo",
    category: "Cabelo",
    price: 10000,
    compareAt: 0,
    featured: false,
    onPromotion: false,
    available: true,
    stock: "",
    description:
      "Servico geral de cabelo para clientes que procuram finalizacao natural, visual moderno e apresentacao forte com fotografia de beleza de alta qualidade.",
    image: "",
    images: [],
    imagePrompt:
      "African woman with beautiful natural styled hair, salon professional setting, modern hairstyle, clean background, high quality beauty photography, confident pose",
    imageGeneration: BEAUTY_STARTER_IMAGE_SPECS,
  },
]);

export function shouldHydrateBeautyStarterCatalog(store = {}, products = []) {
  return !store?.starterCatalogHydrated && Array.isArray(products) && products.length === 0;
}

export function buildBeautyStarterCatalog(baseStore = {}, options = {}) {
  const storeName = String(baseStore?.name || options.storeName || "Minha Loja").trim();
  const storeSlug = String(baseStore?.publicSlug || normalizeStorefrontSlug(storeName || "minha-loja")).trim();

  return {
    store: {
      ...baseStore,
      name: storeName || "Minha Loja",
      description:
        String(baseStore?.description || "").trim()
        || "Salao de beleza com manicure, trancas, maquiagem, cabelo e pacote noiva apresentados de forma profissional no WhatsApp.",
      publicSlug: storeSlug,
      starterCatalogHydrated: true,
      starterCatalogProfile: "beauty_angola",
    },
    products: BEAUTY_STARTER_PRODUCTS.map((product) => ({
      ...product,
      storeProfile: "beauty_angola",
    })),
  };
}
