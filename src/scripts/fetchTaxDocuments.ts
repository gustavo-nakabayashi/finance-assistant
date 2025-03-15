import dotenv from "dotenv";
import { getTaxDocuments } from "../services/conta49";
import { logger } from "../utils/logger";

dotenv.config();

async function main() {
  try {
    logger.info("Starting tax document fetch test");

    const taxDocuments = await getTaxDocuments();

    if (taxDocuments.length === 0) {
      logger.info("No tax documents found");
      return;
    }

    logger.info(`Found ${taxDocuments.length} tax documents`);

    taxDocuments.forEach((doc, index) => {
      logger.info(`Document ${index + 1}:`);
      logger.info(`  ID: ${doc.id}`);
      logger.info(`  Title: ${doc.title}`);
      logger.info(`  File name: ${doc.name}`);
      logger.info(`  Description: ${doc.description}`);
      logger.info(`  Tags: ${doc.tags.join(", ")}`);
      logger.info(`  Created At: ${doc.created_at}`);
      logger.info("-----------------------------------");
    });

    logger.info("Tax document fetch test completed successfully");
  } catch (error) {
    logger.error("Error in tax document fetch test", error);
  }
}

main().catch((error) => {
  logger.error("Unhandled error in main function", error);
  process.exit(1);
});
