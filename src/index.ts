import dotenv from "dotenv";
import { getTaxDocuments, getPendingCharges } from "./services/conta49";
import {
  makePixPayment,
  createPixCopyPastePayment,
  generateBancoInterToken,
} from "./services/bancoInter";
import { logger } from "./utils/logger";

// Load environment variables
dotenv.config();

/**
 * Main function to process and pay taxes
 */
export async function processTaxes() {
  try {
    logger.info("Starting tax payment process");

    // Fetch pending taxes from Conta 49
    const pendingTaxes = await getPendingCharges();

    // Fetch tax documents (guias and boletos)
    const taxDocuments = await getTaxDocuments();

    if (pendingTaxes.length === 0 && taxDocuments.length === 0) {
      logger.info("No pending taxes or tax documents found");
      return;
    }

    logger.info(
      `Found ${pendingTaxes.length} pending taxes and ${taxDocuments.length} tax documents`,
    );

    const interToken = await generateBancoInterToken();

    // Pay each tax using Banco Inter API
    for (const tax of pendingTaxes) {
      try {
        if (tax.pixCode) {
          const pixPayment = createPixCopyPastePayment(
            tax.value,
            tax.pixCode,
            tax.description
          );
          
          await makePixPayment(pixPayment, interToken.access_token);
          
          logger.info(`Tax paid successfully: ${tax.id}`);
        } else {
          logger.warn(`No PIX code available for tax: ${tax.id}`);
        }
      } catch (error) {
        logger.error(`Error paying tax ${tax.id}`, error);
      }
    }

    logger.info("Tax payment process completed successfully");
  } catch (error) {
    logger.error("Error in tax payment process", error);
  }
}

// The startApp function is no longer needed as Vercel will handle the scheduling
// through its Cron Jobs feature

