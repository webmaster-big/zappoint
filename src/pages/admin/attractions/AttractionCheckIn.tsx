import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  Camera, 
  CheckCircle, 
  XCircle, 
  Upload,
  RefreshCw,
  User,
  Ticket,
  Calendar,
  DollarSign,
  AlertCircle,
  Smartphone,
  X,
  Clock
} from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { attractionPurchaseService, type AttractionPurchase } from '../../../services/AttractionPurchaseService';
import Toast from '../../../components/ui/Toast';
import { AppliedFeesDisplay } from '../../../components/AppliedFeesDisplay';
import { AppliedDiscountsDisplay } from '../../../components/AppliedDiscountsDisplay';
import StandardButton from '../../../components/ui/StandardButton';
import { getStoredUser } from '../../../utils/storage';
import { convertTo12Hour } from '../../../utils/timeFormat';

interface ScanResult {
  purchaseId: number;
  purchase: AttractionPurchase;
  success: boolean;
  message: string;
}

const AttractionCheckIn = () => {
  const { themeColor, fullColor } = useThemeColor();
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [verifiedPurchase, setVerifiedPurchase] = useState<AttractionPurchase | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerRef = useRef<HTMLDivElement>(null);

  const getAuthToken = () => {
    const userData = localStorage.getItem('zapzone_user');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        return user.token;
      } catch (error) {
        console.error('Error parsing user data:', error);
        return null;
      }
    }
    return null;
  };

  const startScanning = async () => {
    try {
      setError(null);
      setScanResult(null);
      setShowModal(false);
      
      if (scannerRef.current) {
        try {
          const state = await scannerRef.current.getState();
          if (state === 2) { // 2 = SCANNING state
            await scannerRef.current.stop();
          }
          await scannerRef.current.clear();
        } catch (err) {
          console.log('Scanner cleanup:', err);
        }
      }
      
      scannerRef.current = new Html5Qrcode('qr-reader');

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      };

      setScanning(true);

      await scannerRef.current.start(
        { facingMode: "environment" },
        config,
        onScanSuccess,
        onScanFailure
      );

    } catch (err) {
      console.error('Error starting scanner:', err);
      setError('Failed to start camera. Please check permissions and try again. Note: Mobile devices work better for scanning.');
      setToast({ message: 'Camera error - Try using a mobile device', type: 'error' });
      setScanning(false);
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current) {
      try {
        const state = await scannerRef.current.getState();
        if (state === 2) { // 2 = SCANNING state
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch (err) {
        console.log('Scanner already stopped or error:', err);
        try {
          if (scannerRef.current) {
            await scannerRef.current.clear();
          }
        } catch (clearErr) {
          console.log('Force clear error:', clearErr);
        }
      } finally {
        setScanning(false);
      }
    } else {
      setScanning(false);
    }
  };

  const onScanSuccess = async (decodedText: string) => {
    if (processing) return;

    setProcessing(true);
    
    try {
      await stopScanning();

      let purchaseId: number;
      
      try {
        const qrData = JSON.parse(decodedText);
        purchaseId = qrData.purchaseId || qrData.purchase_id || qrData.id;
      } catch {
        const idMatch = decodedText.match(/\d+/);
        if (idMatch) {
          purchaseId = parseInt(idMatch[0]);
        } else {
          throw new Error('Invalid QR code format');
        }
      }

      const authToken = getAuthToken();
      console.log('🔐 Auth Token:', authToken ? 'Present' : 'Missing');
      
      const verifyResponse = await attractionPurchaseService.verifyPurchase(purchaseId);
      
      if (!verifyResponse.success) {
        setToast({ message: 'Invalid ticket - Purchase not found', type: 'error' });
        setProcessing(false);
        await startScanning();
        return;
      }

      const purchase = verifyResponse.data;

      if (!purchase.scheduled_date || !purchase.scheduled_time) {
        try {
          const fullPurchaseResponse = await attractionPurchaseService.getPurchase(purchaseId);
          if (fullPurchaseResponse.success && fullPurchaseResponse.data) {
            const raw = fullPurchaseResponse.data;
            purchase.scheduled_date = raw.scheduled_date
              ? raw.scheduled_date.split('T')[0]
              : purchase.scheduled_date;
            purchase.scheduled_time = raw.scheduled_time ?? purchase.scheduled_time;
          }
        } catch (e) {
          console.warn('Could not fetch full purchase data for schedule fields:', e);
        }
      }

      if (purchase.status === 'checked-in') {
        setScanResult({
          purchaseId,
          purchase,
          success: false,
          message: 'This ticket has already been checked in'
        });
        setVerifiedPurchase(purchase);
        setShowModal(true);
        setToast({ message: 'Ticket already checked in', type: 'error' });
        return;
      }

      if (purchase.status === 'cancelled') {
        setScanResult({
          purchaseId,
          purchase,
          success: false,
          message: 'This ticket has been cancelled'
        });
        setVerifiedPurchase(purchase);
        setShowModal(true);
        setToast({ message: 'Ticket cancelled', type: 'error' });
        return;
      }

      if (purchase.status === 'refunded') {
        setScanResult({
          purchaseId,
          purchase,
          success: false,
          message: 'This ticket has been refunded'
        });
        setVerifiedPurchase(purchase);
        setShowModal(true);
        setToast({ message: 'Ticket refunded', type: 'error' });
        return;
      }

      if (purchase.status === 'pending') {
        setScanResult({
          purchaseId,
          purchase,
          success: false,
          message: 'This ticket has not been fully paid yet. Payment must be completed before check-in.'
        });
        setVerifiedPurchase(purchase);
        setShowModal(true);
        setToast({ message: 'Ticket not fully paid - cannot check in', type: 'error' });
        return;
      }

      setVerifiedPurchase(purchase);
      setShowModal(true);
      setToast({ message: 'Ticket verified - Please confirm check-in', type: 'info' });

    } catch (err) {
      console.error('Error processing scan:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to process QR code';
      setToast({ message: errorMessage, type: 'error' });
      await startScanning();
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirmCheckIn = async () => {
    if (!verifiedPurchase) return;

    try {
      setProcessing(true);
      const authToken = getAuthToken();
      console.log('🔐 Check-in Auth Token:', authToken ? 'Present' : 'Missing');
      
      const checkInResponse = await attractionPurchaseService.checkInPurchase(verifiedPurchase.id, getStoredUser()?.id);
      
      if (checkInResponse.success) {
        setScanResult({
          purchaseId: verifiedPurchase.id,
          purchase: checkInResponse.data,
          success: true,
          message: 'Check-in successful! Ticket marked as used.'
        });
        setToast({ message: 'Check-in successful!', type: 'success' });
        setShowModal(false);
        setVerifiedPurchase(null);
      } else {
        setToast({ message: 'Check-in failed. Please try again.', type: 'error' });
      }
    } catch (err) {
      console.error('Error checking in:', err);
      setToast({ message: 'Failed to check in ticket', type: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  const handleCancelCheckIn = () => {
    setShowModal(false);
    setVerifiedPurchase(null);
    startScanning();
  };

  const onScanFailure = () => {
  };

  const scanFromFile = async (file: File) => {
    try {
      setProcessing(true);
      setError(null);
      setScanResult(null);

      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode('qr-reader');
      }

      const result = await scannerRef.current.scanFile(file, false);
      await onScanSuccess(result);
      
    } catch (err) {
      console.error('Error scanning file:', err);
      setError('Failed to scan QR code from image. Please try another image.');
      setToast({ message: 'Failed to scan image', type: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      scanFromFile(file);
    }
  };

  const resetScan = () => {
    setScanResult(null);
    setError(null);
  };

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (scannerRef.current) {
        try {
          scannerRef.current.stop();
          scannerRef.current.clear();
        } catch (err) {
          console.log('Unload cleanup error:', err);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      const cleanup = async () => {
        if (scannerRef.current) {
          try {
            const state = await scannerRef.current.getState();
            if (state === 2) { // SCANNING state
              await scannerRef.current.stop();
            }
            await scannerRef.current.clear();
            scannerRef.current = null;
          } catch (err) {
            console.log('Cleanup:', err);
            try {
              if (scannerRef.current) {
                await scannerRef.current.clear();
                scannerRef.current = null;
              }
            } catch (clearErr) {
              console.log('Force clear error:', clearErr);
            }
          }
        }
      };
      
      cleanup();
    };
  }, []); // Empty dependency array - only cleanup on unmount

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Camera className="h-6 w-6" />
            Attraction Ticket Check-In
          </h1>
          <p className="text-gray-600 mt-1">Scan QR codes to check in customers and mark tickets as used</p>
          
          <div className="mt-3 flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <Smartphone className="h-5 w-5 text-blue-600 flex-shrink-0" />
            <p className="text-sm text-blue-800">
              <strong>Tip:</strong> For best scanning experience, use a mobile device or tablet with a rear camera
            </p>
          </div>
        </div>

        {scanResult && (
          <div className={`mb-6 rounded-xl overflow-hidden shadow-sm border flex items-center justify-between ${
            scanResult.success 
              ? 'border-green-200 bg-green-50' 
              : 'border-red-200 bg-red-50'
          }`}>
            <div className="flex items-center gap-3 px-4 py-3">
              {scanResult.success ? (
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
              )}
              <div>
                <span className={`font-semibold text-sm ${
                  scanResult.success ? 'text-green-800' : 'text-red-800'
                }`}>
                  {scanResult.success ? 'Check-In Successful!' : 'Check-In Failed'}
                </span>
                <span className="text-sm text-gray-600 ml-2">{scanResult.message}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 px-4 py-3">
              <StandardButton
                variant="primary"
                size="sm"
                icon={Camera}
                onClick={() => {
                  resetScan();
                  startScanning();
                }}
              >
                Scan Next
              </StandardButton>
              <StandardButton
                variant="ghost"
                size="sm"
                onClick={resetScan}
              >
                Reset
              </StandardButton>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="relative">
            <div 
              id="qr-reader" 
              ref={scannerContainerRef}
              className={`mx-auto rounded-lg overflow-hidden ${scanning ? 'block' : 'hidden'}`}
              style={{ maxWidth: '500px' }}
            ></div>

            {!scanning && !scanResult && (
              <div className="flex flex-col items-center justify-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <Camera className="h-16 w-16 text-gray-400 mb-4" />
                <p className="text-gray-600 mb-2">Ready to scan QR codes</p>
                <p className="text-sm text-gray-500 mb-6 flex items-center gap-1">
                  <Smartphone className="h-4 w-4" />
                  Works best on mobile devices
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4">
                  <StandardButton
                    variant="primary"
                    size="md"
                    onClick={startScanning}
                    disabled={processing}
                    icon={Camera}
                  >
                    Start Camera
                  </StandardButton>

                  <StandardButton
                    variant="secondary"
                    size="md"
                    onClick={() => document.getElementById('attraction-qr-file-upload')?.click()}
                    disabled={processing}
                    icon={Upload}
                  >
                    Upload Image
                  </StandardButton>
                  <input
                    id="attraction-qr-file-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={processing}
                  />
                </div>
              </div>
            )}

            {processing && (
              <div className="flex flex-col items-center justify-center py-12">
                <RefreshCw className={`h-12 w-12 text-${themeColor}-600 animate-spin mb-4`} />
                <p className="text-gray-600">Processing QR code...</p>
              </div>
            )}
          </div>

          {scanning && !processing && (
            <div className="mt-4 flex justify-center">
              <StandardButton
                variant="danger"
                size="md"
                onClick={stopScanning}
              >
                Stop Camera
              </StandardButton>
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">Error</p>
                <p className="text-sm text-red-600">{error}</p>
              </div>
            </div>
          )}
        </div>

        {showModal && verifiedPurchase && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-backdrop-fade">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800">Verify Ticket Details</h2>
                <StandardButton
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelCheckIn}
                  icon={X}
                >
                  {''}
                </StandardButton>
              </div>

              <div className="p-6">
                {(verifiedPurchase.scheduled_time || verifiedPurchase.scheduled_date) && (
                  <div className="mb-4 p-4 bg-blue-50 border-2 border-blue-300 rounded-xl text-center">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <Clock className="h-6 w-6 text-blue-600" />
                      <span className="text-lg font-bold text-blue-800">
                        Scheduled for {verifiedPurchase.scheduled_time ? convertTo12Hour(verifiedPurchase.scheduled_time) : 'No time set'}
                      </span>
                    </div>
                    {verifiedPurchase.scheduled_date && (
                      <p className="text-sm text-blue-600">
                        {new Date(verifiedPurchase.scheduled_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                      </p>
                    )}
                    {verifiedPurchase.status === 'confirmed' && (
                      <p className="text-sm text-blue-700 mt-2 font-medium">Would you like to check this person in now?</p>
                    )}
                  </div>
                )}

                {verifiedPurchase.status === 'checked-in' && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                    <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-red-800">Already Checked In</p>
                      <p className="text-sm text-red-600">This ticket has already been checked in and cannot be used again.</p>
                    </div>
                  </div>
                )}

                {verifiedPurchase.status === 'cancelled' && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                    <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-red-800">Ticket Cancelled</p>
                      <p className="text-sm text-red-600">This ticket has been cancelled and cannot be used.</p>
                    </div>
                  </div>
                )}

                {verifiedPurchase.status === 'refunded' && (
                  <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg flex items-start gap-3">
                    <XCircle className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-purple-800">Ticket Refunded</p>
                      <p className="text-sm text-purple-600">This ticket has been refunded and cannot be used.</p>
                    </div>
                  </div>
                )}

                {verifiedPurchase.status === 'pending' && (
                  <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
                    <Clock className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-yellow-800">Payment Incomplete</p>
                      <p className="text-sm text-yellow-600">Paid: ${Number(verifiedPurchase.total_amount && verifiedPurchase.total_amount).toFixed(2)} outstanding. Cannot check in until fully paid.</p>
                    </div>
                  </div>
                )}

                {verifiedPurchase.status === 'confirmed' && (
                  <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-blue-800">Valid Ticket - Ready for Check-In</p>
                      <p className="text-sm text-blue-600">This ticket is paid in full and ready to be checked in.</p>
                    </div>
                  </div>
                )}

                <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-semibold text-gray-800 mb-4">Ticket Information</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                        <Ticket className={`h-5 w-5 text-${fullColor}`} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Purchase ID</p>
                        <p className="font-medium text-gray-800">#{verifiedPurchase.id}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                        <User className={`h-5 w-5 text-${fullColor}`} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Customer</p>
                        <p className="font-medium text-gray-800">
                          {verifiedPurchase.guest_name || 
                           (verifiedPurchase.customer ? 
                            `${verifiedPurchase.customer.first_name} ${verifiedPurchase.customer.last_name}` : 
                            'Walk-in Customer')}
                        </p>
                      </div>
                    </div>

                    {verifiedPurchase.attraction && (
                      <div className="flex items-center gap-3 col-span-full">
                        <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                          <Ticket className={`h-5 w-5 text-${fullColor}`} />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Attraction</p>
                          <p className="font-medium text-gray-800 text-lg">{verifiedPurchase.attraction.name}</p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                        <Calendar className={`h-5 w-5 text-${fullColor}`} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Purchase Date</p>
                        <p className="font-medium text-gray-800">
                          {new Date(verifiedPurchase.purchase_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                        <Calendar className={`h-5 w-5 text-${fullColor}`} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Schedule</p>
                        <p className="font-medium text-gray-800">
                          {verifiedPurchase.scheduled_date
                            ? new Date(verifiedPurchase.scheduled_date + 'T00:00:00').toLocaleDateString()
                            : '—'}
                          {verifiedPurchase.scheduled_time ? ` at ${convertTo12Hour(verifiedPurchase.scheduled_time)}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                        <Ticket className={`h-5 w-5 text-${fullColor}`} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Quantity</p>
                        <p className="font-medium text-gray-800">{verifiedPurchase.quantity} {verifiedPurchase.quantity > 1 ? 'tickets' : 'ticket'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                        <DollarSign className={`h-5 w-5 text-${fullColor}`} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Total Amount</p>
                        <p className="font-medium text-gray-800">${Number(verifiedPurchase.total_amount).toFixed(2)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        verifiedPurchase.status === 'checked-in' 
                          ? 'bg-green-100' 
                          : verifiedPurchase.status === 'confirmed'
                          ? 'bg-blue-100'
                          : verifiedPurchase.status === 'cancelled'
                          ? 'bg-red-100'
                          : verifiedPurchase.status === 'refunded'
                          ? 'bg-purple-100'
                          : 'bg-yellow-100'
                      }`}>
                        <CheckCircle className={`h-5 w-5 ${
                          verifiedPurchase.status === 'checked-in' 
                            ? 'text-green-600' 
                            : verifiedPurchase.status === 'confirmed'
                            ? 'text-blue-600'
                            : verifiedPurchase.status === 'cancelled'
                            ? 'text-red-600'
                            : verifiedPurchase.status === 'refunded'
                            ? 'text-purple-600'
                            : 'text-yellow-600'
                        }`} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Status</p>
                        <p className={`font-semibold ${
                          verifiedPurchase.status === 'checked-in' 
                            ? 'text-green-600' 
                            : verifiedPurchase.status === 'confirmed'
                            ? 'text-blue-600'
                            : verifiedPurchase.status === 'cancelled'
                            ? 'text-red-600'
                            : verifiedPurchase.status === 'refunded'
                            ? 'text-purple-600'
                            : 'text-yellow-600'
                        }`}>
                          {verifiedPurchase.status === 'checked-in' ? 'Checked In' : verifiedPurchase.status.charAt(0).toUpperCase() + verifiedPurchase.status.slice(1)}
                        </p>
                      </div>
                    </div>

                    {verifiedPurchase.guest_email && (
                      <div className="flex items-center gap-3 col-span-full">
                        <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                          <User className={`h-5 w-5 text-${fullColor}`} />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Email</p>
                          <p className="font-medium text-gray-800">{verifiedPurchase.guest_email}</p>
                        </div>
                      </div>
                    )}

                    {verifiedPurchase.notes && (
                      <div className="flex items-start gap-3 col-span-full">
                        <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                          <AlertCircle className={`h-5 w-5 text-${fullColor}`} />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Notes</p>
                          <p className="font-medium text-gray-800">{verifiedPurchase.notes}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {verifiedPurchase.applied_fees && verifiedPurchase.applied_fees.length > 0 && (
                    <div>
                      <AppliedFeesDisplay appliedFees={verifiedPurchase.applied_fees} />
                    </div>
                  )}

                  {(verifiedPurchase as any).applied_discounts && (verifiedPurchase as any).applied_discounts.length > 0 && (
                    <div>
                      <AppliedDiscountsDisplay appliedDiscounts={(verifiedPurchase as any).applied_discounts} />
                    </div>
                  )}
                </div>
              </div>

              <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-6 flex gap-4">
                {verifiedPurchase.status === 'confirmed' ? (
                  <>
                    <StandardButton
                      variant="danger"
                      size="md"
                      icon={XCircle}
                      onClick={handleCancelCheckIn}
                      fullWidth
                    >
                      Deny
                    </StandardButton>
                    
                    <StandardButton
                      variant="success"
                      size="md"
                      onClick={handleConfirmCheckIn}
                      disabled={processing}
                      loading={processing}
                      icon={CheckCircle}
                      fullWidth
                    >
                      {processing ? 'Approving...' : 'Approve'}
                    </StandardButton>
                  </>
                ) : (
                  <StandardButton
                    variant="secondary"
                    size="md"
                    onClick={handleCancelCheckIn}
                    fullWidth
                  >
                    Close & Scan Next
                  </StandardButton>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
          <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            How to Use
          </h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li className="flex items-start gap-2">
              <span className="font-bold">1.</span>
              <span>Click "Start Camera" to begin scanning or upload a QR code image from your device</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold">2.</span>
              <span><strong>Mobile recommended:</strong> Point your phone/tablet camera at the customer's QR code ticket</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold">3.</span>
              <span>Review the ticket details in the popup modal and verify customer information</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold">4.</span>
              <span>Click "Confirm Check-In" to mark the ticket as used, or "Cancel" to scan again</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold">5.</span>
              <span>Each ticket can only be used once - already used tickets will be rejected automatically</span>
            </li>
          </ul>
        </div>
      </div>

      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-fade-in-up">
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        </div>
      )}
    </div>
  );
};

export default AttractionCheckIn;
