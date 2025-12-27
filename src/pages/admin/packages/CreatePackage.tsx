import React, { useState, useEffect } from "react";
import Toast from "../../../components/ui/Toast";
import StandardButton from "../../../components/ui/StandardButton";
import LocationSelector from '../../../components/admin/LocationSelector';
import { Info, Plus, RefreshCcw, Calendar, Clock, Gift, Tag, Home, Trash2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useThemeColor } from '../../../hooks/useThemeColor';
import { 
    attractionService, 
    addOnService, 
    roomService, 
    promoService, 
    giftCardService,
    packageService,
    locationService,
    categoryService
} from '../../../services';
import type { Category } from '../../../services/CategoryService';
import type { AvailabilitySchedule } from '../../../services/PackageService';
import { formatTimeRange } from '../../../utils/timeFormat';
import type { 
    CreatePackageAttraction, 
    CreatePackageAddOn, 
    CreatePackageRoom,
    CreatePackagePromo,
    CreatePackageGiftCard
} from '../../../types/createPackage.types';
import { getStoredUser } from "../../../utils/storage";

const CreatePackage: React.FC = () => {
    const navigate = useNavigate();
    const { themeColor, fullColor } = useThemeColor();
    
    // State for fetched data
    const [attractions, setAttractions] = useState<CreatePackageAttraction[]>([]); // must include id
    const [addOns, setAddOns] = useState<CreatePackageAddOn[]>([]); // must include id
    const [categories, setCategories] = useState<Category[]>([]); // Fetch from API
    const [rooms, setRooms] = useState<CreatePackageRoom[]>([]); // must include id
    const [promos, setPromos] = useState<CreatePackagePromo[]>([]); // must include id
    const [giftCards, setGiftCards] = useState<CreatePackageGiftCard[]>([]); // must include id
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    
    const currentUser = getStoredUser();
    const isCompanyAdmin = currentUser?.role === 'company_admin';
    const [locations, setLocations] = useState<Array<{ id: number; name: string; address?: string; city?: string; state?: string }>>([]);
    const [selectedLocation, setSelectedLocation] = useState<number | null>(null);

    // Fetch locations for company admin
    useEffect(() => {
        if (isCompanyAdmin) {
            const fetchLocations = async () => {
                try {
                    const response = await locationService.getLocations();
                    if (response.success && response.data) {
                        setLocations(Array.isArray(response.data) ? response.data : []);
                    }
                } catch (error) {
                    console.error('Error fetching locations:', error);
                }
            };
            fetchLocations();
        }
    }, [isCompanyAdmin]);

    // Fetch data from database on component mount
    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                
                // Fetch all data in parallel
                const params: { user_id: any; location_id?: number } = {user_id: getStoredUser()?.id};
                if (selectedLocation !== null && selectedLocation !== undefined) {
                    params.location_id = selectedLocation;
                }
                const [attractionsRes, addOnsRes, roomsRes, promosRes, giftCardsRes, categoriesRes] = await Promise.all([
                    attractionService.getAttractions(params),
                    addOnService.getAddOns(params),
                    roomService.getRooms(params),
                    promoService.getPromos(),
                    giftCardService.getGiftCards(),
                    categoryService.getCategories()
                ]);

                // Transform data to match component types (include id)
                const attractionsData = attractionsRes.data?.attractions?.map(attr => ({
                    id: attr.id,
                    name: attr.name,
                    price: attr.price || 0,
                    unit: attr.unit || ''
                })) || [];

                const addOnsData = addOnsRes.data?.add_ons?.map(addon => ({
                    id: addon.id,
                    name: addon.name,
                    price: addon.price || 0
                })) || [];

                const roomsData = roomsRes.data?.rooms?.map(room => ({
                    id: room.id,
                    name: room.name,
                    area_group: room.area_group || undefined
                })) || [];

                const promosData = promosRes.data?.promos?.filter(promo => 
                    promo.status === "active" && !promo.deleted
                ).map(promo => ({
                    id: promo.id,
                    name: promo.name,
                    code: promo.code,
                    description: promo.description || ''
                })) || [];

                const giftCardsData = giftCardsRes.data?.gift_cards?.filter(gc => 
                    gc.status === "active" && !gc.deleted
                ).map(gc => ({
                    id: gc.id,
                    name: gc.code, // Use code as display name
                    code: gc.code,
                    description: gc.description || ''
                })) || [];

                const categoriesData = categoriesRes.data || [];

                setAttractions(attractionsData);
                setAddOns(addOnsData);
                setRooms(roomsData);
                setPromos(promosData);
                setGiftCards(giftCardsData);
                setCategories(categoriesData);
            } catch (error) {
                console.error('Error fetching data:', error);
                showToast('Error loading data from server', 'error');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [selectedLocation]);

    // Form state
    const [form, setForm] = useState({
        name: "",
        description: "",
        category: "",
        packageType: "regular", // 'regular', 'holiday', 'special', 'seasonal'
        features: [""] as string[],
        attractions: [] as string[],
        rooms: [] as string[],
        price: "",
        minParticipants: "",
        maxParticipants: "",
        pricePerAdditional: "",
        duration: "",
        durationUnit: "hours" as "hours" | "minutes",
        promos: [] as string[], // will store promo.code
        giftCards: [] as string[], // will store giftCard.code
        addOns: [] as string[],
        image: "" as string, // base64 or data url
        partialPaymentPercentage: "0", // Percentage for partial payments
        partialPaymentFixed: "0", // Fixed amount for partial payments
        hasGuestOfHonor: false,
        
        // NEW: Replace old availability fields with schedules array
        availability_schedules: [] as AvailabilitySchedule[],
    });


    // Image preview state
    const [imagePreview, setImagePreview] = useState<string>("");
    // Handle image upload
    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setForm(prev => ({ ...prev, image: reader.result as string }));
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    // Toast state
    const [toast, setToast] = useState<{ message: string; type?: "success" | "error" | "info" } | null>(null);
    const showToast = (message: string, type?: "success" | "error" | "info") => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 2200);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    // Handle feature input change
    const handleFeatureChange = (index: number, value: string) => {
        setForm((prev) => {
            const newFeatures = [...prev.features];
            newFeatures[index] = value;
            return { ...prev, features: newFeatures };
        });
    };

    // Add new feature input
    const handleAddFeature = () => {
        setForm((prev) => ({
            ...prev,
            features: [...prev.features, ""]
        }));
    };

    // Remove feature input
    const handleRemoveFeature = (index: number) => {
        setForm((prev) => ({
            ...prev,
            features: prev.features.filter((_, i) => i !== index)
        }));
    };

    // Multi-select for promos and gift cards
    const handleMultiSelectCheckbox = (name: 'promos' | 'giftCards', value: string) => {
        setForm((prev) => {
            const arr = prev[name] as string[];
            if (arr.includes(value)) {
                return { ...prev, [name]: arr.filter((v) => v !== value) };
            } else {
                return { ...prev, [name]: [...arr, value] };
            }
        });
    };

    const handleMultiSelect = (name: string, value: string) => {
        setForm((prev) => {
            const arr = prev[name as keyof typeof prev] as string[];
            if (arr.includes(value)) {
                return { ...prev, [name]: arr.filter((v) => v !== value) };
            } else {
                return { ...prev, [name]: [...arr, value] };
            }
        });
    };

    // Add new availability schedule
    const addNewSchedule = () => {
        setForm(prev => ({
            ...prev,
            availability_schedules: [
                ...prev.availability_schedules,
                {
                    availability_type: 'daily',
                    day_configuration: null,
                    time_slot_start: '09:00',
                    time_slot_end: '17:00',
                    time_slot_interval: 30,
                    is_active: true,
                }
            ]
        }));
    };

    // Update a specific schedule
    const updateSchedule = (index: number, updates: Partial<AvailabilitySchedule>) => {
        setForm(prev => ({
            ...prev,
            availability_schedules: prev.availability_schedules.map((schedule, i) =>
                i === index ? { ...schedule, ...updates } : schedule
            )
        }));
    };

    // Remove a schedule
    const removeSchedule = (index: number) => {
        setForm(prev => ({
            ...prev,
            availability_schedules: prev.availability_schedules.filter((_, i) => i !== index)
        }));
    };

    // Select all days for weekly schedule
    const selectAllWeekDays = (index: number) => {
        const allDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        const schedule = form.availability_schedules[index];
        const current = schedule.day_configuration || [];
        const allSelected = allDays.every(day => current.includes(day));
        updateSchedule(index, { day_configuration: allSelected ? [] : allDays });
    };

    // Add option with API calls instead of localStorage
    const handleAddOption = async (type: string, value: string, code?: string, extra?: string) => {
        if (!value.trim() || ((type === 'promo' || type === 'giftcard') && !code?.trim())) return;
        
        try {
            switch(type) {
                case 'addon':
                    if (!addOns.some(a => a.name === value)) {
                        const priceValue = parseFloat(extra || '0');
                        
                        if (isNaN(priceValue) || priceValue < 0) {
                            showToast("Please enter a valid price for the add-on", "error");
                            return;
                        }
                        
                        const price = Number(priceValue.toFixed(2)); // Ensure 2 decimal places
                        
                        await addOnService.createAddOn({
                            location_id: 1, // Default location
                            name: value,
                            price,
                            description: '',
                            is_active: true
                        });
                        const tempId = Date.now();
                        const updated = [...addOns, { id: tempId, name: value, price }];
                        setAddOns(updated);
                        showToast("Add-on added!", "success");
                    }
                    break;
                case 'category':
                    if (!categories.some(c => c.name === value)) {
                        const response = await categoryService.createCategory({ name: value });
                        if (response.success && response.data) {
                            setCategories(prev => [...prev, response.data]);
                            showToast("Category added successfully!", "success");
                        }
                    }
                    break;
                case 'room':
                    if (!rooms.some(r => r.name === value)) {
                        await roomService.createRoom({
                            location_id: 1, // Default location
                            name: value,
                            capacity: 20,
                            is_available: true
                        });
                        const tempId = Date.now();
                        const updated = [...rooms, { id: tempId, name: value }];
                        setRooms(updated);
                        showToast("Space added!", "success");
                    }
                    break;
                case 'promo':
                    if (!promos.some(p => p.name === value)) {
                        const description = extra || '';
                        await promoService.createPromo({
                            name: value,
                            code: code || '',
                            description,
                            type: 'fixed' as const,
                            value: 0,
                            start_date: new Date().toISOString().split('T')[0],
                            end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                            usage_limit_per_user: 1,
                            status: 'active' as const,
                            created_by: 1 // Default user ID
                        });
                        const tempId = Date.now();
                        const updated = [...promos, { id: tempId, name: value, code: code || '', description }];
                        setPromos(updated);
                        showToast("Promo added!", "success");
                    }
                    break;
                case 'giftcard':
                    if (!giftCards.some(g => g.code === code)) {
                        const description = extra || '';
                        const initialValue = 100;
                        await giftCardService.createGiftCard({
                            code: code || '',
                            type: 'fixed' as const,
                            initial_value: initialValue,
                            balance: initialValue,
                            max_usage: 1,
                            description,
                            status: 'active' as const,
                            created_by: 1 // Default user ID
                        });
                        const tempId = Date.now();
                        const updated = [...giftCards, { id: tempId, name: code || '', code: code || '', description }];
                        setGiftCards(updated);
                        showToast("Gift card added!", "success");
                    }
                    break;
            }
        } catch (error) {
            console.error(`Error adding ${type}:`, error);
            showToast(`Error adding ${type}`, "error");
        }
    };

    // On submit, save form data using API instead of localStorage
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Validate availability schedules
        if (form.availability_schedules.length === 0) {
            showToast("Please add at least one availability schedule", "error");
            return;
        }
        
        setSubmitting(true);
        try {
            // Validate required numeric fields
            const price = parseFloat(form.price);
            const minParticipants = form.minParticipants ? parseInt(form.minParticipants) : undefined;
            const maxParticipants = parseInt(form.maxParticipants);
            const pricePerAdditional = form.pricePerAdditional ? parseFloat(form.pricePerAdditional) : 0;
            const duration = parseInt(form.duration);

            if (isNaN(price) || price < 0) {
                showToast("Please enter a valid price", "error");
                setSubmitting(false);
                return;
            }

            if (form.maxParticipants && (isNaN(maxParticipants) || maxParticipants < 1)) {
                showToast("Please enter a valid max participants (minimum 1)", "error");
                setSubmitting(false);
                return;
            }

            if (form.minParticipants && minParticipants && (isNaN(minParticipants) || minParticipants < 1)) {
                showToast("Please enter a valid min participants (minimum 1)", "error");
                setSubmitting(false);
                return;
            }

            if (isNaN(duration) || duration < 1) {
                showToast("Please enter a valid duration", "error");
                setSubmitting(false);
                return;
            }

            // Prepare package data for API (send IDs)
            const packageData = {
                name: form.name,
                description: form.description,
                category: form.category,
                package_type: form.packageType,
                features: form.features.filter(f => f.trim()), // Filter out empty features
                price: Number(price.toFixed(2)), // Ensure 2 decimal places
                min_participants: minParticipants,
                max_participants: maxParticipants,
                price_per_additional: Number(pricePerAdditional.toFixed(2)), // Ensure 2 decimal places
                duration: duration,
                duration_unit: form.durationUnit,
                image: form.image,
                status: 'active' as const,
                location_id: selectedLocation || 1,
                partial_payment_percentage: form.partialPaymentPercentage ? parseInt(form.partialPaymentPercentage) : undefined,
                partial_payment_fixed: form.partialPaymentFixed ? parseInt(form.partialPaymentFixed) : undefined,
                has_guest_of_honor: form.hasGuestOfHonor,
                
                // NEW: Send availability schedules
                availability_schedules: form.availability_schedules,
                attraction_ids: form.attractions.map(name => {
                    const found = attractions.find(a => a.name === name);
                    return found?.id;
                }).filter(Boolean),
                room_ids: form.rooms.map(name => {
                    const found = rooms.find(r => r.name === name);
                    return found?.id;
                }).filter(Boolean),
                addon_ids: form.addOns.map(name => {
                    const found = addOns.find(a => a.name === name);
                    return found?.id;
                }).filter(Boolean),
                promo_ids: form.promos.map(code => {
                    const found = promos.find(p => p.code === code);
                    return found?.id;
                }).filter(Boolean),
                gift_card_ids: form.giftCards.map(code => {
                    const found = giftCards.find(g => g.code === code);
                    return found?.id;
                }).filter(Boolean)
            };

                        console.log("Package created:", packageData);


            // Create package first
            const packageResponse = await packageService.createPackage(packageData);
            
            // Then create availability schedules if package was created successfully
            if (packageResponse.success && packageResponse.data?.id && form.availability_schedules.length > 0) {
                try {
                    await packageService.updateAvailabilitySchedules(
                        packageResponse.data.id,
                        { schedules: form.availability_schedules }
                    );
                } catch (scheduleError) {
                    console.error('Error creating availability schedules:', scheduleError);
                    showToast("Package created but failed to add availability schedules", "error");
                    setSubmitting(false);
                    return;
                }
            }
            
            showToast("Package created successfully!", "success");
            
            // Reset form
            setForm({
                name: "",
                description: "",
                category: "",
                packageType: "regular",
                features: [""],
                attractions: [],
                rooms: [],
                price: "",
                minParticipants: "",
                maxParticipants: "",
                pricePerAdditional: "",
                duration: "",
                durationUnit: "hours",
                promos: [],
                giftCards: [],
                addOns: [],
                image: "",
                partialPaymentPercentage: "0",
                partialPaymentFixed: "0",
                hasGuestOfHonor: false,
                availability_schedules: [],
            });
            setImagePreview("");
            
        } catch (error) {
            console.error('Error creating package:', error);
            showToast("Error creating package", "error");
        } finally {
            setSubmitting(false);
        }
    };

    // Format availability for display
    const formatAvailability = () => {
        if (form.availability_schedules.length === 0) return "No schedules configured";
        
        return form.availability_schedules.map(schedule => {
            const { availability_type, day_configuration, time_slot_start, time_slot_end } = schedule;
            
            let dayText = '';
            if (availability_type === 'daily') {
                dayText = 'Every day';
            } else if (availability_type === 'weekly' && day_configuration && day_configuration.length > 0) {
                dayText = `Every ${day_configuration.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ')}`;
            } else if (availability_type === 'monthly' && day_configuration && day_configuration.length > 0) {
                dayText = day_configuration.map(config => {
                    const [occurrence, day] = config.split('-');
                    return `${occurrence.charAt(0).toUpperCase() + occurrence.slice(1)} ${day.charAt(0).toUpperCase() + day.slice(1)}`;
                }).join(', ');
            }
            
            return `${dayText} (${formatTimeRange(time_slot_start, time_slot_end)})`;
        }).join(', ');
    };

    // Format duration for display
    const formatDuration = () => {
        if (!form.duration) return "Not specified";
        return `${form.duration} ${form.durationUnit}`;
    };

    if (loading) {
        return (
            <div className="w-full mx-auto sm:px-4 md:mt-8 pb-6 flex justify-center items-center min-h-64">
                <div className="text-center">
                    <div className={`animate-spin rounded-full h-12 w-12 border-b-2 border-${fullColor} mx-auto mb-4`}></div>
                </div>
            </div>
        );
    }

    return (
            <div className="w-full mx-auto sm:px-4 md:mt-8 pb-6 flex flex-col md:flex-row gap-8 md:gap-12">
                {/* Form Section */}
                <div className="flex-1 mx-auto">
                    <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 md:p-8">
                        <div className="mb-6">
                            <h2 className="text-2xl sm:text-3xl font-bold text-neutral-900 tracking-tight">Create Package Deal</h2>
                            <p className="text-sm text-gray-500 mt-2">Fill in the details below to create a new package deal.</p>
                        </div>
                        
                        <form className="space-y-8" onSubmit={handleSubmit} autoComplete="off">
                            {/* Location Selection for company_admin */}
                            {isCompanyAdmin && (
                                <div>
                                    <LocationSelector
                                        locations={locations.map(loc => ({
                                          id: loc.id.toString(),
                                          name: loc.name,
                                          address: loc.address || '',
                                          city: loc.city || '',
                                          state: loc.state || ''
                                        }))}
                                        selectedLocation={selectedLocation?.toString() || ''}
                                        onLocationChange={(id) => setSelectedLocation(id ? Number(id) : null)}
                                        themeColor={themeColor}
                                        fullColor={fullColor}
                                        layout="grid"
                                        maxWidth="100%"
                                        showAllOption={false}
                                    />
                                </div>
                            )}
                            
                            {/* Image Upload */}
                            {/* Image Upload */}
                            <div>
                                <label className="block font-semibold mb-2 text-base text-neutral-800">Package Image</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageChange}
                                    className={`block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-${themeColor}-50 file:text-${fullColor} hover:file:bg-${themeColor}-100`}
                                />
                                {imagePreview && (
                                    <div className="mt-4">
                                        <img src={imagePreview} alt="Preview" className="w-full max-h-56 object-contain rounded-md border border-gray-200" />
                                    </div>
                                )}
                            </div>
                            {/* Details Section */}
                            <div>
                                <h3 className="text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2 relative group">
                                    <Info className="w-5 h-5 text-primary" /> Details
                                    <span className="absolute z-20 left-0 top-full mt-2 min-w-[250px] max-w-xs bg-gray-900 text-white text-xs rounded-md px-3 py-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-all">
                                        Basic package information including name, duration, participants, and pricing details
                                    </span>
                                </h3>
                                <div className="space-y-5">
                                    <div>
                                        <label className="block font-semibold mb-2 text-base text-neutral-800">Package Name</label>
                                        <input
                                            type="text"
                            name="name"
                            value={form.name}
                            onChange={handleChange}
                            className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all placeholder:text-gray-400`}
                            placeholder="Enter package name"
                            required
                        />
                    </div>
                    
                    {/* Duration Section */}
                    <div>
                        <label className="block font-semibold mb-2 text-base text-neutral-800">Duration</label>
                        <div className="flex gap-2">
                            <input
                                type="number"
                                name="duration"
                                value={form.duration}
                                onChange={handleChange}
                                className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all placeholder:text-gray-400`}
                                min="1"
                                placeholder="Duration"
                            />
                            <select
                                name="durationUnit"
                                value={form.durationUnit}
                                onChange={handleChange}
                                className={`rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all`}
                            >
                                <option value="hours">Hours</option>
                                <option value="minutes">Minutes</option>
                            </select>
                        </div>
                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block font-semibold mb-2 text-base text-neutral-800">Min Participants</label>
                                            <input
                                                type="number"
                                                name="minParticipants"
                                                value={form.minParticipants}
                                                onChange={handleChange}
                                                className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all placeholder:text-gray-400`}
                                                min="1"
                                                placeholder="Enter min participants"
                                            />
                                        </div>
                                        
                                        <div>
                                            <label className="block font-semibold mb-2 text-base text-neutral-800">Max Participants</label>
                                            <input
                                                type="number"
                                                name="maxParticipants"
                                                value={form.maxParticipants}
                                                onChange={handleChange}
                                                className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all placeholder:text-gray-400`}
                                                min="1"
                                                placeholder="Enter max participants"
                                            />
                                        </div>
                                    </div>
                                    
                    {/* Additional Pricing Section */}
                    {form.maxParticipants && (
                        <div>
                            <label className="block font-semibold mb-2 text-base text-neutral-800">Price per Additional Participant</label>
                            <input
                                type="number"
                                name="pricePerAdditional"
                                value={form.pricePerAdditional}
                                onChange={handleChange}
                                className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all placeholder:text-gray-400`}
                                min="0"
                                step="0.01"
                                placeholder="Enter price per additional"
                            />
                        </div>
                    )}
                                    
                                    <div>
                                        <label className="block font-semibold mb-2 text-base text-neutral-800">Category</label>
                                        <div className="flex flex-col sm:flex-row gap-2">
                                            <div className="flex gap-1 items-center flex-1">
                                                <select
                                                    name="category"
                                                    value={form.category}
                                                    onChange={handleChange}
                                                    className={`rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base min-w-0 flex-1 transition-all`}
                                                    required
                                                >
                                                    <option value="">Select category</option>
                                                    {categories.map((cat) => (
                                                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                                                    ))}
                                                </select>
                                                {form.category && (
                                                    <StandardButton
                                                        type="button"
                                                        onClick={async () => {
                                                            const category = categories.find(c => c.name === form.category);
                                                            if (category && window.confirm(`Are you sure you want to delete the category "${category.name}"?`)) {
                                                                try {
                                                                    await categoryService.deleteCategory(category.id);
                                                                    setCategories(prev => prev.filter(c => c.id !== category.id));
                                                                    setForm(prev => ({ ...prev, category: '' }));
                                                                    showToast("Category deleted successfully!", "success");
                                                                } catch (error) {
                                                                    console.error('Error deleting category:', error);
                                                                    showToast("Error deleting category", "error");
                                                                }
                                                            }
                                                        }}
                                                        variant="ghost"
                                                        size="sm"
                                                        icon={Trash2}
                                                        className="text-red-600 hover:bg-red-50"
                                                        title="Delete category"
                                                    />
                                                )}
                                            </div>
                                            <div className="flex gap-1 items-center">
                                                <input
                                                    type="text"
                                                    placeholder="Add category"
                                                    className="rounded-md border border-gray-200 px-3 py-2 bg-white text-base min-w-0 w-32 transition-all"
                                                    onKeyDown={async (e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            await handleAddOption('category', (e.target as HTMLInputElement).value);
                                                            (e.target as HTMLInputElement).value = '';
                                                        }
                                                    }}
                                                />
                                                <StandardButton 
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    icon={Plus}
                                                    title="Add category"
                                                    onClick={async () => {
                                                        const input = document.querySelector('input[placeholder="Add category"]') as HTMLInputElement;
                                                        if (input?.value) {
                                                            await handleAddOption('category', input.value);
                                                            input.value = '';
                                                        }
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Package Type */}
                                    <div>
                                        <label className="block font-semibold mb-2 text-base text-neutral-800">Package Type</label>
                                        <select
                                            name="packageType"
                                            value={form.packageType}
                                            onChange={handleChange}
                                            className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all`}
                                        >
                                            <option value="regular">Regular</option>
                                            <option value="custom">Custom</option>
                                            <option value="holiday">Holiday</option>
                                            <option value="special">Special</option>
                                            <option value="seasonal">Seasonal</option>
                                        </select>
                                        <p className="text-xs text-gray-500 mt-1">
                                            Use "Regular" for standard packages. Other types will appear in the Custom Packages section.
                                        </p>
                                    </div>

                                    {/* Features input below category */}
                                    <div>
                                        <label className="block font-semibold mb-2 text-base text-neutral-800">Features</label>
                                        <div className="space-y-2">
                                            {form.features.map((feature, index) => (
                                                <div key={index} className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={feature}
                                                        onChange={(e) => handleFeatureChange(index, e.target.value)}
                                                        className={`flex-1 rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all placeholder:text-gray-400`}
                                                        placeholder={`Feature ${index + 1}`}
                                                    />
                                                    {form.features.length > 1 && (
                                                        <StandardButton
                                                            onClick={() => handleRemoveFeature(index)}
                                                            variant="danger"
                                                            size="sm"
                                                            className="px-3"
                                                        >
                                                            ×
                                                        </StandardButton>
                                                    )}
                                                </div>
                                            ))}
                                            <StandardButton
                                                onClick={handleAddFeature}
                                                variant="ghost"
                                                size="sm"
                                                fullWidth
                                            >
                                                + Add Feature
                                            </StandardButton>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block font-semibold mb-2 text-base text-neutral-800">Description</label>
                                        <textarea
                                            name="description"
                                            value={form.description}
                                            onChange={handleChange}
                                            className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all placeholder:text-gray-400`}
                                            rows={3}
                                            placeholder="Describe the package"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>
                            
                            {/* Availability Schedules Section */}
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-xl font-bold text-neutral-900 flex items-center gap-2 relative group">
                                        <Calendar className="w-5 h-5 text-primary" /> Availability Schedules
                                        <span className="absolute z-20 left-0 top-full mt-2 min-w-[250px] max-w-xs bg-gray-900 text-white text-xs rounded-md px-3 py-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-all">
                                            Configure multiple availability schedules with different time slots for different days
                                        </span>
                                    </h3>
                                    <StandardButton
                                        type="button"
                                        onClick={addNewSchedule}
                                        variant="primary"
                                        size="sm"
                                        icon={Plus}
                                    >
                                        Add Schedule
                                    </StandardButton>
                                </div>

                                {form.availability_schedules.length === 0 ? (
                                    <div className="bg-gray-50 rounded-lg p-6 text-center border border-dashed border-gray-300">
                                        <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                                        <p className="text-gray-600 mb-2 font-medium">No availability schedules configured</p>
                                        <p className="text-gray-500 text-sm mb-4">Add schedules to define when this package can be booked</p>
                                        <StandardButton
                                            type="button"
                                            onClick={addNewSchedule}
                                            variant="primary"
                                            size="sm"
                                            icon={Plus}
                                        >
                                            Add First Schedule
                                        </StandardButton>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {form.availability_schedules.map((schedule, index) => (
                                            <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50 relative">
                                                <StandardButton
                                                    type="button"
                                                    onClick={() => removeSchedule(index)}
                                                    variant="ghost"
                                                    size="sm"
                                                    icon={X}
                                                    className="absolute top-3 right-3 text-red-600 hover:bg-red-100"
                                                    title="Remove schedule"
                                                />

                                                <div className="space-y-4">
                                                    {/* Schedule Type */}
                                                    <div>
                                                        <label className="block font-semibold mb-2 text-sm text-neutral-800">
                                                            Schedule Type
                                                        </label>
                                                        <div className="flex flex-wrap gap-2">
                                                            {(['daily', 'weekly', 'monthly'] as const).map((type) => (
                                                                <StandardButton
                                                                    key={type}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        updateSchedule(index, {
                                                                            availability_type: type,
                                                                            day_configuration: type === 'daily' ? null : schedule.day_configuration
                                                                        });
                                                                    }}
                                                                    variant={schedule.availability_type === type ? 'primary' : 'secondary'}
                                                                    size="sm"
                                                                >
                                                                    {type.charAt(0).toUpperCase() + type.slice(1)}
                                                                </StandardButton>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Day Configuration for Weekly */}
                                                    {schedule.availability_type === 'weekly' && (
                                                        <div>
                                                            <div className="flex items-center justify-between mb-2">
                                                                <label className="block font-semibold text-sm text-neutral-800">
                                                                    Select Days
                                                                </label>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => selectAllWeekDays(index)}
                                                                    className={`text-xs font-medium px-2 py-1 rounded transition-colors ${
                                                                        ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].every(d => schedule.day_configuration?.includes(d))
                                                                            ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                                                            : `bg-${themeColor}-100 text-${fullColor} hover:bg-${themeColor}-200`
                                                                    }`}
                                                                >
                                                                    {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].every(d => schedule.day_configuration?.includes(d)) ? 'Deselect All' : 'Select All'}
                                                                </button>
                                                            </div>
                                                            <div className="flex flex-wrap gap-2">
                                                                {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => {
                                                                    const isSelected = schedule.day_configuration?.includes(day) || false;
                                                                    return (
                                                                        <StandardButton
                                                                            key={day}
                                                                            type="button"
                                                                            onClick={() => {
                                                                                const current = schedule.day_configuration || [];
                                                                                const updated = isSelected
                                                                                    ? current.filter(d => d !== day)
                                                                                    : [...current, day];
                                                                                updateSchedule(index, { day_configuration: updated.length > 0 ? updated : null });
                                                                            }}
                                                                            variant={isSelected ? 'primary' : 'secondary'}
                                                                            size="sm"
                                                                        >
                                                                            {day.charAt(0).toUpperCase() + day.slice(1)}
                                                                        </StandardButton>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Day Configuration for Monthly */}
                                                    {schedule.availability_type === 'monthly' && (
                                                        <div>
                                                            <label className="block font-semibold mb-2 text-sm text-neutral-800">
                                                                Select Occurrences
                                                            </label>
                                                            <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-200 rounded-md p-3 bg-gray-50">
                                                                {['first', 'second', 'third', 'fourth', 'last'].map(occurrence => 
                                                                    ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => {
                                                                        const value = `${occurrence}-${day}`;
                                                                        const isSelected = schedule.day_configuration?.includes(value) || false;
                                                                        return (
                                                                            <label key={value} className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-1 rounded">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={isSelected}
                                                                                    onChange={() => {
                                                                                        const current = schedule.day_configuration || [];
                                                                                        const updated = isSelected
                                                                                            ? current.filter(d => d !== value)
                                                                                            : [...current, value];
                                                                                        updateSchedule(index, { day_configuration: updated.length > 0 ? updated : null });
                                                                                    }}
                                                                                    className="rounded border-gray-300"
                                                                                />
                                                                                <span className="text-sm">
                                                                                    {occurrence.charAt(0).toUpperCase() + occurrence.slice(1)} {day.charAt(0).toUpperCase() + day.slice(1)}
                                                                                </span>
                                                                            </label>
                                                                        );
                                                                    })
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Time Slot Configuration */}
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                        <div>
                                                            <label className="block text-xs font-medium text-gray-600 mb-1">Start Time</label>
                                                            <input
                                                                type="time"
                                                                value={schedule.time_slot_start}
                                                                onChange={(e) => updateSchedule(index, { time_slot_start: e.target.value })}
                                                                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-medium text-gray-600 mb-1">End Time</label>
                                                            <input
                                                                type="time"
                                                                value={schedule.time_slot_end}
                                                                onChange={(e) => updateSchedule(index, { time_slot_end: e.target.value })}
                                                                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-medium text-gray-600 mb-1">Interval (min)</label>
                                                            <input
                                                                type="number"
                                                                value={schedule.time_slot_interval}
                                                                onChange={(e) => updateSchedule(index, { time_slot_interval: parseInt(e.target.value) || 30 })}
                                                                min="15"
                                                                step="15"
                                                                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Preview generated time slots */}
                                                    {form.duration && schedule.time_slot_start && schedule.time_slot_end && (
                                                        <div className="mt-3 pt-3 border-t border-gray-200">
                                                            <p className="text-xs font-medium text-gray-600 mb-2">Generated Time Slots:</p>
                                                            <div className="flex flex-wrap gap-1">
                                                                {(() => {
                                                                    const slotDuration = form.durationUnit === 'hours' ? parseInt(form.duration) * 60 : parseInt(form.duration);
                                                                    const interval = schedule.time_slot_interval;
                                                                    const [startHour, startMin] = schedule.time_slot_start.split(':').map(Number);
                                                                    const [endHour, endMin] = schedule.time_slot_end.split(':').map(Number);
                                                                    let currentMinutes = startHour * 60 + startMin;
                                                                    const endMinutes = endHour * 60 + endMin;
                                                                    const slots = [];
                                                                    
                                                                    while (currentMinutes < endMinutes) {
                                                                        const slotEndMinutes = currentMinutes + slotDuration;
                                                                        if (slotEndMinutes <= endMinutes) {
                                                                            const startH = Math.floor(currentMinutes / 60);
                                                                            const startM = currentMinutes % 60;
                                                                            const endH = Math.floor(slotEndMinutes / 60);
                                                                            const endM = slotEndMinutes % 60;
                                                                            const startTime = `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`;
                                                                            const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
                                                                            slots.push(
                                                                                <span key={currentMinutes} className="px-2 py-1 bg-white border border-gray-200 rounded text-xs">
                                                                                    {formatTimeRange(startTime, endTime)}
                                                                                </span>
                                                                            );
                                                                        }
                                                                        currentMinutes += interval;
                                                                    }
                                                                    
                                                                    return slots.length > 0 ? slots : <span className="text-xs text-gray-500">No valid slots with current configuration</span>;
                                                                })()}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            
                            <div className="border-b border-gray-100 my-2" />
                            
            {/* Attractions Section */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-neutral-900 flex items-center gap-2 relative group">
                        <Info className="w-5 h-5 text-primary" /> Additional Attractions
                        <span className="absolute z-20 left-0 top-full mt-2 min-w-[250px] max-w-xs bg-gray-900 text-white text-xs rounded-md px-3 py-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-all">
                            Select extra attractions that customers can add to this package during booking
                        </span>
                    </h3>
                    {attractions.length > 0 && (
                        <StandardButton
                            type="button"
                            onClick={() => {
                                if (form.attractions.length === attractions.length) {
                                    setForm(prev => ({ ...prev, attractions: [] }));
                                } else {
                                    setForm(prev => ({ ...prev, attractions: attractions.map(a => a.name) }));
                                }
                            }}
                            variant={form.attractions.length === attractions.length ? 'primary' : 'ghost'}
                            size="sm"
                        >
                            {form.attractions.length === attractions.length ? 'Deselect All' : 'Select All'}
                        </StandardButton>
                    )}
                </div>
                {attractions.length === 0 ? (
                    <div className="bg-gray-50 rounded-lg p-4 text-center border border-dashed border-gray-300">
                        <p className="text-gray-500 mb-3 text-sm">No attractions available yet</p>
                        <StandardButton
                            type="button"
                            onClick={() => navigate('/admin/attractions/create')}
                            variant="primary"
                            size="sm"
                            icon={Plus}
                        >
                            Create Attraction
                        </StandardButton>
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-2 mb-2">
                        {attractions.map((act) => (
                            <StandardButton
                                type="button"
                                key={act.name}
                                variant={form.attractions.includes(act.name) ? 'primary' : 'secondary'}
                                size="sm"
                                onClick={() => handleMultiSelect("attractions", act.name)}
                            >
                                {act.name} <span className="text-xs opacity-70 ml-1">${act.price}</span>
                            </StandardButton>
                        ))}
                    </div>
                )}
            </div>                            {/* SPACE Section */}
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-xl font-bold text-neutral-900 flex items-center gap-2 relative group">
                                        <Home className="w-5 h-5 text-primary" /> Space
                                        <span className="absolute z-20 left-0 top-full mt-2 min-w-[250px] max-w-xs bg-gray-900 text-white text-xs rounded-md px-3 py-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-all">
                                            Assign specific Spaces where this package can be booked
                                        </span>
                                    </h3>
                                    <StandardButton
                                        type="button"
                                        onClick={() => {
                                            if (form.rooms.length === rooms.length) {
                                                setForm(prev => ({ ...prev, rooms: [] }));
                                            } else {
                                                setForm(prev => ({ ...prev, rooms: rooms.map(r => r.name) }));
                                            }
                                        }}
                                        variant={form.rooms.length === rooms.length ? 'primary' : 'ghost'}
                                        size="sm"
                                    >
                                        {form.rooms.length === rooms.length ? 'Deselect All' : 'Select All'}
                                    </StandardButton>
                                </div>
                                {/* Group rooms by area_group */}
                                {(() => {
                                    const groupedRooms = rooms.reduce((acc, room) => {
                                        const group = room.area_group || 'Ungrouped';
                                        if (!acc[group]) acc[group] = [];
                                        acc[group].push(room);
                                        return acc;
                                    }, {} as Record<string, typeof rooms>);
                                    
                                    const sortedGroups = Object.keys(groupedRooms).sort((a, b) => {
                                        if (a === 'Ungrouped') return 1;
                                        if (b === 'Ungrouped') return -1;
                                        return a.localeCompare(b);
                                    });
                                    
                                    return sortedGroups.map(group => (
                                        <div key={group} className="mb-4">
                                            {sortedGroups.length > 1 && (
                                                <div className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                                                    <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                                                    {group}
                                                </div>
                                            )}
                                            <div className="flex flex-wrap gap-2">
                                                {[...groupedRooms[group]]
                                                    .sort((a, b) =>
                                                        a.name.localeCompare(b.name, undefined, {
                                                            numeric: true,
                                                            sensitivity: "base",
                                                        })
                                                    )
                                                    .map((room) => (
                                                        <StandardButton
                                                            type="button"
                                                            key={room.name}
                                                            variant={form.rooms.includes(room.name) ? 'primary' : 'secondary'}
                                                            size="sm"
                                                            onClick={() => handleMultiSelect("rooms", room.name)}
                                                        >
                                                            {room.name}
                                                        </StandardButton>
                                                    ))}
                                            </div>
                                        </div>
                                    ));
                                })()}
                                <div className="flex gap-2 mt-2">
                                    <input
                                        type="text"
                                        placeholder="Space name"
                                        className="rounded-md border border-gray-200 px-2 py-1 w-24 bg-white text-sm transition-all placeholder:text-gray-400"
                                        id="room-name"
                                    />
                                    <StandardButton type="button" variant="ghost" size="sm" icon={Plus} title="Add Space"
                                        onClick={async () => {
                                            const nameInput = document.getElementById('room-name') as HTMLInputElement;
                                            if (nameInput.value) {
                                                await handleAddOption('room', nameInput.value);
                                                nameInput.value = '';
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                            
                            {/* Add-ons Section */}
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-xl font-bold text-neutral-900 flex items-center gap-2 relative group">
                                        <Info className="w-5 h-5 text-primary" /> Add-ons
                                        <span className="absolute z-20 left-0 top-full mt-2 min-w-[250px] max-w-xs bg-gray-900 text-white text-xs rounded-md px-3 py-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-all">
                                            Optional extras like food, decorations, or party favors that enhance this package
                                        </span>
                                    </h3>
                                    <StandardButton
                                        type="button"
                                        onClick={() => {
                                            if (form.addOns.length === addOns.length) {
                                                setForm(prev => ({ ...prev, addOns: [] }));
                                            } else {
                                                setForm(prev => ({ ...prev, addOns: addOns.map(a => a.name) }));
                                            }
                                        }}
                                        variant={form.addOns.length === addOns.length ? 'primary' : 'ghost'}
                                        size="sm"
                                    >
                                        {form.addOns.length === addOns.length ? 'Deselect All' : 'Select All'}
                                    </StandardButton>
                                </div>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {addOns.map((add) => (
                                        <StandardButton
                                            type="button"
                                            key={add.name}
                                            variant={form.addOns.includes(add.name) ? 'success' : 'secondary'}
                                            size="sm"
                                            onClick={() => handleMultiSelect("addOns", add.name)}
                                        >
                                            {add.name} <span className="text-xs opacity-70">${add.price}</span>
                                        </StandardButton>
                                    ))}
                                    <input
                                        type="text"
                                        placeholder="Add add-on"
                                        className="rounded-md border border-gray-200 px-2 py-1 w-20 bg-white text-sm transition-all placeholder:text-gray-400"
                                        id="addon-name"
                                    />
                                    <input
                                        type="number"
                                        placeholder="Price"
                                        className="rounded-md border border-gray-200 px-2 py-1 w-16 bg-white text-sm transition-all placeholder:text-gray-400"
                                        id="addon-price"
                                        min="0"
                                    />
                                    <StandardButton type="button" variant="ghost" size="sm" icon={Plus} title="Add add-on"
                                        onClick={async () => {
                                            const nameInput = document.getElementById('addon-name') as HTMLInputElement;
                                            const priceInput = document.getElementById('addon-price') as HTMLInputElement;
                                            if (nameInput.value) {
                                                await handleAddOption('addon', nameInput.value, '', priceInput.value);
                                                nameInput.value = '';
                                                priceInput.value = '';
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                            
                            {/* Promos Section */}
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-xl font-bold text-neutral-900 flex items-center gap-2 relative group">
                                        <Tag className="w-5 h-5 text-primary" /> Promos
                                        <span className="absolute z-20 left-0 top-full mt-2 min-w-[250px] max-w-xs bg-gray-900 text-white text-xs rounded-md px-3 py-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-all">
                                            Link promotional codes that can be applied as discounts for this package
                                        </span>
                                    </h3>
                                    {promos.length > 0 && (
                                        <StandardButton
                                            type="button"
                                            onClick={() => {
                                                if (form.promos.length === promos.length) {
                                                    setForm(prev => ({ ...prev, promos: [] }));
                                                } else {
                                                    setForm(prev => ({ ...prev, promos: promos.map(p => p.code) }));
                                                }
                                            }}
                                            variant={form.promos.length === promos.length ? 'primary' : 'ghost'}
                                            size="sm"
                                        >
                                            {form.promos.length === promos.length ? 'Deselect All' : 'Select All'}
                                        </StandardButton>
                                    )}
                                </div>
                                {promos.length === 0 ? (
                                    <div className="bg-gray-50 rounded-lg p-4 text-center border border-dashed border-gray-300">
                                        <p className="text-gray-500 mb-3 text-sm">No promos available yet</p>
                                        <StandardButton
                                            type="button"
                                            onClick={() => navigate('/packages/promos')}
                                            variant="primary"
                                            size="sm"
                                            icon={Plus}
                                        >
                                            Create Promo
                                        </StandardButton>
                                    </div>
                                ) : (
                                    <div className="flex flex-wrap gap-2 items-center mb-2">
                                        {promos.map((promo) => (
                                            <label key={promo.code} className={`flex items-center gap-2 px-3 py-1 rounded-full border cursor-pointer text-sm font-medium transition-all duration-150 hover:bg-primary/10 hover:border-primary/60 focus-within:ring-2 focus-within:ring-primary/30 ${form.promos.includes(promo.code) ? "bg-primary/10 border-primary text-primary" : "bg-white border-gray-200 text-neutral-800"}`}>
                                                <input
                                                    type="checkbox"
                                                    checked={form.promos.includes(promo.code)}
                                                    onChange={() => handleMultiSelectCheckbox('promos', promo.code)}
                                                    className="accent-indigo-500"
                                                />
                                                <span className="relative group cursor-pointer flex items-center gap-1">
                                                    {promo.name}
                                                    <span className="text-xs text-gray-400 ml-1">[{promo.code}]</span>
                                                    {promo.description && (
                                                        <span className="ml-1">
                                                            <Info className="w-4 h-4 text-gray-400 group-hover:text-primary transition" />
                                                            <span className="absolute z-20 left-1/2 -translate-x-1/2 bottom-full mb-2 min-w-[180px] max-w-xs bg-white border border-gray-200 shadow-lg text-gray-900 text-xs rounded-md px-3 py-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-all whitespace-pre-line text-left content-fit">
                                                                {promo.description}
                                                            </span>
                                                        </span>
                                                    )}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                            
                            {/* Gift Cards Section */}
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-xl font-bold text-neutral-900 flex items-center gap-2 relative group">
                                        <Gift className="w-5 h-5 text-primary" /> Gift Cards
                                        <span className="absolute z-20 left-0 top-full mt-2 min-w-[250px] max-w-xs bg-gray-900 text-white text-xs rounded-md px-3 py-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-all">
                                            Associate gift card codes that can be redeemed when booking this package
                                        </span>
                                    </h3>
                                    {giftCards.length > 0 && (
                                        <StandardButton
                                            type="button"
                                            onClick={() => {
                                                if (form.giftCards.length === giftCards.length) {
                                                    setForm(prev => ({ ...prev, giftCards: [] }));
                                                } else {
                                                    setForm(prev => ({ ...prev, giftCards: giftCards.map(gc => gc.code) }));
                                                }
                                            }}
                                            variant={form.giftCards.length === giftCards.length ? 'primary' : 'ghost'}
                                            size="sm"
                                        >
                                            {form.giftCards.length === giftCards.length ? 'Deselect All' : 'Select All'}
                                        </StandardButton>
                                    )}
                                </div>
                                {giftCards.length === 0 ? (
                                    <div className="bg-gray-50 rounded-lg p-4 text-center border border-dashed border-gray-300">
                                        <p className="text-gray-500 mb-3 text-sm">No gift cards available yet</p>
                                        <StandardButton
                                            type="button"
                                            onClick={() => navigate('/packages/giftcards')}
                                            variant="primary"
                                            size="sm"
                                            icon={Plus}
                                        >
                                            Create Gift Card
                                        </StandardButton>
                                    </div>
                                ) : (
                                    <div className="flex flex-wrap gap-2 items-center mb-2">
                                        {giftCards.map((gc) => (
                                            <label key={gc.code} className={`flex items-center gap-2 px-3 py-1 rounded-full border cursor-pointer text-sm font-medium transition-all duration-150 hover:bg-emerald-50 hover:border-emerald-400/60 focus-within:ring-2 focus-within:ring-emerald-200 ${form.giftCards.includes(gc.code) ? "bg-emerald-50 border-emerald-400 text-emerald-800" : "bg-white border-gray-200 text-neutral-800"}`}>
                                                <input
                                                    type="checkbox"
                                                    checked={form.giftCards.includes(gc.code)}
                                                    onChange={() => handleMultiSelectCheckbox('giftCards', gc.code)}
                                                    className="accent-emerald-500"
                                                />
                                                <span className="relative group cursor-pointer flex items-center gap-1">
                                                    {gc.name}
                                                    <span className="text-xs text-gray-400 ml-1">[{gc.code}]</span>
                                                    {gc.description && (
                                                        <span className="ml-1">
                                                            <Info className="w-4 h-4 text-emerald-400 group-hover:text-emerald-800 transition" />
                                                            <span className="absolute z-20 left-1/2 -translate-x-1/2 bottom-full mb-2 min-w-[180px] max-w-xs bg-white border border-gray-200 shadow-lg text-gray-900 text-xs rounded-md px-3 py-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-all whitespace-pre-line text-left content-fit">
                                                                {gc.description}
                                                            </span>
                                                        </span>
                                                    )}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                            
                            {/* Pricing Section */}
                            <div>
                                <h3 className="text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2 relative group">
                                    <Info className="w-5 h-5 text-primary" /> Pricing
                                    <span className="absolute z-20 left-0 top-full mt-2 min-w-[250px] max-w-xs bg-gray-900 text-white text-xs rounded-md px-3 py-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-all">
                                        Set the base price for this package (before any add-ons or additional participants)
                                    </span>
                                </h3>
                                <label className="block font-semibold mb-2 text-base text-neutral-800">Price</label>
                                <input
                                    type="number"
                                    name="price"
                                    value={form.price}
                                    onChange={handleChange}
                                    className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all placeholder:text-gray-400`}
                                    min="0"
                                    step="0.01"
                                    placeholder="Enter price"
                                    required
                                />
                            </div>
                            {/* Partial Payment Section */}
                            <div>
                                <h3 className="text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2 relative group">
                                    <Info className="w-5 h-5 text-primary" /> Partial Payment Options
                                    <span className="absolute z-20 left-0 top-full mt-2 min-w-[250px] max-w-xs bg-gray-900 text-white text-xs rounded-md px-3 py-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-all">
                                        Configure partial payment options for customers (percentage or fixed amount)
                                    </span>
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block font-semibold mb-2 text-base text-neutral-800">Partial Payment Percentage (%)</label>
                                        <input
                                            type="number"
                                            name="partialPaymentPercentage"
                                            value={form.partialPaymentPercentage}
                                            onChange={handleChange}
                                            className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all placeholder:text-gray-400`}
                                            min="0"
                                            max="100"
                                            placeholder="e.g. 20 for 20%"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Leave 0 to disable percentage-based partial payment</p>
                                    </div>
                                    <div>
                                        <label className="block font-semibold mb-2 text-base text-neutral-800">Partial Payment Fixed Amount ($)</label>
                                        <input
                                            type="number"
                                            name="partialPaymentFixed"
                                            value={form.partialPaymentFixed}
                                            onChange={handleChange}
                                            className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all placeholder:text-gray-400`}
                                            min="0"
                                            placeholder="e.g. 50 for $50"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Leave 0 to disable fixed amount partial payment</p>
                                    </div>
                                </div>
                            </div>

                            {/* Guest of Honor Toggle */}
                            <div>
                                <h3 className="text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2">
                                    <Gift className="w-5 h-5 text-primary" /> Guest of Honor
                                </h3>
                                <label className="flex items-center space-x-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={form.hasGuestOfHonor}
                                        onChange={(e) => setForm(prev => ({ ...prev, hasGuestOfHonor: e.target.checked }))}
                                        className={`w-5 h-5 rounded border-gray-300 text-${themeColor}-600 focus:ring-${themeColor}-500 cursor-pointer`}
                                    />
                                    <span className="text-base text-neutral-800">Enable guest of honor fields for this package</span>
                                </label>
                                <p className="text-xs text-gray-500 mt-2">When enabled, customers can specify the name, age, and gender of the guest of honor during booking.</p>
                            </div>

                            
                            <div className="flex gap-2 mt-6">
                                <StandardButton
                                    type="submit"
                                    disabled={submitting || loading}
                                    variant="primary"
                                    size="md"
                                    icon={Plus}
                                    loading={submitting}
                                    fullWidth
                                >
                                    {submitting ? 'Creating...' : 'Submit'}
                                </StandardButton>
                                <StandardButton
                                    variant="secondary"
                                    size="md"
                                    icon={RefreshCcw}
                                    fullWidth
                                    onClick={() => setForm({
                                        name: "",
                                        description: "",
                                        category: "",
                                        packageType: "regular",
                                        features: [""],
                                        attractions: [],
                                        rooms: [],
                                        price: "",
                                        minParticipants: "",
                                        maxParticipants: "",
                                        pricePerAdditional: "",
                                        duration: "",
                                        durationUnit: "hours",
                                        promos: [],
                                        giftCards: [],
                                        addOns: [],
                                        image: "",
                                        partialPaymentPercentage: "0",
                                        partialPaymentFixed: "0",
                                        hasGuestOfHonor: false,
                                        availability_schedules: [],
                                    })}
                                >
                                    Reset
                                </StandardButton>
                                </div>
                        </form>
                    </div>
                </div>
                
                {/* Live Preview Section */}
                <div className="w-full md:w-[420px] md:max-w-sm md:sticky md:top-1 h-fit">
                    <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6 md:p-8 shadow-none">
                        <h3 className="text-2xl font-bold mb-6 text-neutral-900 tracking-tight">Live Preview</h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-bold text-2xl text-primary tracking-tight">{form.name || <span className='text-gray-400'>Package Name</span>}</span>
                                <span className="text-lg text-gray-500 font-semibold">${form.price || '--'}</span>
                            </div>
                            <div className="text-xs text-gray-500 mb-2">{form.category || <span className='text-gray-300'>Category</span>}</div>
                            
                            {/* Duration in Preview */}
                            <div className="mb-2 flex items-center gap-2">
                                <Clock className="w-4 h-4 text-gray-500" />
                                <span className="font-semibold">Duration:</span> 
                                <span className="text-neutral-800 text-sm">
                                    {formatDuration()}
                                </span>
                            </div>
                            
                            {/* Availability in Preview */}
                            <div className="mb-2 flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-gray-500" />
                                <span className="font-semibold">Available:</span> 
                                <span className="text-neutral-800 text-sm">
                                    {formatAvailability()}
                                </span>
                            </div>
                            
                            {/* Additional Time Pricing in Preview */}
                            
                            <div className="mb-4 text-neutral-800 text-base min-h-[48px]">{form.description || <span className='text-gray-300'>Description</span>}</div>
                            <div className="mb-2">
                                <span className="font-semibold">Attractions:</span> <span className="text-neutral-800 text-sm">{(form.attractions || []).length ? form.attractions.map((act: string) => {
                                    const found = attractions.find(a => a.name === act);
                                    return found ? `${found.name} ($${found.price}${found.unit ? `, ${found.unit}` : ''})` : act;
                                }).join(", ") : <span className='text-gray-300'>None</span>}</span>
                            </div>
                            <div className="mb-2">
                                <span className="font-semibold">Space:</span> <span className="text-neutral-800 text-sm">{(form.rooms || []).length ? form.rooms.map((room: string) => {
                                    const found = rooms.find(r => r.name === room);
                                    return found ? found.name : room;
                                }).join(", ") : <span className='text-gray-300'>None</span>}</span>
                            </div>
                            <div className="mb-2">
                                <span className="font-semibold">Add-ons:</span> <span className="text-neutral-800 text-sm">{(form.addOns || []).length ? (form.addOns || []).map((add: string) => {
                                    const found = addOns.find(a => a.name === add);
                                    return found ? `${found.name} ($${found.price})` : add;
                                }).join(", ") : <span className='text-gray-300'>None</span>}</span>
                            </div>
                            <div className="mb-2 flex items-center gap-2 flex-wrap">
                                <span className="font-semibold">Promos:</span>
                                {(form.promos || []).length ? (form.promos || []).map((code: string) => {
                                    const found = promos.find(p => p.code === code);
                                    return found ? (
                                        <span key={code} className="relative group cursor-pointer text-primary flex items-center gap-1">
                                            {found.name}
                                            {found.code && <span className="ml-1 text-gray-400">[{found.code}]</span>}
                                            {found.description && (
                                                <span className="ml-1">
                                                    <Info className="w-4 h-4 text-primary group-hover:text-primary/80 transition" />
                                                    <span className="absolute z-20 left-1/2 -translate-x-1/2 bottom-full mb-2 min-w-[180px] max-w-xs bg-white border border-gray-200 shadow-lg text-gray-900 text-xs rounded-md px-3 py-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-all whitespace-pre-line text-left content-fit">
                                                        {found.description}
                                                    </span>
                                                </span>
                                            )}
                                        </span>
                                    ) : null;
                                }) : <span className='text-gray-300'>None</span>}
                            </div>
                            <div className="mb-2 flex items-center gap-2 flex-wrap">
                                <span className="font-semibold">Gift Cards:</span>
                                {(form.giftCards || []).length ? (form.giftCards || []).map((code: string) => {
                                    const found = giftCards.find(g => g.code === code);
                                    return found ? (
                                        <span key={code} className="relative group cursor-pointer text-emerald-800 flex items-center gap-1">
                                            {found.name}
                                            {found.code && <span className="ml-1 text-gray-400">[{found.code}]</span>}
                                            {found.description && (
                                                <span className="ml-1">
                                                    <Info className="w-4 h-4 text-emerald-400 group-hover:text-emerald-800 transition" />
                                                    <span className="absolute z-20 left-1/2 -translate-x-1/2 bottom-full mb-2 min-w-[180px] max-w-xs bg-white border border-gray-200 shadow-lg text-gray-900 text-xs rounded-md px-3 py-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-all whitespace-pre-line text-left content-fit">
                                                        {found.description}
                                                    </span>
                                                </span>
                                            )}
                                        </span>
                                    ) : null;
                                }) : <span className='text-gray-300'>None</span>}
                            </div>
                            {form.maxParticipants && form.pricePerAdditional && (
                                <div className="mb-2">
                                    <span className="font-semibold">Price per Additional Participant:</span> <span className="text-neutral-800 text-sm">${form.pricePerAdditional}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
        
        
            {/* Toast notification (top right) */}
            {toast && (
                <div className="fixed top-6 right-6 z-50 animate-fade-in-up">
                    <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
                </div>
            )}
        </div>

            
    );
};

export default CreatePackage;