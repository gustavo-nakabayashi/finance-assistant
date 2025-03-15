import dotenv from "dotenv";
import { getPendingCharges } from "../services/conta49";
import { logger } from "../utils/logger";

dotenv.config();

async function main() {
  try {
    logger.info("Starting pending charges fetch test");

    const pendingCharges = await getPendingCharges();

    if (pendingCharges.length === 0) {
      logger.info("No pending charges found");
      return;
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
  } catch (error) {
    logger.error("Error in pending charges fetch test", error);
  }
}

main().catch((error) => {
  logger.error("Unhandled error in main function", error);
  process.exit(1);
});
