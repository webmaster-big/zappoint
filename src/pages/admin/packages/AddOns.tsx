import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Utensils } from 'lucide-react';
import type { AddOnsAddon } from '../../../types/addOns.types';

const ManageAddons = () => {
  const [addons, setAddons] = useState<AddOnsAddon[]>([]);
  const [filteredAddons, setFilteredAddons] = useState<AddOnsAddon[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(6);
  const [showModal, setShowModal] = useState(false);
  const [editingAddon, setEditingAddon] = useState<AddOnsAddon | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    image: ''
  });

  // Load addons from localStorage
  useEffect(() => {
    loadAddons();
  }, []);

  // Filter addons based on search
  useEffect(() => {
    if (searchTerm) {
      const filtered = addons.filter(addon =>
        addon.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredAddons(filtered);
    } else {
      setFilteredAddons(addons);
    }
    setCurrentPage(1);
  }, [searchTerm, addons]);

  const loadAddons = () => {
    try {
      const storedAddons = localStorage.getItem('zapzone_addons');
      if (storedAddons) {
        const parsedAddons = JSON.parse(storedAddons);
        setAddons(parsedAddons);
      } else {
        // Sample food addons
        const sampleAddons: AddOnsAddon[] = [
          {
            id: '1',
            name: 'Cheese Pizza Slice',
            price: 3.99,
            image: '/api/placeholder/200/200'
          },
          {
            id: '2',
            name: 'Classic Burger',
            price: 5.99,
            image: '/api/placeholder/200/200'
          },
          {
            id: '3',
            name: 'French Fries',
            price: 2.99,
            image: '/api/placeholder/200/200'
          },
          {
            id: '4',
            name: 'Chicken Wings',
            price: 7.99,
            image: '/api/placeholder/200/200'
          },
          {
            id: '5',
            name: 'Soft Drink',
            price: 1.99,
            image: '/api/placeholder/200/200'
          },
          {
            id: '6',
            name: 'Chocolate Shake',
            price: 4.49,
            image: '/api/placeholder/200/200'
          }
        ];
        setAddons(sampleAddons);
        localStorage.setItem('zapzone_addons', JSON.stringify(sampleAddons));
      }
    } catch (error) {
      console.error('Error loading addons:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          image: reader.result as string
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.price) {
      alert('Please fill in all required fields');
      return;
    }

    const newAddon: AddOnsAddon = {
      id: editingAddon ? editingAddon.id : `addon_${Date.now()}`,
      name: formData.name,
      price: parseFloat(formData.price),
      image: formData.image || '/api/placeholder/200/200'
    };

    let updatedAddons;
    if (editingAddon) {
      updatedAddons = addons.map(addon => 
        addon.id === editingAddon.id ? newAddon : addon
      );
    } else {
      updatedAddons = [...addons, newAddon];
    }

    setAddons(updatedAddons);
    localStorage.setItem('zapzone_addons', JSON.stringify(updatedAddons));
    
    resetForm();
    setShowModal(false);
  };

  const handleEdit = (addon: AddOnsAddon) => {
    setEditingAddon(addon);
    setFormData({
      name: addon.name,
      price: addon.price.toString(),
      image: addon.image
    });
    setShowModal(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this add-on?')) {
      const updatedAddons = addons.filter(addon => addon.id !== id);
      setAddons(updatedAddons);
      localStorage.setItem('zapzone_addons', JSON.stringify(updatedAddons));
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      price: '',
      image: ''
    });
    setEditingAddon(null);
  };

  const handleModalClose = () => {
    setShowModal(false);
    resetForm();
  };

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentAddons = filteredAddons.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredAddons.length / itemsPerPage);

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  return (
    <div className="w-full mx-auto px-4 pb-6 flex flex-col items-center">
      <div className="bg-white rounded-xl p-6 w-full shadow-sm border border-gray-100 mt-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Manage Add-ons</h2>
            <p className="text-gray-500 mt-1">Food, beverage and other items for your attractions</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-800 hover:bg-blue-800 text-white px-6 py-2 rounded-lg font-semibold whitespace-nowrap inline-flex items-center gap-2"
          >
            <Plus className="h-5 w-5" />
            Add New Add-on
          </button>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search add-ons by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          {/* Results count */}
          <div className="text-sm text-gray-500 mt-2">
            Showing {filteredAddons.length} add-on{filteredAddons.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Add-ons Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
          {currentAddons.length === 0 ? (
            <div className="col-span-full text-center py-12 border border-dashed border-gray-300 rounded-xl">
              <Utensils className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No add-ons found</h3>
              <p className="text-gray-500 mb-4">
                {searchTerm ? `No add-ons match "${searchTerm}"` : 'Get started by creating your first add-on'}
              </p>
              {searchTerm && (
                <button
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-2 rounded-lg font-semibold mr-2"
                  onClick={() => setSearchTerm("")}
                >
                  Clear Search
                </button>
              )}
              <button
                onClick={() => setShowModal(true)}
                className="bg-blue-700 hover:bg-blue-800 text-white px-6 py-2 rounded-lg font-semibold"
              >
                Create Add-on
              </button>
            </div>
          ) : (
            currentAddons.map((addon) => (
              <div key={addon.id} className="border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
                <div className="h-40 bg-gray-100 relative">
                  {addon.image ? (
                    <img
                      src={addon.image}
                      alt={addon.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-50">
                      <Utensils className="h-12 w-12 text-gray-300" />
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 text-base mb-3">{addon.name}</h3>
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-blue-800">
                      ${addon.price.toFixed(2)}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(addon)}
                        className="p-2 text-gray-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit add-on"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(addon.id)}
                        className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete add-on"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-100">
            <div className="text-sm text-gray-700">
              Showing <span className="font-medium">{indexOfFirstItem + 1}</span> to{' '}
              <span className="font-medium">
                {Math.min(indexOfLastItem, filteredAddons.length)}
              </span>{' '}
              of <span className="font-medium">{filteredAddons.length}</span> results
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => paginate(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => paginate(page)}
                  className={`px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
                    currentPage === page
                      ? 'border-blue-700 bg-blue-700 text-white'
                      : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {page}
                </button>
              ))}
              
              <button
                onClick={() => paginate(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Add/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">
                {editingAddon ? 'Edit Add-on' : 'Add New Add-on'}
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Image Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Add-on Image
                  </label>
                  <div className="flex items-center justify-center w-full">
                    <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-gray-200 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                      {formData.image ? (
                        <div className="relative w-full h-full">
                          <img
                            src={formData.image}
                            alt="Preview"
                            className="w-full h-full object-cover rounded-lg"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                            <span className="text-white text-sm font-medium">Click to change</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-6">
                          <Utensils className="h-10 w-10 text-gray-400 mb-2" />
                          <p className="text-sm text-gray-600 font-medium">Click to upload image</p>
                          <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 5MB</p>
                        </div>
                      )}
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleImageUpload}
                      />
                    </label>
                  </div>
                </div>

                {/* Name Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Add-on Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="e.g., Cheese Pizza, French Fries"
                    required
                  />
                </div>

                {/* Price Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Price <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <span className="text-gray-500 font-medium">$</span>
                    </div>
                    <input
                      type="number"
                      name="price"
                      min="0"
                      step="0.01"
                      value={formData.price}
                      onChange={handleInputChange}
                      className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleModalClose}
                    className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2.5 bg-blue-800 text-white rounded-lg hover:bg-blue-800 transition-colors font-medium"
                  >
                    {editingAddon ? 'Update Add-on' : 'Create Add-on'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageAddons;