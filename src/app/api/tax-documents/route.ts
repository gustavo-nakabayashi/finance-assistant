import { db } from "~/server/db";
import { documents } from "~/server/db/schema";
import { fetchConta49DocumentPaymentCode, getTaxDocuments } from "~/services/conta49";
import { logger } from "~/utils/logger";

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response("Unauthorized", {
        status: 401,
      });
    }

    logger.info("Starting tax document fetch test");

    const taxDocuments = await getTaxDocuments();
    const dbDocuments = await db.query.documents.findMany();

    if (taxDocuments.length === 0) {
      logger.info("No tax documents found");
      return new Response(
        JSON.stringify({ message: "No taxes documents found" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const newDocuments = taxDocuments.filter((doc) => {
      return !dbDocuments.map((existingDoc) => existingDoc.id).includes(doc.id);
    });

    if (newDocuments.length === 0) {
      logger.info("No new tax documents found");
      return new Response(
        JSON.stringify({ message: "No pending taxes found" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    for (const doc of newDocuments) {
      const docUrl = await fetchConta49DocumentPaymentCode(doc.id);
      doc.payment_code = docUrl.payment_code;
      doc.value = docUrl.value;
      doc.date = docUrl.date;
    }

    await db.insert(documents).values(
      newDocuments.map((doc) => {
        return {
          id: doc.id,
          created_at: new Date(doc.created_at),
          name: doc.name,
          payment_code: doc.payment_code ?? "",
        };
      }),
    );

    logger.info(`Found ${taxDocuments.length} tax documents`);

    newDocuments.forEach((doc, index) => {
      logger.info(`Document ${index + 1}:`);
      logger.info(`  ID: ${doc.id}`);
      logger.info(`  Title: ${doc.title}`);
      logger.info(`  File name: ${doc.name}`);
      logger.info(`  Description: ${doc.description}`);
      logger.info(`  Tags: ${doc.tags.join(", ")}`);
      logger.info(`  Created At: ${doc.created_at}`);
      logger.info(`  Payment Code: ${doc.payment_code}`);
      logger.info("-----------------------------------");
    });

    return new Response(
      JSON.stringify({
        message: "success",
        count: taxDocuments.length,
        taxes: taxDocuments,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
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
