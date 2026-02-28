import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 6,
          background: "#0f172a",
          fontFamily: "sans-serif",
        }}
      >
        <span
          style={{
            fontSize: 18,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 1,
          }}
        >
          <span style={{ color: "#2563eb" }}>f</span>
          <span style={{ color: "#94a3b8" }}>g</span>
        </span>
      </div>
    ),
    { ...size }
  );
}
