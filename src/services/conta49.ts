import axios from "axios";
import * as cheerio from "cheerio";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";

import { logger } from "../utils/logger";

const FirebaseAuthResponseSchema = z.object({
  idToken: z.string(),
  email: z.string(),
  refreshToken: z.string(),
  expiresIn: z.string(),
  localId: z.string(),
  registered: z.boolean(),
});

type FirebaseAuthResponse = z.infer<typeof FirebaseAuthResponseSchema>;

const Conta49SignResponseSchema = z.object({
  data: z.any(),
  status: z.number(),
  headers: z.object({
    "set-cookie": z
      .array(z.string())
      .nonempty({ message: "No cookies returned from Conta49 sign-in" })
      .refine(
        (cookies) => cookies.some((cookie) => cookie.startsWith("session=")),
        { message: "Session cookie not found in Conta49 response" },
      ),
  }),
});

type Conta49SignResponse = z.infer<typeof Conta49SignResponseSchema>;

const PENDING = "PENDING";
const OVERDUE = "OVERDUE";
const RECEIVED = "RECEIVED";

const ChargeSchema = z.object({
  id: z.string(),
  status: z.enum([PENDING, OVERDUE, RECEIVED]),
  description: z.string(),
  value: z.number(),
  invoiceUrl: z.string(),
});

type Charge = z.infer<typeof ChargeSchema>;

type ChargeWithPix = Charge & {
  pixCode?: string;
};

const AccountChargesResponseSchema = z.array(
  z.object(
    {
      result: z.object({
        data: z.object(
          {
            json: z.unknown(),
          },
          { message: "data object invalid" },
        ),
      }),
    },
    { message: "result object invalid" },
  ),
);

type AccountChargesResponse = z.infer<typeof AccountChargesResponseSchema>;

const Conta49TaxDocumentSchema = z.object({
  created_at: z.string().datetime(),
  description: z.string(),
  id: z.string(),
  name: z.string(),
  tags: z.array(z.string()),
  title: z.string(),
  payment_code: z.string().length(48).optional(),
  expiration_date: z.string().optional(),
  value: z.string().optional(),
});

type Conta49TaxDocument = z.infer<typeof Conta49TaxDocumentSchema>;

const Conta49GetTaxDocumentsResponseSchema = z.array(
  z.object(
    {
      result: z.object(
        {
          data: z.object(
            {
              json: z.unknown(),
            },
            { message: "data object invalid" },
          ),
        },
        { message: "result object invalid" },
      ),
    },
    { message: "parent object invalid" },
  ),
);

type Conta49GetTaxDocumentsResponse = z.infer<
  typeof Conta49GetTaxDocumentsResponseSchema
>;

const HtmlResponseSchema = z.string();

