import axios from "axios";
import * as cheerio from "cheerio";
import { logger } from "../utils/logger";
import { Tax } from "../types";

// Create axios instance for Conta 49 API
const conta49Api = axios.create({
  baseURL: process.env.CONTA49_API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

/**
 * Firebase authentication for Conta49
 * @returns Authentication result
 */
/**
 * Authenticates with Firebase for Conta49 access
 * Note: Firebase API keys are designed to be public and used in client-side code.
 * Security is enforced through Firebase Console settings (domain restrictions,
 * IP allowlists, and Firebase Security Rules).
 */
async function firebaseAuthenticate(): Promise<any> {
  try {
    // Log authentication attempt (without sensitive data)
    logger.info(
      `Attempting Firebase authentication for ${process.env.CONTA49_EMAIL}`,
    );

    // Check if credentials are available
    if (!process.env.CONTA49_EMAIL) {
      throw new Error("CONTA49_EMAIL environment variable is not set");
    }

    if (!process.env.CONTA49_PASSWORD) {
      throw new Error("CONTA49_PASSWORD environment variable is not set");
    }

    if (!process.env.CONTA49_FIREBASE_API_KEY) {
      throw new Error(
        "CONTA49_FIREBASE_API_KEY environment variable is not set",
      );
    }

    const response = await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.CONTA49_FIREBASE_API_KEY}`,
      {
        returnSecureToken: true,
        email: process.env.CONTA49_EMAIL,
        password: process.env.CONTA49_PASSWORD,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    logger.info("Firebase authentication successful");
    return response.data;
  } catch (error) {
    logger.error("Failed to authenticate with Firebase", error);

    // Add more detailed error information
    if (axios.isAxiosError(error) && error.response) {
      logger.error(
        `Firebase auth error details: ${JSON.stringify(error.response.data)}`,
      );
    }

    throw new Error("Authentication with Firebase failed");
  }
}

/**
 * Authenticates with Conta49 using Firebase token
 * @returns Authentication result
 */
async function conta49SignIn(firebaseToken: string): Promise<any> {
  try {
    const response = await axios.post(
      "https://app.conta49.com.br/api/trpc/auth.signIn?batch=1",
      {
        "0": {
          json: {
            tokenId: firebaseToken,
          },
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    // Extract the Set-Cookie header from the response
    const cookies = response.headers["set-cookie"];
    if (!cookies || cookies.length === 0) {
      logger.error("No cookies returned from Conta49 sign-in");
      throw new Error("No session cookie received from Conta49");
    }

    // Find the session cookie
    const sessionCookie = cookies.find((cookie: string) =>
      cookie.startsWith("session="),
    );
    if (!sessionCookie) {
      logger.error("No session cookie found in Conta49 response");
      throw new Error("Session cookie not found in Conta49 response");
    }

    // Extract just the cookie value (without attributes like Path, HttpOnly, etc.)
    const sessionValue = sessionCookie.split(";")[0].replace("session=", "");

    logger.info("Conta49 sign-in successful with session cookie");

    // Return both the response data and the session cookie
    return {
      data: response.data,
      sessionCookie: sessionValue,
    };
  } catch (error) {
    logger.error("Failed to sign in to Conta49", error);
    if (axios.isAxiosError(error) && error.response) {
      logger.error(
        `Conta49 sign-in error details: ${JSON.stringify(error.response.data)}`,
      );
    }
    throw new Error("Authentication with Conta49 failed");
  }
}

/**
 * Complete authentication flow for Conta49
 * @returns Authentication tokens and session data
 */
export async function authenticateConta49(): Promise<any> {
  try {
    // First authenticate with Firebase
    const firebaseAuthResult = await firebaseAuthenticate();

    // Then use the Firebase token to authenticate with Conta49
    const conta49AuthResult = await conta49SignIn(firebaseAuthResult.idToken);

    return {
      firebaseAuth: firebaseAuthResult,
      conta49Auth: conta49AuthResult.data,
      sessionCookie: conta49AuthResult.sessionCookie,
    };
  } catch (error) {
    logger.error("Complete Conta49 authentication flow failed", error);
    throw new Error("Conta49 authentication flow failed");
  }
}

/**
 * Fetches account information and charges from Conta49
 * @param sessionToken Firebase session token
 * @param accountId Account ID to fetch charges for
 * @returns Account information and charges
 */
export async function fetchAccountCharges(
  sessionCookie: string,
  accountId: string,
): Promise<any> {
  try {
    const url =
      "https://app.conta49.com.br/api/trpc/account.getMe,account.getCharges?batch=1";
    const inputData = {
      "0": {
        json: null,
        meta: {
          values: ["undefined"],
        },
      },
      "1": {
        json: {
          accountId: accountId,
        },
      },
    };

    // URL encode the input data
    const inputParam = encodeURIComponent(JSON.stringify(inputData));
    const requestUrl = `${url}&input=${inputParam}`;

    const response = await axios.get(requestUrl, {
      headers: {
        "Content-Type": "application/json",
        Cookie: `session=${sessionCookie}`,
      },
    });

    logger.info("Successfully fetched account charges from Conta49");
    return response.data;
  } catch (error) {
    logger.error("Failed to fetch account charges from Conta49", error);
    throw new Error("Failed to fetch account charges");
  }
}

function parseInvoiceUrl(invoiceUrl: string): string {
  // Check if it's already in the correct format
  if (invoiceUrl.includes("/b/preview/")) {
    return invoiceUrl;
  }

  // Extract the ID from the invoice URL (the part after "/i/")
  const matches = invoiceUrl.match(/\/i\/([^\/]+)$/);
  if (matches && matches[1]) {
    const id = matches[1];
    return `https://www.asaas.com/b/preview/${id}`;
  }

  // If no match found, return original URL
  return invoiceUrl;
}

/**
 * Converts a payment from Conta49 API to our Tax interface
 * @param payment Payment object from Conta49 API
 * @returns Tax object
 */
function paymentToTax(payment: any): Tax {
  return {
    id: payment.id,
    description: payment.description,
    dueDate: new Date(payment.dueDate),
    amount: payment.value,
    barCode: payment.nossoNumero,
    documentType: payment.billingType,
    paymentUrl: parseInvoiceUrl(payment.invoiceUrl),
  };
}

/**
 * Extracts PIX code from a payment URL
 * @param paymentUrl The URL to the payment page
 * @returns The PIX code or null if not found
 */
export async function extractPixCodeFromUrl(
  paymentUrl: string,
): Promise<string | null> {
  try {
    logger.info(`Extracting PIX code from URL: ${paymentUrl}`);

    // Fetch the payment page
    const response = await axios.get(paymentUrl);
    const html = response.data;

    // Use cheerio to parse the HTML
    const $ = cheerio.load(html);

    // Look for the PIX code in the pix-section div
    const pixSection = $(".pix-section");
    if (pixSection.length > 0) {
      // Get the paragraph that contains the PIX code
      const pixCode = pixSection.find("p").text().trim();
      if (pixCode && pixCode.startsWith("00020101")) {
        logger.info("Successfully extracted PIX code from pix-section");
        return pixCode.replace(/\s+/g, ""); // Remove any whitespace
      }
    }

    // Alternative: Look for elements with "Código Pix copia e cola" heading
    const pixHeading = $('h5:contains("Código Pix copia e cola")');
    if (pixHeading.length > 0) {
      // Get the next paragraph after the heading
      const pixCode = pixHeading.next("p").text().trim();
      if (pixCode && pixCode.startsWith("00020101")) {
        logger.info("Successfully extracted PIX code from heading");
        return pixCode.replace(/\s+/g, ""); // Remove any whitespace
      }
    }

    // Fallback: Look for any paragraph containing a PIX code pattern
    const pixParagraphs = $("p").filter(function () {
      const text = $(this).text().trim();
      return text.includes("br.gov.bcb.pix") && text.startsWith("00020101");
    });

    if (pixParagraphs.length > 0) {
      const pixCode = pixParagraphs.first().text().trim();
      logger.info("Successfully extracted PIX code from paragraph");
      return pixCode;
    }

    logger.warn("Could not extract PIX code from the payment page");
    return null;
  } catch (error) {
    logger.error("Error extracting PIX code from URL", { error });
    return null;
  }
}

/**
 * Enhances tax objects by fetching and adding payment codes
 * @param taxes Array of tax objects
 * @returns Enhanced tax objects with payment codes where available
 */
export async function enhanceTaxesWithPaymentCodes(
  taxes: Tax[],
): Promise<Tax[]> {
  const enhancedTaxes: Tax[] = [];

  for (const tax of taxes) {
    try {
      // If there's a payment URL, try to extract the PIX code
      if (tax.paymentUrl) {
        const pixCode = await extractPixCodeFromUrl(tax.paymentUrl);
        if (pixCode) {
          tax.pixCode = pixCode;
        }
      }

      enhancedTaxes.push(tax);
    } catch (error) {
      logger.error(`Error enhancing tax with ID ${tax.id}`, { error });
      enhancedTaxes.push(tax); // Still include the original tax
    }
  }

  return enhancedTaxes;
}

/**
 * Gets all pending taxes from Conta49
 * @returns List of taxes that need to be paid
 */
export async function getPendingTaxes(): Promise<Tax[]> {
  try {
    // First authenticate
    const authResult = await authenticateConta49();

    // Extract session cookie from auth result
    const sessionCookie = authResult.sessionCookie;

    // Get account ID from auth result or use from environment
    const accountId =
      process.env.CONTA49_ACCOUNT_ID || "65d62836a290003c6c9e768f";

    // Fetch charges
    const chargesResult = await fetchAccountCharges(sessionCookie, accountId);

    // Extract payments from the response
    // The charges are in the second result object, in the data.json array
    const payments = chargesResult[1]?.result?.data?.json || [];

    // Filter for pending or overdue payments only
    const pendingPayments = payments.filter(
      (payment: any) =>
        payment.status === "PENDING" || payment.status === "OVERDUE",
    );

    // Convert to Tax objects
    let taxes: Tax[] = pendingPayments.map(paymentToTax);

    // Enhance taxes with payment codes
    taxes = await enhanceTaxesWithPaymentCodes(taxes);

    logger.info(`Found ${taxes.length} pending taxes`);
    return taxes;
  } catch (error) {
    logger.error("Failed to get pending taxes", error);
    throw new Error("Failed to get pending taxes from Conta49");
  }
}

/**
 * Fetches documents from Conta49 and filters for tax documents
 * @returns List of tax documents (guias and boletos)
 */
export async function getTaxDocuments(): Promise<any[]> {
  try {
    // First authenticate
    const authResult = await authenticateConta49();

    // Extract session cookie from auth result
    const sessionCookie = authResult.sessionCookie;

    if (!sessionCookie) {
      logger.error("No session cookie found in authentication response");
      throw new Error("Missing session cookie");
    }

    logger.info("Successfully obtained Conta49 session cookie");

    // Get account ID from auth result or use from environment
    const accountId =
      process.env.CONTA49_ACCOUNT_ID || "65d62836a290003c6c9e768f";

    // Prepare the request to fetch documents
    const url =
      "https://app.conta49.com.br/api/trpc/account.getMe,account.getDocuments,account.getDocumentTags";

    const inputData = {
      "0": {
        json: null,
        meta: {
          values: ["undefined"],
        },
      },
      "1": {
        json: {
          accountId: accountId,
          tag: "",
          ids: "",
        },
      },
      "2": {
        json: accountId,
      },
    };

    // URL encode the input data
    const inputParam = encodeURIComponent(JSON.stringify(inputData));
    const requestUrl = `${url}?batch=1&input=${inputParam}`;

    const response = await axios.get(requestUrl, {
      headers: {
        "Content-Type": "application/json",
        Cookie: `session=${sessionCookie}`,
      },
    });

    // Extract documents from the response
    // The documents are in the second result object, in the data.json array
    const documents = response.data[1]?.result?.data?.json || [];

    // Filter for documents with "guia" or "Boleto" tags
    const taxDocuments = documents.filter((doc: any) => {
      if (!doc.tags || !Array.isArray(doc.tags)) return false;
      return doc.tags.includes("guia") || doc.tags.includes("Boleto");
    });

    // Extract relevant information and parse dates
    const formattedDocuments = taxDocuments.map((doc: any) => {
      // Try to extract due date from description if it contains "Vencimento"
      let dueDate = null;
      if (doc.description && doc.description.includes("Vencimento")) {
        const dateMatch = doc.description.match(
          /Vencimento\s+(\d{2}\/\d{2}\/\d{4})/,
        );
        if (dateMatch && dateMatch[1]) {
          const [day, month, year] = dateMatch[1].split("/").map(Number);
          dueDate = new Date(year, month - 1, day);
        }
      }

      return {
        id: doc.id,
        uuid: doc.uuid,
        title: doc.title,
        description: doc.description,
        tags: doc.tags,
        createdAt: new Date(doc.created_at),
        dueDate: dueDate,
        fileName: doc.name,
        documentType: doc.tags.includes("Boleto") ? "Boleto" : "Guia",
      };
    });

    logger.info(
      `Found ${formattedDocuments.length} tax documents (guias and boletos)`,
    );
    return formattedDocuments;
  } catch (error) {
    logger.error("Failed to get tax documents", error);

    // Add more detailed error information
    if (error instanceof Error) {
      logger.error(`Error message: ${error.message}`);
    }

    if (axios.isAxiosError(error) && error.response) {
      logger.error(`API error details: ${JSON.stringify(error.response.data)}`);
      logger.error(`Status code: ${error.response.status}`);
    }

    throw new Error("Failed to get tax documents from Conta49");
  }
}

