import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import Toast from "../../../components/ui/Toast";
import { Info, Plus, Calendar, Clock, Gift, Tag, Home, ArrowLeft, Save } from "lucide-react";
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

// Only categories remain in localStorage
const initialCategories = ["Birthday", "Special", "Event", "Arcade Party", "Corporate", "Other"];

const EditPackage: React.FC = () => {
    const { themeColor, fullColor } = useThemeColor();
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [submitting, setSubmitting] = useState(false);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    
    // State for fetched data from backend
    const [attractions, setAttractions] = useState<CreatePackageAttraction[]>([]);
    const [addOns, setAddOns] = useState<CreatePackageAddOn[]>([]);
    const [categories, setCategories] = useState<string[]>(() => JSON.parse(localStorage.getItem("zapzone_categories") || JSON.stringify(initialCategories)));
    const [rooms, setRooms] = useState<CreatePackageRoom[]>([]);
    const [promos, setPromos] = useState<CreatePackagePromo[]>([]);
    const [giftCards, setGiftCards] = useState<CreatePackageGiftCard[]>([]);

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
        availableMonthDays: [] as string[],
        image: "" as string, // base64 or data url
        timeSlotStart: "09:00", // Start time for available time slots
        timeSlotEnd: "17:00", // End time for available time slots
        timeSlotInterval: "30", // Interval between time slots in minutes
    });

    // Image preview state
    const [imagePreview, setImagePreview] = useState<string>("");

    // Fetch options data and then load package data
    useEffect(() => {
        const initializeData = async () => {
            if (!id) {
                setNotFound(true);
                setLoading(false);
                return;
            }

            try {
                // Step 1: Fetch all reference data first
                const [attractionsRes, addOnsRes, roomsRes, promosRes, giftCardsRes] = await Promise.all([
                    attractionService.getAttractions(),
                    addOnService.getAddOns(),
                    roomService.getRooms(),
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

                // Set reference data state
                setAttractions(attractionsData);
                setAddOns(addOnsData);
                setRooms(roomsData);
                setPromos(promosData);
                setGiftCards(giftCardsData);

                // Step 2: Now fetch the package data
                const response = await packageService.getPackage(parseInt(id));
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const pkg = response.data as any; // Using 'any' to handle time slot fields that may not be in type yet
                
                console.log("Loaded package data:", pkg);
                
                if (!pkg) {
                    setNotFound(true);
                    setLoading(false);
                    return;
                }

                // Extract names/codes from relationship objects (backend uses snake_case)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const attractionNames = pkg.attractions?.map((a: any) => typeof a === 'string' ? a : (a.name || '')) || [];
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const promoCodes = pkg.promos?.map((p: any) => typeof p === 'string' ? p : (p.code || '')) || [];
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const giftCardCodes = pkg.gift_cards?.map((g: any) => typeof g === 'string' ? g : (g.code || '')) || [];
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const addOnNames = pkg.add_ons?.map((a: any) => typeof a === 'string' ? a : (a.name || '')) || [];
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const roomNames = pkg.rooms?.map((r: any) => typeof r === 'string' ? r : (r.name || '')) || [];
                
                console.log("Extracted data:", {
                    attractionNames,
                    promoCodes,
                    giftCardCodes,
                    addOnNames,
                    roomNames
                });

                // Convert arrays to strings if needed
                const availableDays = Array.isArray(pkg.available_days) 
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    ? pkg.available_days.map((d: any) => String(d)) 
                    : [];
                const availableWeekDays = Array.isArray(pkg.available_week_days) 
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    ? pkg.available_week_days.map((d: any) => String(d)) 
                    : [];
                const availableMonthDays = Array.isArray(pkg.available_month_days) 
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    ? pkg.available_month_days.map((d: any) => String(d)) 
                    : [];

                // Format time values from HH:MM:SS to HH:MM for HTML time input
                const formatTime = (time: string) => {
                    if (!time) return "09:00";
                    // If time is already in HH:MM format, return as is
                    if (time.length === 5) return time;
                    // If time is in HH:MM:SS format, extract HH:MM
                    return time.substring(0, 5);
                };

                setForm({
                    name: pkg.name || "",
                    description: pkg.description || "",
                    category: pkg.category || "",
                    features: pkg.features || "",
                    attractions: attractionNames,
                    rooms: roomNames,
                    price: String(pkg.price || ""),
                    maxParticipants: String(pkg.max_participants || ""),
                    pricePerAdditional: String(pkg.price_per_additional || ""),
                    duration: String(pkg.duration || ""),
                    durationUnit: pkg.duration_unit || "hours",
                    promos: promoCodes,
                    giftCards: giftCardCodes,
                    addOns: addOnNames,
                    availabilityType: pkg.availability_type || "daily",
                    availableDays: availableDays,
                    availableWeekDays: availableWeekDays,
                    availableMonthDays: availableMonthDays,
                    image: pkg.image || "",
                    timeSlotStart: formatTime(pkg.time_slot_start || "09:00"),
                    timeSlotEnd: formatTime(pkg.time_slot_end || "17:00"),
                    timeSlotInterval: String(pkg.time_slot_interval || "30"),
                });

                if (pkg.image) {
                    setImagePreview(pkg.image);
                }

                setLoading(false);
            } catch (error) {
                console.error("Error loading data:", error);
                showToast("Failed to load package data", "error");
                setNotFound(true);
                setLoading(false);
            }
        };

        initializeData();
    }, [id]);

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

    // On submit, update the package via API
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!id) {
            showToast("Package ID is missing!", "error");
            return;
        }

        // Validation
        if (!form.name.trim()) {
            showToast("Package name is required", "error");
            return;
        }

        if (!form.category) {
            showToast("Please select a category", "error");
            return;
        }

        const price = parseFloat(form.price);
        const pricePerAdditional = parseFloat(form.pricePerAdditional || '0');
        const maxParticipants = parseInt(form.maxParticipants || '0');
        const duration = parseInt(form.duration || '0');
        const timeSlotInterval = parseInt(form.timeSlotInterval || '30');

        if (isNaN(price) || price < 0) {
            showToast("Please enter a valid price", "error");
            return;
        }

        if (form.maxParticipants && (isNaN(maxParticipants) || maxParticipants < 1)) {
            showToast("Please enter a valid max participants (minimum 1)", "error");
            return;
        }

        if (form.pricePerAdditional && (isNaN(pricePerAdditional) || pricePerAdditional < 0)) {
            showToast("Please enter a valid price per additional participant", "error");
            return;
        }

        if (form.duration && (isNaN(duration) || duration < 1)) {
            showToast("Please enter a valid duration", "error");
            return;
        }

        setSubmitting(true);
        try {
            // Get IDs for relationships from the options arrays (matching CreatePackage pattern)
            const attraction_ids = form.attractions
                .map(name => attractions.find(a => a.name === name)?.id)
                .filter(Boolean) as number[];

            const addon_ids = form.addOns
                .map(name => addOns.find(a => a.name === name)?.id)
                .filter(Boolean) as number[];

            const room_ids = form.rooms
                .map(name => rooms.find(r => r.name === name)?.id)
                .filter(Boolean) as number[];

            const promo_ids = form.promos
                .map(code => promos.find(p => p.code === code)?.id)
                .filter(Boolean) as number[];

            const gift_card_ids = form.giftCards
                .map(code => giftCards.find(g => g.code === code)?.id)
                .filter(Boolean) as number[];

            // Prepare data matching CreatePackage structure
            const updateData = {
                name: form.name,
                description: form.description,
                category: form.category,
                features: form.features,
                price: Number(price.toFixed(2)),
                max_participants: maxParticipants,
                price_per_additional: Number(pricePerAdditional.toFixed(2)),
                duration: duration,
                duration_unit: form.durationUnit,
                location_id: 1, // Default location ID
                availability_type: form.availabilityType,
                available_days: form.availabilityType === 'daily' ? form.availableDays : [],
                available_week_days: form.availabilityType === 'weekly' ? form.availableWeekDays : [],
                available_month_days: form.availabilityType === 'monthly' ? form.availableMonthDays : [],
                time_slot_start: form.timeSlotStart || "09:00",
                time_slot_end: form.timeSlotEnd || "17:00",
                time_slot_interval: timeSlotInterval || 30,
                image: form.image || undefined,
                attraction_ids,
                addon_ids,
                room_ids,
                promo_ids,
                gift_card_ids,
            };

            console.log("Updating package with data:", updateData);

            const response = await packageService.updatePackage(parseInt(id), updateData);
            console.log("Update response:", response);
            
            showToast("Package updated successfully!", "success");
            
            // Navigate back after a short delay
            setTimeout(() => {
                navigate("/packages");
            }, 1000);
        } catch (error: unknown) {
            console.error("Error updating package:", error);
            
            // Better error messaging
            let errorMessage = "Error updating package. Please try again.";
            if (error && typeof error === 'object' && 'response' in error) {
                const axiosError = error as { response?: { data?: { message?: string } } };
                errorMessage = axiosError.response?.data?.message || errorMessage;
            }
            
            showToast(errorMessage, "error");
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

    // Not found state
    if (notFound) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">Package Not Found</h2>
                    <p className="text-gray-600 mb-6">The package you're looking for doesn't exist.</p>
                    <Link
                        to="/packages"
                        className={`inline-flex items-center gap-2 bg-${themeColor}-700 hover:bg-${fullColor} text-white px-6 py-2 rounded-lg font-semibold`}
                    >
                        <ArrowLeft size={18} />
                        Back to Packages
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full mx-auto sm:px-4 md:mt-8 pb-6 flex flex-col md:flex-row gap-8 md:gap-12">
            {/* Form Section */}
            <div className="flex-1 mx-auto">
                <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 md:p-8">
                    <div className="flex items-center gap-3 mb-6">
                        <Link
                            to="/packages"
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <ArrowLeft size={24} />
                        </Link>
                        <div>
                            <h2 className="text-2xl sm:text-3xl font-bold text-neutral-900 tracking-tight">Edit Package</h2>
                            <p className="text-sm text-gray-500 mt-1">Update the details of your package deal.</p>
                        </div>
                    </div>
                    
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
                            <h3 className={`text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2`}>
                                <Info className={`w-5 h-5 text-${themeColor}-600`} /> Details
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
                                
                                <div>
                                    <label className="block font-semibold mb-2 text-base text-neutral-800">Description</label>
                                    <textarea
                                        name="description"
                                        value={form.description}
                                        onChange={handleChange}
                                        rows={3}
                                        className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all placeholder:text-gray-400`}
                                        placeholder="Enter package description"
                                    />
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block font-semibold mb-2 text-base text-neutral-800">Category</label>
                                        <select
                                            name="category"
                                            value={form.category}
                                            onChange={handleChange}
                                            className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all`}
                                        >
                                            <option value="">Select category</option>
                                            {categories.map((cat) => (
                                                <option key={cat} value={cat}>{cat}</option>
                                            ))}
                                        </select>
                                    </div>
                                    
                                    <div>
                                        <label className="block font-semibold mb-2 text-base text-neutral-800">Max Participants</label>
                                        <input
                                            type="number"
                                            name="maxParticipants"
                                            value={form.maxParticipants}
                                            onChange={handleChange}
                                            className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all placeholder:text-gray-400`}
                                            min="0"
                                            placeholder="Enter max participants"
                                        />
                                    </div>
                                </div>
                                
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
                                            placeholder="Enter price per additional participant"
                                        />
                                    </div>
                                )}
                                
                                <div>
                                    <label className="block font-semibold mb-2 text-base text-neutral-800">Duration</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            name="duration"
                                            value={form.duration}
                                            onChange={handleChange}
                                            className={`flex-1 rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all placeholder:text-gray-400`}
                                            min="0"
                                            placeholder="Enter duration"
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
                                    <label className="block font-semibold mb-2 text-base text-neutral-800">Features</label>
                                    <textarea
                                        name="features"
                                        value={form.features}
                                        onChange={handleChange}
                                        rows={3}
                                        className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all placeholder:text-gray-400`}
                                        placeholder="Enter package features (comma-separated)"
                                    />
                                </div>
                            </div>
                        </div>
                        
                        {/* Availability Section */}
                        <div>
                            <h3 className={`text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2`}>
                                <Calendar className={`w-5 h-5 text-${themeColor}-600`} /> Availability
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block font-semibold mb-2 text-base text-neutral-800">Availability Type</label>
                                    <select
                                        name="availabilityType"
                                        value={form.availabilityType}
                                        onChange={handleChange}
                                        className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all`}
                                    >
                                        <option value="daily">Daily</option>
                                        <option value="weekly">Weekly</option>
                                        <option value="monthly">Monthly</option>
                                    </select>
                                </div>
                                
                                {form.availabilityType === "daily" && (
                                    <div>
                                        <label className="block font-semibold mb-2 text-base text-neutral-800">Available Days</label>
                                        <div className="flex flex-wrap gap-2">
                                            {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => (
                                                <button
                                                    key={day}
                                                    type="button"
                                                    onClick={() => handleAvailabilityChange("daily", day)}
                                                    className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${
                                                        form.availableDays.includes(day)
                                                            ? `bg-${themeColor}-50 border border-${themeColor}-500 text-${fullColor}`
                                                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                                    }`}
                                                >
                                                    {day}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                
                                {form.availabilityType === "weekly" && (
                                    <div>
                                        <label className="block font-semibold mb-2 text-base text-neutral-800">Available Week Days</label>
                                        <div className="flex flex-wrap gap-2">
                                            {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => (
                                                <button
                                                    key={day}
                                                    type="button"
                                                    onClick={() => handleAvailabilityChange("weekly", day)}
                                                    className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${
                                                        form.availableWeekDays.includes(day)
                                                            ? `bg-${themeColor}-50 border border-${themeColor}-500 text-${fullColor}`
                                                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                                    }`}
                                                >
                                                    Every {day}
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
                                    <h4 className="text-lg font-semibold mb-4 text-neutral-900 flex items-center gap-2">
                                        <Clock className={`w-5 h-5 text-${themeColor}-600`} /> Time Slot Configuration
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
                                    
                                    {/* Preview time slots */}
                                    <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                                        <p className="text-sm font-medium text-gray-700 mb-2">Preview Time Slots:</p>
                                        <div className="flex flex-wrap gap-2">
                                            {(() => {
                                                const slots = [];
                                                const [startHour, startMin] = form.timeSlotStart.split(':').map(Number);
                                                const [endHour, endMin] = form.timeSlotEnd.split(':').map(Number);
                                                const startMinutes = startHour * 60 + startMin;
                                                const endMinutes = endHour * 60 + endMin;
                                                const interval = parseInt(form.timeSlotInterval);
                                                
                                                for (let time = startMinutes; time <= endMinutes - interval; time += interval) {
                                                    const hours = Math.floor(time / 60);
                                                    const mins = time % 60;
                                                    const displayTime = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
                                                    slots.push(
                                                        <span key={time} className="px-2 py-1 bg-white border border-gray-300 rounded text-xs text-gray-700">
                                                            {displayTime}
                                                        </span>
                                                    );
                                                }
                                                
                                                if (slots.length === 0) {
                                                    return <span className="text-xs text-gray-500">No time slots generated. Please check your start/end times.</span>;
                                                }
                                                
                                                return slots;
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div className="border-b border-gray-100 my-2" />
                        
                        {/* Attractions Section */}
                        <div>
                            <h3 className={`text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2`}>
                                <Info className={`w-5 h-5 text-${themeColor}-600`} /> Attractions
                            </h3>
                            {attractions.length === 0 ? (
                                <div className="bg-gray-50 rounded-lg p-4 text-center border border-dashed border-gray-300">
                                    <p className="text-gray-500 mb-3 text-sm">No attractions available yet</p>
                                    <Link
                                        to="/admin/attractions/create"
                                        className={`inline-flex items-center gap-2 bg-${fullColor} text-xs hover:bg-${themeColor}-900 text-white px-4 py-2 rounded-md transition`}
                                    >
                                        <Plus className="w-4 h-4" />
                                        Create Attraction
                                    </Link>
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
                        </div>
                        
                        {/* Rooms Section */}
                        <div>
                            <h3 className={`text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2`}>
                                <Home className={`w-5 h-5 text-${themeColor}-600`} /> Rooms
                            </h3>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {rooms.map((room) => (
                                    <button
                                        key={room.name}
                                        type="button"
                                        onClick={() => handleMultiSelect("rooms", room.name)}
                                        className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-all ${
                                            form.rooms.includes(room.name)
                                                ? `bg-${themeColor}-50 border border-${themeColor}-500 text-${fullColor}`
                                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                        }`}
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
                                <button
                                    type="button"
                                    onClick={() => {
                                        const input = document.getElementById("room-name") as HTMLInputElement;
                                        handleAddOption("room", input?.value || "");
                                        if (input) input.value = "";
                                    }}
                                    className={`px-3 py-1.5 bg-${themeColor}-50 text-${fullColor} rounded-md text-sm font-semibold hover:bg-${themeColor}-100 transition-all flex items-center gap-1`}
                                >
                                    <Plus className="w-4 h-4" /> Add
                                </button>
                            </div>
                        </div>
                        
                        {/* Add-ons Section */}
                        <div>
                            <h3 className={`text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2`}>
                                <Info className={`w-5 h-5 text-${themeColor}-600`} /> Add-ons
                            </h3>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {addOns.map((addon) => (
                                    <button
                                        key={addon.name}
                                        type="button"
                                        onClick={() => handleMultiSelect("addOns", addon.name)}
                                        className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-all ${
                                            form.addOns.includes(addon.name)
                                                ? `bg-${themeColor}-50 border border-${themeColor}-500 text-${fullColor}`
                                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                        }`}
                                    >
                                        {addon.name}
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
                                <button
                                    type="button"
                                    onClick={() => {
                                        const nameInput = document.getElementById("addon-name") as HTMLInputElement;
                                        const priceInput = document.getElementById("addon-price") as HTMLInputElement;
                                        handleAddOption("addon", nameInput?.value || "", "", priceInput?.value || "");
                                        if (nameInput) nameInput.value = "";
                                        if (priceInput) priceInput.value = "";
                                    }}
                                    className={`px-3 py-1.5 bg-${themeColor}-50 text-${fullColor} rounded-md text-sm font-semibold hover:bg-${themeColor}-100 transition-all flex items-center gap-1`}
                                >
                                    <Plus className="w-4 h-4" /> Add
                                </button>
                            </div>
                        </div>
                        
                        {/* Promos Section */}
                        <div>
                            <h3 className={`text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2`}>
                                <Tag className={`w-5 h-5 text-${themeColor}-600`} /> Promos
                            </h3>
                            {promos.length === 0 ? (
                                <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-4 border border-gray-200">
                                    No active promos available. Create promos in the Promo Management section.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {promos.map((promo) => (
                                        <label
                                            key={promo.code}
                                            className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={form.promos.includes(promo.code)}
                                                onChange={() => handleMultiSelectCheckbox('promos', promo.code)}
                                                className="mt-1"
                                            />
                                            <div className="flex-1">
                                                <div className="font-semibold text-neutral-900">{promo.name}</div>
                                                <div className="text-sm text-gray-500">Code: {promo.code}</div>
                                                {promo.description && (
                                                    <div className="text-sm text-gray-600 mt-1">{promo.description}</div>
                                                )}
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                        
                        {/* Gift Cards Section */}
                        <div>
                            <h3 className={`text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2`}>
                                <Gift className={`w-5 h-5 text-${themeColor}-600`} /> Gift Cards
                            </h3>
                            {giftCards.length === 0 ? (
                                <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-4 border border-gray-200">
                                    No active gift cards available. Create gift cards in the Gift Card Management section.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {giftCards.map((giftCard) => (
                                        <label
                                            key={giftCard.code}
                                            className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={form.giftCards.includes(giftCard.code)}
                                                onChange={() => handleMultiSelectCheckbox('giftCards', giftCard.code)}
                                                className="mt-1"
                                            />
                                            <div className="flex-1">
                                                <div className="font-semibold text-neutral-900">{giftCard.name}</div>
                                                <div className="text-sm text-gray-500">Code: {giftCard.code}</div>
                                                {giftCard.description && (
                                                    <div className="text-sm text-gray-600 mt-1">{giftCard.description}</div>
                                                )}
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                        
                        {/* Pricing Section */}
                        <div>
                            <h3 className={`text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2`}>
                                <Info className={`w-5 h-5 text-${themeColor}-600`} /> Pricing
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
                        
                        <div className="flex gap-2 mt-6">
                            <button
                                type="submit"
                                disabled={submitting || loading}
                                className={`flex-1 bg-${fullColor} hover:bg-${themeColor}-900 text-white font-semibold py-2 rounded-md transition text-base flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                <Save className="w-5 h-5" /> {submitting ? 'Updating...' : 'Update Package'}
                            </button>
                            <Link
                                to="/packages"
                                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-2 rounded-md transition text-base flex items-center justify-center gap-2"
                            >
                                Cancel
                            </Link>
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
                            <span className={`font-bold text-2xl text-${themeColor}-600 tracking-tight`}>{form.name || "Package Name"}</span>
                            <span className="text-lg text-gray-500 font-semibold">${form.price || "0"}</span>
                        </div>
                        <div className="text-xs text-gray-500 mb-2">{form.category || "Category"}</div>
                        
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
                        
                        {/* Time Slots in Preview */}
                        <div className="mb-2 flex items-start gap-2">
                            <Clock className="w-4 h-4 text-gray-500 mt-0.5" />
                            <div className="flex-1">
                                <span className="font-semibold">Time Slots:</span>
                                <div className="text-neutral-800 text-sm mt-1">
                                    {form.timeSlotStart && form.timeSlotEnd && form.timeSlotInterval ? (
                                        <span>{form.timeSlotStart} - {form.timeSlotEnd} (every {form.timeSlotInterval} min)</span>
                                    ) : (
                                        <span className="text-gray-400">Not configured</span>
                                    )}
                                </div>
                            </div>
                        </div>
                        
                        <div className="mb-4 text-neutral-800 text-base min-h-[48px]">{form.description || "Package description will appear here"}</div>
                        <div className="mb-2">
                            <span className="font-semibold">Attractions:</span> <span className="text-neutral-800 text-sm">{form.attractions.length > 0
                                ? form.attractions.join(", ")
                                : "No attractions selected"}</span>
                        </div>
                        <div className="mb-2">
                            <span className="font-semibold">Rooms:</span> <span className="text-neutral-800 text-sm">{form.rooms.length > 0
                                ? form.rooms.join(", ")
                                : "No rooms selected"}</span>
                        </div>
                        <div className="mb-2">
                            <span className="font-semibold">Add-ons:</span> <span className="text-neutral-800 text-sm">{form.addOns.length > 0
                                ? form.addOns.join(", ")
                                : "No add-ons selected"}</span>
                        </div>
                        <div className="mb-2 flex items-center gap-2 flex-wrap">
                            <span className="font-semibold">Promos:</span>
                            {(form.promos || []).length ? (form.promos || []).map((code: string) => {
                                const promo = promos.find(p => p.code === code);
                                return promo ? (
                                    <span key={code} className={`px-2 py-1 bg-${themeColor}-100 text-${fullColor} text-xs rounded-md font-semibold`}>
                                        {promo.name}
                                    </span>
                                ) : null;
                            }) : <span className="text-neutral-800 text-sm">No promos selected</span>}
                        </div>
                        <div className="mb-2 flex items-center gap-2 flex-wrap">
                            <span className="font-semibold">Gift Cards:</span>
                            {(form.giftCards || []).length ? (form.giftCards || []).map((code: string) => {
                                const giftCard = giftCards.find(g => g.code === code);
                                return giftCard ? (
                                    <span key={code} className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-md font-semibold">
                                        {giftCard.name}
                                    </span>
                                ) : null;
                            }) : <span className="text-neutral-800 text-sm">No gift cards selected</span>}
                        </div>
                        {form.maxParticipants && form.pricePerAdditional && (
                            <div className="mb-2">
                                <span className="font-semibold">Additional:</span> <span className="text-neutral-800 text-sm">${form.pricePerAdditional} per participant after {form.maxParticipants}</span>
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

export default EditPackage;