const Conta49DocumentURLResponseSchema = z.array(
  z.object(
    {
      result: z.object(
        {
          data: z.object(
            {
              json: z.string(),
            },
            { message: "data object invalid" },
          ),
        },
        { message: "result object invalid" },
      ),
    },
    { message: "parent object invalid" },
  ),
);

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
async function firebaseAuthenticate(): Promise<FirebaseAuthResponse> {
  try {
    // Log authentication attempt (without sensitive data)
    logger.info(
      `Attempting Firebase authentication for ${process.env.CONTA49_EMAIL}`,
    );

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

    const response = await axios.post<FirebaseAuthResponse>(
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

    return FirebaseAuthResponseSchema.parse(response.data);
  } catch (error) {
    logger.error("Failed to authenticate with Firebase", error);

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
async function conta49SignIn(
  firebaseToken: string,
): Promise<{ sessionCookie: string }> {
  try {
    const response = await axios.post<Conta49SignResponse>(
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

    const validatedResponse = Conta49SignResponseSchema.parse(response);

    const sessionCookie = validatedResponse.headers["set-cookie"].find(
      (cookie) => cookie.startsWith("session="),
    )!;

    const sessionValue = (sessionCookie.split(";")[0] ?? "").replace(
      "session=",
      "",
    );

    logger.info("Conta49 sign-in successful with session cookie");

    return { sessionCookie: sessionValue };
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

interface AuthenticateConta49Response {
  firebaseAuth: FirebaseAuthResponse;
  sessionCookie: string;
}

/**
 * Complete authentication flow for Conta49
 * @returns Authentication tokens and session data
 */
export async function authenticateConta49(): Promise<AuthenticateConta49Response> {
  try {
    const firebaseAuthResponse = await firebaseAuthenticate();

    const conta49AuthResponse = await conta49SignIn(
      firebaseAuthResponse.idToken,
    );

    return {
      firebaseAuth: firebaseAuthResponse,
      sessionCookie: conta49AuthResponse.sessionCookie,
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
): Promise<Array<Charge>> {
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

    const inputParam = encodeURIComponent(JSON.stringify(inputData));
    const requestUrl = `${url}&input=${inputParam}`;

    const response = await axios.get<AccountChargesResponse>(requestUrl, {
      headers: {
        "Content-Type": "application/json",
        Cookie: `session=${sessionCookie}`,
      },
    });

    logger.info("Successfully fetched account charges from Conta49");
    const validateResponse = AccountChargesResponseSchema.parse(response.data);

    const payments = validateResponse[1]?.result?.data?.json;

    const validatedPayments = z
      .array(ChargeSchema, { message: "Failed parsing array of ChargeSchema" })
      .parse(payments);

    return validatedPayments;
  } catch (error) {
    logger.error("Failed to fetch account charges from Conta49", error);
    throw new Error("Failed to fetch account charges");
  }
}

function parseInvoiceUrl(invoiceUrl: string): string {
  if (invoiceUrl.includes("/b/preview/")) {
    return invoiceUrl;
  }

  const matches = /\/i\/([^\/]+)$/.exec(invoiceUrl);
  if (matches?.[1]) {
    const id = matches[1];
    return `https://www.asaas.com/b/preview/${id}`;
  }

  return invoiceUrl;
}

/**
 * Extracts PIX code from a payment URL from asa preview page
 * @param paymentUrl The URL to the payment page
 * @returns The PIX code or null if not found
 */
export async function extractPixCodeFromAsaPreviewPage(
  paymentUrl: string,
): Promise<string | null> {
  try {
    logger.info(`Extracting PIX code from URL: ${paymentUrl}`);

    const response = await axios.get(paymentUrl);
    const html = HtmlResponseSchema.parse(response.data);

    const $ = cheerio.load(html);

    const pixSection = $(".pix-section");
    if (pixSection.length > 0) {
      const pixCode = pixSection.find("p")?.text()?.trim() || "";
      if (pixCode?.startsWith("00020101")) {
        logger.info("Successfully extracted PIX code from pix-section");
        return pixCode;
      }
    }

    // Alternative: Look for elements with "Código Pix copia e cola" heading
    const pixHeading = $('h5:contains("Código Pix copia e cola")');
    if (pixHeading.length > 0) {
      const pixCode = pixHeading.next("p")?.text()?.trim() || "";
      if (pixCode?.startsWith("00020101")) {
        logger.info("Successfully extracted PIX code from heading");
        return pixCode;
      }
    }

    // Fallback: Look for any paragraph containing a PIX code pattern
    const pixParagraphs = $("p").filter(function () {
      const text = $(this).text()?.trim() || "";
      return text.includes("br.gov.bcb.pix") && text.startsWith("00020101");
    });

    if (pixParagraphs.length > 0) {
      const pixCode = pixParagraphs.first().text()?.trim() || "";
      logger.info("Successfully extracted PIX code from paragraph");
      return pixCode;
    }

    logger.warn("Could not extract PIX code from the payment page");
    return null;
  } catch (error) {
    // Properly type the error
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error("Error extracting PIX code from URL", { error: errorMessage });
    return null;
  }
}

/**
 * Enhances tax objects by fetching and adding payment codes
 * @param charges Array of charge objects
 * @returns Enhanced charge objects with payment codes where available
 */
export async function enhanceChargesWithPaymentCodes(
  charges: Charge[],
): Promise<ChargeWithPix[]> {
  const enhancedCharges: ChargeWithPix[] = [];

  for (const charge of charges) {
    try {
      const enhancedCharge: ChargeWithPix = {
        ...charge,
      };
      const pixCode = await extractPixCodeFromAsaPreviewPage(charge.invoiceUrl);

      if (pixCode) {
        enhancedCharge.pixCode = pixCode;
      }

      enhancedCharges.push(enhancedCharge);
    } catch (error) {
      logger.error(`Error enhancing charge with ID ${charge.id}`, { error });
      enhancedCharges.push({ ...charge });
    }
  }

  return enhancedCharges;
}

/**
 * Gets all pending charges from Conta49
 * @returns List of charges that need to be paid
 */
export async function getPendingCharges(): Promise<ChargeWithPix[]> {
  try {
    const authResponse = await authenticateConta49();

    const sessionCookie = authResponse.sessionCookie;

    if (!process.env.CONTA49_ACCOUNT_ID) {
      throw new Error("CONTA49_ACCOUNT_ID environment variable is not set");
    }

    const charges = await fetchAccountCharges(
      sessionCookie,
      process.env.CONTA49_ACCOUNT_ID,
    );

    const pendingCharges = charges
      .filter(
        (payment: Charge) =>
          payment.status === PENDING || payment.status === OVERDUE,
      )
      .map((charge) => {
        return {
          ...charge,
          invoiceUrl: parseInvoiceUrl(charge.invoiceUrl),
        };
      });

    logger.info(
      `Found ${pendingCharges.length} pending charges and ${charges.length - pendingCharges.length} paid charges`,
    );

    const pendingChargesWithPix =
      await enhanceChargesWithPaymentCodes(pendingCharges);

    return pendingChargesWithPix;
  } catch (error) {
    logger.error("Failed to get pending charges", error);
    throw new Error("Failed to get pending charges from Conta49");
  }
}

/**
 * Fetches documents from Conta49 and filters for tax documents
 * @returns List of tax documents (guias and boletos)
 */
export async function getTaxDocuments(): Promise<Conta49TaxDocument[]> {
  try {
    const authResponse = await authenticateConta49();

    const sessionCookie = authResponse.sessionCookie;

    if (!sessionCookie) {
      logger.error("No session cookie found in authentication response");
      throw new Error("Missing session cookie");
    }

    logger.info("Successfully obtained Conta49 session cookie");

    const accountId = process.env.CONTA49_ACCOUNT_ID;

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

    const inputParam = encodeURIComponent(JSON.stringify(inputData));
    const requestUrl = `${url}?batch=1&input=${inputParam}`;

    const response = await axios.get<Conta49GetTaxDocumentsResponse>(
      requestUrl,
      {
        headers: {
          "Content-Type": "application/json",
          Cookie: `session=${sessionCookie}`,
        },
      },
    );

    const validatedResponse = Conta49GetTaxDocumentsResponseSchema.parse(
      response.data,
    );

    const documents = validatedResponse[1]?.result?.data?.json;

    const validatedDocuments = z
      .array(Conta49TaxDocumentSchema)
      .parse(documents);

    const taxDocuments = validatedDocuments.filter(
      (doc: Conta49TaxDocument) => {
        if (!doc.tags || !Array.isArray(doc.tags)) return false;
        return doc.tags.includes("guia") || doc.tags.includes("Boleto");
      },
    );

    logger.info(
      `Found ${taxDocuments.length} tax documents (guias and boletos)`,
    );
    return taxDocuments;
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

const boletoSchema = z.object({
  payment_code: z.string(),
  value: z.string(),
  expiration_date: z.string(),
});

type Boleto = z.infer<typeof boletoSchema>;

/**
 * Fetches account information and charges from Conta49
 * @param sessionToken Firebase session token
 * @param accountId Account ID to fetch charges for
 * @param documentId Account ID to fetch charges for
 * @returns document URL
 */
export async function fetchConta49DocumentPaymentCode(
  documentId: string,
): Promise<Boleto> {
  try {
    const authResponse = await authenticateConta49();

    const sessionCookie = authResponse.sessionCookie;

    if (!sessionCookie) {
      logger.error("No session cookie found in authentication response");
      throw new Error("Missing session cookie");
    }

    logger.info("Successfully obtained Conta49 session cookie");

    const accountId = process.env.CONTA49_ACCOUNT_ID;

    const response = await axios.post(
      "https://app.conta49.com.br/api/trpc/account.getDocumentDownloadUrl?batch=1",
      {
        "0": {
          json: {
            accountId,
            documentId,
          },
        },
      },
      {
        headers: {
          "content-type": "application/json",
          Cookie: `session=${sessionCookie}`,
        },
      },
    );

    logger.info("Successfully fetched conta 49 document URL");

    const validateResponse = Conta49DocumentURLResponseSchema.parse(
      response.data,
    );

    const documentUrl = z
      .string()
      .url()
      .parse(validateResponse[0]?.result?.data?.json);

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const paymentCodeResponse = await anthropic.messages.create({
      model: "claude-3-7-sonnet-20250219",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "url",
                url: documentUrl,
              },
            },
            {
              type: "text",
              text: `
                You are tasked with extracting specific information from a PDF document containing a Brazillian Boleto. Your goal is to extract the Pix payment code, the expiration date, and the payment value from the provided PDF content.

                Follow these steps to complete the task:

                1. Analyze the PDF content and locate the Code to pay, it's a brazillian Boleto for paying taxes.
                2. Extract the Pix payment code from the QR code. This code is always exactly 48 digits long. Examples of valid formats:
                   - Without separators: 85890000005068210385250979071625072116722993141
                   - With spaces: 85890000005 0 68210385250 9 79071625072 1 16722993141 0
                   - With hyphens: 81670000001-0 75610521202-8 50331032515-7 53710070000-5

                3. Process the payment code:
                   - Remove all white spaces and hyphens
                   - Validate that the result is exactly 48 digits long
                   - Ensure no digits are lost during processing, especially after hyphens

                4. Locate and extract the expiration date for the payment.
                5. Find and extract the payment value.
                6. Format the payment value as a string with 2 decimal places.

                After extracting the required information, format your response as a JSON object with the following properties:
                - payment_code: The Pix payment code as a string of exactly 48 digits
                - value: The payment value as a string with 2 decimal places
                - expiration_date: The payment date in ISO format

                Answer with only a valid JSON object. Example:

                {
                  "payment_code": "858900000050682103852509790716250721167229931410",
                  "value": "123.45",
                  "expiration_date": "2024-03-15"
                }

                Note: If you cannot find or extract any of the required information, use an empty string ("") for the corresponding value in the JSON object.

                Validation checks:
                1. The payment_code must be exactly 48 digits long
                2. Verify that no digits are lost when removing hyphens
                3. The final string should contain only numbers, no spaces or special characters
                            },
                          ],
                        },
                      ],
                    });

                    const res = paymentCodeResponse.content[0];

                    if (res?.type !== "text") {
                      logger.error("Failed to fetch document URL from 49");
                      throw new Error("failed to get text from claude response");
                    }

  `})
                    logger.info( `Attempting to parse payment details response as JSON: ${documentUrl}`,
      res.text,
    );

    const paymentCode = boletoSchema.parse(JSON.parse(res.text));

    return paymentCode;
  } catch (error) {
    logger.error("Failed to fetch document URL from 49", error);
    throw new Error("Failed to fetch document URL");
  }
}
