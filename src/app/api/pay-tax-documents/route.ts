import { db } from "~/server/db";
import { logger } from "~/utils/logger";
import { ne, eq, and } from "drizzle-orm";
import { documentsTable } from "../../../server/db/schema";
import {
  createBoletoBankAccountPayment,
  generateBancoInterToken,
} from "~/services/bancoInter";

export async function GET(request: Request) {
  try {
    const boletos = await db.query.documentsTable.findMany({
      where: and(eq(documentsTable.paid, false), ne(documentsTable.payment_code, "")),
    });

    const token = await generateBancoInterToken();

    const payBoletos = boletos.map(async (boleto) => {
      await createBoletoBankAccountPayment(boleto, token.access_token);
    });

    await Promise.all(payBoletos);

    return new Response(JSON.stringify(boletos), {
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
