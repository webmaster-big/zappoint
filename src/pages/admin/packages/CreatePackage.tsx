import React, { useState, useEffect } from "react";
import Toast from "../../../components/ui/Toast";
import { Info, Plus, RefreshCcw, Calendar, Clock, Gift, Tag, Home } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useThemeColor } from '../../../hooks/useThemeColor';
import { 
    attractionService, 
    addOnService, 
    roomService, 
    promoService, 
    giftCardService,
    packageService 
} from '../../../services';
import type { 
    CreatePackageAttraction, 
    CreatePackageAddOn, 
    CreatePackageRoom,
    CreatePackagePromo,
    CreatePackageGiftCard
} from '../../../types/createPackage.types';
import { getStoredUser } from "../../../utils/storage";

// Only categories remain in localStorage
const initialCategories = ["Birthday", "Special", "Event"];

const CreatePackage: React.FC = () => {
    const navigate = useNavigate();
    const { themeColor, fullColor } = useThemeColor();
    
    // State for fetched data
    const [attractions, setAttractions] = useState<CreatePackageAttraction[]>([]); // must include id
    const [addOns, setAddOns] = useState<CreatePackageAddOn[]>([]); // must include id
    const [categories, setCategories] = useState<string[]>(() => JSON.parse(localStorage.getItem("zapzone_categories") || JSON.stringify(initialCategories)));
    const [rooms, setRooms] = useState<CreatePackageRoom[]>([]); // must include id
    const [promos, setPromos] = useState<CreatePackagePromo[]>([]); // must include id
    const [giftCards, setGiftCards] = useState<CreatePackageGiftCard[]>([]); // must include id
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Fetch data from database on component mount
    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                
                // Fetch all data in parallel
                const [attractionsRes, addOnsRes, roomsRes, promosRes, giftCardsRes] = await Promise.all([
                    attractionService.getAttractions({user_id: getStoredUser()?.id}),
                    addOnService.getAddOns({user_id: getStoredUser()?.id}),
                    roomService.getRooms({user_id: getStoredUser()?.id}),
                    promoService.getPromos(),
                    giftCardService.getGiftCards()
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
                    name: room.name
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

                setAttractions(attractionsData);
                setAddOns(addOnsData);
                setRooms(roomsData);
                setPromos(promosData);
                setGiftCards(giftCardsData);
            } catch (error) {
                console.error('Error fetching data:', error);
                showToast('Error loading data from server', 'error');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // Form state
    const [form, setForm] = useState({
        name: "",
        description: "",
        category: "",
        features: "",
        attractions: [] as string[],
        rooms: [] as string[],
        price: "",
        maxParticipants: "",
        pricePerAdditional: "",
        duration: "",
        durationUnit: "hours" as "hours" | "minutes",
        promos: [] as string[], // will store promo.code
        giftCards: [] as string[], // will store giftCard.code
        addOns: [] as string[],
        availabilityType: "daily" as "daily" | "weekly" | "monthly",
        availableDays: [] as string[],
        availableWeekDays: [] as string[],
        availableMonthDays: [] as string[], // Format: "Monday-1", "Tuesday-2", "Wednesday-last", etc.
        image: "" as string, // base64 or data url
        timeSlotStart: "09:00", // Start time for available time slots
        timeSlotEnd: "17:00", // End time for available time slots
        timeSlotInterval: "30", // Interval between time slots in minutes
        partialPaymentPercentage: "0", // Percentage for partial payments
        partialPaymentFixed: "0", // Fixed amount for partial payments
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

    // Handle availability selection
    const handleAvailabilityChange = (type: "daily" | "weekly" | "monthly", value: string) => {
        if (type === "daily") {
            setForm(prev => {
                const days = prev.availableDays.includes(value)
                    ? prev.availableDays.filter(d => d !== value)
                    : [...prev.availableDays, value];
                return { ...prev, availableDays: days };
            });
        } else if (type === "weekly") {
            setForm(prev => {
                const days = prev.availableWeekDays.includes(value)
                    ? prev.availableWeekDays.filter(d => d !== value)
                    : [...prev.availableWeekDays, value];
                return { ...prev, availableWeekDays: days };
            });
        } else if (type === "monthly") {
            setForm(prev => {
                const days = prev.availableMonthDays.includes(value)
                    ? prev.availableMonthDays.filter(d => d !== value)
                    : [...prev.availableMonthDays, value];
                return { ...prev, availableMonthDays: days };
            });
        }
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
                    if (!categories.includes(value)) {
                        const updated = [...categories, value];
                        setCategories(updated);
                        localStorage.setItem("zapzone_categories", JSON.stringify(updated));
                        showToast("Category added!", "success");
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
                        showToast("Room added!", "success");
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
        
        setSubmitting(true);
        try {
            // Validate required numeric fields
            const price = parseFloat(form.price);
            const maxParticipants = parseInt(form.maxParticipants);
            const pricePerAdditional = form.pricePerAdditional ? parseFloat(form.pricePerAdditional) : 0;
            const duration = parseInt(form.duration);
            const timeSlotInterval = parseInt(form.timeSlotInterval);

            if (isNaN(price) || price < 0) {
                showToast("Please enter a valid price", "error");
                setSubmitting(false);
                return;
            }

            if (isNaN(maxParticipants) || maxParticipants < 1) {
                showToast("Please enter a valid max participants (minimum 1)", "error");
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
                features: form.features,
                price: Number(price.toFixed(2)), // Ensure 2 decimal places
                max_participants: maxParticipants,
                price_per_additional: Number(pricePerAdditional.toFixed(2)), // Ensure 2 decimal places
                duration: duration,
                duration_unit: form.durationUnit,
                image: form.image,
                status: 'active' as const,
                location_id: 1, // Default location ID - you may want to make this configurable
                availability_type: form.availabilityType,
                available_days: form.availabilityType === 'daily' ? form.availableDays : [],
                available_week_days: form.availabilityType === 'weekly' ? form.availableWeekDays : [],
                available_month_days: form.availabilityType === 'monthly' ? form.availableMonthDays : [],
                time_slot_start: form.timeSlotStart,
                time_slot_end: form.timeSlotEnd,
                time_slot_interval: timeSlotInterval,
                partial_payment_percentage: form.partialPaymentPercentage ? parseInt(form.partialPaymentPercentage) : undefined,
                partial_payment_fixed: form.partialPaymentFixed ? parseInt(form.partialPaymentFixed) : undefined,
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


            await packageService.createPackage(packageData);
            showToast("Package created successfully!", "success");
            
            // Reset form
            setForm({
                name: "",
                description: "",
                category: "",
                features: "",
                attractions: [],
                rooms: [],
                price: "",
                maxParticipants: "",
                pricePerAdditional: "",
                duration: "",
                durationUnit: "hours",
                promos: [],
                giftCards: [],
                addOns: [],
                availabilityType: "daily",
                availableDays: [],
                availableWeekDays: [],
                availableMonthDays: [],
                image: "",
                timeSlotStart: "09:00",
                timeSlotEnd: "17:00",
                timeSlotInterval: "30",
                partialPaymentPercentage: "0",
                partialPaymentFixed: "0",
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
        if (form.availabilityType === "daily") {
            if (form.availableDays.length === 0) return "No days selected";
            if (form.availableDays.length === 7) return "Every day";
            return form.availableDays.map(day => day.substring(0, 3)).join(", ");
        } else if (form.availabilityType === "weekly") {
            if (form.availableWeekDays.length === 0) return "No days selected";
            return form.availableWeekDays.map(day => `Every ${day}`).join(", ");
        } else if (form.availabilityType === "monthly") {
            if (form.availableMonthDays.length === 0) return "No days selected";
            return form.availableMonthDays.map(dayWeek => {
                const [day, week] = dayWeek.split('-');
                const weekSuffix = week === "1" ? "st" : week === "2" ? "nd" : week === "3" ? "rd" : week === "4" ? "th" : "last";
                const weekText = week === "last" ? "Last week" : `${week}${weekSuffix} week`;
                return `${day.substring(0, 3)} (${weekText})`;
            }).join(", ");
        }
        return "Not specified";
    };

    // Format duration for display
    const formatDuration = () => {
        if (!form.duration) return "Not specified";
        return `${form.duration} ${form.durationUnit}`;
    };

    // Generate time slots based on backend logic
    const generateTimeSlots = () => {
        if (!form.duration || !form.timeSlotStart || !form.timeSlotEnd || !form.timeSlotInterval) {
            return [];
        }

        const slots = [];
        const slotDuration = form.durationUnit === 'hours' ? parseInt(form.duration) * 60 : parseInt(form.duration);
        const interval = parseInt(form.timeSlotInterval);
        
        // Parse start and end times
        const [startHour, startMin] = form.timeSlotStart.split(':').map(Number);
        const [endHour, endMin] = form.timeSlotEnd.split(':').map(Number);
        
        let currentMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;
        
        while (currentMinutes < endMinutes) {
            const slotEndMinutes = currentMinutes + slotDuration;
            
            // Only add slot if it fits before end time
            if (slotEndMinutes <= endMinutes) {
                const startH = Math.floor(currentMinutes / 60);
                const startM = currentMinutes % 60;
                const endH = Math.floor(slotEndMinutes / 60);
                const endM = slotEndMinutes % 60;
                
                slots.push({
                    start_time: `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`,
                    end_time: `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`,
                    duration: form.duration,
                    duration_unit: form.durationUnit
                });
            }
            
            currentMinutes += interval;
        }
        
        return slots;
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
                        <h2 className="text-2xl sm:text-3xl font-bold text-neutral-900 tracking-tight">Create Package Deal</h2>
                        <p className="text-sm text-gray-500 mb-8 mt-2">Fill in the details below to create a new package deal.</p>    
                        <form className="space-y-8" onSubmit={handleSubmit} autoComplete="off">
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
                    </div>                                    {/* Duration Section */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block font-semibold mb-2 text-base text-neutral-800">Price per Additional Participant</label>
                                                <input
                                                    type="number"
                                                    name="pricePerAdditional"
                                                    value={form.pricePerAdditional}
                                                    onChange={handleChange}
                                                    className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all placeholder:text-gray-400`}
                                                    min="0"
                                                    placeholder="Enter price for each additional participant"
                                                />
                                            </div>
                                        </div>
                                    )}
                                    
                                    <div>
                                        <label className="block font-semibold mb-2 text-base text-neutral-800">Category</label>
                                        <div className="flex flex-col sm:flex-row gap-2">
                                            <select
                                                name="category"
                                                value={form.category}
                                                onChange={handleChange}
                                                className={`rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base min-w-0 flex-1 transition-all`}
                                                required
                                            >
                                                <option value="">Select category</option>
                                                {categories.map((cat) => (
                                                    <option key={cat} value={cat}>{cat}</option>
                                                ))}
                                            </select>
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
                                                <button type="button" className="p-2 rounded-md hover:bg-gray-100 transition" title="Add category">
                                                    <Plus className="w-4 h-4 text-primary" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    {/* Features input below category */}
                                    <div>
                                        <label className="block font-semibold mb-2 text-base text-neutral-800">Features</label>
                                        <input
                                            type="text"
                                            name="features"
                                            value={form.features}
                                            onChange={handleChange}
                                            className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all placeholder:text-gray-400`}
                                            placeholder="e.g. Free drinks, VIP room, etc."
                                        />
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
                            
                            {/* Availability Section */}
                            <div>
                                <h3 className="text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2 relative group">
                                    <Calendar className="w-5 h-5 text-primary" /> Availability
                                    <span className="absolute z-20 left-0 top-full mt-2 min-w-[250px] max-w-xs bg-gray-900 text-white text-xs rounded-md px-3 py-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-all">
                                        Configure when this package is available for booking (daily, weekly, or monthly schedules)
                                    </span>
                                </h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block font-semibold mb-2 text-base text-neutral-800">Schedule Type</label>
                                        <div className="flex flex-wrap gap-4">
                                            <label className="flex items-center gap-2">
                                                <input
                                                    type="radio"
                                                    name="availabilityType"
                                                    value="daily"
                                                    checked={form.availabilityType === "daily"}
                                                    onChange={handleChange}
                                                    className="accent-primary"
                                                />
                                                <span>Daily</span>
                                            </label>
                                            <label className="flex items-center gap-2">
                                                <input
                                                    type="radio"
                                                    name="availabilityType"
                                                    value="weekly"
                                                    checked={form.availabilityType === "weekly"}
                                                    onChange={handleChange}
                                                    className="accent-primary"
                                                />
                                                <span>Weekly</span>
                                            </label>
                                            <label className="flex items-center gap-2">
                                                <input
                                                    type="radio"
                                                    name="availabilityType"
                                                    value="monthly"
                                                    checked={form.availabilityType === "monthly"}
                                                    onChange={handleChange}
                                                    className="accent-primary"
                                                />
                                                <span>Monthly</span>
                                            </label>
                                        </div>
                                    </div>
                                    
                                    {form.availabilityType === "daily" && (
                                        <div>
                                            <label className="block font-semibold mb-2 text-base text-neutral-800">Available Days</label>
                                            <div className="flex flex-wrap gap-2">
                                                {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(day => (
                                                    <button
                                                        type="button"
                                                        key={day}
                                                        className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-all duration-150 hover:bg-${themeColor}-50 hover:border-${themeColor}-400 focus:outline-none focus:ring-2 focus:ring-${themeColor}-200 ${form.availableDays.includes(day) ? `bg-${themeColor}-50 border-${themeColor}-500 text-${fullColor}` : "bg-white border-gray-200 text-neutral-800"}`}
                                                        onClick={() => handleAvailabilityChange("daily", day)}
                                                    >
                                                        {day.substring(0, 3)}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    
                                    {form.availabilityType === "weekly" && (
                                        <div>
                                            <label className="block font-semibold mb-2 text-base text-neutral-800">Available On</label>
                                            <div className="flex flex-wrap gap-2">
                                                {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(day => (
                                                    <button
                                                        type="button"
                                                        key={day}
                                                        className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-all duration-150 hover:bg-${themeColor}-50 hover:border-${themeColor}-400 focus:outline-none focus:ring-2 focus:ring-${themeColor}-200 ${form.availableWeekDays.includes(day) ? `bg-${themeColor}-50 border-${themeColor}-500 text-${fullColor}` : "bg-white border-gray-200 text-neutral-800"}`}
                                                        onClick={() => handleAvailabilityChange("weekly", day)}
                                                    >
                                                        {day.substring(0, 3)}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    
                                    {form.availabilityType === "monthly" && (
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block font-semibold mb-3 text-base text-neutral-800">Select Day and Week of Month</label>
                                                <p className="text-sm text-gray-500 mb-4">Choose which day(s) of the week and which week(s) of the month this package is available.</p>
                                                
                                                <div className="space-y-4">
                                                    {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(day => (
                                                        <div key={day} className="border border-gray-200 rounded-lg p-4">
                                                            <div className="flex items-center justify-between mb-3">
                                                                <span className="font-medium text-gray-900">{day}</span>
                                                                <span className="text-sm text-gray-500">
                                                                    {form.availableMonthDays.filter(item => item.startsWith(day)).length > 0 
                                                                        ? `${form.availableMonthDays.filter(item => item.startsWith(day)).length} week(s) selected`
                                                                        : 'No weeks selected'
                                                                    }
                                                                </span>
                                                            </div>
                                                            <div className="flex flex-wrap gap-2">
                                                                {["1", "2", "3", "4", "last"].map(week => {
                                                                    const value = `${day}-${week}`;
                                                                    const isSelected = form.availableMonthDays.includes(value);
                                                                    return (
                                                                        <button
                                                                            type="button"
                                                                            key={value}
                                                                            className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-all duration-150 hover:bg-${themeColor}-50 hover:border-${themeColor}-400 focus:outline-none focus:ring-2 focus:ring-${themeColor}-200 ${isSelected ? `bg-${themeColor}-50 border-${themeColor}-500 text-${fullColor}` : "bg-white border-gray-200 text-neutral-800"}`}
                                                                            onClick={() => {
                                                                                setForm(prev => {
                                                                                    const arr = prev.availableMonthDays;
                                                                                    if (arr.includes(value)) {
                                                                                        return { ...prev, availableMonthDays: arr.filter(v => v !== value) };
                                                                                    } else {
                                                                                        return { ...prev, availableMonthDays: [...arr, value] };
                                                                                    }
                                                                                });
                                                                            }}
                                                                        >
                                                                            {week === "last" ? "Last Week" : `${week}${week === "1" ? "st" : week === "2" ? "nd" : week === "3" ? "rd" : "th"} Week`}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    
                                    {/* Time Slot Configuration */}
                                    <div className="mt-6 border-t border-gray-200 pt-6">
                                        <h4 className="text-lg font-semibold mb-4 text-neutral-900 flex items-center gap-2 relative group">
                                            <Clock className="w-5 h-5 text-primary" /> Time Slot Configuration
                                            <span className="absolute z-20 left-0 top-full mt-2 min-w-[250px] max-w-xs bg-gray-900 text-white text-xs rounded-md px-3 py-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-all">
                                                Set the time range and intervals for available booking slots throughout the day
                                            </span>
                                        </h4>
                                        <p className="text-sm text-gray-500 mb-4">Configure the available booking time slots for this package.</p>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <label className="block font-semibold mb-2 text-base text-neutral-800">Start Time</label>
                                                <input
                                                    type="time"
                                                    name="timeSlotStart"
                                                    value={form.timeSlotStart}
                                                    onChange={handleChange}
                                                    className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all`}
                                                />
                                                <p className="text-xs text-gray-500 mt-1">First available time slot</p>
                                            </div>
                                            
                                            <div>
                                                <label className="block font-semibold mb-2 text-base text-neutral-800">End Time</label>
                                                <input
                                                    type="time"
                                                    name="timeSlotEnd"
                                                    value={form.timeSlotEnd}
                                                    onChange={handleChange}
                                                    className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all`}
                                                />
                                                <p className="text-xs text-gray-500 mt-1">Last available time slot</p>
                                            </div>
                                            
                                            <div>
                                                <label className="block font-semibold mb-2 text-base text-neutral-800">Interval (minutes)</label>
                                                <select
                                                    name="timeSlotInterval"
                                                    value={form.timeSlotInterval}
                                                    onChange={handleChange}
                                                    className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all`}
                                                >
                                                    <option value="15">15 minutes</option>
                                                    <option value="30">30 minutes</option>
                                                    <option value="45">45 minutes</option>
                                                    <option value="60">1 hour</option>
                                                    <option value="90">1.5 hours</option>
                                                    <option value="120">2 hours</option>
                                                </select>
                                                <p className="text-xs text-gray-500 mt-1">Time between slots</p>
                                            </div>
                                        </div>
                                        
                                        {/* Time Slot Preview */}
                                        {form.duration && (
                                            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                                <h4 className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
                                                    <Clock className="w-4 h-4" />
                                                    Generated Time Slots Preview
                                                </h4>
                                                {generateTimeSlots().length > 0 ? (
                                                    <>
                                                        <p className="text-xs text-blue-700 mb-3">
                                                            {generateTimeSlots().length} slot(s) available based on your configuration
                                                        </p>
                                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-60 overflow-y-auto">
                                                            {generateTimeSlots().map((slot, idx) => (
                                                                <div
                                                                    key={idx}
                                                                    className="bg-white px-3 py-2 rounded border border-blue-300 text-center"
                                                                >
                                                                    <div className="text-sm font-semibold text-blue-900">
                                                                        {slot.start_time}
                                                                    </div>
                                                                    <div className="text-xs text-gray-500">to</div>
                                                                    <div className="text-sm font-semibold text-blue-900">
                                                                        {slot.end_time}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </>
                                                ) : (
                                                    <p className="text-xs text-blue-700">
                                                        No available slots - check if duration fits within the time range
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            <div className="border-b border-gray-100 my-2" />
                            
            {/* Attractions Section */}
            <div>
                <h3 className="text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2 relative group">
                    <Info className="w-5 h-5 text-primary" /> Additional Attractions
                    <span className="absolute z-20 left-0 top-full mt-2 min-w-[250px] max-w-xs bg-gray-900 text-white text-xs rounded-md px-3 py-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-all">
                        Select extra attractions that customers can add to this package during booking
                    </span>
                </h3>
                {attractions.length === 0 ? (
                    <div className="bg-gray-50 rounded-lg p-4 text-center border border-dashed border-gray-300">
                        <p className="text-gray-500 mb-3 text-sm">No attractions available yet</p>
                        <button
                            type="button"
                            onClick={() => navigate('/admin/attractions/create')}
                            className={`inline-flex items-center gap-2 bg-${fullColor} text-xs hover:bg-${themeColor}-900 text-white px-4 py-2 rounded-md transition`}
                        >
                            <Plus className="w-4 h-4" />
                            Create Attraction
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-2 mb-2">
                        {attractions.map((act) => (
                            <button
                                type="button"
                                key={act.name}
                                className={`px-3 py-1 rounded-full border text-sm font-medium transition-all duration-150 hover:bg-${themeColor}-50 hover:border-${themeColor}-400 focus:outline-none focus:ring-2 focus:ring-${themeColor}-200 ${form.attractions.includes(act.name) ? `bg-${themeColor}-50 border-${themeColor}-500 text-${fullColor}` : "bg-white border-gray-200 text-neutral-800"}`}
                                onClick={() => handleMultiSelect("attractions", act.name)}
                            >
                                {act.name} <span className="text-xs text-gray-400 ml-1">${act.price}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>                            {/* Rooms Section */}
                            <div>
                                <h3 className="text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2 relative group">
                                    <Home className="w-5 h-5 text-primary" /> Rooms
                                    <span className="absolute z-20 left-0 top-full mt-2 min-w-[250px] max-w-xs bg-gray-900 text-white text-xs rounded-md px-3 py-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-all">
                                        Assign specific rooms or spaces where this package can be booked
                                    </span>
                                </h3>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {rooms.map((room) => (
                                        <button
                                            type="button"
                                            key={room.name}
                                            className={`px-3 py-1 rounded-full border text-sm font-medium transition-all duration-150 hover:bg-${themeColor}-50 hover:border-${themeColor}-400 focus:outline-none focus:ring-2 focus:ring-${themeColor}-200 ${form.rooms.includes(room.name) ? `bg-${themeColor}-50 border-${themeColor}-500 text-${fullColor}` : "bg-white border-gray-200 text-neutral-800"}`}
                                            onClick={() => handleMultiSelect("rooms", room.name)}
                                        >
                                            {room.name}
                                        </button>
                                    ))}
                                    <input
                                        type="text"
                                        placeholder="Room name"
                                        className="rounded-md border border-gray-200 px-2 py-1 w-24 bg-white text-sm transition-all placeholder:text-gray-400"
                                        id="room-name"
                                    />
                                    <button type="button" className="p-2 rounded-md hover:bg-blue-50 transition" title="Add room"
                                        onClick={async () => {
                                            const nameInput = document.getElementById('room-name') as HTMLInputElement;
                                            if (nameInput.value) {
                                                await handleAddOption('room', nameInput.value);
                                                nameInput.value = '';
                                            }
                                        }}
                                    >
                                        <Plus className="w-4 h-4 text-blue-600" />
                                    </button>
                                </div>
                            </div>
                            
                            {/* Add-ons Section */}
                            <div>
                                <h3 className="text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2 relative group">
                                    <Info className="w-5 h-5 text-primary" /> Add-ons
                                    <span className="absolute z-20 left-0 top-full mt-2 min-w-[250px] max-w-xs bg-gray-900 text-white text-xs rounded-md px-3 py-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-all">
                                        Optional extras like food, decorations, or party favors that enhance this package
                                    </span>
                                </h3>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {addOns.map((add) => (
                                        <button
                                            type="button"
                                            key={add.name}
                                            className={`px-3 py-1 rounded-full border text-sm font-medium flex items-center gap-2 transition-all duration-150 hover:bg-emerald-50 hover:border-emerald-400/60 focus:outline-none focus:ring-2 focus:ring-emerald-200 ${form.addOns.includes(add.name) ? "bg-emerald-50 border-emerald-400 text-emerald-800" : "bg-white border-gray-200 text-neutral-800"}`}
                                            onClick={() => handleMultiSelect("addOns", add.name)}
                                        >
                                            {add.name} <span className="text-xs text-gray-500">${add.price}</span>
                                        </button>
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
                                    <button type="button" className="p-2 rounded-md hover:bg-emerald-50 transition" title="Add add-on"
                                        onClick={async () => {
                                            const nameInput = document.getElementById('addon-name') as HTMLInputElement;
                                            const priceInput = document.getElementById('addon-price') as HTMLInputElement;
                                            if (nameInput.value) {
                                                await handleAddOption('addon', nameInput.value, '', priceInput.value);
                                                nameInput.value = '';
                                                priceInput.value = '';
                                            }
                                        }}
                                    >
                                        <Plus className="w-4 h-4 text-emerald-600" />
                                    </button>
                                </div>
                            </div>
                            
                            {/* Promos Section */}
                            <div>
                                <h3 className="text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2 relative group">
                                    <Tag className="w-5 h-5 text-primary" /> Promos
                                    <span className="absolute z-20 left-0 top-full mt-2 min-w-[250px] max-w-xs bg-gray-900 text-white text-xs rounded-md px-3 py-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-all">
                                        Link promotional codes that can be applied as discounts for this package
                                    </span>
                                </h3>
                                {promos.length === 0 ? (
                                    <div className="bg-gray-50 rounded-lg p-4 text-center border border-dashed border-gray-300">
                                        <p className="text-gray-500 mb-3 text-sm">No promos available yet</p>
                                        <button
                                            type="button"
                                            onClick={() => navigate('/packages/promos')}
                                            className={`inline-flex items-center gap-2 bg-${fullColor} text-xs hover:bg-${themeColor}-900 text-white px-4 py-2 rounded-md transition`}
                                        >
                                            <Plus className="w-4 h-4" />
                                            Create Promo
                                        </button>
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
                                <h3 className="text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2 relative group">
                                    <Gift className="w-5 h-5 text-primary" /> Gift Cards
                                    <span className="absolute z-20 left-0 top-full mt-2 min-w-[250px] max-w-xs bg-gray-900 text-white text-xs rounded-md px-3 py-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-all">
                                        Associate gift card codes that can be redeemed when booking this package
                                    </span>
                                </h3>
                                {giftCards.length === 0 ? (
                                    <div className="bg-gray-50 rounded-lg p-4 text-center border border-dashed border-gray-300">
                                        <p className="text-gray-500 mb-3 text-sm">No gift cards available yet</p>
                                        <button
                                            type="button"
                                            onClick={() => navigate('/packages/giftcards')}
                                            className={`inline-flex items-center gap-2 bg-${fullColor} text-xs hover:bg-${themeColor}-900 text-white px-4 py-2 rounded-md transition`}
                                        >
                                            <Plus className="w-4 h-4" />
                                            Create Gift Card
                                        </button>
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

                            
                            <div className="flex gap-2 mt-6">
                                <button
                                    type="submit"
                                    disabled={submitting || loading}
                                    className={`flex-1 bg-${fullColor} hover:bg-${themeColor}-900 text-white font-semibold py-2 rounded-md transition text-base flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                    <Plus className="w-5 h-5" /> 
                                    {submitting ? 'Creating...' : 'Submit'}
                                </button>
                                <button
                                    type="button"
                                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-2 rounded-md transition text-base flex items-center justify-center gap-2"
                                    onClick={() => setForm({
                                        name: "",
                                        description: "",
                                        category: "",
                                        features: "",
                                        attractions: [],
                                        rooms: [],
                                        price: "",
                                        maxParticipants: "",
                                        pricePerAdditional: "",
                                        duration: "",
                                        durationUnit: "hours",
                                        promos: [],
                                        giftCards: [],
                                        addOns: [],
                                        availabilityType: "daily",
                                        availableDays: [],
                                        availableWeekDays: [],
                                        availableMonthDays: [],
                                        image: "",
                                        timeSlotStart: "09:00",
                                        timeSlotEnd: "17:00",
                                        timeSlotInterval: "30",
                                        partialPaymentPercentage: "0",
                                        partialPaymentFixed: "0",
                                    })}
                                >
                                    <RefreshCcw className="w-5 h-5" /> Reset
                                </button>
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
                                <span className="font-semibold">Rooms:</span> <span className="text-neutral-800 text-sm">{(form.rooms || []).length ? form.rooms.map((room: string) => {
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