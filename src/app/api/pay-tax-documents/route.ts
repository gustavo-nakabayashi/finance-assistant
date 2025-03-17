import { db } from "~/server/db";
import { logger } from "~/utils/logger";
import { ne, eq, and } from "drizzle-orm";
import { documents } from "../../../server/db/schema";
import { makePixPayment } from "~/services/bancoInter";

export async function GET(request: Request) {
  try {
    const results = await db.query.documents.findMany({
      where: and(eq(documents.paid, false), ne(documents.payment_code, "")),
    });

    makep

    makePixPayment()

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    logger.error("Error in pending taxes fetch", error);
    return new Response(
      JSON.stringify({ message: "error", error: String(error) }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
