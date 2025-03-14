import dotenv from "dotenv";
import { getTaxDocuments, getPendingTaxes } from "./services/conta49";
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
import { recordTaxPayment, recordTaxDocument, hasTaxBeenPaid } from './utils/database';

export async function processTaxes() {
  try {
    logger.info("Starting tax payment process");

    // Fetch pending taxes from Conta 49
    const pendingTaxes = await getPendingTaxes();

    // Fetch tax documents (guias and boletos)
    const taxDocuments = await getTaxDocuments();

    if (pendingTaxes.length === 0 && taxDocuments.length === 0) {
      logger.info("No pending taxes or tax documents found");
      return;
    }

    logger.info(
      `Found ${pendingTaxes.length} pending taxes and ${taxDocuments.length} tax documents`,
    );

    // Record tax documents in database
    for (const document of taxDocuments) {
      await recordTaxDocument(document);
    }

    const interToken = await generateBancoInterToken();

    // Pay each tax using Banco Inter API
    for (const tax of pendingTaxes) {
      try {
        // Check if this tax has already been paid
        const alreadyPaid = await hasTaxBeenPaid(tax.id);
        if (alreadyPaid) {
          logger.info(`Tax ${tax.id} has already been paid, skipping`);
          continue;
        }

        if (tax.pixCode) {
          const pixPayment = createPixCopyPastePayment(
            tax.amount,
            tax.pixCode,
            tax.description
          );
          
          const paymentResult = await makePixPayment(pixPayment, interToken.access_token);
          
          // Record successful payment in database
          await recordTaxPayment(
            tax, 
            'SUCCESS', 
            paymentResult.codigoSolicitacao
          );
          
          logger.info(`Tax paid successfully: ${tax.id}`);
        } else {
          logger.warn(`No PIX code available for tax: ${tax.id}`);
          // Record pending payment in database
          await recordTaxPayment(
            tax, 
            'PENDING', 
            undefined, 
            'No PIX code available'
          );
        }
      } catch (error) {
        logger.error(`Error paying tax ${tax.id}`, error);
        // Record failed payment in database
        await recordTaxPayment(
          tax, 
          'FAILED', 
          undefined, 
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    }

    logger.info("Tax payment process completed successfully");
  } catch (error) {
    logger.error("Error in tax payment process", error);
  }
}

// The startApp function is no longer needed as Vercel will handle the scheduling
// through its Cron Jobs feature

