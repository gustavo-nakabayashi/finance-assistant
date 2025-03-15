import { getPendingCharges } from "~/services/conta49";
import { logger } from "~/utils/logger";

export async function GET(request: Request) {
  try {
    logger.info("Starting pending charges fetch test");

    const pendingCharges = await getPendingCharges();

    if (pendingCharges.length === 0) {
      logger.info("No pending charges found");
      return new Response(
        JSON.stringify({ message: "No pending charges found" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    logger.info(`Found ${pendingCharges.length} pending charges`);

    pendingCharges.forEach((charge, index) => {
      logger.info(`Charge ${index + 1}:`);
      logger.info(`  ID: ${charge.id}`);
      logger.info(`  Description: ${charge.description}`);
      logger.info(`  Amount: R$ ${charge.value.toFixed(2)}`);
      logger.info(`  PixCode: ${charge.pixCode}`);
      logger.info("-----------------------------------");
    });

    logger.info("Pending charges fetch test completed successfully");

    return new Response(
      JSON.stringify({
        message: "success",
        count: pendingCharges.length,
        charges: pendingCharges,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    logger.error("Error in pending charges fetch test", error);
    return new Response(
      JSON.stringify({ message: "error", error: String(error) }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
