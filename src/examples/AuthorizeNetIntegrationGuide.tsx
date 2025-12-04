/**
 * AUTHORIZE.NET PAYMENT INTEGRATION GUIDE FOR BOOKPACKAGE.TSX
 * 
 * This file demonstrates how to integrate Authorize.Net Accept.js payment
 * processing into the BookPackage component.
 */

import React, { useState, useEffect } from 'react';
import { loadAcceptJS, processCardPayment, validateCardNumber, formatCardNumber, getCardType } from '../services/PaymentService';
import { getAuthorizeNetPublicKey } from '../services/SettingsService';
import type { PaymentChargeResponse } from '../types/Payment.types';

/**
 * STEP 1: Add payment form state to BookPackage component
 * Add these state variables to your existing BookPackage component:
 */
const paymentFormState = {
  // Card details
  cardNumber: '',
  cardMonth: '',
  cardYear: '',
  cardCVV: '',
  
  // Payment processing
  isProcessingPayment: false,
  paymentError: '',
  
  // Authorize.Net credentials
  authorizeApiLoginId: '',
  authorizeEnvironment: 'sandbox' as 'sandbox' | 'production',
};

/**
 * STEP 2: Load Accept.js library on component mount
 * Add this to your useEffect hook:
 */
const loadAcceptJSExample = () => {
  useEffect(() => {
    const initializeAuthorizeNet = async () => {
      try {
        // Fetch public key from backend
        const locationId = 1; // Replace with actual location ID from your component state/props
        const response = await getAuthorizeNetPublicKey(locationId);
        if (response.success && response.data) {
          setAuthorizeApiLoginId(response.data.api_login_id);
        }
        
        // Load Accept.js library
        await loadAcceptJS(authorizeEnvironment);
        console.log('Accept.js loaded successfully');
      } catch (error) {
        console.error('Failed to initialize Authorize.Net:', error);
        setPaymentError('Failed to initialize payment system');
      }
    };
    
    initializeAuthorizeNet();
  }, []);
};

/**
 * STEP 3: Create payment form component
 * Add this payment form to your step 3 (Payment Method step):
 */
