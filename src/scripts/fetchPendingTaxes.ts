import dotenv from "dotenv";
import { getPendingTaxes } from "../services/conta49";
import { logger } from "../utils/logger";

// Load environment variables
dotenv.config();

async function main() {
  try {
    logger.info("Starting pending taxes fetch test");

    // Fetch pending taxes
    const pendingTaxes = await getPendingTaxes();

    if (pendingTaxes.length === 0) {
      logger.info("No pending taxes found");
      return;
    }

    logger.info(`Found ${pendingTaxes.length} pending taxes`);

    // Display the taxes
    pendingTaxes.forEach((tax, index) => {
      logger.info(`Tax ${index + 1}:`);
      logger.info(`  ID: ${tax.id}`);
      logger.info(`  Description: ${tax.description}`);
      logger.info(`  Due Date: ${tax.dueDate.toLocaleDateString()}`);
      logger.info(`  Amount: R$ ${tax.amount.toFixed(2)}`);
      logger.info(`  Type: ${tax.documentType}`);
      logger.info(`  UrlPagamento: ${tax.pixCode}`);
      logger.info("-----------------------------------");
    });

    logger.info("Pending taxes fetch test completed successfully");
  } catch (error) {
    logger.error("Error in pending taxes fetch test", error);
  }
}

// Run the main function
main().catch((error) => {
  logger.error("Unhandled error in main function", error);
  process.exit(1);
});
