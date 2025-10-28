import React, { useState, useEffect } from 'react';
import { 
  ShoppingCart, 
  CreditCard, 
  Wallet, 
  DollarSign,
  Plus,
  Minus,
  Search,
  X
} from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import type { CreatePurchaseAttraction, CreatePurchaseCustomerInfo } from '../../../types/CreatePurchase.types';

const CreatePurchase = () => {
  const { themeColor, fullColor } = useThemeColor();
  const [attractions, setAttractions] = useState<CreatePurchaseAttraction[]>([]);
  const [filteredAttractions, setFilteredAttractions] = useState<CreatePurchaseAttraction[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAttraction, setSelectedAttraction] = useState<CreatePurchaseAttraction | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [customerInfo, setCustomerInfo] = useState<CreatePurchaseCustomerInfo>({
    name: '',
    email: '',
    phone: ''
  });
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);

  // Load attractions from localStorage
  useEffect(() => {
    const loadAttractions = () => {
      try {
        const storedAttractions = localStorage.getItem('zapzone_attractions');
        if (storedAttractions) {
          const parsedAttractions = JSON.parse(storedAttractions);
          setAttractions(parsedAttractions);
          setFilteredAttractions(parsedAttractions);
        }
      } catch (error) {
        console.error('Error loading attractions:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAttractions();
  }, []);

  // Filter attractions based on search term
  useEffect(() => {
    if (searchTerm) {
      const filtered = attractions.filter(attraction =>
        attraction.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        attraction.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredAttractions(filtered);
    } else {
      setFilteredAttractions(attractions);
    }
  }, [searchTerm, attractions]);

  const handleCustomerInfoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCustomerInfo(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const calculateSubtotal = () => {
    if (!selectedAttraction) return 0;
    return selectedAttraction.price * quantity;
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    return Math.max(0, subtotal - discount);
  };

  const handleAddToCart = (attraction: CreatePurchaseAttraction) => {
    setSelectedAttraction(attraction);
    setQuantity(1);
    setDiscount(0);
  };

  const handleCompletePurchase = () => {
    if (!selectedAttraction) return;

    // Create purchase object
    const purchase = {
      id: `purchase_${Date.now()}`,
      type: 'attraction',
      attractionName: selectedAttraction.name,
      customerName: customerInfo.name || 'Walk-in Customer',
      email: customerInfo.email,
      phone: customerInfo.phone,
      quantity: quantity,
      status: 'confirmed',
      totalAmount: calculateTotal(),
      createdAt: new Date().toISOString(),
      paymentMethod: paymentMethod,
      duration: `${selectedAttraction.duration} ${selectedAttraction.durationUnit}`,
      activity: selectedAttraction.name,
      discount: discount,
      notes: notes
    };

    // Save to localStorage
    const existingPurchases = JSON.parse(localStorage.getItem('zapzone_purchases') || '[]');
    localStorage.setItem('zapzone_purchases', JSON.stringify([...existingPurchases, purchase]));

    // Show confirmation
    alert(`Purchase completed successfully! Total: $${calculateTotal().toFixed(2)}`);
    
    // Reset form
    setSelectedAttraction(null);
    setQuantity(1);
    setCustomerInfo({ name: '', email: '', phone: '' });
    setDiscount(0);
    setNotes('');
    setPaymentMethod('cash');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className={`animate-spin rounded-full h-12 w-12 border-b-2 border-${themeColor}-600`}></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Create New Purchase</h1>
          <p className="text-gray-600">Process on-site ticket purchases for customers</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Attraction Selection */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Select Attraction</h2>
              
              {/* Search */}
              <div className="relative mb-4">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search attractions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                />
              </div>

              {/* Attractions Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                {filteredAttractions.filter(a => a.status === 'active').map(attraction => (
                  <div
                    key={attraction.id}
                    className={`border rounded-lg p-4 cursor-pointer transition-colors flex gap-4 ${
                      selectedAttraction?.id === attraction.id
                        ? `border-${themeColor}-500 bg-${themeColor}-50`
                        : `border-gray-200 hover:border-${themeColor}-300`
                    }`}
                    onClick={() => handleAddToCart(attraction)}
                  >
                    {/* Attraction Image */}
                    <div className="w-20 h-20 flex-shrink-0 flex items-center justify-center bg-gray-100 rounded-md border border-gray-200 overflow-hidden">
                      {attraction.images && attraction.images.length > 0 ? (
                        <img src={attraction.images[0]} alt={attraction.name} className="object-cover w-full h-full" />
                      ) : (
                        <span className="text-gray-400 text-xs">No Image</span>
                      )}
                    </div>
                    <div className="flex-1 flex flex-col justify-between">
                      <h3 className="font-semibold text-gray-800">{attraction.name}</h3>
                      <p className="text-sm text-gray-600 mb-2">{attraction.category}</p>
                      <div className="flex justify-between items-center">
                        <span className={`text-lg font-bold text-${themeColor}-600`}>
                          ${attraction.price}
                          <span className="text-xs font-normal text-gray-500 ml-1">
                            {attraction.pricingType === 'per_person' ? '/person' : 
                             attraction.pricingType === 'per_group' ? '/group' : 
                             attraction.pricingType === 'per_hour' ? '/hour' : ''}
                          </span>
                        </span>
                        <span className="text-xs text-gray-500">
                          {attraction.duration} {attraction.durationUnit}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Customer Information */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Customer Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Customer Name 
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={customerInfo.name}
                    onChange={handleCustomerInfoChange}
                    className={`w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                    placeholder="Walk-in Customer"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email 
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={customerInfo.email}
                    onChange={handleCustomerInfoChange}
                    className={`w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                    placeholder="customer@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone (Optional)
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={customerInfo.phone}
                    onChange={handleCustomerInfoChange}
                    className={`w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Purchase Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-6 sticky top-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Purchase Summary</h2>
              
              {selectedAttraction ? (
                <>
                  {/* Selected Attraction */}
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-gray-800">{selectedAttraction.name}</h3>
                      <button
                        onClick={() => setSelectedAttraction(null)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    {/* Attraction Image */}
                    <div className="mb-3 w-full flex justify-center">
                      {selectedAttraction.images && selectedAttraction.images.length > 0 ? (
                        <img src={selectedAttraction.images[0]} alt={selectedAttraction.name} className="max-h-32 rounded-lg object-contain border border-gray-200" />
                      ) : (
                        <span className="text-gray-400 text-xs">No Image</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{selectedAttraction.category}</p>
                    {/* Quantity Selector */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Quantity</label>
                      <div className="flex items-center">
                        <button
                          onClick={() => setQuantity(Math.max(1, quantity - 1))}
                          className="w-8 h-8 rounded-lg bg-gray-100 text-gray-700 flex items-center justify-center hover:bg-gray-200"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="mx-3 font-semibold">{quantity}</span>
                        <button
                          onClick={() => setQuantity(quantity + 1)}
                          className="w-8 h-8 rounded-lg bg-gray-100 text-gray-700 flex items-center justify-center hover:bg-gray-200"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Discount */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Discount ($)</label>
                      <input
                        type="number"
                        min="0"
                        max={calculateSubtotal()}
                        value={discount}
                        onChange={(e) => setDiscount(Number(e.target.value))}
                        className={`w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                      />
                    </div>

                    {/* Notes */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={2}
                        className={`w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                        placeholder="Additional notes..."
                      />
                    </div>
                  </div>

                  {/* Payment Method */}
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-gray-700 mb-3">Payment Method</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setPaymentMethod('cash')}
                        className={`p-3 border rounded-lg text-center transition-colors ${
                          paymentMethod === 'cash'
                            ? `border-${themeColor}-500 bg-${themeColor}-50 text-${themeColor}-700`
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        <DollarSign className="h-5 w-5 mx-auto mb-1" />
                        <span className="text-sm">Cash</span>
                      </button>
                      <button
                        onClick={() => setPaymentMethod('e_wallet')}
                        className={`p-3 border rounded-lg text-center transition-colors ${
                          paymentMethod === 'e_wallet'
                            ? `border-${themeColor}-500 bg-${themeColor}-50 text-${themeColor}-700`
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        <Wallet className="h-5 w-5 mx-auto mb-1" />
                        <span className="text-sm">E-Wallet</span>
                      </button>
                      <button
                        onClick={() => setPaymentMethod('credit_card')}
                        className={`p-3 border rounded-lg text-center transition-colors ${
                          paymentMethod === 'credit_card'
                            ? `border-${themeColor}-500 bg-${themeColor}-50 text-${themeColor}-700`
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        <CreditCard className="h-5 w-5 mx-auto mb-1" />
                        <span className="text-sm">Card</span>
                      </button>
                    </div>
                  </div>

                  {/* Pricing Breakdown */}
                  <div className="border-t border-gray-200 pt-4 mb-6">
                    <div className="flex justify-between mb-2">
                      <span className="text-gray-600">Subtotal</span>
                      <span className="font-medium">${calculateSubtotal().toFixed(2)}</span>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between mb-2 text-red-600">
                        <span>Discount</span>
                        <span>-${discount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-lg mt-3 pt-3 border-t border-gray-200">
                      <span>Total</span>
                      <span>${calculateTotal().toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Complete Purchase Button */}
                  <button
                    onClick={handleCompletePurchase}
                    className={`w-full bg-${themeColor}-600 text-white py-3 rounded-lg font-semibold hover:bg-${themeColor}-700 transition-colors flex items-center justify-center`}
                  >
                    <ShoppingCart className="h-5 w-5 mr-2" />
                    Complete Purchase
                  </button>
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Select an attraction to begin</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreatePurchase;