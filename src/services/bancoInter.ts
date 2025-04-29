import axios from "axios";
import fs from "fs";
import https from "https";
import { logger } from "../utils/logger";
import { db } from "~/server/db";
import { type documents } from "~/server/db/schema";

const BANCO_INTER_BASE_URL = "https://cdpj.partners.bancointer.com.br";
const TOKEN_ENDPOINT = "/oauth/v2/token";
const PIX_ENDPOINT = "/banking/v2/pix";
const BOLETO_ENDPOINT = "/banking/v2/pagamento";

type PixDestinationType = "CHAVE" | "DADOS_BANCARIOS" | "PIX_COPIA_E_COLA";

interface TokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in: number;
}

interface PixPaymentResponse {
  tipoRetorno: string;
  codigoSolicitacao: string;
  dataPagamento: string;
  dataOperacao: string;
}

interface PixKeyPayment {
  valor: number;
  dataPagamento?: string;
  descricao: string;
  destinatario: {
    tipo: "CHAVE";
    chave: string;
  };
}

interface PixBankAccountPayment {
  valor: number;
  dataPagamento?: string;
  descricao: string;
  destinatario: {
    tipo: "DADOS_BANCARIOS";
    nome: string;
    contaCorrente: string;
    tipoConta: "CONTA_CORRENTE" | "CONTA_POUPANCA";
    cpfCnpj: string;
    agencia: string;
    instituicaoFinanceira: {
      ispb: string;
    };
  };
}

interface PixCopyPastePayment {
  valor: number;
  dataPagamento?: string;
  descricao: string;
  destinatario: {
    tipo: "PIX_COPIA_E_COLA";
    pixCopiaECola: string;
  };
}

// Union type for all PIX payment types
type PixPayment = PixKeyPayment | PixBankAccountPayment | PixCopyPastePayment;

const openCertificates = () => {
  if (!process.env.BANCO_INTER_CERT) {
    throw new Error("BANCO_INTER_CERT environment variable is not set");
  }

  if (!process.env.BANCO_INTER_KEY) {
    throw new Error("BANCO_INTER_KEY environment variable is not set");
  }

  const cert = Buffer.from(process.env.BANCO_INTER_CERT, "base64").toString(
    "ascii",
  );
  const key = Buffer.from(process.env.BANCO_INTER_KEY, "base64").toString(
    "ascii",
  );

  return { cert, key };
};

/**
 * Generate a token for Banco Inter API using certificate-based authentication
 * @returns Promise with the token response
 */
export async function generateBancoInterToken(): Promise<TokenResponse> {
  try {
    logger.info("Generating Banco Inter token");

    // Check if credentials are available
    if (
      !process.env.BANCO_INTER_CLIENT_ID ||
      !process.env.BANCO_INTER_CLIENT_SECRET
    ) {
      throw new Error(
        "Banco Inter credentials or certificate not set in environment variables",
      );
    }

    const { cert, key } = openCertificates();

    const params = new URLSearchParams();
    params.append("client_id", process.env.BANCO_INTER_CLIENT_ID);
    params.append("client_secret", process.env.BANCO_INTER_CLIENT_SECRET);
    params.append("grant_type", "client_credentials");
    params.append("scope", "pagamento-pix.write pagamento-boleto.write");

    // Create HTTPS agent with certificates
    const httpsAgent = new https.Agent({
      cert,
      key,
      rejectUnauthorized: true, // Validate server certificate
    });

    const response = await axios.post<TokenResponse>(
      `${BANCO_INTER_BASE_URL}${TOKEN_ENDPOINT}`,
      params,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        httpsAgent,
      },
    );

    logger.info("Successfully generated Banco Inter token");
    return response.data;
  } catch (error) {
    logger.error("Error generating Banco Inter token:", error);
    throw error;
  }
}

/**
 * Make a PIX payment using Banco Inter API
 * @param payment The payment details
 * @param token The access token
 * @returns Promise with the payment response
 */
