import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, email, company, teamSize, message } = body as Record<string, string>;

  if (!name || !email || !company) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  const portalId = process.env.HUBSPOT_PORTAL_ID;
  const formGuid = process.env.HUBSPOT_FORM_GUID;

  if (portalId && formGuid) {
    try {
      const nameParts = name.trim().split(" ");
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(" ") || "";

      const hsRes = await fetch(
        `https://api.hsforms.com/submissions/v3/integration/submit/${portalId}/${formGuid}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fields: [
              { name: "firstname", value: firstName },
              { name: "lastname", value: lastName },
              { name: "email", value: email },
              { name: "company", value: company },
              { name: "numemployees", value: teamSize || "" },
              { name: "message", value: message || "" },
            ],
            context: {
              pageUri: process.env.NEXT_PUBLIC_APP_URL || "https://aegisgrc.com",
              pageName: "Aegis GRC – Talk to Sales",
            },
          }),
        }
      );

      if (!hsRes.ok) {
        const err = await hsRes.text();
        console.error("HubSpot submission error:", hsRes.status, err);
      }
    } catch (err) {
      console.error("HubSpot submission failed:", err);
    }
  } else {
    // HubSpot not yet configured — log for visibility
    console.log("[Contact form] HubSpot env vars not set. Submission:", {
      name,
      email,
      company,
      teamSize,
      message,
    });
  }

  return Response.json({ success: true });
}
