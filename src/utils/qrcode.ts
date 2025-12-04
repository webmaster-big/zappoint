import QRCode from 'qrcode';

/**
 * Generate a QR code as a base64 data URL
 * @param data - The data to encode in the QR code
 * @param options - QR code generation options
 * @returns Promise<string> - Base64 data URL of the QR code image
 */
export const generateQRCode = async (
  data: string,
  options?: {
    width?: number;
    margin?: number;
    color?: {
      dark?: string;
      light?: string;
    };
  }
): Promise<string> => {
  try {
    const qrCodeDataURL = await QRCode.toDataURL(data, {
      width: options?.width || 300,
      margin: options?.margin || 2,
      color: {
        dark: options?.color?.dark || '#000000',
        light: options?.color?.light || '#FFFFFF',
      },
      errorCorrectionLevel: 'M',
    });
    
    return qrCodeDataURL;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error('Failed to generate QR code');
  }
};

/**
 * Generate purchase QR code data
 * @param purchaseId - The purchase ID
 * @param additionalData - Additional data to include in QR code
 * @returns QR code data string
 */
export const generatePurchaseQRData = (
  purchaseId: number | string,
): string => {
  const qrData = {
    type: 'attraction_purchase',
    id: purchaseId,
  };
  
  return JSON.stringify(qrData);
};

/**
 * Generate a QR code for a purchase
 * @param purchaseId - The purchase ID
 * @param purchaseData - Purchase data to include in QR code
 * @returns Promise<string> - Base64 data URL of the QR code
 */
export const generatePurchaseQRCode = async (
  purchaseId: number | string,
 
): Promise<string> => {
  const qrData = generatePurchaseQRData(purchaseId);
  return generateQRCode(qrData);
};
