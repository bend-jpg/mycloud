// Image Open Graph dynamique 1200×630 servie à /og.png
// Utilisée pour les previews Twitter/LinkedIn/WhatsApp/iMessage.

import { ImageResponse } from "next/og";

export const runtime = "edge";
export const contentType = "image/png";
export const size = { width: 1200, height: 630 };

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(circle at 20% 20%, #0ea5e9 0%, transparent 50%), radial-gradient(circle at 80% 80%, #f59e0b 0%, transparent 50%), #0a0a14",
          fontFamily: "system-ui, sans-serif",
          color: "#f5f5f7",
          padding: "80px",
        }}
      >
        {/* Logo + brand */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "20px",
            marginBottom: "40px",
          }}
        >
          <div
            style={{
              fontSize: "80px",
              filter: "drop-shadow(0 0 40px rgba(14, 165, 233, 0.6))",
            }}
          >
            ☁️
          </div>
          <div style={{ fontSize: "56px", fontWeight: 700, letterSpacing: "-0.02em" }}>
            MyTitanCloud
          </div>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: "44px",
            fontWeight: 700,
            textAlign: "center",
            maxWidth: "900px",
            lineHeight: 1.15,
            background: "linear-gradient(135deg, #0ea5e9 0%, #f59e0b 100%)",
            backgroundClip: "text",
            color: "transparent",
            marginBottom: "24px",
          }}
        >
          Ton cloud personnel, simple et puissant
        </div>

        {/* Sub */}
        <div
          style={{
            fontSize: "26px",
            color: "#a1a1aa",
            textAlign: "center",
            maxWidth: "900px",
          }}
        >
          Stockage · Partage WeTransfer · Famille · 50 Go gratuits
        </div>

        {/* Footer URL */}
        <div
          style={{
            position: "absolute",
            bottom: "40px",
            fontSize: "20px",
            color: "#71717a",
          }}
        >
          mytitancloud.com
        </div>
      </div>
    ),
    { ...size, headers: { "Cache-Control": "public, immutable, max-age=86400" } },
  );
}
