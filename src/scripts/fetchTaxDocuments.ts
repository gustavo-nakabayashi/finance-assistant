import dotenv from "dotenv";
import { getTaxDocuments } from "../services/conta49";
import { logger } from "../utils/logger";

// Load environment variables
dotenv.config();

async function main() {
  try {
    logger.info("Starting tax document fetch test");

    // Fetch tax documents (guias and boletos)
    const taxDocuments = await getTaxDocuments();

    if (taxDocuments.length === 0) {
      logger.info("No tax documents found");
      return;
    }

    logger.info(`Found ${taxDocuments.length} tax documents`);

    // Display the documents
    taxDocuments.forEach((doc, index) => {
      logger.info(`Document ${index + 1}:`);
      logger.info(`  Title: ${doc.title}`);
      logger.info(`  Type: ${doc.documentType}`);
      logger.info(`  Created: ${doc.createdAt.toLocaleDateString()}`);
      if (doc.dueDate) {
        logger.info(`  Due Date: ${doc.dueDate.toLocaleDateString()}`);
      }
      logger.info(`  Tags: ${doc.tags.join(", ")}`);
      logger.info("-----------------------------------");
    });

    logger.info("Tax document fetch test completed successfully");
  } catch (error) {
    logger.error("Error in tax document fetch test", error);
  }
}

// Run the main function
main().catch((error) => {
  logger.error("Unhandled error in main function", error);
  process.exit(1);
});
