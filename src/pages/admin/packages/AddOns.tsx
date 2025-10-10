import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Utensils } from 'lucide-react';

interface Addon {
  id: string;
  name: string;
  price: number;
  image: string;
}

const ManageAddons = () => {
  const [addons, setAddons] = useState<Addon[]>([]);
  const [filteredAddons, setFilteredAddons] = useState<Addon[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(6);
  const [showModal, setShowModal] = useState(false);
  const [editingAddon, setEditingAddon] = useState<Addon | null>(null);
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
        const sampleAddons: Addon[] = [
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

    const newAddon: Addon = {
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

  const handleEdit = (addon: Addon) => {
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
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Manage Add-ons</h1>
            <p className="text-gray-600 mt-2">Food and beverage items for your attractions</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 sm:mt-0 inline-flex items-center px-4 py-2 bg-blue-800 text-white rounded-lg hover:bg-blue-800 transition-colors"
          >
            <Plus className="h-5 w-5 mr-2" />
            Add New Add-on
          </button>
        </div>

        {/* Search */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="relative max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search add-ons..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Add-ons Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {currentAddons.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <Utensils className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No add-ons found</h3>
              <p className="text-gray-500">Get started by creating your first food add-on</p>
            </div>
          ) : (
            currentAddons.map((addon) => (
              <div key={addon.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
                <div className="h-40 bg-gray-200 relative">
                  {addon.image ? (
                    <img
                      src={addon.image}
                      alt={addon.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-100">
                      <Utensils className="h-12 w-12 text-gray-400" />
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-800 text-lg mb-2">{addon.name}</h3>
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold text-blue-800">
                      ${addon.price.toFixed(2)}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(addon)}
                        className="p-1 text-gray-600 hover:tex8-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(addon.id)}
                        className="p-1 text-red-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
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
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => paginate(page)}
                    className={`px-3 py-2 border rounded-lg text-sm font-medium ${
                      currentPage === page
                        ? 'border-blue-800 bg-blue-800 text-white'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                
                <button
                  onClick={() => paginate(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-md w-full p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">
                {editingAddon ? 'Edit Add-on' : 'Add New Add-on'}
              </h2>
              
              <form onSubmit={handleSubmit}>
                {/* Image Upload */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Add-on Image
                  </label>
                  <div className="flex items-center justify-center w-full">
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                      {formData.image ? (
                        <img
                          src={formData.image}
                          alt="Preview"
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <Utensils className="h-8 w-8 text-gray-400 mb-2" />
                          <p className="text-sm text-gray-500">Click to upload image</p>
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
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Add-on Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Cheese Pizza, French Fries"
                    required
                  />
                </div>

                {/* Price Input */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Price *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500">$</span>
                    </div>
                    <input
                      type="number"
                      name="price"
                      min="0"
                      step="0.01"
                      value={formData.price}
                      onChange={handleInputChange}
                      className="w-full pl-8 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleModalClose}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-800 text-white rounded-lg hover:bg-blue-800 transition-colors"
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