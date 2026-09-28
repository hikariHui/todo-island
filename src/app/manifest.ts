import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Todo Island",
    short_name: "Todo",
    description: "个人 Todo List，支持 iCloud 日历同步",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#A8D4F5",
    theme_color: "#A8D4F5",
    lang: "zh-CN",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