export async function makePixPayment(
  payment: PixPayment,
  token: string,
): Promise<PixPaymentResponse> {
  try {
    logger.info("Making PIX payment");

    const { cert, key } = openCertificates();

    // If dataPagamento is not provided, use today's date
    if (!("dataPagamento" in payment) || !payment.dataPagamento) {
      const today = new Date();
      const formattedDate = today.toISOString().split("T")[0]; // YYYY-MM-DD
      payment = { ...payment, dataPagamento: formattedDate };
    }

    // Create HTTPS agent with certificates
    const httpsAgent = new https.Agent({
      cert,
      key,
      rejectUnauthorized: true, // Validate server certificate
    });

    const response = await axios.post<PixPaymentResponse>(
      `${BANCO_INTER_BASE_URL}${PIX_ENDPOINT}`,
      payment,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        httpsAgent,
      },
    );

    logger.info(
      `PIX payment successful. Reference: ${response.data.codigoSolicitacao}`,
    );
    return response.data;
  } catch (error) {
    logger.error("Error making PIX payment:", error);
    throw error;
  }
}

/**
 * Helper function to create a PIX payment with key
 * @param value Payment amount
 * @param key PIX key
 * @param description Payment description
 * @param paymentDate Optional payment date (YYYY-MM-DD)
 * @returns PIX payment object
 */
export function createPixKeyPayment(
  value: number,
  key: string,
  description: string,
  paymentDate?: string,
): PixKeyPayment {
  return {
    valor: value,
    dataPagamento: paymentDate,
    descricao: description,
    destinatario: {
      tipo: "CHAVE",
      chave: key,
    },
  };
}

/**
 * Helper function to create a PIX payment with copy and paste code
 * @param value Payment amount
 * @param copyPasteCode PIX copy and paste code
 * @param description Payment description
 * @param paymentDate Optional payment date (YYYY-MM-DD)
 * @returns PIX payment object
 */
export function createPixCopyPastePayment(
  value: number,
  copyPasteCode: string,
  description: string,
  paymentDate?: string,
): PixCopyPastePayment {
  return {
    valor: value,
    dataPagamento: paymentDate,
    descricao: description,
    destinatario: {
      tipo: "PIX_COPIA_E_COLA",
      pixCopiaECola: copyPasteCode,
    },
  };
}

/**
 * Helper function to create a PIX payment with bank account details
 * @param value Payment amount
 * @param bankDetails Bank account details
 * @param description Payment description
 * @param paymentDate Optional payment date (YYYY-MM-DD)
 * @returns PIX payment object
 */
export function createPixBankAccountPayment(
  value: number,
  bankDetails: {
    name: string;
    accountNumber: string;
    accountType: "CONTA_CORRENTE" | "CONTA_POUPANCA";
    cpfCnpj: string;
    agency: string;
    ispb: string;
  },
  description: string,
  paymentDate?: string,
): PixBankAccountPayment {
  return {
    valor: value,
    dataPagamento: paymentDate,
    descricao: description,
    destinatario: {
      tipo: "DADOS_BANCARIOS",
      nome: bankDetails.name,
      contaCorrente: bankDetails.accountNumber,
      tipoConta: bankDetails.accountType,
      cpfCnpj: bankDetails.cpfCnpj,
      agencia: bankDetails.agency,
      instituicaoFinanceira: {
        ispb: bankDetails.ispb,
      },
    },
  };
}

type Boleto = typeof documents.$inferInsert;

export async function createBoletoBankAccountPayment(
  boleto: Boleto,
  token: string,
) {
  logger.info("Making Boleto payment");

  const { cert, key } = openCertificates();

  const httpsAgent = new https.Agent({
    cert,
    key,
    rejectUnauthorized: true, // Validate server certificate
  });

  const body = {
    codBarraLinhaDigitavel: boleto.payment_code,
    valorPagar: boleto.value,
    dataVencimento: boleto.expiration_date,
  };

  logger.info(`Trying to pay boleto: `, JSON.stringify(body));

  await axios.post<object>(`${BANCO_INTER_BASE_URL}${BOLETO_ENDPOINT}`, body, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    httpsAgent,
  });

  logger.info(`Boleto payment successful. Reference: ${boleto.id}`);
}