const PaymentFormExample = () => {
  const [cardNumber, setCardNumber] = useState('');
  const [cardMonth, setCardMonth] = useState('');
  const [cardYear, setCardYear] = useState('');
  const [cardCVV, setCardCVV] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCardNumber(e.target.value);
    if (formatted.replace(/\s/g, '').length <= 16) {
      setCardNumber(formatted);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-800 mb-4">Card Information</h3>
      
      {/* Card Number */}
      <div>
        <label className="block font-medium mb-2 text-gray-800 text-sm">Card Number</label>
        <input
          type="text"
          value={cardNumber}
          onChange={handleCardNumberChange}
          placeholder="1234 5678 9012 3456"
          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
          maxLength={19}
        />
        {cardNumber && (
          <p className="text-xs text-gray-500 mt-1">
            {getCardType(cardNumber)} • {validateCardNumber(cardNumber) ? '✓ Valid' : '✗ Invalid'}
          </p>
        )}
      </div>
      
      {/* Expiration Date */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block font-medium mb-2 text-gray-800 text-sm">Expiration Month</label>
          <select
            value={cardMonth}
            onChange={(e) => setCardMonth(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
          >
            <option value="">MM</option>
            {Array.from({ length: 12 }, (_, i) => {
              const month = (i + 1).toString().padStart(2, '0');
              return <option key={month} value={month}>{month}</option>;
            })}
          </select>
        </div>
        <div>
          <label className="block font-medium mb-2 text-gray-800 text-sm">Expiration Year</label>
          <select
            value={cardYear}
            onChange={(e) => setCardYear(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
          >
            <option value="">YYYY</option>
            {Array.from({ length: 10 }, (_, i) => {
              const year = (new Date().getFullYear() + i).toString();
              return <option key={year} value={year}>{year}</option>;
            })}
          </select>
        </div>
      </div>
      
      {/* CVV */}
      <div>
        <label className="block font-medium mb-2 text-gray-800 text-sm">Security Code (CVV)</label>
        <input
          type="text"
          value={cardCVV}
          onChange={(e) => {
            const value = e.target.value.replace(/\D/g, '');
            if (value.length <= 4) {
              setCardCVV(value);
            }
          }}
          placeholder="123"
          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
          maxLength={4}
        />
      </div>
      
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
          {error}
        </div>
      )}
    </div>
  );
};

/**
 * STEP 4: Update handlePayNow function to process payment
 * Replace the existing handlePayNow function with this:
 */
const handlePayNowWithAuthorizeNet = async () => {
  if (!pkg || !selectedRoomId) return;
  
  // Validate card information
  if (!cardNumber || !cardMonth || !cardYear || !cardCVV) {
    setPaymentError('Please fill in all card details');
    return;
  }
  
  if (!validateCardNumber(cardNumber)) {
    setPaymentError('Invalid card number');
    return;
  }
  
  setIsProcessingPayment(true);
  setPaymentError('');
  
  try {
    // Prepare card data for tokenization
    const cardData = {
      cardNumber: cardNumber.replace(/\s/g, ''),
      month: cardMonth,
      year: cardYear,
      cardCode: cardCVV,
    };
    
    // Calculate payment amount
    const amountToPay = paymentType === 'full' ? total : partialAmount;
    
    // Prepare payment data
    const paymentData = {
      location_id: pkg.location_id || 1,
      amount: amountToPay,
      order_id: `PKG-${pkg.id}-${Date.now()}`,
      description: `Package Booking: ${pkg.name}`,
      // customer_id and booking_id will be added after booking creation
    };
    
    // OPTION A: Process payment BEFORE creating booking
    console.log('💳 Processing payment...');
    const paymentResponse = await processCardPayment(
      cardData,
      paymentData,
      authorizeApiLoginId
    );
    
    if (!paymentResponse.success) {
      throw new Error(paymentResponse.message || 'Payment failed');
    }
    
    console.log('✅ Payment successful:', paymentResponse.transaction_id);
    
    // Now create the booking with payment info
    const bookingData = {
      guest_name: `${form.firstName} ${form.lastName}`,
      guest_email: form.email,
      guest_phone: form.phone,
      location_id: pkg.location_id || 1,
      package_id: pkg.id,
      room_id: selectedRoomId,
      type: 'package' as const,
      booking_date: selectedDate,
      booking_time: selectedTime,
      participants,
      duration: pkg.duration,
      duration_unit: pkg.duration_unit,
      total_amount: total,
      amount_paid: amountToPay,
      payment_method: 'credit' as const,
      payment_status: (paymentType === 'full' ? 'paid' : 'partial') as 'paid' | 'partial',
      status: 'confirmed' as const,
      transaction_id: paymentResponse.transaction_id, // Link payment to booking
      notes: form.notes || undefined,
    };
    
    // Create booking
    const bookingResponse = await bookingService.createBooking(bookingData);
    
    if (bookingResponse.success && bookingResponse.data) {
      const bookingId = bookingResponse.data.id;
      const referenceNumber = bookingResponse.data.reference_number;
      
      console.log('✅ Booking created:', { bookingId, referenceNumber });
      
      // Generate and store QR code
      const qrCodeBase64 = await QRCode.toDataURL(referenceNumber, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      
      await bookingService.storeQrCode(bookingId, qrCodeBase64);
      
      // Show success confirmation
      setConfirmationData({
        referenceNumber,
        qrCode: qrCodeBase64,
        bookingId
      });
      setShowConfirmation(true);
    }
    
  } catch (error: any) {
    console.error('❌ Payment/Booking error:', error);
    setPaymentError(error.message || 'Payment processing failed. Please try again.');
  } finally {
    setIsProcessingPayment(false);
  }
};

/**
 * STEP 5: Alternative approach - Create booking first, then charge
 * This approach creates the booking first, then processes payment
 */
const handlePayNowAlternativeApproach = async () => {
  if (!pkg || !selectedRoomId) return;
  
  setIsProcessingPayment(true);
  setPaymentError('');
  
  try {
    // Step 1: Create booking first
    const bookingData = {
      guest_name: `${form.firstName} ${form.lastName}`,
      guest_email: form.email,
      guest_phone: form.phone,
      location_id: pkg.location_id || 1,
      package_id: pkg.id,
      room_id: selectedRoomId,
      type: 'package' as const,
      booking_date: selectedDate,
      booking_time: selectedTime,
      participants,
      duration: pkg.duration,
      duration_unit: pkg.duration_unit,
      total_amount: total,
      amount_paid: 0, // Will update after payment
      payment_method: 'credit' as const,
      payment_status: 'pending' as const,
      status: 'pending' as const,
      notes: form.notes || undefined,
    };
    
    const bookingResponse = await bookingService.createBooking(bookingData);
    
    if (!bookingResponse.success || !bookingResponse.data) {
      throw new Error('Failed to create booking');
    }
    
    const bookingId = bookingResponse.data.id;
    
    // Step 2: Process payment with booking_id
    const amountToPay = paymentType === 'full' ? total : partialAmount;
    
    const cardData = {
      cardNumber: cardNumber.replace(/\s/g, ''),
      month: cardMonth,
      year: cardYear,
      cardCode: cardCVV,
    };
    
    const paymentData = {
      location_id: pkg.location_id || 1,
      amount: amountToPay,
      booking_id: bookingId,
      order_id: bookingResponse.data.reference_number,
      description: `Package Booking: ${pkg.name}`,
    };
    
    const paymentResponse = await processCardPayment(
      cardData,
      paymentData,
      authorizeApiLoginId
    );
    
    if (!paymentResponse.success) {
      // Payment failed - you might want to cancel/delete the booking here
      throw new Error(paymentResponse.message || 'Payment failed');
    }
    
    // Step 3: Update booking status after successful payment
    // You would need to create an update booking API endpoint for this
    
    // Show confirmation
    const qrCodeBase64 = await QRCode.toDataURL(bookingResponse.data.reference_number, {
      width: 300,
      margin: 2,
    });
    
    await bookingService.storeQrCode(bookingId, qrCodeBase64);
    
    setConfirmationData({
      referenceNumber: bookingResponse.data.reference_number,
      qrCode: qrCodeBase64,
      bookingId
    });
    setShowConfirmation(true);
    
  } catch (error: any) {
    console.error('❌ Error:', error);
    setPaymentError(error.message || 'Failed to process booking');
  } finally {
    setIsProcessingPayment(false);
  }
};

/**
 * STEP 6: Update the Pay Now button
 * Replace the existing Pay Now button with:
 */
const PayNowButtonExample = () => (
  <button 
    className={`py-3 px-8 rounded-lg font-medium transition shadow-sm flex items-center justify-center ${
      isProcessingPayment || !cardNumber || !cardMonth || !cardYear || !cardCVV
        ? 'bg-gray-300 text-gray-400 cursor-not-allowed' 
        : 'bg-blue-800 text-white hover:bg-blue-900'
    }`}
    onClick={handlePayNowWithAuthorizeNet}
    disabled={isProcessingPayment || !cardNumber || !cardMonth || !cardYear || !cardCVV}
  >
    {isProcessingPayment ? (
      <>
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
        Processing...
      </>
    ) : (
      <>
        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
        </svg>
        Pay ${paymentType === 'full' ? total.toFixed(2) : partialAmount.toFixed(2)}
      </>
    )}
  </button>
);

/**
 * SECURITY NOTES:
 * 
 * 1. NEVER send raw card data to your server
 *    - Accept.js tokenizes card data client-side
 *    - Only opaque token is sent to your backend
 * 
 * 2. PCI Compliance
 *    - Accept.js handles PCI compliance
 *    - Your server never touches raw card data
 * 
 * 3. Environment
 *    - Use 'sandbox' for testing
 *    - Switch to 'production' only when ready for live transactions
 * 
 * 4. API Keys
 *    - Only API Login ID (public key) is exposed to frontend
 *    - Transaction Key stays secure on backend
 * 
 * 5. Error Handling
 *    - Always handle payment failures gracefully
 *    - Consider implementing retry logic
 *    - Log errors for debugging but don't expose sensitive info to users
 */

export default {
  PaymentFormExample,
  handlePayNowWithAuthorizeNet,
  handlePayNowAlternativeApproach,
  PayNowButtonExample,
};
