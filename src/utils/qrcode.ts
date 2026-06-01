import QRCode from 'qrcode';

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

export const generatePurchaseQRData = (
  purchaseId: number | string,
): string => {
  const qrData = {
    type: 'attraction_purchase',
    id: purchaseId,
  };
  
  return JSON.stringify(qrData);
};

export const generatePurchaseQRCode = async (
  purchaseId: number | string,
 
): Promise<string> => {
  const qrData = generatePurchaseQRData(purchaseId);
  return generateQRCode(qrData);
};
